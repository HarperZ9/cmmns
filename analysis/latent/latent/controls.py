"""Falsification: planted structure, pure noise, and the recovery score.

planted()   data with k known latents, mixed into d variables with a set share of noise. Mixing:
            'linear'    X = Z A + noise, Gaussian Z, dense A;
            'sparse'    Laplace Z (sparse sources), each variable loads on one latent plus a 20%
                        chance of a second;
            'nonlinear' tanh(1.5 Z A) plus half a squared term of another mix of Z.
            Ordered data get AR(1) latents (phi 0.5) and AR(1) noise with the data's own lag-1
            autocorrelation, so the control is red where the data are red.
negative()  the data with every column scrambled on its own: a permutation for unordered rows,
            a phase randomisation for ordered rows (each column keeps its spectrum, the shared
            structure goes).
recovery()  each planted latent is regressed on the surviving latents' scores (cross-validated
            ridge); recovered when that R^2 >= 0.7.
"""
import numpy as np

from .stability import cv_r2
from .units import ls_spectra

R2_RECOVER = 0.7


def _ar1(n, m, phi, rng):
    e = rng.normal(size=(n, m))
    if phi == 0:
        return e
    out = np.empty_like(e)
    out[0] = e[0] / np.sqrt(1 - phi ** 2)
    for t in range(1, n):
        out[t] = phi * out[t - 1] + e[t]
    return out


def _std(M):
    sd = M.std(0)
    sd[sd == 0] = 1
    return (M - M.mean(0)) / sd


def _mix(Z, d, mixing, rng):
    k = Z.shape[1]
    A = rng.normal(size=(k, d))
    if mixing == "sparse":
        mask = np.zeros((k, d), bool)
        mask[rng.integers(0, k, d), np.arange(d)] = True
        mask |= rng.random((k, d)) < 0.2
        A = A * mask
    S = _std(Z @ A)
    if mixing == "nonlinear":
        S = _std(np.tanh(1.5 * S) + 0.5 * _std(Z @ rng.normal(size=(k, d))) ** 2)
    return S


def planted(n, d, k, noise_share, rng, mixing="linear", ordered=False, phi_noise=0.0):
    if ordered:
        Z = _std(_ar1(n, k, 0.5, rng))
    elif mixing == "sparse":
        Z = _std(rng.laplace(size=(n, k)))
    else:
        Z = rng.normal(size=(n, k))
    S = _mix(Z, d, mixing, rng)
    E = _std(_ar1(n, d, phi_noise, rng))
    return np.sqrt(1 - noise_share) * S + np.sqrt(noise_share) * E, Z


def negative(X, ordered, rng):
    if ordered:
        return np.column_stack([ls_spectra.phase_randomize(c, rng) + c.mean() for c in X.T])
    return np.column_stack([rng.permutation(c) for c in X.T])


def recovery(Z, kept_scores, labels):
    """R^2 per planted latent from the surviving scores; rate = share recovered."""
    if kept_scores is None or kept_scores.shape[1] == 0:
        r2 = [0.0] * Z.shape[1]
    else:
        r2 = [max(0.0, cv_r2(kept_scores, Z[:, j], labels)) for j in range(Z.shape[1])]
    rec = [r >= R2_RECOVER for r in r2]
    return {"r2": r2, "recovered": rec, "rate": float(np.mean(rec)), "threshold": R2_RECOVER}


def matched_noise(X, k_fit, ordered):
    """Noise share and lag-1 autocorrelation that make a planted control look like these data."""
    Z = _std(X)
    lam = np.sort(np.linalg.eigvalsh(np.corrcoef(Z, rowvar=False)))[::-1]
    share = float(np.clip(1 - lam[:k_fit].sum() / Z.shape[1], 0.05, 0.98))
    phi = 0.0
    if ordered:
        r1 = [np.corrcoef(c[:-1], c[1:])[0, 1] for c in Z.T]
        phi = float(np.clip(np.nanmedian(r1), 0.0, 0.95))
    return share, phi
