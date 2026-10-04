"""Model registry shared by the API server, the exporter and the trainer.

All browser-loadable models live in ``web/public/models`` as ONNX files and are
described by ``manifest.json`` in the same folder. The web app reads the
manifest at startup, so a freshly trained or exported model shows up in the
app without rebuilding it.
"""
from __future__ import annotations

import json
import re
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "web" / "public" / "models"
WEIGHTS_DIR = ROOT / "server" / "weights"  # .pt files (base weights, training outputs)
DATA_DIR = ROOT / "server" / "data"  # datasets uploaded from the app
MANIFEST = MODELS_DIR / "manifest.json"

_lock = threading.Lock()


def slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:48] or "model"


def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {"models": []}


def register(entry: dict) -> dict:
    """Insert or replace a manifest entry (keyed by id)."""
    entry.setdefault("created", time.strftime("%Y-%m-%dT%H:%M:%S"))
    with _lock:
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        m = load_manifest()
        m["models"] = [e for e in m["models"] if e["id"] != entry["id"]] + [entry]
        MANIFEST.write_text(json.dumps(m, indent=2, ensure_ascii=False))
    return entry


def export_onnx(model, model_id: str, *, imgsz: int = 640, name: str, classes: list[str],
                source: str, extra: dict | None = None) -> dict:
    """Export an ultralytics model to ONNX in MODELS_DIR and register it.

    Uses a fixed input size, opset 17 and the raw (non-NMS) head so the browser
    decoder in ``web/src/engine/decode.ts`` can handle every model the same
    way: output0 = [1, 4 + nc (+ 32 mask coeffs), N], output1 = mask protos.
    """
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    # nms left at its default (None) -> YOLO26/YOLOE-26 heads export their raw
    # one-to-many branch, identical in layout to YOLO11.
    path = Path(model.export(format="onnx", imgsz=imgsz, opset=17, simplify=True, dynamic=False))
    target = MODELS_DIR / f"{model_id}.onnx"
    path.replace(target)
    task = getattr(model, "task", "detect")
    entry = {
        "id": model_id,
        "name": name,
        "file": target.name,
        "task": "segment" if task == "segment" else "detect",
        "imgsz": imgsz,
        "classes": classes,
        "source": source,
        "sizeMB": round(target.stat().st_size / 1e6, 1),
    }
    entry.update(extra or {})
    return register(entry)
