"""Timescales and spectra of irregularly sampled series (ESM mood logs). Times in hours.

One-timescale model (OU + noise): latent x is an Ornstein-Uhlenbeck process with time constant
tau and stationary variance (1 - rho) V; each observation is x plus white measurement noise of
variance rho V. Between samples dt apart, x decays by a = exp(-dt / tau) and gains variance
(1 - rho) V (1 - a^2), so irregular gaps are exact, not interpolated. V is concentrated out of
the likelihood; (tau, rho) are fitted by maximum likelihood on a grid: tau in 41 log steps
from 0.05 h to 2000 h, rho in 0, 0.05, ..., 0.95. Batched Kalman filter, mean = training mean.

Two-timescale model: x = x_fast + x_slow, two independent OU processes (tau_1 < tau_2) sharing
the latent variance in proportion u : (1 - u), plus noise rho. Grid: tau 21 log steps over the
same range, u in 0.1..0.9, rho in 0..0.8.

Out of sample: fit on the first 70% of a person's observations; run the filter over all of
them with those parameters; score the summed log predictive density of the last 30%. Two
timescales "fit better" when their held-out score is higher.

Sampling floor: a tau shorter than the sampling interval cannot be told from noise, since the
state forgets between samples. at_floor = tau_hat < median within-day gap.

Haar spectrum (structure-function wavelet variance, robust to irregular gaps): for every pair
of observations, half the squared difference against their lag; SF(lag) is its mean in a lag
bin. Variance accrued within a timescale band is the rise of SF across it: within-day =
SF(lags 0-12 h); day-to-day = SF(18-168 h) - within-day; week = SF(168 h to T/2) - SF(18-168 h),
negatives set to 0; band shares = each / their sum. The per-lag spectrum uses 12 log-spaced lag
bins from 1 h to T/2. Variance faster than the shortest lag (sub-sampling dynamics and
measurement noise alike) lands in the first value and cannot be split further.

Lomb-Scargle periodogram (Lomb 1976, Scargle 1982; mean removed, power normalised by the
variance) on a linear frequency grid from 1/T to 0.5 cycles per hour, spacing 1/(4T). Bands
by period: within-day < 30 h (holds the 24 h cycle), day-to-day 30 h to 168 h, week-scale
> 168 h. Band share = band power / power over all three. Spectral slope: OLS of log10 power on
log10 f after averaging into 16 log-spaced bins, over periods from 5 h to T / 2 (below the
pseudo-Nyquist of five beeps a day). Shuffling values over the times flattens the spectrum to
the same shape that variance faster than the sampling produces, so the shuffled null and the
sampling floor coincide for spectra.
"""
import numpy as np

TAU_GRID = np.geomspace(0.05, 2000.0, 41)
RHO_GRID = np.arange(0, 0.96, 0.05)
BANDS = {"within_day": (0.0, 30.0), "day_to_day": (30.0, 168.0), "week": (168.0, np.inf)}


def _ou1_filter(t, y, tau, rho):
    """Batched over parameter combos (arrays tau, rho). Returns v (n, C), F (n, C) in units of V."""
    n, C = y.size, tau.size
    m = np.zeros(C)
    P = 1.0 - rho
    v, F = np.empty((n, C)), np.empty((n, C))
    for i in range(n):
        if i:
            a = np.exp(-(t[i] - t[i - 1]) / tau)
            m = a * m
            P = a * a * P + (1 - rho) * (1 - a * a)
        f = P + rho
        e = y[i] - m
        k = P / np.maximum(f, 1e-12)
        m = m + k * e
        P = P - k * P
        v[i], F[i] = e, np.maximum(f, 1e-12)
    return v, F


