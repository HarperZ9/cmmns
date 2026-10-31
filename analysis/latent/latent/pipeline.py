"""The instrument: take apart, check the lens, put back together, falsify.

discover(X) is the core: choose k, fit every lens, run the held-out found test for every latent,
apply Benjamini-Hochberg across all latents of all lenses, check each latent against the other
lenses, and keep the survivors (found and lens-stable). k_found counts survivors in the linear
lenses (PCA, ICA, NMF); the autoencoder has two units per latent, so its count is reported apart.
run.run(X) adds the order/disorder map, the planted and pure-noise controls, and the validity call.
"""
import numpy as np

from . import controls, heldout, lenses, order, select, stability
from .units import s2_units

DEFAULTS = {"n_folds": 5, "n_perm": 199, "n_pa": 100, "n_shuf": 49, "n_surr_latent": 39,
            "n_surr_var": 19, "k_cap": 12, "q": 0.05, "r2_min": 0.5}


def _scale(X):
    sd = X.std(0)
    sd[sd == 0] = 1
    return X / sd


def _kmax(n, d, cap):
    return int(max(2, min(cap, d - 1, n // 4)))


def _found(per_lens, q):
    keys = [(a, j) for a in per_lens for j in range(len(per_lens[a]["p"]))]
    qs = s2_units.bh([per_lens[a]["p"][j] for a, j in keys]) if keys else []
    found = {a: np.zeros(len(per_lens[a]["p"]), bool) for a in per_lens}
    qv = {a: [1.0] * len(per_lens[a]["p"]) for a in per_lens}
    for (a, j), v in zip(keys, qs):
        found[a][j] = v <= q
        qv[a][j] = float(v)
    return found, qv


def discover(X, ordered=False, rng=None, cfg=None):
    cfg = {**DEFAULTS, **(cfg or {})}
    rng = rng if rng is not None else np.random.default_rng(0)
    n, d = X.shape
    S = _scale(X)
    labels = heldout.fold_labels(n, cfg["n_folds"], ordered, rng)
    k = select.choose(X, ordered, labels, rng, _kmax(n, d, cfg["k_cap"]), cfg["n_pa"])
    fits, held = {}, {}
    if k["k_fit"] == 0:
        return {"n": n, "d": d, "ordered": ordered, "k": k, "lenses": {}, "n_survivors": {}, "k_found": 0,
                "any_survivor": False, "_fits": {}, "_union": np.zeros((n, 0)), "_labels": labels}
    for name in lenses.available(S):
        fits[name] = lenses.fit(name, S, k["k_fit"], rng)
        held[name] = heldout.run(S, name, k["k_fit"], fits[name]["scores"], labels, rng, cfg["n_perm"])
    found, qv = _found(held, cfg["q"])
    scores = {a: fits[a]["scores"] for a in fits}
    stab = stability.check(scores, found, labels, rng, cfg["n_shuf"], cfg["r2_min"])
    lat = {}
    for a in fits:
        surv = [bool(found[a][j] and stab[a][j]["lens_stable"]) for j in range(len(found[a]))]
        keep = np.nonzero(surv)[0]
        lat[a] = {"r2_heldout_all": held[a]["r2"], "r2_heldout_kept": heldout.r2_kept(held[a], keep),
                  "latents": [{"index": j, "p_found": held[a]["p"][j], "q_found": qv[a][j],
                               "gain_over_shuffle": held[a]["gain_over_shuffle"][j],
                               "found": bool(found[a][j]), **_slim(stab[a][j]), "survives": surv[j]}
                              for j in range(len(found[a]))]}
    surv_scores = [fits[a]["scores"][:, [r["index"] for r in lat[a]["latents"] if r["survives"]]] for a in fits]
    union = np.hstack(surv_scores) if surv_scores else np.zeros((n, 0))
    n_surv = {a: sum(r["survives"] for r in lat[a]["latents"]) for a in lat}
    linear = [n_surv[a] for a in n_surv if a != "sae"]
    return {"n": n, "d": d, "ordered": ordered, "k": k, "lenses": lat, "n_survivors": n_surv,
            "k_found": int(max(linear) if linear else 0), "any_survivor": bool(sum(n_surv.values())),
            "_fits": fits, "_union": union,
            "_labels": labels}


def _slim(row):
    return {"best_partner": row["best_partner"], "lens_stable": row["lens_stable"],
            "lens_dependent": row["lens_dependent"], "decoder_dependent": row["decoder_dependent"],
            "partners": row["partners"]}


def public(res):
    return {k: v for k, v in res.items() if not k.startswith("_")}
