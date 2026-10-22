"""The line preprocessing of src/ocr/image.js and read.js, in numpy, so training images match what
the extension feeds the model. tests/ocr.image.test.js compares the two on fixtures."""
import numpy as np
from PIL import Image

HEIGHT = 32


def jround(x):
    """JavaScript Math.round."""
    return int(np.floor(x + 0.5))


def luminance(rgb):
    rgb = rgb.astype(np.float32)
    return (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]).astype(np.float32)


def line_box(x0, y0, x1, y1, w, h):
    lh = y1 - y0
    py, px = max(2, jround(0.15 * lh)), max(3, jround(0.35 * lh))
    return max(0, x0 - px), max(0, y0 - py), min(w, x1 + px), min(h, y1 + py)


def quantile(hist, n, q):
    c = np.cumsum(hist)
    return int(np.argmax(c >= q * n))


def normalize_line(gray, height=HEIGHT, max_width=2400):
    h, w = gray.shape
    r = np.clip(np.floor(gray + 0.5), 0, 255).astype(np.int64)
    bg = quantile(np.bincount(r.ravel(), minlength=256), r.size, 0.5)
    d = np.abs(gray - np.float32(bg)).astype(np.float32)
    dh = np.bincount(np.minimum(255, np.floor(d + 0.5)).astype(np.int64).ravel(), minlength=256)
    scale = max(quantile(dh, d.size, 0.98), 24)
    d = np.minimum(np.float32(1), d / np.float32(scale)).astype(np.float32)
    ow = max(4, min(max_width, jround(w * height / h)))
    out = Image.fromarray(d, mode="F").resize((ow, height), Image.BILINEAR)
    return np.asarray(out, dtype=np.float32)