def _ou2_filter(t, y, t1, t2, u, rho):
    n, C = y.size, t1.size
    m1, m2 = np.zeros(C), np.zeros(C)
    s1, s2 = (1 - rho) * u, (1 - rho) * (1 - u)
    P11, P22, P12 = s1.copy(), s2.copy(), np.zeros(C)
    v, F = np.empty((n, C)), np.empty((n, C))
    for i in range(n):
        if i:
            dt = t[i] - t[i - 1]
            a1, a2 = np.exp(-dt / t1), np.exp(-dt / t2)
            m1, m2 = a1 * m1, a2 * m2
            P11 = a1 * a1 * P11 + s1 * (1 - a1 * a1)
            P22 = a2 * a2 * P22 + s2 * (1 - a2 * a2)
            P12 = a1 * a2 * P12
        f = np.maximum(P11 + P22 + 2 * P12 + rho, 1e-12)
        e = y[i] - m1 - m2
        k1, k2 = (P11 + P12) / f, (P12 + P22) / f
        m1, m2 = m1 + k1 * e, m2 + k2 * e
        P11, P12, P22 = P11 - k1 * (P11 + P12), P12 - k1 * (P12 + P22), P22 - k2 * (P12 + P22)
        v[i], F[i] = e, f
    return v, F


def _ll(v, F, V=None):
    n = v.shape[0]
    if V is None:
        V = np.mean(v * v / F, axis=0)
    return -0.5 * (np.log(F * V).sum(axis=0) + (v * v / (F * V)).sum(axis=0) + n * np.log(2 * np.pi)), V


def _grid1():
    T, R = np.meshgrid(TAU_GRID, RHO_GRID, indexing="ij")
    return T.ravel(), R.ravel()


def _grid2():
    tg = np.geomspace(0.05, 2000.0, 21)
    rows = [(a, b, u, r) for i, a in enumerate(tg) for b in tg[i + 1:]
            for u in np.arange(0.1, 0.91, 0.1) for r in np.arange(0, 0.81, 0.1)]
    return [np.array(c) for c in zip(*rows)]


def fit_ou(t, y):
    t, y = np.asarray(t, float), np.asarray(y, float)
    tau, rho = _grid1()
    v, F = _ou1_filter(t, y - y.mean(), tau, rho)
    ll, V = _ll(v, F)
    j = int(np.argmax(ll))
    return {"tau": float(tau[j]), "rho": float(rho[j]), "V": float(V[j]), "ll": float(ll[j])}


def fit_ou2(t, y):
    t, y = np.asarray(t, float), np.asarray(y, float)
    t1, t2, u, rho = _grid2()
    v, F = _ou2_filter(t, y - y.mean(), t1, t2, u, rho)
    ll, V = _ll(v, F)
    j = int(np.argmax(ll))
    return {"tau1": float(t1[j]), "tau2": float(t2[j]), "u": float(u[j]), "rho": float(rho[j]),
            "V": float(V[j]), "ll": float(ll[j])}


def held_out(t, y, frac=0.7):
    """Held-out log predictive density per test observation, one against two timescales."""
    t, y = np.asarray(t, float), np.asarray(y, float)
    k = int(frac * y.size)
    mu = y[:k].mean()
    f1, f2 = fit_ou(t[:k], y[:k]), fit_ou2(t[:k], y[:k])
    v, F = _ou1_filter(t, y - mu, np.array([f1["tau"]]), np.array([f1["rho"]]))
    l1 = _ll(v[k:], F[k:], np.array([f1["V"]]))[0][0]
    v, F = _ou2_filter(t, y - mu, *[np.array([f2[c]]) for c in ("tau1", "tau2", "u", "rho")])
    l2 = _ll(v[k:], F[k:], np.array([f2["V"]]))[0][0]
    m = y.size - k
    return {"one": f1, "two": f2, "ll1": float(l1 / m), "ll2": float(l2 / m), "n_test": m}


def within_day_gap(t):
    d = np.diff(np.asarray(t, float))
    d = d[(d > 0) & (d < 12)]
    return float(np.median(d)) if d.size else float("nan")


