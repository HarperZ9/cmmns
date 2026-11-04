"""Envelope: attack, decay, sustain, release fitted to any 1D profile.

Model on normalised position t in [0, 1], all four values fractions:
  0 -> 1 linearly over [0, a]; 1 -> s over [a, a+d]; s held over [a+d, 1-r]; s -> 0 over
  [1-r, 1]. Constraint a + d + r <= 1.
Profile preparation: resample to 200 points, subtract the 5th percentile, divide by the
maximum of a 5-point moving average, so the peak reads 1 and the floor 0.
Fit: exhaustive grid over a, d, r in steps of 0.02 up to 0.5; for each triple the model is
linear in s, so s has a closed-form least-squares value (clipped to [0, 1]); the triple with
the least squared error wins.

Sources of a profile:
  audio      moving RMS of the waveform (window 'win' samples);
  any 1D     the profile itself;
  image      the radial luminance profile, mean grey level in annuli around the centre against
             radius / max radius (the brief's reading of an envelope for a still);
  text       sentence-length series in words, in reading order.
"""
import re

import numpy as np

from .core import as_1d, gray, moving_average, resample

_N = 200
_T = np.linspace(0, 1, _N)
_STEP = 0.02
_GRID = np.round(np.arange(0, 0.5 + 1e-9, _STEP), 4)


def adsr_curve(a, d, s, r, t=_T):
    t = np.asarray(t, dtype=np.float64)
    y = np.full_like(t, s)
    if a > 0:
        m = t < a
        y[m] = t[m] / a
    if d > 0:
        m = (t >= a) & (t < a + d)
        y[m] = 1 + (s - 1) * (t[m] - a) / d
    if r > 0:
        m = t > 1 - r
        y[m] = s * (1 - t[m]) / r
    return y


def _basis(a, d, r):
    """Model = c0 + s * c1 on the fixed grid _T."""
    c0 = np.zeros(_N)
    c1 = np.ones(_N)
    if a > 0:
        m = _T < a
        c0[m], c1[m] = _T[m] / a, 0
    if d > 0:
        m = (_T >= a) & (_T < a + d)
        u = (_T[m] - a) / d
        c0[m], c1[m] = 1 - u, u
    if r > 0:
        m = _T > 1 - r
        c0[m], c1[m] = 0, (1 - _T[m]) / r
    return c0, c1


def normalise(profile):
    y = resample(as_1d(profile), _N)
    y = y - np.percentile(y, 5)
    pk = moving_average(y, 5).max()
    return y / pk if pk > 0 else y


_BANK = {}


def _bank():
    """All grid triples and their bases, built once (float32, about 28 MB)."""
    if not _BANK:
        tri = [(a, d, r) for a in _GRID for d in _GRID for r in _GRID if a + d + r <= 1]
        c0 = np.empty((len(tri), _N), dtype=np.float32)
        c1 = np.empty((len(tri), _N), dtype=np.float32)
        for i, (a, d, r) in enumerate(tri):
            c0[i], c1[i] = _basis(a, d, r)
        _BANK.update(tri=np.array(tri), c0=c0, c1=c1, den=(c1 * c1).sum(1))
    return _BANK


def fit_adsr(profile):
    y = normalise(profile).astype(np.float32)
    b = _bank()
    res = y[None, :] - b["c0"]
    s = np.clip((res * b["c1"]).sum(1) / np.maximum(b["den"], 1e-9), 0, 1)
    err = ((res - s[:, None] * b["c1"]) ** 2).sum(1)
    i = int(np.argmin(err))
    a, d, r = (float(v) for v in b["tri"][i])
    return {"attack": a, "decay": d, "sustain": float(s[i]), "release": r, "sse": float(err[i])}


def audio_envelope(x, win=256):
    x = as_1d(x)
    return np.sqrt(moving_average(x * x, win))


def radial_profile(img, nbins=100):
    g = gray(img)
    h, w = g.shape
    yy, xx = np.mgrid[0:h, 0:w]
    rr = np.hypot(yy - (h - 1) / 2, xx - (w - 1) / 2)
    rr = rr / rr.max()
    idx = np.minimum((rr * nbins).astype(np.int64), nbins - 1).ravel()
    s = np.bincount(idx, weights=g.ravel(), minlength=nbins)
    c = np.bincount(idx, minlength=nbins)
    return s / np.maximum(c, 1)


def sentence_lengths(text):
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return np.array([len(p.split()) for p in parts if p.split()], dtype=np.float64)
