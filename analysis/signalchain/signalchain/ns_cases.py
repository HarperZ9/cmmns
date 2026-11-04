"""Recovery cases for the non-stationary measures, in the same (draw, make, measure, transform,
unit) form as cases.py, read by run_ns_recovery.py and tests/test_nonstationary.py."""
import numpy as np

from . import changepoint as C
from . import modes as M
from . import regime as G
from . import timefreq as T
from . import tvar as V
from .core import welch
from .ns_cases_ts import (_B30, _B60, _B60S, _B90, _ls_slope, _ou_esm, _powerlaw_esm, _read_bands,
                          _read_two_tau, _shuffled_tau, _tau_hat, _two_tau)


def _logu(rng, lo, hi):
    return float(np.exp(rng.uniform(np.log(lo), np.log(hi))))


# ---- time-frequency ---------------------------------------------------------------------
def _chirp(rng, f01, n):
    f0, f1 = f01
    t = np.arange(n)
    ph = 2 * np.pi * (f0 * t + 0.5 * (f1 - f0) * t * t / n) + rng.uniform(0, 2 * np.pi)
    return np.sqrt(2) * np.sin(ph) + rng.standard_normal(n)


def _jump(rng, p, n):
    tj, la, lb = p
    k = int(tj * n)
    f = np.where(np.arange(n) < k, np.exp(la), np.exp(lb))
    ph = 2 * np.pi * np.cumsum(f) + rng.uniform(0, 2 * np.pi)
    return np.sqrt(2) * np.sin(ph) + rng.standard_normal(n)


def _draw_jump(r):
    la = np.log(_logu(r, 0.03, 0.2))
    lb = la + r.choice([-1, 1]) * r.uniform(0.4, 1.2)
    lb = float(np.clip(lb, np.log(0.02), np.log(0.35)))
    return [r.uniform(0.2, 0.8), la, lb]


def _jfit(ridge):
    tj, fa, fb = T.jump_fit(*ridge)
    return [tj, np.log(fa), np.log(fb)]


def _move(a):
    """[f0, f1] -> [ln f0, ln f1, ln f1 - ln f0]: the last component is the movement itself,
    which a stationary reading cannot carry (see control.welch_peak_for_chirp)."""
    a = np.log(np.asarray(a, dtype=np.float64))
    return np.concatenate([a, a[..., 1:2] - a[..., 0:1]], axis=-1)


def _jmove(a):
    a = np.asarray(a, dtype=np.float64)
    return np.concatenate([a, a[..., 2:3] - a[..., 1:2]], axis=-1)


def _pos(v):
    return [max(a, 1e-4) for a in v]


# ---- change points ----------------------------------------------------------------------
def _mean_shift(rng, tau, n=400):
    k = int(tau * n)
    x = rng.standard_normal(n)
    x[k:] += rng.choice([-1, 1]) * rng.uniform(1, 3)
    return x


def _biggest(x, key):
    cps = C.pelt(x)
    if not cps:
        return None
    seg = C.segments(x, cps)
    j = int(np.argmax([key(seg[i], seg[i + 1]) for i in range(len(cps))]))
    return cps[j], seg[j], seg[j + 1]


def _loc_mean(x):
    b = _biggest(x, lambda a, c: abs(c["mean"] - a["mean"]))
    return np.nan if b is None else b[0] / x.size


def _var_shift(rng, p, n=400):
    tau, lr = p
    k = int(tau * n)
    x = rng.standard_normal(n)
    x[k:] *= np.exp(lr / 2)
    return x


def _loc_var(x):
    b = _biggest(x, lambda a, c: abs(np.log(c["sd"] ** 2 / a["sd"] ** 2)))
    return [np.nan, np.nan] if b is None else [b[0] / x.size, 2 * np.log(b[2]["sd"] / b[1]["sd"])]


def _count_series(rng, k, n=600):
    x = rng.standard_normal(n)
    steps = np.zeros(n)
    sgn = 1.0
    for i in range(int(k)):
        pos = int(n * ((i + 1) / (k + 1) + rng.uniform(-0.04, 0.04)))
        steps[pos:] += sgn * rng.uniform(1.5, 3)
        sgn = -sgn
    return x + steps


