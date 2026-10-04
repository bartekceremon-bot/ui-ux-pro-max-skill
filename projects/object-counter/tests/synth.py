"""Synthetic test scenes with ground truth for the object counter.

Generates procedural (not photo-real) scenes of the main use cases so the whole
pipeline -- camera -> model -> tracker -> count -- can be tested repeatably,
including camera motion (a panning crop rendered as a .y4m video that Chromium
can play as a fake webcam).

    python tests/synth.py images  --out tests/out          # still images + gt.json
    python tests/synth.py video   --out tests/out --scene boards_end --frames 150
    python tests/synth.py dataset --out datasets/synth --n 600  # YOLO-seg training set

Every object has a ground-truth box, so detection recall/precision and
"is the same object counted twice while panning" can be measured exactly.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import cv2
import numpy as np

# ----------------------------------------------------------------- textures


def _noise(h: int, w: int, rng: np.random.Generator, scale: int = 8) -> np.ndarray:
    small = rng.random((max(2, h // scale), max(2, w // scale))).astype(np.float32)
    return cv2.resize(small, (w, h), interpolation=cv2.INTER_CUBIC)


def background(h: int, w: int, rng: np.random.Generator) -> np.ndarray:
    """Concrete / gravel-ish ground with a lighting gradient."""
    base = np.array(rng.choice([[120, 125, 128], [95, 100, 98], [140, 138, 130]]), np.float32)
    n = 0.6 * _noise(h, w, rng, 4) + 0.4 * _noise(h, w, rng, 32)
    img = base[None, None, :] * (0.75 + 0.5 * n[..., None])
    return img


def wood_side(h: int, w: int, rng: np.random.Generator) -> np.ndarray:
    """Long face of a plank: horizontal grain."""
    tone = np.array([rng.uniform(150, 200), rng.uniform(110, 150), rng.uniform(60, 95)], np.float32)[::-1]
    y = np.arange(h, dtype=np.float32)[:, None]
    x = np.arange(w, dtype=np.float32)[None, :]
    warp = 6 * _noise(h, w, rng, 40)
    grain = 0.5 + 0.5 * np.sin((y + warp * 4) * rng.uniform(0.6, 1.2) + np.sin(x / rng.uniform(60, 120)) * 3)
    img = tone[None, None, :] * (0.82 + 0.18 * grain[..., None]) * (0.9 + 0.2 * _noise(h, w, rng, 6)[..., None])
    return img


def wood_end(h: int, w: int, rng: np.random.Generator) -> np.ndarray:
    """End grain: growth rings around an off-centre pith."""
    tone = np.array([rng.uniform(170, 215), rng.uniform(130, 170), rng.uniform(80, 115)], np.float32)[::-1]
    cy, cx = rng.uniform(-h, 2 * h), rng.uniform(-w, 2 * w)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot(yy - cy, xx - cx) + 3 * _noise(h, w, rng, 10)
    rings = 0.5 + 0.5 * np.sin(r * rng.uniform(0.5, 0.9))
    return tone[None, None, :] * (0.8 + 0.2 * rings[..., None]) * (0.92 + 0.16 * _noise(h, w, rng, 5)[..., None])


def cardboard(h: int, w: int, rng: np.random.Generator) -> np.ndarray:
    tone = np.array([rng.uniform(150, 190), rng.uniform(115, 145), rng.uniform(70, 95)], np.float32)[::-1]
    img = tone[None, None, :] * (0.9 + 0.15 * _noise(h, w, rng, 12)[..., None])
    # packing tape across the middle
    t0, t1 = int(h * 0.42), int(h * 0.58)
    img[t0:t1] = img[t0:t1] * 0.6 + np.array([200, 205, 210], np.float32) * 0.4
    if rng.random() < 0.6:  # shipping label
        lh, lw = int(h * 0.18), int(w * 0.25)
        ly, lx = int(h * 0.12), int(w * rng.uniform(0.1, 0.6))
        img[ly:ly + lh, lx:lx + lw] = 235
        for k in range(3):
            yk = ly + 4 + k * max(3, lh // 4)
            img[yk:yk + 2, lx + 3:lx + lw - 3] = 40
    return img


def shade_edges(tile: np.ndarray, k: float = 0.35, frac: float = 0.08) -> np.ndarray:
    h, w = tile.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.minimum.reduce([yy, xx, h - 1 - yy, w - 1 - xx]) / max(2.0, min(h, w) * frac)
    return tile * (1 - k + k * np.clip(d, 0, 1))[..., None]


def paste(canvas: np.ndarray, tile: np.ndarray, x: int, y: int, mask: np.ndarray | None = None) -> None:
    H, W = canvas.shape[:2]
    h, w = tile.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return
    t = tile[y0 - y:y1 - y, x0 - x:x1 - x]
    if mask is None:
        canvas[y0:y1, x0:x1] = t
    else:
        m = mask[y0 - y:y1 - y, x0 - x:x1 - x, None]
        canvas[y0:y1, x0:x1] = canvas[y0:y1, x0:x1] * (1 - m) + t * m


def drop_shadow(canvas: np.ndarray, x: int, y: int, w: int, h: int, strength: float = 0.45, off: int = 6) -> None:
    H, W = canvas.shape[:2]
    x0, y0, x1, y1 = max(0, x + off), max(0, y + off), min(W, x + w + off), min(H, y + h + off)
    if x1 > x0 and y1 > y0:
        canvas[y0:y1, x0:x1] *= 1 - strength


# ------------------------------------------------------------------- scenes
Box = list  # [x1, y1, x2, y2]


def scene_boards_end(rng, H=900, W=1600, rows=None, cols=None, gap=None):
    """Stack of boards seen from the end (the classic lumber-yard count)."""
    img = background(H, W, rng)
    rows = rows or int(rng.integers(5, 9))
    cols = cols or int(rng.integers(6, 12))
    bw = int(min(W * 0.85 / cols, rng.uniform(90, 150)))
    bh = int(bw * rng.uniform(0.25, 0.45))
    gap = gap if gap is not None else int(rng.integers(2, 10))
    sticker = int(rng.integers(6, 16))  # spacer battens between layers
    stack_w = cols * (bw + gap)
    stack_h = rows * (bh + sticker)
    ox, oy = (W - stack_w) // 2, H - stack_h - int(H * 0.06)
    drop_shadow(img, ox - 10, oy - 10, stack_w + 20, stack_h + 20, 0.55, 0)
    boxes = []
    for r in range(rows):
        y = oy + r * (bh + sticker)
        for c in range(cols):
            jx, jy = int(rng.integers(-3, 4)), int(rng.integers(-2, 3))
            ww, hh = bw + int(rng.integers(-4, 5)), bh + int(rng.integers(-2, 3))
            x = ox + c * (bw + gap) + jx
            tile = shade_edges(wood_end(hh, ww, rng), 0.3, 0.12)
            paste(img, tile, x, y + jy)
            boxes.append([x, y + jy, x + ww, y + jy + hh])
    return img, boxes


def scene_boards_side(rng, H=900, W=1600, n=None):
    """Planks stacked flat, seen from the long side: horizontal strips."""
    img = background(H, W, rng)
    n = n or int(rng.integers(6, 18))
    ph = int(min(H * 0.8 / n, rng.uniform(28, 60)))
    boxes = []
    base_x, base_w = int(W * 0.08), int(W * 0.84)
    y = H - int(H * 0.06) - n * (ph + 2)
    for i in range(n):
        x = base_x + int(rng.integers(-40, 40))
        w = base_w + int(rng.integers(-80, 30))
        tile = shade_edges(wood_side(ph, w, rng), 0.45, 0.25)
        drop_shadow(img, x, y, w, ph, 0.5, 3)
        paste(img, tile, x, y)
        boxes.append([x, y, x + w, y + ph])
        y += ph + int(rng.integers(1, 4))
    return img, boxes


def scene_boxes(rng, H=900, W=1600, rows=None, cols=None):
    img = background(H, W, rng)
    rows = rows or int(rng.integers(2, 5))
    cols = cols or int(rng.integers(3, 7))
    bw = int(min(W * 0.8 / cols, rng.uniform(150, 260)))
    bh = int(bw * rng.uniform(0.6, 0.9))
    ox, oy = (W - cols * bw) // 2, H - rows * bh - int(H * 0.05)
    boxes = []
    for r in range(rows):
        for c in range(cols):
            if r < rows - 1 and rng.random() < 0.12:
                continue  # missing box higher up -> irregular stack
            x = ox + c * bw + int(rng.integers(-8, 9))
            y = oy + r * bh + int(rng.integers(-4, 5))
            ww, hh = bw - int(rng.integers(2, 8)), bh - int(rng.integers(2, 6))
            drop_shadow(img, x, y, ww, hh, 0.4, 4)
            paste(img, shade_edges(cardboard(hh, ww, rng), 0.3, 0.05), x, y)
            boxes.append([x, y, x + ww, y + hh])
    return img, boxes


def scene_pipes(rng, H=900, W=1600, rows=None, cols=None):
    """Bundle of pipes seen from the end: hex-packed rings."""
    img = background(H, W, rng)
    rows = rows or int(rng.integers(4, 8))
    cols = cols or int(rng.integers(6, 12))
    r = int(min(W * 0.4 / cols, H * 0.4 / rows, rng.uniform(35, 60)))
    dy = int(r * math.sqrt(3))
    ox = (W - cols * 2 * r) // 2 + r
    oy = H - int(H * 0.05) - rows * dy
    metal = np.array(rng.choice([[170, 172, 175], [200, 120, 60], [60, 60, 65], [220, 220, 215]]), np.float32)
    boxes = []
    yy, xx = np.mgrid[-r:r + 1, -r:r + 1].astype(np.float32)
    d = np.hypot(yy, xx)
    for i in range(rows):
        for j in range(cols - (i % 2)):
            cx = ox + j * 2 * r + (r if i % 2 else 0)
            cy = oy + i * dy + r
            rr = r - 1
            wall = 0.18 + rng.uniform(-0.04, 0.04)
            outer = np.clip(rr - d + 0.5, 0, 1)
            inner = np.clip(rr * (1 - wall) - d + 0.5, 0, 1)
            light = (0.75 + 0.25 * (xx - yy) / (2 * r))[..., None]
            tile = metal[None, None, :] * light * np.ones((2 * r + 1, 2 * r + 1, 1), np.float32)
            hole = np.full_like(tile, 25.0)
            t = tile * (outer - inner)[..., None] + hole * inner[..., None]
            paste(img, t, cx - r, cy - r, outer)
            boxes.append([cx - rr, cy - rr, cx + rr, cy + rr])
    return img, boxes


def pine_end(h: int, w: int, rng: np.random.Generator) -> np.ndarray:
    """Sawn softwood end: light, low-contrast arcs of an off-board pith, saw marks, dirt."""
    tone = np.array([rng.uniform(175, 225), rng.uniform(135, 175), rng.uniform(70, 110)], np.float32)[::-1]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cy = rng.choice([-1, 1]) * rng.uniform(1.0, 4.0) * h + h / 2
    cx = rng.uniform(-0.5, 1.5) * w
    r = np.hypot(yy - cy, xx - cx) + 2 * _noise(h, w, rng, 6)
    rings = 0.5 + 0.5 * np.sin(r * rng.uniform(0.35, 0.8))
    img = tone[None, None, :] * (0.86 + 0.14 * rings[..., None]) * (0.9 + 0.2 * _noise(h, w, rng, 4)[..., None])
    if rng.random() < 0.35:  # weathered / darker board
        img *= rng.uniform(0.6, 0.85)
    if rng.random() < 0.06:  # spray-paint marking across the end
        col = np.array(rng.choice([[200, 140, 40], [60, 60, 220], [40, 160, 200], [70, 60, 200]]), np.float32)
        a = np.clip(_noise(h, w, rng, 3) * 1.6 - 0.2, 0, 1)[..., None] * rng.uniform(0.5, 0.9)
        img = img * (1 - a) + col * a
    if rng.random() < 0.5:  # row of nail holes / saw tearing near one edge
        y = int(h * rng.choice([0.15, 0.85]))
        for x in range(int(w * 0.05), w, max(4, w // 18)):
            cv2.circle(img, (x, y), max(1, h // 14), (60, 50, 40), -1)
    return img


def scene_planks_tight(rng, H=900, W=1600, cols=None):
    """Sawn-timber package seen from the end: columns of thin planks packed tight,
    columns staggered, hair-line dark seams (the classic lumber-yard count)."""
    img = background(H, W, rng) * rng.uniform(0.5, 0.9)
    cols = cols or int(rng.integers(4, 10))
    bw = int(rng.uniform(70, 150))
    bh = max(10, int(bw / rng.uniform(2.5, 6.5)))
    rows = int(rng.integers(8, max(9, min(26, (H * 0.8) // bh))))
    seam = int(rng.integers(1, 4))
    stack_w = cols * (bw + seam)
    ox = (W - stack_w) // 2 + int(rng.integers(-W // 8, W // 8))
    oy = int(H * rng.uniform(0.05, 0.15))
    # side face of the package (long faces of the outer boards) to the left
    side_w = int(rng.uniform(0, 0.35) * W)
    if side_w > 20:
        side = wood_side(rows * (bh + seam), side_w, rng) * 1.05
        paste(img, side, ox - side_w, oy)
    seam_col = rng.uniform(25, 70)
    img[oy:oy + rows * (bh + seam) + bh, max(0, ox):ox + stack_w] = seam_col  # dark gaps behind the boards
    boxes = []
    for c in range(cols):
        x = ox + c * (bw + seam) + int(rng.integers(-2, 3))
        stagger = int(rng.integers(0, bh))
        n = rows - int(rng.integers(0, 3))
        for r in range(n):
            y = oy + stagger + r * (bh + seam)
            ww = bw + int(rng.integers(-3, 4)); hh = bh + int(rng.integers(-1, 2))
            if y + hh > H or x + ww > W or x < 0:
                continue
            tile = shade_edges(pine_end(hh, ww, rng), 0.25, 0.1)
            paste(img, tile, x, y)
            boxes.append([x, y, x + ww, y + hh])
    return img, boxes


SCENES = {
    "boards_end": scene_boards_end,
    "boards_side": scene_boards_side,
    "boxes": scene_boxes,
    "pipes": scene_pipes,
    "planks_tight": scene_planks_tight,
}


def finish(img: np.ndarray, rng: np.random.Generator, light: float = 1.0) -> np.ndarray:
    """Camera-ish degradations: global light, vignetting, sensor noise, slight blur."""
    H, W = img.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    vig = 1 - 0.35 * (((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2) * 2
    img = img * vig[..., None] * light
    img = img + rng.normal(0, 4, img.shape)
    img = cv2.GaussianBlur(np.clip(img, 0, 255).astype(np.uint8), (3, 3), 0)
    return img


# ---------------------------------------------------------------- outputs
# class ids shared with server/presets (data.yaml written by cmd_dataset)
CLASS_OF_SCENE = {"boards_end": 0, "boards_side": 0, "boxes": 1, "pipes": 2, "planks_tight": 0}
CLASS_NAMES = ["board", "box", "pipe"]


def _polygon(scene: str, b: Box) -> np.ndarray:
    x1, y1, x2, y2 = b
    if scene == "pipes":
        cx, cy, r = (x1 + x2) / 2, (y1 + y2) / 2, (x2 - x1) / 2
        a = np.linspace(0, 2 * np.pi, 16, endpoint=False)
        return np.stack([cx + r * np.cos(a), cy + r * np.sin(a)], 1)
    return np.array([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], np.float64)


def cmd_dataset(out: Path, seed: int, n: int, size: int, val_frac: float = 0.15, scenes: list[str] | None = None) -> None:
    """Domain-randomised YOLO-seg dataset: random scene, random crop/zoom,
    random perspective, random lighting. Labels are polygons (rect / circle)."""
    rng = np.random.default_rng(seed)
    for split in ("train", "val"):
        (out / "images" / split).mkdir(parents=True, exist_ok=True)
        (out / "labels" / split).mkdir(parents=True, exist_ok=True)
    names = scenes or list(SCENES)
    for i in range(n):
        scene = names[i % len(names)]
        img, boxes = SCENES[scene](rng)
        img = finish(img, rng, float(rng.uniform(0.5, 1.4)))
        H, W = img.shape[:2]
        bx = np.array(boxes, np.float64)
        # crop around a random part of the stack, zoom 1x-3x
        sx0, sy0 = bx[:, 0].min(), bx[:, 1].min()
        sx1, sy1 = bx[:, 2].max(), bx[:, 3].max()
        zoom = rng.uniform(1.0, 3.0)
        cw = min(W, (sx1 - sx0) * rng.uniform(1.05, 1.5) / zoom)
        ch = min(H, cw * rng.uniform(0.55, 1.0))
        cx = rng.uniform(sx0 + cw * 0.3, max(sx0 + cw * 0.3 + 1, sx1 - cw * 0.3))
        cy = rng.uniform(sy0 + ch * 0.3, max(sy0 + ch * 0.3 + 1, sy1 - ch * 0.3))
        x0 = float(np.clip(cx - cw / 2, 0, W - cw))
        y0 = float(np.clip(cy - ch / 2, 0, H - ch))
        src = np.float32([[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + ch], [x0, y0 + ch]])
        out_h = int(size * ch / cw) // 32 * 32 or 32
        j = 0.06 * size
        dst = np.float32([[0, 0], [size, 0], [size, out_h], [0, out_h]]) + rng.uniform(-j, j, (4, 2)).astype(np.float32)
        Mx = cv2.getPerspectiveTransform(src, dst)
        warped = cv2.warpPerspective(img, Mx, (size, out_h), borderMode=cv2.BORDER_REFLECT)
        if rng.random() < 0.3:
            warped = cv2.GaussianBlur(warped, (5, 5), rng.uniform(0.5, 1.5))
        lines = []
        for b in boxes:
            poly = cv2.perspectiveTransform(_polygon(scene, b)[None].astype(np.float32), Mx)[0]
            area_full = cv2.contourArea(poly)
            clipped = np.clip(poly, [0, 0], [size - 1, out_h - 1]).astype(np.float32)
            if area_full <= 0 or cv2.contourArea(clipped) < 0.5 * area_full or cv2.contourArea(clipped) < 40:
                continue  # mostly outside the crop -> not labelled
            norm = clipped / [size, out_h]
            lines.append(f"{CLASS_OF_SCENE[scene]} " + " ".join(f"{v:.5f}" for v in norm.reshape(-1)))
        split = "val" if rng.random() < val_frac else "train"
        cv2.imwrite(str(out / "images" / split / f"s{i:05d}.jpg"), warped, [cv2.IMWRITE_JPEG_QUALITY, 88])
        (out / "labels" / split / f"s{i:05d}.txt").write_text("\n".join(lines))
    (out / "data.yaml").write_text(
        f"path: {out.resolve()}\ntrain: images/train\nval: images/val\nnames:\n"
        + "".join(f"  {k}: {v}\n" for k, v in enumerate(CLASS_NAMES)))
    print(f"dataset: {n} images -> {out}")



def cmd_images(out: Path, seed: int, per_scene: int) -> None:
    out.mkdir(parents=True, exist_ok=True)
    gt = {}
    rng = np.random.default_rng(seed)
    for name, fn in SCENES.items():
        for k in range(per_scene):
            img, boxes = fn(rng)
            light = [1.0, 0.55, 1.35][k % 3]  # normal / dim / overexposed
            img = finish(img, rng, light)
            fname = f"{name}_{k}.jpg"
            cv2.imwrite(str(out / fname), img, [cv2.IMWRITE_JPEG_QUALITY, 90])
            gt[fname] = {"scene": name, "count": len(boxes), "light": light, "boxes": boxes}
    (out / "gt.json").write_text(json.dumps(gt, indent=1))
    print(f"wrote {len(gt)} images to {out}")


def write_y4m(path: Path, frames: list[np.ndarray], fps: int = 15) -> None:
    h, w = frames[0].shape[:2]
    with open(path, "wb") as f:
        f.write(f"YUV4MPEG2 W{w} H{h} F{fps}:1 Ip A1:1 C420jpeg\n".encode())
        for fr in frames:
            yuv = cv2.cvtColor(fr, cv2.COLOR_BGR2YUV_I420)
            f.write(b"FRAME\n")
            f.write(yuv.tobytes())


def cmd_video(out: Path, seed: int, scene: str, frames: int, w: int, h: int, static: bool = False,
              zoom: float = 1.9) -> None:
    """Render a big scene once, then pan a camera window across it and back.

    The ground truth answers: how many distinct objects appear in the clip,
    and how many are visible in each frame.
    """
    out.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(seed)
    big, boxes = SCENES[scene](rng, H=int(h * 1.25), W=int(w * zoom))
    big = finish(big, rng)
    BH, BW = big.shape[:2]
    seq, per_frame, seen = [], [], set()
    for i in range(frames):
        t = i / max(1, frames - 1)
        u = 0.5 if static else 0.5 - 0.5 * math.cos(2 * math.pi * t)  # 0 -> 1 -> 0 (pan right and back)
        x0 = int(u * (BW - w))
        y0 = int((BH - h) * (0.5 + (0 if static else 0.4) * math.sin(4 * math.pi * t)))  # small vertical shake
        crop = big[y0:y0 + h, x0:x0 + w].copy()
        crop = np.clip(crop.astype(np.float32) * (0.9 + 0.2 * math.sin(2 * math.pi * t * 1.5)), 0, 255).astype(np.uint8)
        seq.append(crop)
        vis = []
        for k, (a, b, c, d) in enumerate(boxes):
            iw = max(0, min(c, x0 + w) - max(a, x0))
            ih = max(0, min(d, y0 + h) - max(b, y0))
            if iw * ih >= 0.6 * (c - a) * (d - b):  # "visible" = 60% inside frame
                vis.append(k)
                seen.add(k)
        per_frame.append(len(vis))
    tag = scene + ("_static" if static else "")
    write_y4m(out / f"{tag}.y4m", seq)
    cv2.imwrite(str(out / f"{tag}_frame0.jpg"), seq[0])
    meta = {"scene": scene, "frames": frames, "total_objects_in_scene": len(boxes),
            "distinct_visible": len(seen), "visible_per_frame": per_frame}
    (out / f"{tag}_video.json").write_text(json.dumps(meta))
    print(json.dumps({k: v for k, v in meta.items() if k != "visible_per_frame"}))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["images", "video", "dataset"])
    ap.add_argument("--n", type=int, default=600)
    ap.add_argument("--size", type=int, default=640)
    ap.add_argument("--scenes", default=None, help="comma-separated subset of scenes for `dataset`")
    ap.add_argument("--out", type=Path, default=Path("tests/out"))
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--per-scene", type=int, default=3)
    ap.add_argument("--scene", default="boards_end", choices=list(SCENES))
    ap.add_argument("--frames", type=int, default=150)
    ap.add_argument("--width", type=int, default=640)
    ap.add_argument("--height", type=int, default=480)
    ap.add_argument("--static", action="store_true", help="no camera motion (for Count & Freeze tests)")
    ap.add_argument("--zoom", type=float, default=1.9, help="scene width as a multiple of the frame width")
    a = ap.parse_args()
    if a.cmd == "images":
        cmd_images(a.out, a.seed, a.per_scene)
    elif a.cmd == "dataset":
        cmd_dataset(a.out, a.seed, a.n, a.size, scenes=a.scenes.split(",") if a.scenes else None)
    else:
        cmd_video(a.out, a.seed, a.scene, a.frames, a.width, a.height, a.static, a.zoom)
