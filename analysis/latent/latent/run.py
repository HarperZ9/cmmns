"""A full instrument run: discover, map order and disorder, run the controls, call validity."""
import time

import numpy as np
from scipy import stats

from . import controls, order, pipeline


def _loadings(fit, cols, top=8):
    D = fit["D"]
    rows = []
    for j in range(D.shape[0]):
        w = D[j]
        idx = np.argsort(-np.abs(w))[:top]
        a2 = w ** 2
        rows.append({"top": [{"variable": cols[i], "weight": float(w[i])} for i in idx],
                     "spread": float(a2.sum() ** 2 / (a2 ** 2).sum() / len(w)) if a2.sum() > 0 else 0.0})
    return rows


def _unordered_order(s, rng, n=99):
    """For unordered rows only the distribution can show order: excess kurtosis against
    Gaussian samples of the same size (heavy tails or a sparse code read as order)."""
    k = float(stats.kurtosis(s))
    null = np.array([stats.kurtosis(rng.normal(size=len(s))) for _ in range(n)])
    return {"excess_kurtosis": k, "gauss_q95": float(np.quantile(null, 0.95)),
            "p_heavy": float((np.sum(null >= k) + 1) / (n + 1))}


def order_map(X, cols, res, ordered, rng, cfg):
    lat_rows, var_rows = [], []
    for a, fit in res["_fits"].items():
        for r in res["lenses"][a]["latents"]:
            s = fit["scores"][:, r["index"]]
            if ordered:
                lat_rows.append({"lens": a, "index": r["index"], **order.profile(s, rng, cfg["n_surr_latent"])})
            else:
                lat_rows.append({"lens": a, "index": r["index"], **_unordered_order(s, rng)})
    if ordered:
        for j, c in enumerate(cols):
            var_rows.append({"variable": c, **order.profile(X[:, j], rng, cfg["n_surr_var"])})
        order.classify(lat_rows)
        order.classify(var_rows)
    return {"ordered": ordered, "latents": lat_rows, "variables": var_rows,
            "note": None if ordered else "rows are unordered, so spectra and compression along rows "
                                         "are not defined; latents report distribution shape only"}


def _controls(X, res, ordered, rng, cfg):
    n, d = X.shape
    k_pl = int(max(1, min(res["k"]["k_fit"], 5)))  # at least one, so a null run still meets a planted latent
    share, phi = controls.matched_noise(X, k_pl, ordered)
    Xp, Zp = controls.planted(n, d, k_pl, share, rng, "linear", ordered, phi)
    rp = pipeline.discover(Xp, ordered, rng, cfg)
    rec = controls.recovery(Zp, rp["_union"], rp["_labels"])
    rn = pipeline.discover(controls.negative(X, ordered, rng), ordered, rng, cfg)
    pos = {"k_planted": k_pl, "noise_share": share, "noise_phi": phi, "k_found": rp["k_found"],
           "recovery": rec, "pass": bool(rec["rate"] >= 0.8)}
    neg = {"scramble": "phase per column" if ordered else "permutation per column",
           "k_found": rn["k_found"], "n_survivors": rn["n_survivors"], "pass": not rn["any_survivor"]}
    return {"positive": pos, "negative": neg, "valid": bool(pos["pass"] and neg["pass"])}


def run(X, cols, ordered=False, seed=20261029, cfg=None, with_controls=True, return_fits=False):
    """Full run. return_fits=True also returns the lens fits (decoders and scores) for callers that
    need the loadings as arrays, such as an external check."""
    cfg = {**pipeline.DEFAULTS, **(cfg or {})}
    rng = np.random.default_rng(seed)
    t0 = time.perf_counter()
    res = pipeline.discover(X, ordered, rng, cfg)
    out = pipeline.public(res)
    for a, fit in res["_fits"].items():
        for r, ld in zip(out["lenses"][a]["latents"], _loadings(fit, cols)):
            r["loadings"] = ld
        out["lenses"][a]["scores"] = fit["scores"].round(5).tolist()
        if "dead_units" in fit:
            out["lenses"][a]["dead_units"] = fit["dead_units"]
    out["order"] = order_map(X, cols, res, ordered, rng, cfg)
    if with_controls:
        out["controls"] = _controls(X, res, ordered, rng, cfg)
        out["valid"] = out["controls"]["valid"]
    out["survivors"] = [{"lens": a, "index": r["index"]} for a in out["lenses"]
                        for r in out["lenses"][a]["latents"] if r["survives"]]
    out["columns"] = list(cols)
    out["config"] = {**cfg, "seed": seed}
    out["seconds"] = round(time.perf_counter() - t0, 1)
    return (out, res["_fits"]) if return_fits else out
