Modele dołączone do repozytorium (nie da się ich odtworzyć w CI bez treningu).

* `deski-kartony-rury-synth.onnx`: YOLO11n-seg dotrenowany 8 epok na 600 syntetycznych
  scenach z `tests/synth.py` (klasy: board, box, pipe). Przykład cyklu trening → wdrożenie.
  Na prawdziwych zdjęciach jest słabszy, patrz README, sekcja 6.

`bundled.json` to wpisy manifestu dla tych plików. `server/export_models.py --bundled`
kopiuje je do `web/public/models/`. Robi to też workflow GitHub Pages.
