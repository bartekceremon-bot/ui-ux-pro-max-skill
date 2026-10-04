"""Download base weights and export the browser models.

    python server/export_models.py            # COCO general model + open-vocabulary presets
    python server/export_models.py --prompt "plastic crate" --prompt "crate"   # custom object

Models:
  * ``coco-yolo11n-seg``  -- YOLO11n instance segmentation, 80 COCO classes
    (people, cars, bottles, suitcases, books ...). Small (~11 MB), fast.
  * ``yoloe-presets``     -- YOLOE-26 open-vocabulary segmentation with the
    preset vocabulary baked in (boards, boxes, parcels, pallets, pipes).
  * ``yoloe-<prompt>``    -- the same open-vocabulary network with a user text
    prompt baked in (what "Własny obiekt" asks the server for).

Text prompts are encoded once, here, with MobileCLIP; the exported ONNX graph
contains the resulting class embeddings, so the browser needs no text encoder.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from modelzoo import WEIGHTS_DIR, export_onnx, slug  # noqa: E402

# Vocabulary for the open-vocabulary preset model. The web presets select
# classes from this list by name (see web/src/presets.ts).
PRESET_VOCAB = [
    "wooden board", "wooden plank", "end of a wooden board", "lumber",
    "cardboard box", "carton",
    "parcel", "package",
    "wooden pallet", "pallet",
    "pipe", "tube", "end of a pipe",
    "log",
]

YOLOE_BASE = "yoloe-26s-seg.pt"


def _weights(name: str) -> str:
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    p = WEIGHTS_DIR / name
    if not p.exists():
        from ultralytics.utils.downloads import attempt_download_asset
        got = Path(attempt_download_asset(name))
        if got.resolve() != p.resolve():
            got.replace(p)
    return str(p)


def export_coco() -> dict:
    from ultralytics import YOLO
    m = YOLO(_weights("yolo11n-seg.pt"))
    names = [m.names[i] for i in sorted(m.names)]
    return export_onnx(m, "coco-yolo11n-seg", imgsz=640, name="YOLO11n-seg (COCO, 80 klas)",
                       classes=names, source="pretrained", extra={"weights": "yolo11n-seg.pt"})


def export_prompt(prompts: list[str], model_id: str | None = None, name: str | None = None,
                  imgsz: int = 640) -> dict:
    """Bake an open-vocabulary YOLOE model with the given text prompts."""
    import os
    from ultralytics import YOLOE
    cwd = os.getcwd()
    os.chdir(WEIGHTS_DIR)  # MobileCLIP weights are downloaded next to the .pt files
    try:
        m = YOLOE(_weights(YOLOE_BASE))
        m.set_classes(prompts, m.get_text_pe(prompts))
        mid = model_id or "yoloe-" + slug("-".join(prompts))
        return export_onnx(m, mid, imgsz=imgsz, name=name or f"YOLOE: {', '.join(prompts)}",
                           classes=list(prompts), source="open-vocabulary",
                           extra={"base": YOLOE_BASE, "weights": YOLOE_BASE, "prompts": list(prompts)})
    finally:
        os.chdir(cwd)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", action="append", help="custom object text prompt (repeatable)")
    ap.add_argument("--skip-coco", action="store_true")
    ap.add_argument("--skip-presets", action="store_true")
    a = ap.parse_args()
    if a.prompt:
        print(export_prompt(a.prompt))
    else:
        if not a.skip_coco:
            print(export_coco())
        if not a.skip_presets:
            print(export_prompt(PRESET_VOCAB, "yoloe-presets", "YOLOE-26s open-vocabulary (presety)"))
