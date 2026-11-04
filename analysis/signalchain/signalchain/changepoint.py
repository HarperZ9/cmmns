"""Change-point detection by PELT (Killick, Fearnhead and Eckley 2012).

Segment cost, model "meanvar": n ln(sigma_hat^2) for a segment of n points with its own mean and
variance (twice the Gaussian negative log-likelihood up to a constant), variance floored at
1e-8 x the series variance. Model "mean": sum of squared deviations from the segment mean over
sigma^2, sigma from the MAD of first differences / (0.6745 sqrt 2), robust to the shifts.

Penalty rule, stated before any data: BIC. Each added change costs k ln n with k the parameters
it adds: 3 for meanvar (location, mean, variance), 2 for mean (location, mean). Minimum segment
length 5. The cost assumes independent noise; autocorrelated noise inflates the count, which
false_positive_rate shows. For a real series the count is judged against AR(1) surrogates
(excess_changes): same length, mean, variance and lag-1 coefficient, no change points.
"""
import numpy as np

from .core import as_1d


def _cost_fn(x, model):
    n = x.size
    c1 = np.r_[0.0, np.cumsum(x)]
    c2 = np.r_[0.0, np.cumsum(x * x)]
    if model == "meanvar":
        floor = 1e-8 * max(x.var(), 1e-300)

        def cost(s, t):  # segment x[s:t], s array
            m = t - s
            v = (c2[t] - c2[s]) / m - ((c1[t] - c1[s]) / m) ** 2
            return m * np.log(np.maximum(v, floor))
        return cost, 3
    if model == "mean":
        sig2 = (np.median(np.abs(np.diff(x) - np.median(np.diff(x)))) / (0.6745 * np.sqrt(2))) ** 2
        sig2 = max(sig2, 1e-12 * max(x.var(), 1e-300))

        def cost(s, t):
            m = t - s
            return ((c2[t] - c2[s]) - (c1[t] - c1[s]) ** 2 / m) / sig2
        return cost, 2
    raise ValueError(f"unknown model {model!r}")


def pelt(x, model="meanvar", min_seg=5, penalty=None):
    """Change-point indices (segment starts after the first), sorted."""
    x = as_1d(x)
    n = x.size
    cost, k = _cost_fn(x, model)
    beta = k * np.log(n) if penalty is None else float(penalty)
    F = np.full(n + 1, np.inf)
    F[0] = -beta
    last = np.zeros(n + 1, dtype=int)
    cands = np.array([0])
    for t in range(min_seg, n + 1):
        elig = (t - cands) >= min_seg
        s = cands[elig]
        if s.size:
            cs = cost(s, t)
            vals = F[s] + cs + beta
            j = int(np.argmin(vals))
            F[t], last[t] = vals[j], s[j]
            keep = np.ones(cands.size, dtype=bool)
            keep[elig] = F[s] + cs <= F[t]
            cands = cands[keep]
        if np.isfinite(F[t]):
            cands = np.r_[cands, t]
    cps, t = [], n
    while t > 0:
        t = last[t]
        if t > 0:
            cps.append(int(t))
    return sorted(cps)


def segments(x, cps):
    x = as_1d(x)
    b = [0] + list(cps) + [x.size]
    return [{"start": b[i], "end": b[i + 1], "mean": float(x[b[i]:b[i + 1]].mean()),
             "sd": float(x[b[i]:b[i + 1]].std())} for i in range(len(b) - 1)]


def ar1_fit(x):
    x = as_1d(x)
    m = x.mean()
    y = x - m
    phi = float(np.clip((y[1:] @ y[:-1]) / max(y[:-1] @ y[:-1], 1e-300), -0.99, 0.99))
    return m, phi, float(y.std())


def ar1_surrogate(rng, n, m, phi, sd):
    e = rng.standard_normal(n) * sd * np.sqrt(1 - phi * phi)
    y = np.empty(n)
    y[0] = rng.standard_normal() * sd
    for i in range(1, n):
        y[i] = phi * y[i - 1] + e[i]
    return y + m


def false_positive_rate(rng, n=500, trials=200, phi=0.0, model="meanvar"):
    hits = 0
    for _ in range(trials):
        hits += len(pelt(ar1_surrogate(rng, n, 0.0, phi, 1.0), model)) > 0
    return hits / trials


def excess_changes(x, nsur=99, seed=0, model="meanvar"):
    """Observed change count against AR(1) surrogates fitted to x. The AR(1) fit absorbs part
    of any real shift into phi, so this null is conservative."""
    x = as_1d(x)
    obs = len(pelt(x, model))
    m, phi, sd = ar1_fit(x)
    rng = np.random.default_rng(seed)
    sur = np.array([len(pelt(ar1_surrogate(rng, x.size, m, phi, sd), model)) for _ in range(nsur)])
    return {"count": obs, "null_q95": float(np.quantile(sur, 0.95)), "null_mean": float(sur.mean()),
            "p": float((1 + (sur >= obs).sum()) / (nsur + 1)), "phi": phi}
