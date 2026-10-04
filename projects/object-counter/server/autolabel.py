"""Auto-label stack photos (board / log / pipe ends) for training a counting model.

For each image:
  1. propose candidate items as regions enclosed by edges (CLAHE + Canny),
     keep the most self-consistent ones (dominant size, solid, sensible
     aspect) as *exemplars*;
  2. run YOLOE with those exemplars as in-image visual prompts -- it finds
     every similar item, with instance masks;
  3. write YOLO-seg polygons + an overlay for visual QA.

    python server/autolabel.py --images DIR --out DIR [--exemplars ex.json]

`ex.json` may give hand-picked exemplar boxes per image ({"name.jpg": [[x1,y1,x2,y2], ...]})
that override step 1 -- used when the automatic proposal picks the wrong scale.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np


_fastsam = None


def propose_fastsam(path: str, img: np.ndarray, k: int = 8) -> np.ndarray:
    """Exemplars from FastSAM "segment everything": solid masks of the dominant size."""
    global _fastsam
    from ultralytics import FastSAM
    _fastsam = _fastsam or FastSAM("FastSAM-x.pt")
    H, W = img.shape[:2]
    r = _fastsam.predict(path, imgsz=1024, conf=0.3, iou=0.7, verbose=False, max_det=1000)[0]
    if r.masks is None:
        return np.zeros((0, 4))
    boxes = r.boxes.xyxy.cpu().numpy()
    areas = np.array([cv2.contourArea(p.astype(np.float32)) if len(p) >= 3 else 0 for p in r.masks.xy])
    cands = []
    for b, a in zip(boxes, areas):
        w, h = b[2] - b[0], b[3] - b[1]
        if w <= 2 or h <= 2 or a < 0.0001 * H * W or a > 0.04 * H * W:
            continue
        fill = a / (w * h)
        if fill < 0.6 or not (0.3 < w / h < 3.3):
            continue
        cands.append((*b, a, fill))
    return _pick(cands, k)


def _pick(cands, k):
    if len(cands) < 3:
        return np.zeros((0, 4))
    c = np.array(cands, float)
    la = np.log(c[:, 4])
    best, bi = -1, 0
    for i, v in enumerate(la):
        cnt = np.sum(np.abs(la - v) < 0.35)
        if cnt > best:
            best, bi = cnt, i
    c = c[np.abs(la - la[bi]) < 0.35]
    c = c[np.argsort(-c[:, 5])]
    out = []
    for b in c:
        if all(abs((b[0] + b[2]) - (o[0] + o[2])) + abs((b[1] + b[3]) - (o[1] + o[3])) > (b[2] - b[0]) for o in out):
            out.append(b)
        if len(out) >= k:
            break
    return np.array(out)[:, :4] if len(out) >= 3 else np.zeros((0, 4))


def propose_exemplars(img: np.ndarray, k: int = 8) -> np.ndarray:
    H, W = img.shape[:2]
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    g = cv2.createCLAHE(2.0, (8, 8)).apply(g)
    cands = []
    for lo, hi in ((30, 80), (50, 130)):
        e = cv2.Canny(cv2.GaussianBlur(g, (5, 5), 0), lo, hi)
        e = cv2.dilate(e, np.ones((3, 3), np.uint8))
        n, _, st, _ = cv2.connectedComponentsWithStats((e == 0).astype(np.uint8), 4)
        for i in range(1, n):
            x, y, w, h, a = st[i]
            if a < 0.00015 * H * W or a > 0.03 * H * W:
                continue
            fill = a / (w * h)
            if fill < 0.6 or not (0.33 < w / h < 3):
                continue
            cands.append((x, y, x + w, y + h, a, fill))
    if len(cands) < 3:
        return np.zeros((0, 4))
    c = np.array(cands, float)
    la = np.log(c[:, 4])
    # dominant size = densest window in log-area
    best, bi = -1, 0
    for i, v in enumerate(la):
        cnt = np.sum(np.abs(la - v) < 0.35)
        if cnt > best:
            best, bi = cnt, i
    near = np.abs(la - la[bi]) < 0.35
    c = c[near]
    c = c[np.argsort(-c[:, 5])]  # most solid first
    # spread exemplars across the image, avoid duplicates
    out = []
    for b in c:
        if all(abs((b[0] + b[2]) - (o[0] + o[2])) + abs((b[1] + b[3]) - (o[1] + o[3])) > (b[2] - b[0]) for o in out):
            out.append(b)
        if len(out) >= k:
            break
    return np.array(out)[:, :4] if len(out) >= 3 else np.zeros((0, 4))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--exemplars", default=None)
    ap.add_argument("--conf", type=float, default=0.15)
    ap.add_argument("--weights", default="yoloe-26s-seg.pt")
    ap.add_argument("--rounds", type=int, default=2)
    a = ap.parse_args()

    from ultralytics import YOLOE
    from ultralytics.models.yolo.yoloe import YOLOEVPSegPredictor

    out = Path(a.out)
    (out / "labels").mkdir(parents=True, exist_ok=True)
    (out / "overlay").mkdir(parents=True, exist_ok=True)
    manual = json.loads(Path(a.exemplars).read_text()) if a.exemplars else {}
    model = YOLOE(a.weights)
    report = {}
    for p in sorted(Path(a.images).glob("*.jpg")):
        img = cv2.imread(str(p))
        if img is None:
            continue
        H, W = img.shape[:2]
        if p.name in manual:
            options = [np.array(manual[p.name], float)]
        else:
            # two independent exemplar proposals; keep whichever explains more items
            options = [propose_fastsam(str(p), img), propose_exemplars(img)]
        r, ex = None, None
        for opt in options:
            if len(opt) < 1:
                continue
            res = model.predict(str(p), visual_prompts=dict(bboxes=opt, cls=np.zeros(len(opt), int)),
                                predictor=YOLOEVPSegPredictor, conf=a.conf, imgsz=1024, max_det=1500, verbose=False)[0]
            if r is None or len(res.boxes) > len(r.boxes):
                r, ex = res, opt
        if r is None:
            report[p.name] = {"n": 0, "why": "no exemplars"}
            continue
        # bootstrap: confident detections of *different sizes* become exemplars for a
        # second pass -> covers near (large) and far (small) items of the same kind
        for _ in range(a.rounds):
            if len(r.boxes) < 3:
                break
            b = r.boxes.xyxy.cpu().numpy(); cf = r.boxes.conf.cpu().numpy()
            area = (b[:, 2] - b[:, 0]) * (b[:, 3] - b[:, 1])
            good = cf >= np.quantile(cf, 0.5)
            b, area = b[good], area[good]
            qs = np.quantile(np.log(area), np.linspace(0.05, 0.95, 12))
            idx = sorted({int(np.argmin(np.abs(np.log(area) - q))) for q in qs})
            ex2 = np.vstack([ex, b[idx]])
            r2 = model.predict(str(p), visual_prompts=dict(bboxes=ex2, cls=np.zeros(len(ex2), int)),
                               predictor=YOLOEVPSegPredictor, conf=a.conf, imgsz=1024, max_det=1500, verbose=False)[0]
            if len(r2.boxes) <= len(r.boxes):
                break
            r, ex = r2, ex2
        lines = []
        vis = img.copy()
        if r.masks is not None:
            for poly in r.masks.xy:
                if len(poly) < 3:
                    continue
                poly = cv2.approxPolyDP(poly.astype(np.float32).reshape(-1, 1, 2), 1.0, True).reshape(-1, 2)
                if len(poly) < 3:
                    continue
                norm = poly / [W, H]
                lines.append("0 " + " ".join(f"{v:.5f}" for v in np.clip(norm, 0, 1).reshape(-1)))
                cv2.polylines(vis, [poly.astype(np.int32)], True, (0, 255, 0), max(1, W // 600))
        for x1, y1, x2, y2 in ex:
            cv2.rectangle(vis, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), max(2, W // 300))
        cv2.putText(vis, f"{p.stem} n={len(lines)}", (10, 40), 0, max(0.8, W / 900), (0, 255, 255), 3)
        (out / "labels" / f"{p.stem}.txt").write_text("\n".join(lines))
        cv2.imwrite(str(out / "overlay" / f"{p.stem}.jpg"), vis)
        report[p.name] = {"n": len(lines), "exemplars": ex.round().tolist()}
        print(p.name, len(lines), flush=True)
    (out / "report.json").write_text(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
