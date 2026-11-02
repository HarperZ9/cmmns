"""Check the lens (F72, F73).

F73's law: one linear map per lens carries a shared property from known lenses to a new one. Here a
latent of lens A is lens-stable when the found latents of some other lens B predict its scores
out of sample (cross-validated ridge R^2 >= r2_min) and beat a row-shuffled control (q95 of the
shuffled R^2). A latent no other lens reaches is flagged lens-dependent.

PCA and ICA span the same subspace, so they count as one family: a latent must be reached by a lens of
another family (NMF or the autoencoder) to be stable (v0.2). In v0.1 PCA and ICA confirmed each other,
which at k = 1 is automatic.

F72: transparency depends on the decoder. Every check is repeated with a k-nearest-neighbour
decoder; when the two decoders disagree on stability the latent is flagged decoder-dependent.
"""
import numpy as np
from sklearn.neighbors import KNeighborsRegressor


FAMILY = {"pca": "linear-subspace", "ica": "linear-subspace", "nmf": "nmf", "sae": "autoencoder"}


def _z(P):
    sd = P.std(0)
    sd[sd == 0] = 1
    return (P - P.mean(0)) / sd


def cv_r2(P, y, labels, decoder="ridge", alpha=1.0):
    """Out-of-fold R^2 of y from predictors P."""
    pred = np.zeros_like(y)
    for f in np.unique(labels):
        tr, te = labels != f, labels == f
        mu, sd = P[tr].mean(0), P[tr].std(0)
        sd[sd == 0] = 1
        A, B = (P[tr] - mu) / sd, (P[te] - mu) / sd
        if decoder == "ridge":
            w = np.linalg.solve(A.T @ A + alpha * np.eye(A.shape[1]), A.T @ (y[tr] - y[tr].mean()))
            pred[te] = y[tr].mean() + B @ w
        else:
            nn = KNeighborsRegressor(n_neighbors=int(min(10, max(1, tr.sum() // 5))))
            pred[te] = nn.fit(A, y[tr]).predict(B)
    ss = ((y - y.mean()) ** 2).sum()
    return float(1 - ((y - pred) ** 2).sum() / ss) if ss > 0 else float("nan")


def _one(target, P, labels, rng, n_shuf, r2_min):
    r_ridge = cv_r2(P, target, labels, "ridge")
    r_knn = cv_r2(P, target, labels, "knn")
    null = [cv_r2(P, target[rng.permutation(len(target))], labels, "ridge") for _ in range(n_shuf)]
    q95 = float(np.quantile(null, 0.95))
    return {"r2_ridge": r_ridge, "r2_knn": r_knn, "shuffle_q95": q95,
            "stable_ridge": bool(r_ridge >= r2_min and r_ridge > q95),
            "stable_knn": bool(r_knn >= r2_min and r_knn > q95)}


def check(scores, found, labels, rng, n_shuf=49, r2_min=0.5):
    """scores: {lens: (n, k)}; found: {lens: bool (k,)}. Returns {lens: [row per latent]}."""
    out = {}
    for a, Sa in scores.items():
        rows = []
        for j in range(Sa.shape[1]):
            best, partners = None, {}
            for b, Sb in scores.items():
                if FAMILY[b] == FAMILY[a] or not found[b].any():
                    continue
                r = _one(Sa[:, j], Sb[:, found[b]], labels, rng, n_shuf, r2_min)
                partners[b] = r
                if best is None or r["r2_ridge"] > partners[best]["r2_ridge"]:
                    best = b
            st_r = any(r["stable_ridge"] for r in partners.values())
            st_k = any(r["stable_knn"] for r in partners.values())
            rows.append({"partners": partners, "best_partner": best, "lens_stable": st_r,
                         "lens_dependent": not st_r, "decoder_dependent": st_r != st_k})
        out[a] = rows
    return out
