# Aleja Pixel City

Gra HTML w jednym pliku, zbudowana na koncepcji makiety `PIXEL CITY — Aleja`:
jedna długa aleja podzielona na 300 działek, rysowana w rzucie skośnym, z pełnym
cyklem doby i bobrem przebiegającym przez ruch uliczny.

## Co zostało z pierwowzoru

Aleja i jej geometria, pięć poziomów zabudowy po stronie ulicy i pięć lokali po
stronie parku, neony, billboardy, szyldy z nazwą, ranking, minimapa, doba, ruch
uliczny, przechodnie, pies i minigra z bobrem.

## Co jest nowe

- **Ekonomia miasta.** Każdy budynek płaci czynsz co sekundę, także w trakcie
  biegu. Mnożą go lokalizacja na alei, sąsiedzi po bokach, zabudowanie dzielnicy,
  neon po zmierzchu i billboard.
- **Drugi czasownik w biegu.** Poza skokiem jest ślizg. Barierki i banery wiszą
  za wysoko, żeby je przeskoczyć zwykłym skokiem, więc trzeba przejść pod nimi.
- **Kombo.** Każda ominięta przeszkoda podbija mnożnik do x5. Od x3 żetony liczą
  się podwójnie i bóbr dostaje linie prędkości.
- **Kontrakty miejskie.** Trzy zadania naraz, po odebraniu nagrody wchodzi nowe.
- **Więcej ulepszeń.** Buty sprinterskie, torba na żetony i kamizelka obok
  mocniejszych łap, podwójnego skoku, kasku i magnesu.
- **Rozbudowa i wyburzanie** istniejących budynków zamiast jednorazowej rezerwacji.
- **Pogoda, godziny szczytu i premia nocna** za bieg zaczęty po zmroku.
- **Pierwszy plan parku** z latarniami, ławkami i drzewami oraz sekwencja startowa.

## Czego nie ma

Pierwowzór pobierał opłaty w kryptowalucie na wpisany na stałe adres portfela.
Tu tego nie ma. PXT jest walutą wewnątrz gry: zdobywasz go biegiem, czynszem
i kontraktami. Nie ma podłączania portfela, żadnej transakcji ani adresu odbiorcy.

## Uruchomienie

Otwórz `index.html` w przeglądarce. Nie ma zależności ani kroku budowania.
Stan miasta zapisuje się w `localStorage` przeglądarki gracza.

## Sterowanie

| Akcja | Dotyk | Klawiatura |
| --- | --- | --- |
| Skok | tapnięcie | spacja, W, strzałka w górę |
| Ślizg | przeciągnięcie w dół | S, strzałka w dół |
| Przesuwanie alei | przeciągnięcie | strzałki lewo i prawo |
| Zoom | uszczypnięcie | kółko myszy |
| Bieg, ulepszenia, kontrakty, ranking, wolna działka, pomoc | szyna po lewej | R, U, K, L, F, H |
