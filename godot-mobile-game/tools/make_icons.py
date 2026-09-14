#!/usr/bin/env python3
"""Generates the Android launcher icons from the same shapes as icon.svg.

Run with:  python3 tools/make_icons.py
Requires:  pillow
"""
import os
from PIL import Image, ImageDraw

SS = 4  # supersampling factor for clean edges
BG_TOP = (7, 10, 24)
BG_BOTTOM = (26, 20, 62)
CYAN = (34, 230, 255)
MAGENTA = (255, 62, 165)
AMBER = (255, 193, 61)
OUT = os.path.join(os.path.dirname(__file__), "..", "icons")


def gradient(size):
    img = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(size - 1, 1)
        c = tuple(int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3))
        d.line([(0, y), (size, y)], fill=c + (255,))
    return img


def triangle(d, cx, cy, r, color, width):
    pts = [(cx, cy - r), (cx + r * 0.92, cy + r * 0.72), (cx - r * 0.92, cy + r * 0.72)]
    d.polygon(pts, outline=color + (255,), width=width)


def glyph(size, scale=1.0):
    """Neon ship on a transparent background."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = size / 2
    r = size * 0.28 * scale
    # Soft outer glow built from stacked translucent triangles.
    for i in range(5, 0, -1):
        a = int(26 * (1 - i / 6))
        pts = [(cx, cy - r * (1 + i * 0.05)),
               (cx + r * 0.92 * (1 + i * 0.05), cy + r * 0.72 * (1 + i * 0.05)),
               (cx - r * 0.92 * (1 + i * 0.05), cy + r * 0.72 * (1 + i * 0.05))]
        d.polygon(pts, fill=CYAN + (a,))
    triangle(d, cx, cy, r, CYAN, max(3, int(size * 0.035)))
    inner = [(cx, cy - r * 0.42), (cx + r * 0.52, cy + r * 0.45), (cx - r * 0.52, cy + r * 0.45)]
    d.polygon(inner, fill=MAGENTA + (255,))
    rr = r * 0.16
    d.ellipse([cx - rr, cy + r * 0.10 - rr, cx + rr, cy + r * 0.10 + rr], fill=AMBER + (255,))
    return img


def rounded(img, radius_ratio=0.22):
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1],
                                           radius=int(size * radius_ratio), fill=255)
    img.putalpha(mask)
    return img


def save(img, name, target):
    img = img.resize((target, target), Image.LANCZOS)
    path = os.path.normpath(os.path.join(OUT, name))
    img.save(path)
    print("wrote", path, img.size)


def main():
    os.makedirs(os.path.normpath(OUT), exist_ok=True)

    # Legacy square launcher icon, 192x192.
    big = 192 * SS
    legacy = gradient(big)
    legacy.alpha_composite(glyph(big, 1.0))
    save(rounded(legacy), "launcher_192.png", 192)

    # Adaptive background, 432x432, full bleed.
    big = 432 * SS
    save(gradient(big), "adaptive_background_432.png", 432)

    # Adaptive foreground, 432x432. Art stays inside the 66% safe circle.
    save(glyph(big, 0.72), "adaptive_foreground_432.png", 432)

    # Store / web icon.
    big = 512 * SS
    store = gradient(big)
    store.alpha_composite(glyph(big, 1.0))
    save(rounded(store), "store_512.png", 512)


if __name__ == "__main__":
    main()
