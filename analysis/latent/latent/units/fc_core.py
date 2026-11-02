"""Flatness ceiling core: Welch spectral flatness with log-bias correction, AR(AIC) one-step skill,
a k-nearest-neighbour analogue forecaster, and the per-series pipeline.

Kolmogorov-Szego: for a weakly stationary series the one-step linear prediction error variance is
exp(mean log S); divided by the variance (mean S) it is the spectral flatness r. The skill ceiling of
linear one-step prediction is 1 - r. Run with python -I -B.
"""
import sys

import numpy as np
from scipy import signal, special
from scipy.spatial import cKDTree

sys.dont_write_bytecode = True

HANN_RHO = 0.167  # correlation of Hann-window periodograms at 50 percent overlap (Welch 1967)


def nperseg_rule(n, rule="fc"):
    """'fc': n/8 rounded down to a power of two, at least 16. 'f74': the welch_beta rule of ls_spectra."""
    if rule == "f74":
        return int(min(n, max(64, 2 ** int(np.log2(n / 4)))))
    return int(min(n, max(16, 2 ** int(np.log2(max(n / 8, 1))))))


EULER = 0.5772156649015329


def flatness(x, rule="dj", detrend="constant"):
    """Spectral flatness r = exp(mean log S) / mean S. 'dj' (primary): Hann-tapered periodogram of the
    demeaned series with the Euler-gamma log correction (the Davis-Jones form of the Kolmogorov formula).
    'fc' and 'f74': Welch estimates with an equivalent-dof log-bias correction (secondary)."""
    if rule == "dj":
        return _flatness_dj(x, detrend)
    x = np.asarray(x, float)
    n = len(x)
    nper = nperseg_rule(n, rule)
    f, p = signal.welch(x, nperseg=nper, noverlap=nper // 2, window="hann", detrend=detrend)
    p = p[1:-1] if nper % 2 == 0 else p[1:]
    p = p[p > 0]
    if len(p) < 3:
        return float("nan"), 0.0
    k = 1 + max(0, (n - nper) // (nper - nper // 2))
    ratio = (1.0 / k) * (1 + 2 * HANN_RHO ** 2 * (k - 1) / k) if k > 1 else 1.0
    half_nu = 1.0 / ratio  # nu / 2, with nu = 2 / ratio equivalent chi-square degrees of freedom
    log_bias = special.digamma(half_nu) - np.log(half_nu)
    log_r = np.mean(np.log(p)) - log_bias - np.log(np.mean(p))
    return float(np.exp(log_r)), float(2 * half_nu)


def _flatness_dj(x, detrend):
    x = signal.detrend(np.asarray(x, float), type=detrend)
    n = len(x)
    w = signal.windows.hann(n)
    i = np.abs(np.fft.rfft(x * w)) ** 2 / np.sum(w ** 2)
    i = i[1:-1] if n % 2 == 0 else i[1:]
    i = i[i > 0]
    if len(i) < 3:
        return float("nan"), 0.0
    return float(np.exp(np.mean(np.log(i)) + EULER) / np.mean(i)), 2.0


def _lags(z, pmax):
    """Rows t = pmax..len(z)-1; column j holds z[t-1-j]."""
    w = np.lib.stride_tricks.sliding_window_view(z, pmax + 1)
    return w[:, :pmax][:, ::-1], w[:, pmax]


def ar_fit(train, pmax):
    """Order by AIC on a common sample (orders 0..pmax), then OLS refit at that order on all rows."""
    m = float(np.mean(train))
    z = train - m
    X, y = _lags(z, pmax)
    N = len(y)
    best = (N * np.log(np.mean(y ** 2)), 0)
    for p in range(1, pmax + 1):
        a = np.linalg.lstsq(X[:, :p], y, rcond=None)[0]
        s2 = np.mean((y - X[:, :p] @ a) ** 2)
        aic = N * np.log(max(s2, 1e-300)) + 2 * p
        if aic < best[0]:
            best = (aic, p)
    p = best[1]
    if p == 0:
        return m, np.zeros(0)
    Xp, yp = _lags(z, p)
    return m, np.linalg.lstsq(Xp, yp, rcond=None)[0]


def ar_skill(x, n_train, pmax):
    """Held-out one-step skill 1 - MSE / variance of the test segment, using the true past."""
    m, a = ar_fit(x[:n_train], pmax)
    z = x - m
    p = len(a)
    test = x[n_train:]
    if p:
        X, _ = _lags(z[n_train - p:], p)
        pred = m + X @ a
    else:
        pred = np.full(len(test), m)
    var = np.var(test)
    return float(1 - np.mean((test - pred) ** 2) / var) if var > 0 else float("nan"), p


def _embed(z, m):
    X, y = _lags(z, m)
    return X, y


def knn_skill(x, n_train, dims=(1, 2, 3, 4, 6), cap=4000):
    """Analogue forecast: mean of the next values of the k nearest training states (k = sqrt of library).
    Embedding dimension chosen on the last quarter of the training segment."""
    mu, sd = np.mean(x[:n_train]), np.std(x[:n_train])
    if sd == 0:
        return float("nan"), 0
    z = (x - mu) / sd
    tr = z[:n_train]
    cut = int(0.75 * n_train)
    best = (np.inf, dims[0])
    for m in dims:
        if cut - m < 10 or n_train - cut < 5:
            continue
        lib_X, lib_y = _embed(tr[max(0, cut - cap):cut], m)
        val_X, val_y = _embed(tr[cut - m:], m)
        e = np.mean((val_y - _knn_pred(lib_X, lib_y, val_X)) ** 2)
        if e < best[0]:
            best = (e, m)
    m = best[1]
    lib_X, lib_y = _embed(tr[max(0, n_train - cap):], m)
    te_X, te_y = _embed(z[n_train - m:], m)
    var = np.var(te_y)
    pred = _knn_pred(lib_X, lib_y, te_X)
    return (float(1 - np.mean((te_y - pred) ** 2) / var) if var > 0 else float("nan")), m


def _knn_pred(lib_X, lib_y, q_X):
    k = int(max(3, min(len(lib_y), round(np.sqrt(len(lib_y))))))
    _, idx = cKDTree(lib_X).query(q_X, k=k)
    idx = idx.reshape(len(q_X), -1)
    return lib_y[idx].mean(1)


def pmax_rule(n_train):
    return int(max(1, min(20, n_train // 10)))


def one(x, with_knn=True, rule="dj", detrend="constant"):
    """Bound and skills for one series split in half by time."""
    x = np.asarray(x, float)
    n_train = len(x) // 2
    r, nu = flatness(x[:n_train], rule, detrend)
    skill, p = ar_skill(x, n_train, pmax_rule(n_train))
    out = {"bound": 1 - r, "flat": r, "nu": nu, "ar": skill, "p": p}
    if with_knn:
        out["knn"], out["m"] = knn_skill(x, n_train)
    return out


def phase_surrogate(x, rng):
    """Phase-randomised copy with the mean restored (ls_spectra.phase_randomize removes it)."""
    import ls_spectra as SP
    return SP.phase_randomize(x, rng) + np.mean(x)
