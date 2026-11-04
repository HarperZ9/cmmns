"""Time-frequency: how a signal's frequency moves over time.

STFT ridge: Hann-windowed STFT (n_fft, hop); in each frame the peak bin of |X|^2 between bins
2 and n_fft/2-1, refined by parabolic interpolation on log power. Frame time = window centre.

CWT ridge: Morlet wavelet (w0 = 6), computed in the Fourier domain,
psi_hat(s w) = pi^-1/4 exp(-(s w - w0)^2 / 2) for w > 0, scale s = w0 / (2 pi f), so each row is
labelled by its centre frequency f in cycles per sample. Power |W|^2 / s (scale-normalised so a
pure tone of fixed amplitude gives equal ridge power at any f). The ridge is the peak row per
sample, refined by parabolic interpolation on log power against log f. The edge 5% at each end
(about the cone of influence at the lowest frequency used) is dropped from every fit.

Two readings of a ridge f(t), t as a fraction of the record:
  chirp_fit  OLS line f = f0 + (f1 - f0) t after one pass dropping points more than 3 MADs off
             the first fit; returns f at t = 0 and t = 1.
  jump_fit   the single step in log f that minimises squared error over every split with at
             least 5% of points per side; returns (t_jump, median f before, median f after).
"""
import numpy as np

from .core import as_1d


def stft_ridge(x, n_fft=256, hop=32):
    x = as_1d(x)
    w = np.hanning(n_fft)
    starts = np.arange(0, x.size - n_fft + 1, hop)
    fr = np.array([(x[s:s + n_fft] - x[s:s + n_fft].mean()) * w for s in starts])
    p = np.abs(np.fft.rfft(fr, axis=1)) ** 2 + 1e-300
    k = np.argmax(p[:, 2:-1], axis=1) + 2
    lp = np.log(p)
    i = np.arange(len(k))
    a, b, c = lp[i, k - 1], lp[i, k], lp[i, k + 1]
    den = a - 2 * b + c
    off = np.where(den != 0, 0.5 * (a - c) / np.where(den != 0, den, 1), 0.0)
    f = (k + np.clip(off, -0.5, 0.5)) / n_fft
    t = (starts + n_fft / 2) / x.size
    return t, f


def cwt(x, freqs, w0=6.0):
    """Morlet CWT power, shape (len(freqs), len(x)), scale-normalised."""
    x = as_1d(x)
    n = x.size
    pad = 1 << int(np.ceil(np.log2(2 * n)))
    X = np.fft.fft(x - x.mean(), pad)
    om = 2 * np.pi * np.fft.fftfreq(pad)
    out = np.empty((len(freqs), n))
    for j, f in enumerate(freqs):
        s = w0 / (2 * np.pi * f)
        psi = np.pi ** -0.25 * np.exp(-0.5 * (s * om - w0) ** 2) * (om > 0)
        W = np.fft.ifft(X * psi * np.sqrt(2 * np.pi * s))[:n]
        out[j] = np.abs(W) ** 2 / s
    return out


def cwt_ridge(x, fmin=0.01, fmax=0.45, nf=72, w0=6.0, edge=0.05):
    x = as_1d(x)
    freqs = np.geomspace(fmin, fmax, nf)
    p = cwt(x, freqs, w0) + 1e-300
    k = np.clip(np.argmax(p, axis=0), 1, nf - 2)
    lp = np.log(p)
    i = np.arange(x.size)
    a, b, c = lp[k - 1, i], lp[k, i], lp[k + 1, i]
    den = a - 2 * b + c
    off = np.where(den != 0, 0.5 * (a - c) / np.where(den != 0, den, 1), 0.0)
    lf = np.log(freqs)
    f = np.exp(lf[k] + np.clip(off, -0.5, 0.5) * (lf[1] - lf[0]))
    t = (i + 0.5) / x.size
    keep = (t >= edge) & (t <= 1 - edge)
    return t[keep], f[keep]


def chirp_fit(t, f):
    t, f = np.asarray(t, float), np.asarray(f, float)
    A = np.c_[np.ones_like(t), t]
    coef = np.linalg.lstsq(A, f, rcond=None)[0]
    r = f - A @ coef
    mad = np.median(np.abs(r - np.median(r))) + 1e-12
    m = np.abs(r) < 3 * 1.4826 * mad
    if m.sum() >= 5:
        coef = np.linalg.lstsq(A[m], f[m], rcond=None)[0]
    return float(coef[0]), float(coef[0] + coef[1])


def jump_fit(t, f, min_frac=0.05):
    t, lf = np.asarray(t, float), np.log(np.asarray(f, float))
    n = lf.size
    c1, c2 = np.cumsum(lf), np.cumsum(lf * lf)
    m = max(2, int(min_frac * n))
    best, bk = np.inf, m
    for k in range(m, n - m):
        s1 = c2[k - 1] - c1[k - 1] ** 2 / k
        s2 = (c2[-1] - c2[k - 1]) - (c1[-1] - c1[k - 1]) ** 2 / (n - k)
        if s1 + s2 < best:
            best, bk = s1 + s2, k
    return float(0.5 * (t[bk - 1] + t[bk])), float(np.exp(np.median(lf[:bk]))), float(np.exp(np.median(lf[bk:])))


def frequency_drift(x, method="stft", **kw):
    """Summary for a real signal: ridge, its chirp line, its best jump, and how much of the
    ridge's log-frequency variance the jump and the line explain."""
    t, f = (stft_ridge if method == "stft" else cwt_ridge)(x, **kw)
    lf = np.log(f)
    f0, f1 = chirp_fit(t, f)
    tj, fa, fb = jump_fit(t, f)
    var = lf.var() + 1e-300
    step = np.where(t < tj, np.log(fa), np.log(fb))
    return {"t": t.tolist(), "ridge": f.tolist(), "chirp_f0": f0, "chirp_f1": f1,
            "jump_t": tj, "jump_f_before": fa, "jump_f_after": fb,
            "jump_r2": float(1 - ((lf - step) ** 2).mean() / var)}
