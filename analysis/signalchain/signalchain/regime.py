"""Two-regime Markov-switching AR(1).

Model: hidden s_t in {0, 1}, a first-order Markov chain with stay probabilities p_00, p_11;
x_t | x_t-1, s_t ~ N(c_s + phi_s x_t-1, sigma_s^2). Each regime's implied level is
mu_s = c_s / (1 - phi_s); regimes are labelled so mu_0 <= mu_1. Expected stay in regime s is
1 / (1 - p_ss) steps.

Fit: EM (Baum-Welch with weighted least squares in the M-step), scaled forward-backward,
sigma floored at 1e-3 x the series SD, stay probabilities clipped to [0.5, 0.9995]. Three starts
(split at the median of a 9-point running mean; split at its 30th and 70th percentiles); the
highest likelihood wins. 200 iterations or a likelihood gain under 1e-6 per step.

Switching test: LR = 2 (ll_MS - ll_AR1), judged against parametric AR(1) surrogates
(switch_test), since the one-regime model sits on the boundary of the two-regime one.
"""
import numpy as np

from .core import as_1d


def _norm(y, mean, sd):
    return np.exp(-0.5 * ((y - mean) / sd) ** 2) / (sd * np.sqrt(2 * np.pi))


def _fb(e, A, pi):
    n = e.shape[0]
    al, c = np.empty((n, 2)), np.empty(n)
    a = pi * e[0]
    c[0] = a.sum() + 1e-300
    al[0] = a / c[0]
    for t in range(1, n):
        a = (al[t - 1] @ A) * e[t]
        c[t] = a.sum() + 1e-300
        al[t] = a / c[t]
    be = np.ones((n, 2))
    for t in range(n - 2, -1, -1):
        be[t] = (A @ (e[t + 1] * be[t + 1])) / c[t + 1]
    g = al * be
    g /= g.sum(axis=1, keepdims=True)
    eb = e[1:] * be[1:] / c[1:, None]
    xi = A * np.einsum("ti,tj->ij", al[:-1], eb)
    return g, xi, float(np.log(c).sum())


def _em(x, init, iters=200, tol=1e-6):
    y, z = x[1:], x[:-1]
    sd0 = x.std() + 1e-12
    g = np.c_[1 - init, init].astype(float)
    A = np.array([[0.95, 0.05], [0.05, 0.95]])
    pi = np.array([0.5, 0.5])
    prev, ll = -np.inf, -np.inf
    X = np.c_[np.ones_like(z), z]
    par = np.zeros((2, 3))
    for it in range(iters):
        for s in range(2):
            w = g[:, s] + 1e-12
            Xw = X * w[:, None]
            beta = np.linalg.lstsq(Xw.T @ X + 1e-9 * np.eye(2), Xw.T @ y, rcond=None)[0]
            r = y - X @ beta
            par[s] = beta[0], beta[1], max(np.sqrt((w * r * r).sum() / w.sum()), 1e-3 * sd0)
        e = np.c_[_norm(y, par[0, 0] + par[0, 1] * z, par[0, 2]),
                  _norm(y, par[1, 0] + par[1, 1] * z, par[1, 2])] + 1e-300
        g, xi, ll = _fb(e, A, pi)
        A = xi / xi.sum(axis=1, keepdims=True)
        for s in range(2):
            A[s, s] = np.clip(A[s, s], 0.5, 0.9995)
            A[s, 1 - s] = 1 - A[s, s]
        pi = g[0]
        if ll - prev < tol * abs(ll) and it > 5:
            break
        prev = ll
    return {"par": par.copy(), "A": A, "gamma": g, "ll": ll}


def ar1_ll(x):
    y, z = x[1:], x[:-1]
    X = np.c_[np.ones_like(z), z]
    beta = np.linalg.lstsq(X, y, rcond=None)[0]
    r = y - X @ beta
    s2 = r.var()
    return float(-0.5 * y.size * (np.log(2 * np.pi * s2) + 1)), beta, float(np.sqrt(s2))


def fit(x):
    x = as_1d(x)
    k = 9 if x.size >= 45 else 3
    sm = np.convolve(x, np.ones(k) / k, mode="same")[1:]
    best = None
    for q in (50, 30, 70):
        r = _em(x, (sm > np.percentile(sm, q)).astype(float))
        if best is None or r["ll"] > best["ll"]:
            best = r
    par, A = best["par"], best["A"]
    mu = par[:, 0] / np.where(np.abs(1 - par[:, 1]) > 1e-6, 1 - par[:, 1], 1e-6)
    o = np.argsort(mu)
    par, mu = par[o], mu[o]
    A = A[np.ix_(o, o)]
    g = best["gamma"][:, o]
    path = (g[:, 1] > 0.5).astype(int)
    ll1 = ar1_ll(x)[0]
    return {"mu": mu.tolist(), "phi": par[:, 1].tolist(), "sigma": par[:, 2].tolist(),
            "stay": [float(A[0, 0]), float(A[1, 1])],
            "duration": [float(1 / (1 - A[0, 0])), float(1 / (1 - A[1, 1]))],
            "ll": best["ll"], "ll_ar1": ll1, "lr": float(2 * (best["ll"] - ll1)),
            "switches": int(np.abs(np.diff(path)).sum()), "path": path, "p_high": g[:, 1]}


def switch_test(x, nsur=19, seed=0):
    x = as_1d(x)
    r = fit(x)
    _, beta, sd = ar1_ll(x)
    rng = np.random.default_rng(seed)
    lrs = []
    for _ in range(nsur):
        z = np.empty(x.size)
        z[0] = x[0]
        e = rng.standard_normal(x.size) * sd
        for t in range(1, x.size):
            z[t] = beta[0] + beta[1] * z[t - 1] + e[t]
        lrs.append(fit(z)["lr"])
    lrs = np.array(lrs)
    return {"lr": r["lr"], "null_q95": float(np.quantile(lrs, 0.95)),
            "p": float((1 + (lrs >= r["lr"]).sum()) / (nsur + 1)), "switches": r["switches"],
            "mu": r["mu"], "duration": r["duration"], "sigma": r["sigma"]}
