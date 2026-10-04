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
