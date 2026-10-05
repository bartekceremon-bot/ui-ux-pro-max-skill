"""Split a packed stack of planks (seen end-on) into individual boards.

Packages of sawn timber / tongue-and-groove boards are built from *columns*
of thin horizontal boards. Neural models and SAM struggle there (long thin
neighbours with near-identical texture), but the geometry is simple:

  1. in narrow vertical strips, the row profile of horizontal edges has one
     peak per seam between two boards  -> per-strip board segments;
  2. segments of neighbouring strips that overlap vertically are the same
     board -> chains (union-find);
  3. a chain may run across two columns whose rows happen to align; the
     board *ends* show up as strong vertical edges in the middle rows of the
     band -> chains are cut there.

Used to pseudo-label training photos of the user's packages, and as a
reference count. Works on a crop that contains (mostly) the stack.
"""
from __future__ import annotations

import cv2
import numpy as np


def _peaks(p: np.ndarray, min_dist: int, thr: float) -> list[int]:
    idx = [i for i in range(1, len(p) - 1) if p[i] >= p[i - 1] and p[i] >= p[i + 1] and p[i] > thr]
    idx.sort(key=lambda i: -p[i])
    out: list[int] = []
    for i in idx:
        if all(abs(i - j) >= min_dist for j in out):
            out.append(i)
    return sorted(out)


def estimate_period(gy: np.ndarray) -> float:
    """dominant board height: autocorrelation of the row profile of central strips"""
    h, w = gy.shape
    best = []
    for cx in np.linspace(0.2, 0.8, 7):
        x0, x1 = int(w * cx - w * 0.03), int(w * cx + w * 0.03)
        p = gy[:, x0:x1].mean(1)
        p = p - p.mean()
        ac = np.correlate(p, p, "full")[len(p) - 1:]
        ac /= ac[0] + 1e-9
        lo = max(4, h // 120)
        hi = h // 4
        seg = ac[lo:hi]
        if len(seg) < 3:
            continue
        k = int(np.argmax(seg)) + lo
        best.append((ac[k], k))
    best.sort(reverse=True)
    return float(np.median([k for _, k in best[:4]])) if best else h / 20


def split_planks(img: np.ndarray, period: float | None = None, strip_frac: float = 1 / 28,
                 debug: bool = False):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    g = cv2.createCLAHE(2.0, (8, 8)).apply(g.astype(np.uint8)).astype(np.float32)
    g = cv2.GaussianBlur(g, (0, 0), 1.2)
    gy = np.abs(cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3))
    gx = np.abs(cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3))
    H, W = g.shape
    T = period or estimate_period(gy)
    sw = max(6, int(W * strip_frac))
    step = max(3, sw // 2)
    segs = []  # (strip, x0, x1, y0, y1)
    xs = list(range(0, W - sw + 1, step))
    for si, x0 in enumerate(xs):
        p = gy[:, x0:x0 + sw].mean(1)
        p = cv2.GaussianBlur(p.reshape(-1, 1), (1, 0), sigmaX=0, sigmaY=max(0.8, T / 12)).ravel()
        thr = np.percentile(p, 55)
        pk = _peaks(p, int(T * 0.6), thr)
        for a, b in zip(pk, pk[1:]):
            if 0.55 * T <= b - a <= 1.7 * T:
                segs.append((si, x0, x0 + sw, a, b))
    if not segs:
        return np.zeros((0, 4)), T
    segs = np.array(segs, float)
    n = len(segs)
    par = list(range(n))

    def f(x):
        while par[x] != x:
            par[x] = par[par[x]]
            x = par[x]
        return x

    by_strip: dict[int, list[int]] = {}
    for i, s in enumerate(segs):
        by_strip.setdefault(int(s[0]), []).append(i)
    for si, ids in by_strip.items():
        for j in by_strip.get(si + 1, []) + by_strip.get(si + 2, []):
            for i in ids:
                a0, a1, b0, b1 = segs[i, 3], segs[i, 4], segs[j, 3], segs[j, 4]
                ov = min(a1, b1) - max(a0, b0)
                if ov > 0.65 * min(a1 - a0, b1 - b0) and abs((a1 - a0) - (b1 - b0)) < 0.35 * T:
                    par[f(i)] = f(j)
    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(f(i), []).append(i)
    boards = []
    for ids in groups.values():
        s = segs[ids]
        x0, x1 = s[:, 1].min(), s[:, 2].max()
        y0, y1 = np.median(s[:, 3]), np.median(s[:, 4])
        if x1 - x0 < 2.0 * T:
            continue
        # cut at board ends: strong vertical edges in the middle rows of the band
        m0, m1 = int(y0 + 0.25 * (y1 - y0)), int(y1 - 0.25 * (y1 - y0))
        if m1 <= m0:
            continue
        prof = gx[m0:m1, int(x0):int(x1)].mean(0)
        prof = cv2.GaussianBlur(prof.reshape(1, -1), (0, 0), 2).ravel()
        thr = max(np.median(prof) * 3.5, np.percentile(prof, 97))
        cuts = [c for c in _peaks(prof, int(2.5 * T), thr) if 1.5 * T < c < len(prof) - 1.5 * T]
        edges = [0] + cuts + [len(prof)]
        for a, b in zip(edges, edges[1:]):
            if b - a >= 2.0 * T:
                boards.append([x0 + a, y0, x0 + b, y1])
    B = np.array(boards, float) if boards else np.zeros((0, 4))
    # de-duplicate (chains that ended up parallel)
    keep = []
    for i in np.argsort(-(B[:, 2] - B[:, 0])) if len(B) else []:
        bi = B[i]
        dup = False
        for j in keep:
            bj = B[j]
            iw = min(bi[2], bj[2]) - max(bi[0], bj[0]); ih = min(bi[3], bj[3]) - max(bi[1], bj[1])
            if iw > 0 and ih > 0 and iw * ih > 0.5 * (bi[2] - bi[0]) * (bi[3] - bi[1]):
                dup = True
                break
        if not dup:
            keep.append(i)
    return B[keep], T


if __name__ == "__main__":
    import sys
    im = cv2.imread(sys.argv[1])
    B, T = split_planks(im)
    vis = im.copy()
    for x0, y0, x1, y1 in B:
        cv2.rectangle(vis, (int(x0), int(y0)), (int(x1), int(y1)), (0, 255, 0), 2)
    cv2.putText(vis, f"n={len(B)} T={T:.0f}", (10, 40), 0, 1.2, (0, 0, 255), 3)
    cv2.imwrite(sys.argv[2], vis)
    print(len(B), T)
