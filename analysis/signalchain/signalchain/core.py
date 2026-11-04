"""Shared helpers: medium coercion, power spectra, autocorrelation, smoothing.

Every measure in the package takes plain numpy arrays (images as 2D or HxWx3, audio and
series as 1D) or a token list for text. Nothing here reads files.
"""
import numpy as np

LUMA = np.array([0.2126, 0.7152, 0.0722])


def gray(img):
    """Image to a float 2D luminance array. HxWx3 or HxWx4 uses Rec. 709 weights on the
    encoded values; alpha is dropped."""
    a = np.asarray(img, dtype=np.float64)
    if a.ndim == 3:
        a = a[..., :3] @ LUMA
    if a.ndim != 2:
        raise ValueError(f"image must be 2D or HxWxC, got shape {a.shape}")
    return a


def as_1d(x):
    a = np.asarray(x, dtype=np.float64).ravel()
    if a.size < 4:
        raise ValueError("1D signal needs at least 4 samples")
    return a


def rms(x):
    a = np.asarray(x, dtype=np.float64)
    return float(np.sqrt(np.mean(a * a)))


def welch(x, nperseg=1024, overlap=0.5):
    """One-sided Welch power spectral density with a Hann window.
    Returns (freq in cycles per sample, psd). Segments shorter than the signal are averaged."""
    x = as_1d(x)
    x = x - x.mean()
    n = min(nperseg, x.size)
    step = max(1, int(n * (1 - overlap)))
    w = np.hanning(n)
    scale = 1.0 / (w * w).sum()
    segs = [x[i:i + n] for i in range(0, x.size - n + 1, step)]
    acc = np.zeros(n // 2 + 1)
    for s in segs:
        acc += np.abs(np.fft.rfft((s - s.mean()) * w)) ** 2
    psd = acc * scale / len(segs)
    psd[1:-1] *= 2
    return np.fft.rfftfreq(n), psd


def acf(x, max_lag=None):
    """Normalized autocorrelation (lag 0 = 1) by FFT, biased estimator."""
    x = as_1d(x)
    x = x - x.mean()
    n = x.size
    f = np.fft.rfft(x, 2 * n)
    r = np.fft.irfft(f * np.conj(f))[:n]
    if r[0] <= 0:
        return np.zeros(max_lag or n)
    r = r / r[0]
    return r[: (max_lag or n)]


def moving_average(x, w):
    x = as_1d(x)
    w = max(1, int(w))
    if w == 1:
        return x.copy()
    k = np.ones(w) / w
    return np.convolve(x, k, mode="same")


def ols_slope(x, y):
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    if x.size < 2:
        raise ValueError("slope needs two points")
    xm, ym = x.mean(), y.mean()
    den = ((x - xm) ** 2).sum()
    return float(((x - xm) * (y - ym)).sum() / den), float(ym - xm * ((x - xm) * (y - ym)).sum() / den)


def resample(y, n=200):
    """Linear resample of a 1D profile to n points on t in [0, 1]."""
    y = as_1d(y)
    t0 = np.linspace(0, 1, y.size)
    return np.interp(np.linspace(0, 1, n), t0, y)
