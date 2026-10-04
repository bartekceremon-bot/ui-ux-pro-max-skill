"""Train (fine-tune) a dedicated counting model and deploy it to the web app.

    python server/train.py --data path/to/data.yaml --name deski-v1 \
        --base yolo11n-seg.pt --epochs 60 --imgsz 640

``data.yaml`` is a standard Ultralytics dataset (YOLO txt labels, boxes or
polygons). Datasets exported from the app ("Kalibracja" -> "Eksportuj ZIP" or
uploaded to the server) are already in that format.

After training the best checkpoint is exported to ONNX, copied into
``web/public/models`` and registered in ``manifest.json`` -- reload the app and
pick the model under "Zmień obiekt -> Model AI".
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from modelzoo import WEIGHTS_DIR, export_onnx, slug  # noqa: E402


def train(data: str, name: str, base: str = "yolo11n-seg.pt", epochs: int = 60, imgsz: int = 640,
          batch: int = 16, device: str | None = None, workers: int = 4, patience: int = 20,
          log=print) -> dict:
    from ultralytics import YOLO

    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    local = WEIGHTS_DIR / base
    model = YOLO(str(local) if local.exists() else base)  # else: ultralytics downloads it
    log(f"training {name} from {base} on {data} for {epochs} epochs @ {imgsz}")
    model.train(
        data=data, epochs=epochs, imgsz=imgsz, batch=batch, device=device, workers=workers,
        patience=patience, project=str(WEIGHTS_DIR / "runs"), name=slug(name), exist_ok=True,
        # stacks of identical items: many objects per image, keep a lot of predictions
        max_det=1000, close_mosaic=5, plots=False,
        # wood / cardboard colours vary a lot with light -> strong colour aug
        hsv_h=0.03, hsv_s=0.6, hsv_v=0.5, degrees=5, perspective=0.0005, fliplr=0.5, flipud=0.2,
    )
    run = WEIGHTS_DIR / "runs" / slug(name)
    best = run / "weights" / "best.pt"
    trained = YOLO(str(best))
    names = trained.names
    classes = [names[i] for i in sorted(names)]
    metrics = {}
    res = run / "results.csv"
    if res.exists():
        rows = [r.split(",") for r in res.read_text().strip().splitlines()]
        head, last = [h.strip() for h in rows[0]], rows[-1]
        metrics = {h: float(v) for h, v in zip(head, last) if "mAP" in h}
    entry = export_onnx(trained, slug(name), imgsz=imgsz, name=name, classes=classes,
                        source="trained", extra={"base": base, "metrics": metrics, "data": str(data),
                               "weights": str(best.relative_to(WEIGHTS_DIR))})
    log("deployed " + json.dumps(entry, ensure_ascii=False))
    return entry


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--base", default="yolo11n-seg.pt")
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--device", default=None)
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    train(a.data, a.name, a.base, a.epochs, a.imgsz, a.batch, a.device, a.workers)
