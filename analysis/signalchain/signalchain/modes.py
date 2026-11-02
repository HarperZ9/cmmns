"""Dynamic mode decomposition for a scalar series: oscillations with their own growth.

Delay embedding: Hankel matrix with 'delay' rows (default min(n/3, 80)). Snapshot pairs
X = H[:, :-1], Y = H[:, 1:]. Total-least-squares DMD (Hemati et al. 2017): project X and Y onto
the top-r right singular vectors of the stacked [X; Y], which removes the noise bias that pulls
plain DMD eigenvalues toward damping; then exact DMD at rank r. Each eigenvalue lambda gives a
frequency f = arg(lambda) / (2 pi) cycles per sample and a growth rate g = ln|lambda| per
sample (g < 0 damped, g > 0 growing). A real oscillation is a conjugate pair; the f > 0 member
is reported. Amplitude: least-squares mode weights on the first snapshot, scaled by the
mode's mean |exp(g t)| over the record.

Rank rule when not given: Gavish and Donoho (2014) hard threshold for unknown noise,
tau = omega(beta) x median singular value, omega(beta) = 0.56 b^3 - 0.95 b^2 + 1.82 b + 1.43,
beta = rows / columns, rounded up to an even number, at most 20.

Windowed DMD: the same fit in sliding windows, so a mode's f and g can change over time.
"""
import numpy as np

from .core import as_1d


def hankel(x, delay):
    n = x.size - delay + 1
    idx = np.arange(delay)[:, None] + np.arange(n)[None, :]
    return x[idx]


def gd_rank(s, beta):
    w = 0.56 * beta ** 3 - 0.95 * beta ** 2 + 1.82 * beta + 1.43
    r = int((s > w * np.median(s)).sum())
    return int(min(20, max(2, r + (r % 2))))


def dmd(x, rank=None, delay=None):
    x = as_1d(x)
    x = x - x.mean()
    d = int(delay or min(x.size // 3, 80))
    H = hankel(x, d)
    X, Y = H[:, :-1], H[:, 1:]
    Z = np.vstack([X, Y])
    _, sz, Vh = np.linalg.svd(Z, full_matrices=False)
    r = int(rank) if rank else gd_rank(sz, min(Z.shape) / max(Z.shape))
    Pv = Vh[:r].conj().T @ Vh[:r]
    X, Y = X @ Pv, Y @ Pv
    U, s, Vh2 = np.linalg.svd(X, full_matrices=False)
    U, s, V = U[:, :r], s[:r], Vh2[:r].conj().T
    At = U.conj().T @ Y @ V / s
    lam, W = np.linalg.eig(At)
    Phi = Y @ V / s @ W
    b = np.linalg.lstsq(Phi, H[:, 0], rcond=None)[0]
    f = np.angle(lam) / (2 * np.pi)
    g = np.log(np.abs(lam) + 1e-300)
    t = np.arange(x.size)
    amp = np.abs(b) * np.linalg.norm(Phi, axis=0) * np.array([np.mean(np.exp(gi * t)) for gi in g])
    keep = f > 1e-6
    o = np.argsort(-amp[keep])
    return {"f": f[keep][o].tolist(), "g": g[keep][o].tolist(), "amp": amp[keep][o].tolist(),
            "rank": r, "delay": d, "real_modes": [float(gi) for gi, fi in zip(g, f) if abs(fi) <= 1e-6]}


def top_modes(x, k=2, rank=None, delay=None):
    """The k largest oscillatory modes, sorted by frequency: list of (f, g)."""
    r = dmd(x, rank or 2 * k, delay)
    m = sorted(zip(r["f"][:k], r["g"][:k]))
    if len(m) < k:
        raise ValueError(f"only {len(m)} oscillatory modes at rank {r['rank']}")
    return m


def windowed(x, win=200, step=50, rank=2, delay=None):
    """Dominant mode per window: arrays of window centre (fraction), f, g."""
    x = as_1d(x)
    cs, fs, gs = [], [], []
    for s in range(0, x.size - win + 1, step):
        r = dmd(x[s:s + win], rank, delay or win // 4)
        if r["f"]:
            cs.append((s + win / 2) / x.size)
            fs.append(r["f"][0])
            gs.append(r["g"][0])
    return np.array(cs), np.array(fs), np.array(gs)
