"""Gain and loss through a transform y = T(x), with the input and output both in hand.

Gain: level ratio in dB, 20 log10(rms(y - mean y) / rms(x - mean x)), and the coherent gain
beta = cov(x, y) / var(x), the part of the output that follows the input.

Loss, reconstruction: normalised mean squared error after the best affine map of y back onto
x, NMSE = mean((x - (a y + b))^2) / var(x). A pure gain or offset loses nothing under it.

Loss, information: H(X) - I(X;Y) = H(X|Y) in bits, plug-in estimate from a joint histogram
with the given number of bins per axis. It counts what the transform made unrecoverable,
whatever its shape; it needs many samples per joint cell to be trusted.
"""
import numpy as np

from .core import as_1d


def gain_db(x, y):
    x = as_1d(x)
    y = as_1d(y)
    sx = x.std()
    if sx == 0:
        raise ValueError("input has zero variance; gain undefined")
    return float(20 * np.log10(y.std() / sx))


def coherent_gain(x, y):
    x = as_1d(x)
    y = as_1d(y)
    return float(np.cov(x, y, bias=True)[0, 1] / x.var())


def nmse(x, y):
    x = as_1d(x)
    y = as_1d(y)
    if y.std() == 0:
        return 1.0
    a = np.cov(x, y, bias=True)[0, 1] / y.var()
    b = x.mean() - a * y.mean()
    return float(np.mean((x - (a * y + b)) ** 2) / x.var())


def _codes(v, bins, lo, hi):
    c = np.floor((v - lo) / (hi - lo) * bins).astype(np.int64)
    return np.clip(c, 0, bins - 1)


def _h(counts):
    p = counts[counts > 0] / counts.sum()
    return float(-(p * np.log2(p)).sum())


def mi_loss_bits(x, y, bins=256):
    """H(X|Y) in bits with X and Y each binned over their own range."""
    x = as_1d(x)
    y = as_1d(y)
    cx = _codes(x, bins, x.min(), x.max() + 1e-12)
    cy = _codes(y, bins, y.min(), y.max() + 1e-12)
    joint = np.bincount(cx * bins + cy, minlength=bins * bins).astype(np.float64)
    hxy = _h(joint)
    hy = _h(np.bincount(cy, minlength=bins).astype(np.float64))
    return hxy - hy
