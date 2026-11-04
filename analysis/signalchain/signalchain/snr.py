"""Signal-to-noise ratio in dB, with and without a clean reference.

Reference: 10 log10(sum s^2 / sum (y - s)^2), s the clean signal (mean removed), y the
observed one.

Blind, 1D (narrowband signal in white noise): Welch PSD; the noise floor per bin is the median
PSD value (a narrowband signal occupies few bins, so the median sits on the floor); noise power
= floor * bins, signal power = total - noise. Assumes the noise is white over the band and the
signal occupies under half the bins.

Blind, image: noise sigma by Immerkaer (1996), the absolute response to the Laplacian-
difference mask [[1,-2,1],[-2,4,-2],[1,-2,1]], sigma = sqrt(pi/2) / (6 (W-2)(H-2)) * sum |r|.
Signal variance = var(image) - sigma^2. Assumes white Gaussian noise on a smooth image; fine
texture reads as noise and lowers the estimate.
"""
import numpy as np

from .core import as_1d, gray, welch


def snr_reference(clean, observed):
    s = as_1d(clean)
    y = as_1d(observed)
    s = s - s.mean()
    n = (y - y.mean()) - s
    return float(10 * np.log10((s * s).sum() / max((n * n).sum(), 1e-300)))


def snr_blind_1d(x, nperseg=1024):
    _, p = welch(x, nperseg)
    p = p[1:-1]
    floor = float(np.median(p))
    total = float(p.sum())
    noise = floor * p.size
    sig = max(total - noise, 1e-12 * total)
    return float(10 * np.log10(sig / noise))


def immerkaer_sigma(img):
    g = gray(img)
    r = (g[:-2, :-2] - 2 * g[:-2, 1:-1] + g[:-2, 2:]
         - 2 * g[1:-1, :-2] + 4 * g[1:-1, 1:-1] - 2 * g[1:-1, 2:]
         + g[2:, :-2] - 2 * g[2:, 1:-1] + g[2:, 2:])
    h, w = g.shape
    return float(np.sqrt(np.pi / 2) / (6 * (w - 2) * (h - 2)) * np.abs(r).sum())


def snr_blind_image(img):
    g = gray(img)
    s2 = immerkaer_sigma(g) ** 2
    sig = max(g.var() - s2, 1e-12)
    return float(10 * np.log10(sig / max(s2, 1e-12)))
