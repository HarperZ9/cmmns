"""How many latents to fit (F55's units, F49's rule).

  parallel analysis   s2_units.pa_count: eigenvalues of the correlation matrix against column-wise
                      permutations (q95 per rank). For ordered data the permutation destroys each
                      column's autocorrelation, and independent red series correlate by chance more
                      than white ones, so ordered data use phase-randomised columns as the null
                      (each column keeps its own spectrum). Same counting rule.
  held-out PPCA       s2_units.cv_ppca with the instrument's folds as the groups.
  two lines           twolines_guard.two_lines_guarded on the per-fold PPCA curve (F49, guard from
                      F91 C3): the held-out optimum is read as an interior optimum only when the curve
                      rises and then falls, each line significant. A side with zero variance or a
                      zero standard error is not significant, so a fall to an exact floor is not a U
                      (v0.3, 2026-10-30; v0.2 called the unguarded twolines.two_lines). A curve that
                      only rises or plateaus gives no CV count.
  fitted k            the larger of the two counts. When both are 0 nothing is fitted: no latent beats
                      the null, and the run reports none (v0.2; v0.1 forced k >= 1, which let a single
                      chance latent through on red noise).
"""
import numpy as np
from sklearn.decomposition import PCA

from .units import ls_spectra, s2_units
from .twolines_guard import two_lines_guarded


def pa_ordered(X, rng, n):
    lam = s2_units.eig(X)
    null = np.array([s2_units.eig(np.column_stack([ls_spectra.phase_randomize(c, rng) for c in X.T]))
                     for _ in range(n)])
    q95 = np.quantile(null, 0.95, axis=0)
    k = 0
    while k < len(lam) and lam[k] > q95[k]:
        k += 1
    return k, lam[:6].tolist(), q95[:6].tolist()


def ppca_folds(X, labels, kmax):
    """Per-fold held-out PPCA log-likelihood per row, the statistic s2_units.cv_ppca sums."""
    ks = list(range(1, min(kmax, X.shape[1] - 1) + 1))
    rows = []
    for f in np.unique(labels):
        tr, te = labels != f, labels == f
        Xtr, Xte = s2_units.z(X[tr]), s2_units.z(X[te], X[tr])
        kk = [k for k in ks if k <= min(Xtr.shape)]
        rows.append([PCA(n_components=k).fit(Xtr).score(Xte) if k in kk else np.nan for k in ks])
    return ks, np.array(rows)


def choose(X, ordered, labels, rng, kmax, n_perm=100):
    Z = s2_units.z(X)
    if ordered:
        k_pa, lam, q95 = pa_ordered(Z, rng, n_perm)
    else:
        k_pa, lam, q95 = s2_units.pa_count(Z, rng, n_perm)
    k_best, ll = s2_units.cv_ppca(Z, labels, kmax)
    ks, per = ppca_folds(Z, labels, kmax)
    xs = np.repeat(ks, per.shape[0]).astype(float)
    ys = per.T.reshape(-1)
    ok = np.isfinite(ys)
    tl = two_lines_guarded(xs[ok], ys[ok])
    interior = bool(tl.get("u")) and tl.get("shape_sought") == "inverted-U"
    k_cv = k_best if interior else 0
    k_fit = int(min(kmax, max(k_pa, k_cv)))
    return {"k_pa": int(k_pa), "pa_eig": lam, "pa_q95": q95, "pa_null": "phase" if ordered else "permutation",
            "k_cv_argmax": int(k_best), "cv_loglik": ll, "two_lines": _tl_summary(tl),
            "cv_interior_optimum": interior, "k_cv": int(k_cv), "k_fit": k_fit, "k_max": int(kmax)}


def _tl_summary(tl):
    keep = ("n", "testable", "why", "shape_sought", "u", "direction", "lines_significant", "guard")
    out = {k: tl[k] for k in keep if k in tl}
    if "robin_hood" in tl:
        r = tl["robin_hood"]
        out.update(break_k=r["xc"], slope_low=r["b1"], p_low=r["p1"], slope_high=r["b2"], p_high=r["p2"])
    return out
