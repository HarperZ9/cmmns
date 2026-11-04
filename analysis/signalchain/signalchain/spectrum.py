"""Spectrum, one definition per medium.

Image: radial power spectrum. Luminance minus its mean, times a 2D Hann window, |FFT|^2,
averaged over annuli of radial frequency f = sqrt((kx/W)^2 + (ky/H)^2) in cycles per pixel.
The slope is the OLS fit of log10 P on log10 f over f in [band_lo, band_hi]; natural images sit
near -2.

Audio and series: STFT (Hann, n_fft, hop) for the time-frequency picture; Welch PSD for the
average spectrum; slope fitted the same way as the image, peak by parabolic interpolation.

Text: token rank-frequency spectrum. Counts sorted descending against rank; the slope of
log10 count on log10 rank over the top ranks is minus the Zipf exponent. Chosen over an
embedding spectrum because it needs no model (the model would become part of the measurement
and a shipped dependency), it is defined for a text of any length, and a known exponent can be
planted exactly, which the recovery gate needs.
"""
import numpy as np

from .core import as_1d, gray, ols_slope, welch


def radial_spectrum(img, nbins=64):
    g = gray(img)
    h, w = g.shape
    win = np.outer(np.hanning(h), np.hanning(w))
    p = np.abs(np.fft.fft2((g - g.mean()) * win)) ** 2
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt(fx * fx + fy * fy).ravel()
    edges = np.logspace(np.log10(2.0 / min(h, w)), np.log10(0.5), nbins + 1)
    idx = np.digitize(f, edges) - 1
    ok = (idx >= 0) & (idx < nbins)
    sums = np.bincount(idx[ok], weights=p.ravel()[ok], minlength=nbins)
    cnt = np.bincount(idx[ok], minlength=nbins)
    keep = cnt > 0
    centers = np.sqrt(edges[:-1] * edges[1:])
    return centers[keep], sums[keep] / cnt[keep]


def spectral_slope(freq, power, band=(0.01, 0.25)):
    """Slope of log10 power against log10 frequency inside band (cycles per sample)."""
    f = np.asarray(freq)
    p = np.asarray(power)
    m = (f >= band[0]) & (f <= band[1]) & (p > 0)
    if m.sum() < 3:
        raise ValueError("fewer than 3 spectral points in band")
    return ols_slope(np.log10(f[m]), np.log10(p[m]))[0]


def image_slope(img, band=(0.01, 0.25)):
    f, p = radial_spectrum(img)
    return spectral_slope(f, p, band)


def stft(x, n_fft=1024, hop=256):
    """Magnitude-squared STFT, shape (frames, n_fft//2+1)."""
    x = as_1d(x)
    w = np.hanning(n_fft)
    if x.size < n_fft:
        x = np.pad(x, (0, n_fft - x.size))
    frames = [x[i:i + n_fft] * w for i in range(0, x.size - n_fft + 1, hop)]
    return np.abs(np.fft.rfft(np.array(frames), axis=1)) ** 2


def peak_frequency(x, fs=1.0, nperseg=4096):
    """Dominant frequency from the Welch PSD with parabolic interpolation on log power."""
    f, p = welch(x, nperseg)
    k = int(np.argmax(p[1:-1])) + 1
    a, b, c = np.log(p[k - 1:k + 2] + 1e-300)
    den = a - 2 * b + c
    off = 0.5 * (a - c) / den if den != 0 else 0.0
    return float((k + off) * (f[1] - f[0]) * fs)


def series_slope(x, nperseg=1024, band=(0.005, 0.25)):
    f, p = welch(x, nperseg)
    return spectral_slope(f, p, band)


def rank_frequency(tokens):
    counts = {}
    for t in tokens:
        counts[t] = counts.get(t, 0) + 1
    c = np.array(sorted(counts.values(), reverse=True), dtype=np.float64)
    return np.arange(1, c.size + 1, dtype=np.float64), c


def zipf_exponent(tokens, max_rank=100, min_count=5):
    """Minus the slope of log count on log rank over ranks 1..max_rank with count >= min_count."""
    r, c = rank_frequency(tokens)
    m = (r <= max_rank) & (c >= min_count)
    if m.sum() < 5:
        raise ValueError("too few frequent tokens for a rank-frequency fit")
    return -ols_slope(np.log10(r[m]), np.log10(c[m]))[0]