# ---- time-varying AR --------------------------------------------------------------------
def _ar_drift(rng, ab, n=1500):
    a = np.linspace(ab[0], ab[1], n)
    x = np.zeros(n)
    e = rng.standard_normal(n)
    for t in range(1, n):
        x[t] = a[t] * x[t - 1] + e[t]
    return x


def _ends(x, frac=0.05):
    path, _ = V.coef_path(x, 1)
    k = int(frac * x.size)
    return [float(np.nanmean(path[1:k + 1, 1])), float(np.nanmean(path[-k:, 1]))]


def _global_ar(x):
    y = x - x.mean()
    a = float(y[1:] @ y[:-1] / (y[:-1] @ y[:-1]))
    return [a, a]


def _rw_ar(rng, lq, n=1500):
    q = np.exp(lq)
    c, a = 0.0, rng.uniform(-0.5, 0.5)
    x = np.zeros(n)
    for t in range(1, n):
        c += np.sqrt(q) * rng.standard_normal()
        a += np.sqrt(q) * rng.standard_normal()
        if abs(a) > 0.95:
            a = np.sign(a) * 1.9 - a
        x[t] = c + a * x[t - 1] + rng.standard_normal()
    return x


def _q_hat(x):
    return float(np.log(V.fit(x, 1, grid=V.Q_GRID[1:])["q"]))


# ---- regime switching -------------------------------------------------------------------
def _draw_ms(r):
    return [r.uniform(1.5, 4), r.uniform(-0.7, 0.7), np.log(_logu(r, 20, 200))]


def _ms_series(rng, p, n=2000, phi=0.3):
    gap, lr, ld = p
    stay = 1 - 1 / np.exp(ld)
    mu, sg = np.array([0.0, gap]), np.array([1.0, np.exp(lr)])
    s = np.zeros(n, int)
    s[0] = rng.integers(2)
    for t in range(1, n):
        s[t] = s[t - 1] if rng.random() < stay else 1 - s[t - 1]
    x = np.zeros(n)
    for t in range(1, n):
        x[t] = mu[s[t]] + phi * (x[t - 1] - mu[s[t]]) + sg[s[t]] * rng.standard_normal()
    return x


def _ms_read(x):
    f = G.fit(x)
    return [f["mu"][1] - f["mu"][0], np.log(f["sigma"][1] / f["sigma"][0]), np.log(np.mean(f["duration"]))]


# ---- modes ------------------------------------------------------------------------------
def _draw_two(r):
    f1 = _logu(r, 0.01, 0.05)
    f2 = min(f1 * r.uniform(2, 5), 0.25)
    return [np.log(f1), r.uniform(-4, 2), np.log(f2), r.uniform(-4, 2)]


def _two_modes(rng, p, n=1000):
    t = np.arange(n)
    x = sum(np.exp(g / 1000 * t) * np.cos(2 * np.pi * np.exp(lf) * t + rng.uniform(0, 6.3))
            for lf, g in ((p[0], p[1]), (p[2], p[3])))
    return x + 0.1 * rng.standard_normal(n)


def _read_two(x):
    (f1, g1), (f2, g2) = M.top_modes(x, 2)
    return [np.log(f1), 1000 * g1, np.log(f2), 1000 * g2]


