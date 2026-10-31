"""Put back together, out of sample, and the found test.

For each fold the lens is fitted on the training rows. Each test row is shown half of the columns
(a random half per fold); its latent scores are estimated from those columns through the decoder,
and the other half is predicted. Held-out R^2 = 1 - SSE / SST over the hidden cells, with SST around
the training mean. Ordered data use contiguous blocks as folds, so no neighbouring row leaks.

Found test for latent j: permute the test rows' scores of latent j only (other latents untouched),
predict again, and count how often the shuffled prediction does at least as well. A latent counts as
found only when that p survives Benjamini-Hochberg across every latent of every lens.
"""
import numpy as np
from scipy.optimize import linear_sum_assignment

from . import lenses


def fold_labels(n, n_folds, ordered, rng):
    if ordered:
        return np.minimum(np.arange(n) * n_folds // n, n_folds - 1)
    lab = np.arange(n) % n_folds
    return lab[rng.permutation(n)]


def align(ref, s):
    """Column order and signs that match fold scores s to reference scores ref on the same rows."""
    k = ref.shape[1]
    C = np.zeros((k, s.shape[1]))
    for i in range(k):
        for j in range(s.shape[1]):
            a, b = ref[:, i], s[:, j]
            C[i, j] = 0.0 if a.std() == 0 or b.std() == 0 else np.corrcoef(a, b)[0, 1]
    r, c = linear_sum_assignment(-np.abs(C))
    order = np.empty(k, int)
    order[r] = c
    return order, np.sign(C[r, c] + (C[r, c] == 0))


def _fold(S, tr, te, name, k, rng, ref_scores):
    L = lenses.fit(name, S[tr], k, rng)
    order, sign = align(ref_scores[tr], L["scores"])
    L = {**L, "D": L["D"][order] * sign[:, None], "scores": L["scores"][:, order] * sign}
    d = S.shape[1]
    cols = rng.permutation(d)
    obs, hid = np.sort(cols[: d // 2]), np.sort(cols[d // 2:])
    sc = lenses.scores_from_partial(L, S[te][:, obs], obs)
    return {"L": L, "obs": obs, "hid": hid, "sc": sc, "y": S[te][:, hid], "base": S[tr][:, hid].mean(0)}


def _sse(f, sc, keep=None):
    D = f["L"]["D"][:, f["hid"]]
    m = f["L"]["m"][f["hid"]]
    if keep is not None:
        sc, D = sc[:, keep], D[keep]
    return float(((f["y"] - m - sc @ D) ** 2).sum())


def _refit_kept(f, keep):
    """Scores re-estimated from the observed columns with only the kept latents."""
    L = {**f["L"], "D": f["L"]["D"][keep], "scores": f["L"]["scores"][:, keep]}
    sc = lenses.scores_from_partial(L, f["y_obs"], f["obs"])
    return float(((f["y"] - L["m"][f["hid"]] - sc @ L["D"][:, f["hid"]]) ** 2).sum())


def run(S, name, k, ref_scores, labels, rng, n_perm=199):
    """Held-out R^2 for one lens and the found-test p for each of its latents."""
    folds = []
    for f in np.unique(labels):
        tr, te = labels != f, labels == f
        fo = _fold(S, tr, te, name, k, rng, ref_scores)
        fo["y_obs"] = S[te][:, fo["obs"]]
        folds.append(fo)
    sst = sum(float(((fo["y"] - fo["base"]) ** 2).sum()) for fo in folds)
    sse = sum(_sse(fo, fo["sc"]) for fo in folds)
    r2 = 1 - sse / sst
    kk = folds[0]["sc"].shape[1]
    p, drop = [], []
    for j in range(kk):
        null = []
        for _ in range(n_perm):
            tot = 0.0
            for fo in folds:
                sc = fo["sc"].copy()
                sc[:, j] = sc[rng.permutation(len(sc)), j]
                tot += _sse(fo, sc)
            null.append(1 - tot / sst)
        null = np.array(null)
        p.append(float((np.sum(null >= r2) + 1) / (n_perm + 1)))
        drop.append(float(r2 - null.mean()))
    return {"r2": float(r2), "p": p, "gain_over_shuffle": drop, "folds": folds, "sst": sst}


def r2_kept(res, keep):
    """Held-out R^2 rebuilt from the kept latents only (scores re-estimated without the others)."""
    keep = np.asarray(keep, int)
    if keep.size == 0:
        return 0.0
    sse = sum(_refit_kept(fo, keep) for fo in res["folds"])
    return float(1 - sse / res["sst"])
