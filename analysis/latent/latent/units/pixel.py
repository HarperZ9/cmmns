"""IH17 reading (b): does an image's information sit in neighbour differences more than in values?

Per image (greyscale, longest side 512, Lanczos): R = zlib9(differences) / zlib9(values), where
differences are horizontal neighbour differences mod 256 with the first column kept as values.
Shuffled control per image: the same pixels with positions permuted; R_shuf computed the same way.
Statistic: median over images of (R_shuf - R_real). Null: random sign flips of the per-image
paired differences. LZMA ratios are reported beside zlib as a second compressor.
"""
import json
import lzma
import zlib
from pathlib import Path

import numpy as np

MAX_SIDE = 512


def _images(items_path, n, rng):
    paths = []
    for line in open(items_path, encoding="utf-8"):
        r = json.loads(line)
        for p in r.get("images") or []:
            if Path(p).suffix.lower() in (".jpg", ".jpeg", ".png", ".webp") and Path(p).exists():
                paths.append(p)
                break
    paths = sorted(set(paths))
    idx = rng.choice(len(paths), size=min(n, len(paths)), replace=False)
    return [paths[i] for i in sorted(idx)], len(paths)


def _grey(path):
    from PIL import Image
    im = Image.open(path).convert("L")
    s = MAX_SIDE / max(im.size)
    if s < 1:
        im = im.resize((max(1, round(im.size[0] * s)), max(1, round(im.size[1] * s))), Image.LANCZOS)
    return np.asarray(im, dtype=np.uint8)


def _diff(a):
    d = a.astype(np.int16)
    out = np.empty_like(a)
    out[:, 0] = a[:, 0]
    out[:, 1:] = ((d[:, 1:] - d[:, :-1]) % 256).astype(np.uint8)
    return out


def _ratio(a, comp):
    return len(comp(_diff(a).tobytes())) / len(comp(a.tobytes()))


def analysis(ctx):
    rng, prm = ctx["rng"], ctx["params"]
    paths, pool = _images(prm["items"], prm["n_images"], rng)
    rows = []
    z = lambda b: zlib.compress(b, 9)  # noqa: E731
    x = lambda b: lzma.compress(b, preset=6)  # noqa: E731
    for p in paths:
        try:
            a = _grey(p)
        except Exception as e:  # unreadable image: logged, skipped
            rows.append({"path": p, "error": repr(e)})
            continue
        shuf = a.reshape(-1)[rng.permutation(a.size)].reshape(a.shape)
        rows.append({"path": p, "shape": list(a.shape), "R_real": _ratio(a, z), "R_shuf": _ratio(shuf, z),
                     "R_real_lzma": _ratio(a, x), "R_shuf_lzma": _ratio(shuf, x)})
    ok = [r for r in rows if "error" not in r]
    d = np.array([r["R_shuf"] - r["R_real"] for r in ok])
    rr = np.array([r["R_real"] for r in ok])
    ctx["state"]["d"] = d
    return {"n_pool": pool, "n_images": len(ok), "n_errors": len(rows) - len(ok),
            "median_R_real": float(np.median(rr)), "median_R_shuf": float(np.median([r["R_shuf"] for r in ok])),
            "median_R_real_lzma": float(np.median([r["R_real_lzma"] for r in ok])),
            "median_R_shuf_lzma": float(np.median([r["R_shuf_lzma"] for r in ok])),
            "frac_R_real_below_1": float(np.mean(rr < 1)), "frac_real_below_shuf": float(np.mean(d > 0)),
            "median_gap": float(np.median(d)), "one_minus_median_R_real": float(1 - np.median(rr)),
            "images": ok}


def sign_flip(ctx, analysis):
    d, rng = ctx["state"]["d"], ctx["rng"]
    s = rng.choice(np.array([-1.0, 1.0]), size=(ctx["params"]["n"], d.size))
    return {"null": list(map(float, np.median(s * d, axis=1)))}
