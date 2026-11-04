"""Resonance and decay.

Resonance: peak sharpness as the quality factor Q of the second-order resonance that best fits
the dominant spectral peak (fit_resonance below). For a bandpass section Q = f0 / FWHM exactly
(FWHM = width between the half-power points); for a lowpass section Q is the peak gain over the
passband gain. A raw half-power-width reading was tried first and failed recovery on noisy
Welch spectra (single noisy bins set both the peak and the crossings), so the fit replaced it.

Decay: autocorrelation decay time. Normalised ACF; ln ACF fitted by a line over lags
[start, end], end = first lag where ACF < ACF(start) * e^-2; tau = -1 / slope (samples).
For an AR(1) series with coefficient phi, tau = -1 / ln(phi).

Reverb size: decay time of the energy envelope. y^2 smoothed by a moving average of 'win'
samples; tau_e from its ACF starting at lag 2*win; amplitude decay constant T = 2 tau_e
(energy decays twice as fast as amplitude), RT60 = T ln(1000). Valid for a sparse, impulsive
dry source whose tails are exponential; for a continuous source the envelope ACF measures the
source too.
"""
import numpy as np

from .core import acf, as_1d, moving_average, welch


def _shape(u, q, m):
    return u ** m / ((1 - u * u) ** 2 + (u / q) ** 2)


def fit_resonance(f, p, smooth=9, floor_db=20.0):
    """Least-squares fit, on log power, of A u^m / ((1-u^2)^2 + (u/Q)^2), u = f/f0, m in
    {0, 2, 4} (lowpass, bandpass, highpass second-order sections). The dominant peak of the
    smoothed spectrum seeds f0; f0 is searched within +-25% of it, ln Q over [ln 0.5, ln 300].
    Fit band: the contiguous run of bins around the peak whose smoothed power stays within
    floor_db of the peak, clipped to [f0/4, 4 f0]; tails below that (zeros at DC or Nyquist,
    noise floors) are excluded so they do not dominate the log-domain error."""
    f = np.asarray(f, dtype=np.float64)
    p = np.asarray(p, dtype=np.float64)
    ps = moving_average(p, smooth)
    ps[0] = 0
    k0 = int(np.argmax(ps))
    if f[k0] <= 0:
        raise ValueError("no positive-frequency peak")
    floor = ps[k0] * 10 ** (-floor_db / 10)
    lo = k0
    while lo > 1 and ps[lo - 1] > floor:
        lo -= 1
    hi = k0
    while hi < ps.size - 1 and ps[hi + 1] > floor:
        hi += 1
    idx = np.arange(ps.size)
    band = (idx >= lo) & (idx <= hi) & (f >= f[k0] / 4) & (f <= 4 * f[k0]) & (p > 0)
    fb, lp = f[band], np.log(p[band])
    f0s = f[k0] * np.linspace(0.75, 1.25, 51)
    qs = np.exp(np.linspace(np.log(0.5), np.log(300), 120))
    best = (np.inf, None)
    for m in (0, 2, 4):
        u = fb[None, None, :] / f0s[:, None, None]
        ls = np.log(_shape(u, qs[None, :, None], m))
        la = (lp[None, None, :] - ls).mean(axis=2, keepdims=True)
        err = ((lp[None, None, :] - ls - la) ** 2).sum(axis=2)
        i, j = np.unravel_index(int(np.argmin(err)), err.shape)
        if err[i, j] < best[0]:
            best = (float(err[i, j]), (float(f0s[i]), float(qs[j]), m))
    f0, q, m = best[1]
    return {"q": q, "f0": f0, "order_m": m, "sse": best[0]}


def resonance_q(x, nperseg=4096):
    f, p = welch(x, nperseg)
    return fit_resonance(f, p)


def decay_time(x, start=1, max_lag=None):
    x = as_1d(x)
    r = acf(x, max_lag or x.size // 2)
    if start >= r.size - 3 or r[start] <= 0:
        return float("nan")
    thr = r[start] * np.exp(-2)
    below = np.nonzero(r[start:] < thr)[0]
    end = start + (int(below[0]) if below.size else r.size - start - 1)
    lags = np.arange(start, max(end, start + 2) + 1)
    rr = r[lags]
    ok = rr > 0
    if ok.sum() < 2:
        return float("nan")
    slope = np.polyfit(lags[ok], np.log(rr[ok]), 1)[0]
    return float(-1 / slope) if slope < 0 else float("inf")


def reverb_size(x, win=8):
    y = as_1d(x)
    e = moving_average(y * y, win)
    tau_e = decay_time(e, start=2 * win)
    t = 2 * tau_e
    return {"T": float(t), "rt60": float(t * np.log(1000))}
