"""Decomposition lenses. Every lens returns the same shape of answer so the rest of the instrument
treats them alike: a mean m (d,), a linear decoder D (k, d) with x ~ m + s @ D, and the scores s of
the rows it was fitted on. Data arrive scaled by column SD and not centred, so NMF can run on
non-negative data; the other lenses centre internally.

  pca   principal components (sklearn)
  ica   FastICA (sklearn), unit-variance whitening
  nmf   non-negative matrix factorisation (sklearn), only when every value is >= 0
  sae   a small sparse autoencoder: ReLU encoder, linear decoder with unit-norm rows, L1 on codes,
        2k hidden units because a ReLU code cannot go negative (one unit per sign)
"""
import warnings

import numpy as np
from sklearn.decomposition import NMF, PCA, FastICA
from sklearn.exceptions import ConvergenceWarning


def _pca(S, k, rng):
    p = PCA(n_components=k).fit(S)
    return {"m": p.mean_, "D": p.components_, "scores": p.transform(S)}


def _ica(S, k, rng):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", ConvergenceWarning)
        f = FastICA(n_components=k, whiten="unit-variance", max_iter=1000,
                    random_state=int(rng.integers(2 ** 31)))
        s = f.fit_transform(S)
    return {"m": f.mean_, "D": f.mixing_.T, "scores": s}


def _nmf(S, k, rng):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", ConvergenceWarning)
        f = NMF(n_components=k, init="nndsvda", max_iter=1000, random_state=int(rng.integers(2 ** 31)))
        W = f.fit_transform(S)
    return {"m": np.zeros(S.shape[1]), "D": f.components_, "scores": W}


def _adam(params, grads, state, lr, t, b1=0.9, b2=0.999, eps=1e-8):
    for i, (p, g) in enumerate(zip(params, grads)):
        m, v = state.setdefault(i, (np.zeros_like(p), np.zeros_like(p)))
        m = b1 * m + (1 - b1) * g
        v = b2 * v + (1 - b2) * g * g
        state[i] = (m, v)
        p -= lr * (m / (1 - b1 ** t)) / (np.sqrt(v / (1 - b2 ** t)) + eps)


def sae_fit(S, k, rng, l1=0.05, steps=600, lr=0.02):
    """Full-batch Adam on mean squared error plus l1 times the mean absolute code."""
    mu = S.mean(0)
    X = S - mu
    n, d = X.shape
    h = 2 * k
    W1 = rng.normal(0, 1 / np.sqrt(d), (d, h))
    b1 = np.zeros(h)
    W2 = W1.T.copy() / np.linalg.norm(W1.T, axis=1, keepdims=True)
    b2 = np.zeros(d)
    state = {}
    for t in range(1, steps + 1):
        pre = X @ W1 + b1
        H = np.maximum(pre, 0)
        G = 2 * (H @ W2 + b2 - X) / (n * d)
        dH = (G @ W2.T + l1 * np.sign(H) / (n * h)) * (pre > 0)
        _adam([W1, b1, W2, b2], [X.T @ dH, dH.sum(0), H.T @ G, G.sum(0)], state, lr, t)
        W2 /= np.maximum(np.linalg.norm(W2, axis=1, keepdims=True), 1e-12)
    H = np.maximum(X @ W1 + b1, 0)
    return {"m": mu + b2, "D": W2, "scores": H, "dead_units": int((H.max(0) <= 1e-9).sum())}


FITTERS = {"pca": _pca, "ica": _ica, "nmf": _nmf, "sae": sae_fit}


def available(S):
    """Lens names that apply to this data: NMF only when every value is non-negative."""
    names = ["pca", "ica"]
    if np.all(S >= 0):
        names.append("nmf")
    return names + ["sae"]


def fit(name, S, k, rng):
    out = FITTERS[name](S, k, rng)
    out["name"] = name
    out["sigma2"] = noise_var(out, S)
    return out


def noise_var(L, S):
    """Residual variance per cell on the rows the lens was fitted on."""
    R = S - L["m"] - L["scores"] @ L["D"]
    return float(max(np.mean(R ** 2), 1e-6))


def scores_from_partial(L, x_obs, cols):
    """Scores for rows seen only on columns `cols`: the Gaussian posterior mean
    s = mu + C D_c (D_c' C D_c + sigma2 I)^-1 (x - m - mu D_c), with mu and C the mean and
    covariance of the lens's training scores and sigma2 its residual variance. Plain least squares
    would fit the noise."""
    Dc = L["D"][:, cols]
    mu = L["scores"].mean(0)
    C = np.cov(L["scores"], rowvar=False).reshape(Dc.shape[0], Dc.shape[0])
    M = Dc.T @ C @ Dc + L["sigma2"] * np.eye(Dc.shape[1])
    r = x_obs - L["m"][cols] - mu @ Dc
    return mu + (C @ Dc @ np.linalg.solve(M, r.T)).T
