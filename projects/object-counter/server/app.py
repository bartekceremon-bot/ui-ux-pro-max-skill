"""Licznik Obiektów -- backend (optional).

The web app does all real-time work in the browser. This server adds what a
phone cannot do on its own:

  * serves the built app + models (one URL for phones on the LAN, HTTPS option)
  * POST /api/models/prompt  bake an open-vocabulary YOLOE model for any text
                             ("Własny obiekt") and register it for the browser
  * POST /api/datasets/{n}   receive calibration datasets exported by the app
  * POST /api/train          fine-tune a dedicated model, export ONNX, deploy
  * POST /api/detect         accurate server-side scan with the PyTorch weights
                             at higher resolution (optional "Policz na serwerze")

Run:
    pip install -r server/requirements.txt
    python server/export_models.py          # once: base models
    (cd web && npm install && npm run build)
    python server/app.py --host 0.0.0.0 --port 8000 [--https]
"""
from __future__ import annotations

import argparse
import io
import json
import shutil
import subprocess
import sys
import threading
import time
import traceback
import uuid
import zipfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware

sys.path.insert(0, str(Path(__file__).resolve().parent))
from modelzoo import DATA_DIR, MODELS_DIR, ROOT, WEIGHTS_DIR, load_manifest, slug  # noqa: E402

VERSION = "0.1.0"
DIST = ROOT / "web" / "dist"

app = FastAPI(title="Licznik Obiektów API", version=VERSION)


class Isolation(BaseHTTPMiddleware):
    """COOP/COEP -> crossOriginIsolated -> multi-threaded WASM inference."""

    async def dispatch(self, request, call_next):
        resp = await call_next(request)
        resp.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        resp.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
        resp.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        return resp


app.add_middleware(Isolation)

# ------------------------------------------------------------------ models
_export_lock = threading.Lock()


class PromptReq(BaseModel):
    prompts: list[str]
    name: str | None = None


@app.get("/api/health")
def health():
    try:
        import torch
        gpu = bool(torch.cuda.is_available())
    except Exception:
        gpu = False
    job = _jobs.get(_current_job) if _current_job else None
    return {"ok": True, "version": VERSION, "gpu": gpu, "training": job}


@app.get("/api/models")
def models():
    return load_manifest()


@app.post("/api/models/prompt")
def prompt_model(req: PromptReq):
    prompts = [p.strip() for p in req.prompts if p.strip()][:16]
    if not prompts:
        raise HTTPException(400, "no prompts")
    from export_models import export_prompt
    with _export_lock:
        entry = export_prompt(prompts, name=req.name)
    return entry


# ------------------------------------------------------------------ datasets
@app.post("/api/datasets/{name}")
async def upload_dataset(name: str, file: UploadFile = File(...)):
    name = slug(name)
    target = DATA_DIR / name
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    raw = await file.read()
    try:
        zf = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile:
        raise HTTPException(400, "not a zip file")
    for info in zf.infolist():
        dest = (target / info.filename).resolve()
        if not str(dest).startswith(str(target.resolve())):  # zip-slip guard
            raise HTTPException(400, f"bad path in zip: {info.filename}")
        if info.is_dir():
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(zf.read(info))
    yaml_path = target / "data.yaml"
    if not yaml_path.exists():
        raise HTTPException(400, "data.yaml missing")
    names = _yaml_names(yaml_path.read_text())
    # ultralytics needs a non-empty val split; reuse train images when tiny
    for sub in ("images", "labels"):
        (target / sub / "val").mkdir(parents=True, exist_ok=True)
    if not any((target / "images" / "val").iterdir()):
        for img in list((target / "images" / "train").iterdir())[:3]:
            shutil.copy(img, target / "images" / "val" / img.name)
            lbl = target / "labels" / "train" / (img.stem + ".txt")
            if lbl.exists():
                shutil.copy(lbl, target / "labels" / "val" / lbl.name)
    yaml_path.write_text(
        f"path: {target.resolve()}\ntrain: images/train\nval: images/val\nnames:\n"
        + "".join(f"  {i}: {n}\n" for i, n in enumerate(names)))
    n_img = sum(1 for _ in (target / "images").rglob("*.jpg"))
    return {"name": name, "images": n_img, "classes": names}


def _yaml_names(text: str) -> list[str]:
    names, inside = {}, False
    for line in text.splitlines():
        if line.strip().startswith("names:"):
            inside = True
            continue
        if inside:
            if not line.startswith(" "):
                break
            k, _, v = line.strip().partition(":")
            names[int(k)] = v.strip()
    return [names[k] for k in sorted(names)]


# ------------------------------------------------------------------ training
class TrainReq(BaseModel):
    dataset: str
    name: str
    epochs: int = 50
    base: str | None = None
    imgsz: int = 640


_jobs: dict[str, dict] = {}
_current_job: str | None = None


