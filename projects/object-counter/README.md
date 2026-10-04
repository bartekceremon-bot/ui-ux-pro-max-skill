# Licznik Obiektów — wykrywanie i liczenie obiektów kamerą w czasie rzeczywistym

Aplikacja webowa (PWA) liczy obiekty w kadrze kamery telefonu albo komputera: deski w stosie,
kartony, paczki, rury, palety albo dowolny wskazany obiekt. Każdy obiekt dostaje **osobną ramkę
i numer (#1, #2, …)**. Liczba aktualizuje się na żywo, a **ten sam fizyczny obiekt nie jest liczony
drugi raz**, kiedy poruszasz kamerą.

```
kamera ─► ImageBitmap ─► Web Worker: ONNX Runtime Web (WebGPU / WASM×4)
                          ├─ YOLO-seg / YOLOE  (detekcja + maski instancji)
                          └─ Separator          (rozdzielanie stosu bez modelu)
         ─► detekcje ─► tracker (ByteTrack + kompensacja ruchu kamery)
         ─► ramki #ID + maski + licznik ─► historia (IndexedDB)
```

Cała analiza obrazu działa **lokalnie w przeglądarce**: obraz nigdzie nie jest wysyłany, nie ma
opóźnień sieci, działa offline. Backend w Pythonie jest opcjonalny. Służy do tworzenia modeli dla
własnych obiektów, przyjmowania datasetów, trenowania i dokładniejszego skanu na serwerze.

---

## 1. Co zostało zbudowane

| Funkcja | Gdzie |
|---|---|
| Kamera na żywo (tylna kamera telefonu, 1280×720), podgląd z nakładką | `web/src/main.ts` |
| Inferencja AI w Web Workerze, WebGPU → wielowątkowy WASM (fallback), bez blokowania UI | `web/src/engine/worker.ts` |
| Dekoder YOLO (v8/11/26, YOLOE): boxy, NMS z maskami, maski instancji | `web/src/engine/decode.ts` |
| Usuwanie „ramki na cały stos” (box obejmujący kilka mniejszych detekcji) | `dropGroupBoxes()` |
| **Separator**: rozdzielanie stosu bez modelu (próg adaptacyjny → transformata odległości → watershed) | `web/src/engine/separator.ts` |
| Tracking ByteTrack + Hungarian + Kalman + **kompensacja ruchu kamery** + pamięć obiektów poza kadrem | `web/src/tracking/` |
| LIVE COUNT: liczba w kadrze + „Łącznie (skan)”, czyli suma unikalnych obiektów przy przesuwaniu kamery | |
| COUNT & FREEZE (**POLICZ**): dokładne liczenie kafelkami w natywnej rozdzielczości, zatrzymanie wyniku | `detectAccurate()` |
| **ZRÓB ZDJĘCIE I POLICZ**: pełna rozdzielczość aparatu (ImageCapture) albo wczytanie pliku z galerii | |
| Ręczna korekta wyniku: dotknij ramkę = usuń, dotknij puste miejsce = dodaj | `frozenTap()` |
| Numeracja wyniku w kolejności czytania (rzędami), kolor ramki = pewność, `#12 94%` | `web/src/overlay.ts` |
| Panel: Obiekt / Liczba / Pewność średnia / FPS | |
| Wybór obiektu: Deski, Kartony, Paczki, Palety, Rury, Własny obiekt + wybór silnika i klas | `web/src/presets.ts` |
| Obszar liczenia (ROI): licz tylko w zaznaczonym prostokącie | |
| Historia pomiarów z miniaturą, eksport CSV | `web/src/store.ts` |
| **Kalibracja**: zdjęcia → automatyczne wstępne oznaczenie → edytor ramek → dataset YOLO (ZIP) → trening → wdrożenie | `web/src/dataset.ts`, `server/` |
| Backend FastAPI: modele z opisu tekstowego, datasety, trening, detekcja serwerowa, HTTPS dla telefonów | `server/app.py` |
| Generator scen testowych z ground truth + nagrania „kamery” (.y4m) do testów E2E | `tests/synth.py` |

## 2. Jak działa wykrywanie

Są trzy silniki o tym samym interfejsie (`Detection[]` z boxem, pewnością i opcjonalną maską):

1. **Model AI (YOLO instance segmentation, ONNX)**. Klatka jest skalowana z zachowaniem proporcji
   do 640×640 i przechodzi przez sieć. Wyjście `[1, 4+klasy+32, 8400]` jest dekodowane, potem
   działa NMS. **Maski instancji są używane przy NMS**: jeśli dwa boxy mocno na siebie
   zachodzą, ale maski prawie nie, oba obiekty zostają (pochylone, częściowo zasłonięte deski).
   Ramki obejmujące kilka mniejszych detekcji są usuwane, bo celem są pojedyncze elementy,
   a nie „stos jako całość”.
2. **Tryb dokładny (POLICZ / ZDJĘCIE)**. Analizowany jest cały kadr, a dodatkowo siatka
   nakładających się kafelków w natywnej rozdzielczości (jak SAHI). Detekcje ucięte przez
   wewnętrzną krawędź kafelka są odrzucane (sąsiedni kafelek ma je w całości), a reszta jest
   scalana. Dzięki temu małe, gęsto ułożone obiekty, np. czoła desek w dużym stosie, nie giną
   przy skalowaniu do 640 px.
3. **Separator (bez modelu)** dla elementów widocznych czołowo ze szczelinami między nimi
   (czoła desek, rury, kłody). Działa w trzech wariantach i sam wybiera najbardziej regularny
   wynik: jasne elementy na ciemnym tle, ciemne na jasnym, albo **obszary zamknięte
   krawędziami** (normalizacja kontrastu + Sobel). Ten ostatni sprawdza się na prawdziwych
   stosach, gdzie czoła są raz jasne, raz zacienione. Kroki: próg adaptacyjny → wypełnienie otworów (puste rury) →
   otwarcie morfologiczne → transformata odległości → watershed z łączeniem płytkich basenów →
   scalanie nad-podzielonych regionów → filtr spójności (rozmiar, proporcje, jasność, nasycenie
   koloru), który odrzuca plamy tła. Działa od razu, zanim powstanie dedykowany model.

Silnik dla danego typu obiektu wybierany jest automatycznie: model **wytrenowany na prawdziwych
danych** z pasującą nazwą klasy (np. `board`) → dla desek i rur Separator → model ogólny
z pasującą klasą (YOLOE). Modele demo nie są wybierane automatycznie. Na prawdziwym zdjęciu stosu
zarówno YOLOE (8 różnych opisów), jak i model syntetyczny znalazły 0 desek. Można go zmienić
ręcznie w „Zmień obiekt → Silnik wykrywania”.

## 3. Użyte modele AI

| Model | Rola | Rozmiar |
|---|---|---|
| **YOLO11n-seg** (Ultralytics, COCO 80 klas) | obiekty ogólne (ludzie, auta, butelki, walizki…), test potoku | 11.8 MB |
| **YOLOE-26s-seg** (open-vocabulary, tekst → klasy) | presety: *wooden board, cardboard box, parcel, pallet, pipe…* oraz „Własny obiekt” z dowolnego opisu (serwer wpieka embeddingi MobileCLIP do ONNX; przeglądarka nie potrzebuje enkodera tekstu) | 41.8 MB |
| **Demo: deski/kartony/rury** (YOLO11n-seg dotrenowany, `demo`) | przykład pełnego cyklu „dataset → trening → wdrożenie”, trenowany na danych syntetycznych z `tests/synth.py` (klasy: board, box, pipe) | 11.8 MB |

Wszystkie modele to zwykłe pliki ONNX w `web/public/models/` opisane w `manifest.json`.
Nowy model pojawia się w aplikacji po odświeżeniu strony, bez przebudowy.

## 4. Jak działa tracking (brak podwójnego liczenia)

`web/src/tracking/tracker.ts` + `gmc.ts` + `hungarian.ts`:

* **Kompensacja ruchu kamery (GMC)**: dla każdej analizowanej klatki szacowane jest globalne
  przesunięcie obrazu (block matching SAD na zmniejszonym obrazie w skali szarości, ~15 ms).
  Kara za odejście od poprzedniego ruchu rozstrzyga niejednoznaczność powtarzalnych wzorów,
  bo siatka identycznych desek przesunięta o jedną deskę wygląda prawie tak samo.
* **Współrzędne „świata”**: każdy obiekt ma pozycję w układzie panoramy (klatka + skumulowane
  przesunięcie kamery). Mediana różnic dopasowanych obiektów koryguje dryf GMC.
* **Asocjacja ByteTrack**: najpierw pewne detekcje (algorytm węgierski na IoU), potem słabe
  detekcje mogą tylko *kontynuować* istniejące ścieżki. Rozmyty albo częściowo zasłonięty
  obiekt nie traci ID i nie tworzy duplikatu.
* **Numer dopiero po potwierdzeniu**: obiekt dostaje #ID po 3 kolejnych wykryciach, więc
  jednoklatkowe fałszywe detekcje nie zabierają numerów.
* **Pamięć poza kadrem**: obiekt, który wyszedł z kadru, nie „starzeje się”. Gdy kamera wróci,
  zostaje dopasowany ponownie **z tym samym ID**. Usuwany jest tylko wtedy, gdy powinien być
  widoczny, a przez dłuższy czas nie jest wykrywany.
* **Licznik „Łącznie (skan)”** = liczba potwierdzonych, zapamiętanych obiektów. Pozwala policzyć
  długi stos przesuwając wzdłuż niego kamerę: 3 obiekty w 3 klatkach to 3, a nie 9.

## 5. Uruchomienie

Wymagania: Node 20+, Python 3.10+ (dla backendu i eksportu modeli).

```bash
cd projects/object-counter

# 1) modele (jednorazowo; pobiera wagi z GitHub Ultralytics i eksportuje do ONNX)
python -m venv .venv && . .venv/bin/activate
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu   # lub wersja CUDA
pip install -r server/requirements.txt
python server/export_models.py

# 2) aplikacja web
cd web && npm install && npm run build && cd ..

# 3) serwer (aplikacja + API) – komputer
python server/app.py                       # http://127.0.0.1:8000
# telefon w tej samej sieci (kamera wymaga HTTPS):
python server/app.py --host 0.0.0.0 --port 8443 --https   # https://<IP-komputera>:8443
```

Tryb deweloperski z hot-reload: `cd web && npm run dev` (proxy `/api` → `:8000`;
`HTTPS=1 npm run dev` dla telefonu). Sam katalog `web/dist` można też wystawić na dowolnym
hostingu statycznym z nagłówkami COOP/COEP. Wtedy wszystko działa bez backendu, poza
„Utwórz model AI”, treningiem i skanem serwerowym.

### Testy

```bash
cd web && npm test                         # jednostkowe: dekoder, NMS, tracker, GMC, Separator, ewaluacja
python ../tests/synth.py images            # sceny testowe z ground truth (+ zrzut raw dla ewaluacji)
python ../tests/synth.py video --scene boards_end               # nagranie „kamery” (pan w prawo i z powrotem)
python ../tests/synth.py video --scene boards_end --static --zoom 1
node tests/e2e.mjs --scene boards_end --engine cv              # E2E: Chromium z fałszywą kamerą
node tests/photo.mjs --img ../tests/out/bus.jpg --classes person
```

Własny model z linii poleceń:

```bash
python server/train.py --data dataset/data.yaml --name "Deski v1" --epochs 60   # → ONNX + manifest
python server/export_models.py --prompt "plastic crate"                        # model z opisu
```

## 6. Jak zwiększyć dokładność liczenia desek

Gotowe modele nie znają „pojedynczej deski w stosie”. To jest oczekiwane: na scenach testowych
YOLOE z opisem tekstowym wykrywał 0–14% desek. Droga do wysokiej dokładności:

1. **Zbierz dane z docelowego miejsca**: „Kalibracja → Dodaj zdjęcie”. Co najmniej 50–100 zdjęć
   stosów, różne pory dnia, odległości i kąty, mokre i suche drewno, różne przekroje.
   Celuj w ponad 2000 oznaczonych desek.
2. **Oznaczaj każdą deskę osobno**. Aplikacja wstępnie oznacza zdjęcie bieżącym silnikiem
   (Separator albo poprzedni model), a Ty tylko poprawiasz, co bardzo przyspiesza pracę.
   Dla czół desek wystarczą prostokąty, a dla desek z boku najlepiej poligony (instance
   segmentation).
3. **Trenuj** („Wyślij i trenuj” albo `server/train.py`). Na CPU działa wolno, więc lepiej
   użyć GPU (np. Colab, RTX). Startuj od `yolo11s-seg.pt` lub `yolo11m-seg.pt` przy
   `--imgsz 960–1280`, bo czoła desek są małe. Można zacząć od wag wytrenowanych na danych
   syntetycznych (`--base server/weights/runs/.../best.pt`), co przyspiesza zbieżność.
4. **Sprawdzaj na osobnych stosach** (val) metryką *błąd liczenia* (|wynik−prawda|/prawda),
   nie tylko mAP. Zostaw zdjęcia „trudne”: cień, śnieg, deski różnej długości.
5. Przy liczeniu używaj **POLICZ / ZDJĘCIE** (kafelki w natywnej rozdzielczości), **obszaru
   liczenia** (ROI) i fotografuj możliwie prostopadle do czół.
6. Powtarzaj w pętli: model pomaga oznaczać nowe zdjęcia, nowe zdjęcia poprawiają model
   (active learning).

## 7. Obecne ograniczenia

* **Brak dedykowanego modelu dla prawdziwych desek**. Dołączony model „synth” był trenowany
  wyłącznie na scenach syntetycznych. Pokazuje działający cykl trening → wdrożenie, ale na
  prawdziwych zdjęciach będzie słabszy. Potrzebne są realne dane (punkt 6).
* **Separator** wymaga widocznych szczelin lub krawędzi między elementami i dobrze działa dla
  czół (deski, rury). Dla kartonów i desek widzianych z boku zwykle zawodzi, tam potrzebny
  jest model. Bez ROI może policzyć plamy tła o podobnym rozmiarze.
* **Kompensacja ruchu** modeluje tylko przesunięcie. Duży zoom (podchodzenie do stosu)
  i obrót kamery są obsługiwane gorzej, a przy bardzo szybkim ruchu lub rozmyciu ID mogą się
  zmienić i „Łącznie (skan)” może urosnąć. Do jednoznacznego wyniku służy POLICZ / ZDJĘCIE.
* Wydajność live zależy od urządzenia. YOLO11n w WASM na CPU daje kilka–kilkanaście FPS,
  WebGPU kilkadziesiąt. YOLOE-26s (42 MB) jest ~3× wolniejszy. Modele mają stałe wejście
  640×640, więc dokładność dla małych obiektów zapewnia tryb kafelkowy.
* Silnie zasłonięte obiekty (widoczne w mniej niż ~30%) są często pomijane. Nie da się ich
  policzyć bez założeń o strukturze stosu.
* Historia i próbki kalibracyjne są zapisywane lokalnie (IndexedDB) na jednym urządzeniu.
  Synchronizacji między urządzeniami nie ma, jest eksport CSV i ZIP.
* Trening na backendzie obsługuje jedno zadanie naraz, bez kolejki i bez autoryzacji.
  Backend jest przeznaczony do sieci lokalnej.
