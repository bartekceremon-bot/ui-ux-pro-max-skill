Modele dołączone do repozytorium (nie da się ich odtworzyć w CI bez treningu).

* `deski-kartony-rury-synth.onnx`: YOLO11n-seg dotrenowany 8 epok na 600 syntetycznych
  scenach z `tests/synth.py` (klasy: board, box, pipe). Przykład cyklu trening → wdrożenie.
  Na prawdziwych zdjęciach jest słabszy, patrz README, sekcja 6.

`bundled.json` to wpisy manifestu dla tych plików. `server/export_models.py --bundled`
kopiuje je do `web/public/models/`. Robi to też workflow GitHub Pages.

* `czola-kartony-real-v2.onnx`: YOLO11n-seg, klasy `end` (czoło deski, kłody lub rury) i `box`
  (karton). Douczony z v1 na prawdziwych zdjęciach z Open Images: 51 stosów (auto-oznaczone
  YOLOE), 420 zdjęć kartonów z ręcznymi ramkami, 49 twardych negatywów (drewniane wnętrza
  i meble) oraz sceny syntetyczne.
  * Fałszywe wykrycia na zdjęciach bez stosów spadły 3× względem v1.
  * Na 35 zdjęciach testowych kartonów średni błąd liczenia wynosi ±2.
  * Presety „Deski” i „Rury” używają klasy `end`, a „Kartony” i „Paczki” klasy `box`.

* `deski-v7.onnx`: dedykowany model do desek (klasa `end`, próg 0,45), douczony z v6 na 6
  zdjęciach paczek użytkownika, oznaczonych półautomatycznie: v6 + YOLOE, a dla paczek desek
  z wpustem i piórem `server/plank_split.py` z ręcznie wyznaczonymi kolumnami. Zdjęcia były
  powielone ×12. W aplikacji działa razem z filtrem stosu.
  * Fałszywe wykrycia: 4,6 na zdjęcie w zestawie 60 zdjęć bez stosów (v6: 6,1).
  * Na zdjęciach z nauki liczy blisko oznaczeń, np. 117 desek z wpustem i piórem przy 119
    oznaczonych.
  * Paczka szerokich desek pod kątem, wyjęta z nauki, nadal jest słaba (15).
