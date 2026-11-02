"""Time-varying autoregression by Kalman filter and RTS smoother.

Model: x_t = c_t + a_1,t x_t-1 + ... + a_p,t x_t-p + e_t, e_t ~ N(0, R). The state
beta_t = (c_t, a_1,t, ..., a_p,t) follows a random walk, beta_t = beta_t-1 + w_t,
w_t ~ N(0, q R I). R is concentrated out of the likelihood (every variance is in units of R, and
R_hat = mean(v_t^2 / F_t)), so q is the one free parameter: the drift variance per step
relative to the noise. q = 0 is a constant-coefficient AR(p) fitted recursively.

q is chosen by maximum profile likelihood over the grid 0 and 10^-7 .. 10^-1 (25 points),
the first 'burn' innovations excluded so every q is scored on the same points. The drift
test is LR = 2 (ll(q_hat) - ll(0)); for a real series it is judged against AR surrogates with
constant coefficients (drift_test), since q = 0 sits on the boundary and LR is not chi-square.
"""
import numpy as np

from .core import as_1d

Q_GRID = np.r_[0.0, np.logspace(-7, -1, 25)]


def _design(x, p):
    n = x.size
    H = np.ones((n - p, p + 1))
    for j in range(1, p + 1):
        H[:, j] = x[p - j:n - j]
    return H, x[p:]


def kalman(x, p=1, q=1e-4, burn=20, smooth=False, p0=1e3):
    x = as_1d(x)
    H, y = _design(x, p)
    m, d = H.shape
    b = np.zeros(d)
    P = np.eye(d) * p0
    Qm = np.eye(d) * q
    bs, Ps, bp, Pp = np.empty((m, d)), np.empty((m, d, d)), np.empty((m, d)), np.empty((m, d, d))
    v, F = np.empty(m), np.empty(m)
    for t in range(m):
        P = P + Qm
        bp[t], Pp[t] = b, P
        h = H[t]
        Ph = P @ h
        F[t] = h @ Ph + 1.0
        v[t] = y[t] - h @ b
        K = Ph / F[t]
        b = b + K * v[t]
        P = P - np.outer(K, Ph)
        bs[t], Ps[t] = b, P
    vv, FF = v[burn:], F[burn:]
    R = float(np.mean(vv * vv / FF))
    ll = float(-0.5 * (np.log(FF).sum() + vv.size * np.log(R) + vv.size))
    out = {"q": q, "R": R, "ll": ll, "filtered": bs}
    if smooth:
        sm = bs.copy()
        for t in range(m - 2, -1, -1):
            J = Ps[t] @ np.linalg.inv(Pp[t + 1])
            sm[t] = bs[t] + J @ (sm[t + 1] - bp[t + 1])
        out["smoothed"] = sm
    return out


def ll_grid(x, p=1, grid=Q_GRID, burn=20, p0=1e3):
    """Profile log-likelihood for every q in grid at once (batched filter)."""
    x = as_1d(x)
    H, y = _design(x, p)
    m, d = H.shape
    if m <= burn + 10:
        # Too short: the burn-in would leave no innovations to score (found on the FIA annual
        # series, n = 12 to 14, where every LR came back NaN and p fell to its floor).
        raise ValueError(f"series of {x.size} is too short for burn-in {burn}")
    G = len(grid)
    b = np.zeros((G, d))
    P = np.broadcast_to(np.eye(d) * p0, (G, d, d)).copy()
    Qm = np.asarray(grid)[:, None, None] * np.eye(d)
    v, F = np.empty((m, G)), np.empty((m, G))
    for t in range(m):
        P += Qm
        h = H[t]
        Ph = P @ h
        f = Ph @ h + 1.0
        e = y[t] - b @ h
        K = Ph / f[:, None]
        b += K * e[:, None]
        P -= K[:, :, None] * Ph[:, None, :]
        v[t], F[t] = e, f
    vv, FF = v[burn:], F[burn:]
    R = np.mean(vv * vv / FF, axis=0)
    return -0.5 * (np.log(FF).sum(axis=0) + vv.shape[0] * np.log(R) + vv.shape[0])


def fit(x, p=1, grid=Q_GRID, burn=20):
    lls = ll_grid(x, p, grid, burn)
    j = int(np.argmax(lls))
    best = kalman(x, p, grid[j], burn, smooth=True)
    best["ll0"] = float(lls[0]) if grid[0] == 0 else float("nan")
    best["lr"] = float(2 * (lls[j] - best["ll0"])) if grid[0] == 0 else float("nan")
    best["grid_ll"] = lls.tolist()
    return best


def coef_path(x, p=1, grid=Q_GRID):
    """Smoothed coefficient paths, padded with NaN for the first p samples."""
    r = fit(x, p, grid)
    sm = r["smoothed"]
    return np.vstack([np.full((p, sm.shape[1]), np.nan), sm]), r


def drift_test(x, p=1, nsur=49, seed=0):
    x = as_1d(x)
    r = fit(x, p)
    H, y = _design(x, p)
    coef = np.linalg.lstsq(H, y, rcond=None)[0]
    sd = float(np.std(y - H @ coef))
    rng = np.random.default_rng(seed)
    lrs = []
    for _ in range(nsur):
        z = np.empty(x.size)
        z[:p] = x[:p]
        e = rng.standard_normal(x.size) * sd
        for t in range(p, x.size):
            z[t] = coef[0] + coef[1:] @ z[t - p:t][::-1] + e[t]
        g = ll_grid(z, p)
        lrs.append(2 * (g.max() - g[0]))
    lrs = np.array(lrs)
    return {"q": r["q"], "lr": r["lr"], "null_q95": float(np.quantile(lrs, 0.95)),
            "p": float((1 + (lrs >= r["lr"]).sum()) / (nsur + 1))}