def _growth_switch(rng, gg, n=1200):
    f = _logu(rng, 0.03, 0.15)
    g = np.where(np.arange(n) < n // 2, gg[0], gg[1]) / 1000
    amp = np.exp(np.cumsum(g))
    return amp * np.cos(2 * np.pi * f * np.arange(n) + rng.uniform(0, 6.3)) + 0.01 * rng.standard_normal(n)


def _read_growth(x):
    c, f, g = M.windowed(x, win=200, step=25, rank=2)
    w = 200 / x.size / 2
    return [1000 * float(np.median(g[c + w <= 0.5])), 1000 * float(np.median(g[c - w >= 0.5]))]


def _ab_move(a):
    a = np.asarray(a, dtype=np.float64)
    return np.concatenate([a, a[..., 1:2] - a[..., 0:1]], axis=-1)

CASES = {
    "tf.stft_chirp": (lambda r: [_logu(r, 0.02, 0.3), _logu(r, 0.02, 0.3)], lambda r, p: _chirp(r, p, 8192),
                      lambda x: _pos(T.chirp_fit(*T.stft_ridge(x))), _move, "ln cycles/sample"),
    "tf.cwt_chirp": (lambda r: [_logu(r, 0.02, 0.3), _logu(r, 0.02, 0.3)], lambda r, p: _chirp(r, p, 4096),
                     lambda x: _pos(T.chirp_fit(*T.cwt_ridge(x))), _move, "ln cycles/sample"),
    "tf.stft_jump": (_draw_jump, lambda r, p: _jump(r, p, 8192), lambda x: _jfit(T.stft_ridge(x)), _jmove,
                     "fraction; ln cycles/sample"),
    "tf.cwt_jump": (_draw_jump, lambda r, p: _jump(r, p, 4096), lambda x: _jfit(T.cwt_ridge(x)), _jmove,
                    "fraction; ln cycles/sample"),
    "cp.mean_location": (lambda r: r.uniform(0.15, 0.85), _mean_shift, _loc_mean, None, "fraction"),
    "cp.var_location_ratio": (lambda r: [r.uniform(0.15, 0.85), r.choice([-1, 1]) * r.uniform(np.log(2), np.log(8))],
                              _var_shift, _loc_var, None, "fraction; ln variance ratio"),
    "cp.count": (lambda r: float(r.integers(0, 5)), _count_series, lambda x: float(len(C.pelt(x))), None, "changes"),
    "tvar.ar1_drift": (lambda r: [r.uniform(-0.8, 0.8), r.uniform(-0.8, 0.8)], _ar_drift, _ends, _ab_move,
                       "AR coefficient; end minus start"),
    "tvar.drift_q": (lambda r: r.uniform(np.log(1e-5), np.log(1e-2)), _rw_ar, _q_hat, None, "ln q"),
    "regime.ms_ar1": (_draw_ms, _ms_series, _ms_read, None, "level gap; ln sd ratio; ln duration"),
    "modes.dmd_two": (_draw_two, _two_modes, _read_two, None, "ln f; growth per 1000 samples"),
    "modes.windowed_growth": (lambda r: [r.uniform(-5, 5), r.uniform(-5, 5)], _growth_switch, _read_growth, None,
                              "growth per 1000 samples"),
    "ts.ou_tau": (lambda r: r.uniform(np.log(1), np.log(200)), _ou_esm, _tau_hat, None, "ln hours"),
    "ts.haar_bands_90d": (*_B90, _read_bands, None, "variance share"),
    "ts.fast_share_60d": (*_B60S, lambda ty: _read_bands(ty)[0], None, "within-day variance share"),

}

# Recorded failures, re-checked by the tests so a change is noticed.
FAILED = {
    "ts.ls_slope": (lambda r: r.uniform(0, 2), _powerlaw_esm, _ls_slope, None, "alpha"),
    "ts.haar_bands_30d": (*_B30, _read_bands, None, "variance share"),
    "ts.haar_bands_60d": (*_B60, _read_bands, None, "variance share"),
    "ts.two_timescales": (lambda r: [np.log(_logu(r, 0.5, 6)), np.log(_logu(r, 48, 400))], _two_tau, _read_two_tau,
                          None, "ln hours"),
}

CONTROLS = {
    "control.welch_peak_for_chirp": (CASES["tf.stft_chirp"][0], CASES["tf.stft_chirp"][1],
                                     lambda x: [P := _welch_peak(x), P], _move, "ln cycles/sample"),
    "control.cp_shuffled": (CASES["cp.mean_location"][0], _mean_shift,
                            lambda x: _loc_mean(np.random.default_rng(3).permutation(x)), None, "fraction"),
    "control.global_ar_for_drift": (CASES["tvar.ar1_drift"][0], _ar_drift, _global_ar, _ab_move, "AR coefficient"),
    "control.regime_shuffled": (_draw_ms, _ms_series, lambda x: _ms_read(np.random.default_rng(3).permutation(x)),
                                None, "mixed"),
    "control.dmd_shuffled": (_draw_two, _two_modes, lambda x: _read_two(np.random.default_rng(3).permutation(x)),
                             None, "mixed"),
    "control.ou_shuffled": (CASES["ts.ou_tau"][0], _ou_esm, _shuffled_tau, None, "ln hours"),
}


def _welch_peak(x):
    f, p = welch(x, 1024)
    return float(f[1 + int(np.argmax(p[1:]))])