def lomb_scargle(t, y, f):
    t, y = np.asarray(t, float), np.asarray(y, float)
    y = y - y.mean()
    var = y.var() + 1e-300
    w = 2 * np.pi * np.asarray(f)[:, None]
    tau = np.arctan2(np.sin(2 * w * t).sum(1), np.cos(2 * w * t).sum(1)) / (2 * w[:, 0])
    arg = w * (t[None, :] - tau[:, None])
    c, s = np.cos(arg), np.sin(arg)
    p = ((c @ y) ** 2 / (c * c).sum(1) + (s @ y) ** 2 / (s * s).sum(1)) / (2 * var)
    return p


def spectrum(t, y, fmax=0.5):
    t = np.asarray(t, float)
    T = t.max() - t.min()
    f = np.arange(1 / T, fmax, 1 / (4 * T))
    return f, lomb_scargle(t, y, f), T


def band_shares(f, p, T):
    per = 1 / f
    tot = {k: float(p[(per >= lo) & (per < hi)].sum()) for k, (lo, hi) in BANDS.items()}
    s = sum(tot.values()) + 1e-300
    return {k: v / s for k, v in tot.items()}


def slope(f, p, T, pmin=5.0, nb=16):
    m = (1 / f >= pmin) & (1 / f <= T / 2)
    lf, lp = np.log10(f[m]), np.log10(p[m] + 1e-300)
    edges = np.linspace(lf.min(), lf.max() + 1e-9, nb + 1)
    idx = np.digitize(lf, edges) - 1
    bx = np.array([lf[idx == i].mean() for i in range(nb) if (idx == i).any()])
    by = np.array([np.log10(np.mean(10 ** lp[idx == i])) for i in range(nb) if (idx == i).any()])
    return float(np.polyfit(bx, by, 1)[0])


def pair_lags(t, y):
    t, y = np.asarray(t, float), np.asarray(y, float)
    i, j = np.triu_indices(t.size, 1)
    return np.abs(t[j] - t[i]), 0.5 * (y[j] - y[i]) ** 2


SF_BANDS = {"within_day": (0.0, 12.0), "day_to_day": (18.0, 168.0), "week": (168.0, None)}


def haar_bands(t, y, lag=None, d2=None):
    if lag is None:
        lag, d2 = pair_lags(t, y)
    T = float(np.max(t) - np.min(t))
    sf = {}
    for k, (lo, hi) in SF_BANDS.items():
        m = (lag > lo) & (lag <= (hi if hi is not None else T / 2))
        sf[k] = float(d2[m].mean()) if m.sum() >= 10 else float("nan")
    v = {"within_day": sf["within_day"], "day_to_day": max(sf["day_to_day"] - sf["within_day"], 0.0),
         "week": max(sf["week"] - sf["day_to_day"], 0.0)}
    tot = sum(v.values())
    return {"sf": sf, "share": {k: x / tot for k, x in v.items()} if tot > 0 else None}


def haar_spectrum(t, y, nb=12, lo=1.0):
    lag, d2 = pair_lags(t, y)
    T = float(np.max(t) - np.min(t))
    edges = np.geomspace(lo, T / 2, nb + 1)
    sf = np.array([d2[(lag > edges[i]) & (lag <= edges[i + 1])].mean()
                   if ((lag > edges[i]) & (lag <= edges[i + 1])).sum() >= 5 else np.nan for i in range(nb)])
    return np.sqrt(edges[:-1] * edges[1:]), sf


def esm_times(rng, days=20, beeps=5, start=9.0, end=21.0, miss=0.15):
    """Stratified-random ESM schedule: one beep at a random time in each of 'beeps' equal
    windows of the waking day, a fraction 'miss' dropped at random."""
    w = (end - start) / beeps
    t = np.array([d * 24 + start + b * w + rng.uniform(0, w) for d in range(days) for b in range(beeps)])
    return np.sort(t[rng.random(t.size) >= miss])


def ou_at(rng, t, tau, sd=1.0):
    x = np.empty(t.size)
    x[0] = rng.standard_normal() * sd
    for i in range(1, t.size):
        a = np.exp(-(t[i] - t[i - 1]) / tau)
        x[i] = a * x[i - 1] + sd * np.sqrt(1 - a * a) * rng.standard_normal()
    return x
