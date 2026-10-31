"""Spectral shape: Welch log-binned beta, Whittle fits of three spectral models, CSN-style Vuong comparison,
surrogates and a known-beta calibration."""
import numpy as np
from scipy import optimize, signal, stats


def welch_beta(x, fs=1.0, n_bins=20):
    """beta from least squares on log10 Welch PSD averaged in log-spaced frequency bins (DC excluded)."""
    x = np.asarray(x, float)
    nper = int(min(len(x), max(64, 2 ** int(np.log2(len(x) / 4)))))
    f, p = signal.welch(x, fs=fs, nperseg=nper, detrend="linear")
    f, p = f[1:], p[1:]
    keep = p > 0
    f, p = f[keep], p[keep]
    if len(f) < 4:
        return float("nan")
    edges = np.logspace(np.log10(f[0]), np.log10(f[-1]), n_bins + 1)
    lf, lp = [], []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (f >= lo) & (f < hi) if hi < edges[-1] else (f >= lo) & (f <= hi)
        if m.any():
            lf.append(np.log10(f[m]).mean())
            lp.append(np.log10(p[m]).mean())
    if len(lf) < 4:
        return float("nan")
    return float(-np.polyfit(lf, lp, 1)[0])


def periodogram(x):
    x = np.asarray(x, float)
    x = signal.detrend(x)
    n = len(x)
    F = np.fft.rfft(x)
    f = np.fft.rfftfreq(n)
    I = (np.abs(F) ** 2) / n
    return f[1:-1] if n % 2 == 0 else f[1:], I[1:-1] if n % 2 == 0 else I[1:]


def _models():
    return {
        "power_law": (lambda th, f: th[0] - th[1] * np.log(f), [0.0, 1.0]),
        "exponential": (lambda th, f: th[0] - th[1] * f, [0.0, 1.0]),
        "lognormal": (lambda th, f: th[0] - (np.log(f) - th[1]) ** 2 / (2 * np.exp(th[2]) ** 2), [0.0, -3.0, 0.5]),
    }


def whittle_fit(f, I):
    """Per-frequency Whittle log-likelihood of each model, maximized; returns {model: (theta, ll_vector)}."""
    out = {}
    scale = np.log(I.mean())
    for name, (logS, th0) in _models().items():
        th0 = np.array(th0, float)
        th0[0] = scale

        def nll(th):
            ls = logS(th, f)
            return float(np.sum(ls + I * np.exp(-ls)))
        best = None
        for start in _starts(name, th0):
            r = optimize.minimize(nll, start, method="Nelder-Mead", options={"maxiter": 4000, "xatol": 1e-6, "fatol": 1e-8})
            if best is None or r.fun < best.fun:
                best = r
        ls = logS(best.x, f)
        out[name] = (best.x, -(ls + I * np.exp(-ls)))
    return out


def _starts(name, th0):
    if name == "lognormal":
        return [th0 + np.array([0, d, s]) for d in (-5.0, -2.0, 0.0) for s in (-0.5, 0.5, 1.5)]
    if name == "exponential":
        return [th0 + np.array([0, d]) for d in (0.0, 5.0, 50.0)]
    return [th0 + np.array([0, d]) for d in (-1.0, 0.0, 1.0)]


def vuong(ll_a, ll_b):
    """CSN likelihood ratio R (positive favours a) and the Vuong two-sided p."""
    d = ll_a - ll_b
    R = float(d.sum())
    sd = d.std()
    if sd == 0:
        return R, 1.0
    z = R / (sd * np.sqrt(len(d)))
    return R, float(2 * stats.norm.sf(abs(z)))


def compare(x, max_freqs=4096):
    """Whittle beta and the power law against each alternative. 'beaten' = an alternative favoured at p < 0.1."""
    f, I = periodogram(x)
    if len(f) > max_freqs:  # log-thin very long series so every decade carries weight in the fit
        idx = np.unique(np.round(np.logspace(0, np.log10(len(f) - 1), max_freqs)).astype(int))
        f, I = f[idx], I[idx]
    fits = whittle_fit(f, I)
    pl = fits["power_law"][1]
    rows = {}
    beaten = False
    for alt in ("exponential", "lognormal"):
        R, p = vuong(pl, fits[alt][1])
        rows[alt] = {"R": R, "p": p}
        beaten = beaten or (R < 0 and p < 0.1)
    return {"beta_whittle": float(fits["power_law"][0][1]), "vs": rows, "power_law_beaten": bool(beaten)}


def phase_randomize(x, rng):
    X = np.fft.rfft(np.asarray(x, float) - np.mean(x))
    ph = rng.uniform(0, 2 * np.pi, len(X))
    ph[0] = 0
    if len(x) % 2 == 0:
        ph[-1] = 0
    return np.fft.irfft(np.abs(X) * np.exp(1j * ph), n=len(x))


def synth(beta, n, rng):
    f = np.fft.rfftfreq(n)
    amp = np.zeros_like(f)
    amp[1:] = f[1:] ** (-beta / 2)
    X = amp * (rng.normal(size=len(f)) + 1j * rng.normal(size=len(f)))
    return np.fft.irfft(X, n=n)


def calibrate(rng, n=4096, reps=10):
    rows = []
    for beta in (0.0, 0.5, 1.0, 1.5, 2.0):
        est = [welch_beta(synth(beta, n, rng)) for _ in range(reps)]
        rows.append({"beta_true": beta, "beta_welch_mean": float(np.mean(est)), "abs_err": float(abs(np.mean(est) - beta))})
    ar_beaten = []
    for _ in range(reps):
        e = rng.normal(size=n)
        y = signal.lfilter([1], [1, -0.9], e)
        ar_beaten.append(compare(y)["power_law_beaten"])
    pl_beaten = [compare(synth(1.0, n, rng))["power_law_beaten"] for _ in range(reps)]
    ok = all(r["abs_err"] < 0.15 for r in rows)
    return {"rows": rows, "ar1_power_law_beaten_share": float(np.mean(ar_beaten)),
            "true_power_law_beaten_share": float(np.mean(pl_beaten)), "estimator_ok": int(ok)}