def _run_job(job_id: str, req: TrainReq):
    global _current_job
    job = _jobs[job_id]
    job["state"] = "running"

    def log(msg: str):
        job["log"].append(f"{time.strftime('%H:%M:%S')} {msg}")
        del job["log"][:-200]

    try:
        from train import train
        from ultralytics.utils import LOGGER
        import logging

        class _H(logging.Handler):
            def emit(self, record):
                log(record.getMessage())

        h = _H()
        LOGGER.addHandler(h)
        try:
            entry = train(str(DATA_DIR / slug(req.dataset) / "data.yaml"), req.name,
                          base=req.base or "yolo11n-seg.pt", epochs=req.epochs, imgsz=req.imgsz, log=log)
        finally:
            LOGGER.removeHandler(h)
        job["model"] = entry
        job["state"] = "done"
    except Exception as e:  # noqa: BLE001
        job["state"] = "error"
        job["error"] = str(e)
        log(traceback.format_exc())
    finally:
        _current_job = None


@app.post("/api/train")
def start_train(req: TrainReq):
    global _current_job
    if _current_job:
        raise HTTPException(409, "a training job is already running")
    if not (DATA_DIR / slug(req.dataset) / "data.yaml").exists():
        raise HTTPException(404, "dataset not found")
    job_id = uuid.uuid4().hex[:10]
    _jobs[job_id] = {"id": job_id, "state": "queued", "log": [], "name": req.name}
    _current_job = job_id
    threading.Thread(target=_run_job, args=(job_id, req), daemon=True).start()
    return _jobs[job_id]


@app.get("/api/train/{job_id}")
def train_status(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(404, "unknown job")
    return _jobs[job_id]


# ------------------------------------------------------------------ server-side detection
_loaded: dict[str, object] = {}
_detect_lock = threading.Lock()


def _model_for(entry: dict):
    """PyTorch weights when available (any input size), else the ONNX file at its fixed size."""
    if entry["id"] in _loaded:
        return _loaded[entry["id"]]
    from ultralytics import YOLO, YOLOE
    w = entry.get("weights")
    if w and (WEIGHTS_DIR / w).exists():
        if entry.get("prompts"):
            m = YOLOE(str(WEIGHTS_DIR / w))
            m.set_classes(entry["prompts"], m.get_text_pe(entry["prompts"]))
        else:
            m = YOLO(str(WEIGHTS_DIR / w))
        m._oc_imgsz = 1280
    else:
        m = YOLO(str(MODELS_DIR / entry["file"]), task=entry.get("task", "detect"))
        m._oc_imgsz = entry.get("imgsz", 640)
    _loaded[entry["id"]] = m
    return m


@app.post("/api/detect")
async def detect(file: UploadFile = File(...), model: str = Form(...), conf: float = Form(0.35),
                 classes: str | None = Form(None)):
    import numpy as np
    import cv2
    entry = next((e for e in load_manifest()["models"] if e["id"] == model), None)
    if not entry:
        raise HTTPException(404, "unknown model")
    img = cv2.imdecode(np.frombuffer(await file.read(), np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "bad image")
    names = entry["classes"]
    keep = None
    if classes:
        want = {c.lower() for c in json.loads(classes)}
        keep = [i for i, n in enumerate(names) if n.lower() in want] or None
    t0 = time.time()
    with _detect_lock:
        m = _model_for(entry)
        r = m.predict(img, conf=conf, imgsz=m._oc_imgsz, classes=keep, agnostic_nms=True, max_det=2000,
                      iou=0.6, verbose=False)[0]
    b = r.boxes
    dets = [{"x1": float(x1), "y1": float(y1), "x2": float(x2), "y2": float(y2), "score": float(s), "cls": int(c)}
            for (x1, y1, x2, y2), s, c in zip(b.xyxy.tolist(), b.conf.tolist(), b.cls.tolist())]
    return {"dets": dets, "ms": (time.time() - t0) * 1000}


# ------------------------------------------------------------------ static
@app.get("/models/manifest.json")
def manifest_file():
    return JSONResponse(load_manifest(), headers={"Cache-Control": "no-store"})


MODELS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/models", StaticFiles(directory=MODELS_DIR), name="models")
if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="app")
else:
    @app.get("/")
    def no_build():
        return FileResponse(ROOT / "README.md")


def _self_signed(cert_dir: Path) -> tuple[str, str]:
    cert_dir.mkdir(parents=True, exist_ok=True)
    crt, key = cert_dir / "cert.pem", cert_dir / "key.pem"
    if not crt.exists():
        subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "825",
                        "-subj", "/CN=licznik-obiektow.local", "-keyout", str(key), "-out", str(crt)], check=True)
    return str(crt), str(key)


if __name__ == "__main__":
    import uvicorn
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--https", action="store_true", help="self-signed HTTPS (camera on phones needs a secure origin)")
    a = ap.parse_args()
    ssl = _self_signed(ROOT / "server" / "certs") if a.https else (None, None)
    uvicorn.run(app, host=a.host, port=a.port, ssl_certfile=ssl[0], ssl_keyfile=ssl[1])
