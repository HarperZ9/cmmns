"""Entropy, two estimators per medium.

Shannon: plug-in entropy of the symbol distribution with the Miller-Madow bias correction,
H = -sum p log2 p + (K - 1) / (2 N ln 2), K = occupied symbols, N = samples. Symbols per
medium: image, the 256 grey levels of the 8-bit luminance; audio and series, 256 equal-width
bins over the signal's range; text, word tokens.

Conditional (entropy rate, order 1): H(X_t | X_{t-1}) = H(pair) - H(single), plug-in. It drops
below the Shannon value when symbols depend on their predecessor.

Compression: 8 * len(lzma(stream)) / N bits per symbol, minus the container overhead measured
on an empty stream. Symbols become bytes (or two bytes when there are more than 256 kinds).
It estimates the entropy rate under all the structure lzma can find, so it cross-checks the
plug-in values from above; it carries a finite-length overhead that shrinks with N.
"""
import lzma
import math

import numpy as np

from .core import gray

_OVERHEAD = len(lzma.compress(b"", preset=9 | lzma.PRESET_EXTREME))


def _counts(symbols):
    _, c = np.unique(np.asarray(symbols), return_counts=True)
    return c.astype(np.float64)


def shannon(symbols, correct=True):
    c = _counts(symbols)
    n = c.sum()
    p = c / n
    h = float(-(p * np.log2(p)).sum())
    if correct:
        h += (c.size - 1) / (2 * n * math.log(2))
    return float(h)


def conditional(symbols):
    s = np.asarray(symbols)
    _, inv = np.unique(s, return_inverse=True)
    k = int(inv.max()) + 1
    pairs = inv[:-1].astype(np.int64) * k + inv[1:]
    return shannon(pairs, correct=False) - shannon(inv[:-1], correct=False)


def compression(symbols):
    s = np.asarray(symbols)
    _, inv = np.unique(s, return_inverse=True)
    dtype = np.uint8 if inv.max() < 256 else np.uint16
    raw = inv.astype(dtype).tobytes()
    z = len(lzma.compress(raw, preset=9 | lzma.PRESET_EXTREME)) - _OVERHEAD
    return 8.0 * max(z, 0) / s.size


def image_symbols(img):
    return np.clip(np.round(gray(img)), 0, 255).astype(np.uint8).ravel()


def series_symbols(x, bins=256):
    x = np.asarray(x, dtype=np.float64).ravel()
    lo, hi = x.min(), x.max()
    if hi == lo:
        return np.zeros(x.size, dtype=np.int64)
    return np.clip(((x - lo) / (hi - lo) * bins).astype(np.int64), 0, bins - 1)


def entropy_report(symbols):
    return {"shannon_bits": shannon(symbols), "conditional_bits": conditional(symbols),
            "compression_bits": compression(symbols)}
