"""Order and disorder of one series, with surrogates. Needs rows in a meaningful order.

  beta        spectral exponent, ls_spectra.welch_beta (F74)
  ceiling     1 - spectral flatness, fc_core.flatness rule 'dj' (F76): a bound on one-step linear
              forecast skill, read with its surrogate envelope, never as a point ceiling
  diff_ratio  zlib size of neighbour differences over zlib size of values, pixel._ratio (F61);
              below 1 means the information sits in changes more than in levels
  bits        zlib bits per symbol of the quantised values
  Quantisation: 32 levels, min to max. The pixel unit was built on 512-pixel image rows; at 8 bits a
  series of a few hundred values does not compress at all and every ratio reads 1.0, so the series
  are quantised more coarsely before the same ratio is taken.

Surrogates: shuffles (order destroyed, values kept) decide red, white or blue. Phase-randomised
copies keep the spectrum by construction (F74), so they are the null for structure beyond the
spectrum: a diff_ratio below the phase surrogates' 5th percentile is flagged as nonlinear order.
"""
import zlib

import numpy as np

from .units import fc_core, ls_spectra, pixel

Z9 = lambda b: zlib.compress(b, 9)  # noqa: E731


LEVELS = 32


def quantise(x, levels=LEVELS):
    x = np.asarray(x, float)
    lo, hi = x.min(), x.max()
    if hi <= lo:
        return np.zeros(len(x), np.uint8)
    return np.round((levels - 1) * (x - lo) / (hi - lo)).astype(np.uint8)


def measures(x):
    q = quantise(x)
    r, _ = fc_core.flatness(x)
    return {"beta": ls_spectra.welch_beta(x), "ceiling": float(1 - r),
            "diff_ratio": float(pixel._ratio(q[None, :], Z9)), "bits": 8.0 * len(Z9(q.tobytes())) / len(q)}


def _p_ge(real, null):
    """One-sided p that real sits above the null: a normal approximation to the surrogate
    distribution (z from its mean and SD), so Benjamini-Hochberg is not limited by the number of
    surrogates. The empirical rank p is kept beside it in the report."""
    from scipy.stats import norm
    null = np.asarray(null, float)
    null = null[np.isfinite(null)]
    if len(null) < 3 or not np.isfinite(real):
        return float("nan")
    sd = null.std(ddof=1)
    if sd == 0:
        return 0.0 if real > null.mean() else 1.0
    return float(norm.sf((real - null.mean()) / sd))


def _p_rank(real, null):
    null = np.asarray(null, float)
    null = null[np.isfinite(null)]
    return float((np.sum(null >= real) + 1) / (len(null) + 1)) if len(null) else float("nan")


def profile(x, rng, n_surr=39):
    x = np.asarray(x, float)
    real = measures(x)
    sh = [measures(rng.permutation(x)) for _ in range(n_surr)]
    ph = [measures(ls_spectra.phase_randomize(x, rng)) for _ in range(n_surr)]
    col = lambda rows, k: np.array([r[k] for r in rows], float)  # noqa: E731
    out = dict(real)
    for k in ("beta", "ceiling", "diff_ratio"):
        out[f"{k}_shuffle_q05"] = float(np.nanquantile(col(sh, k), 0.05))
        out[f"{k}_shuffle_q95"] = float(np.nanquantile(col(sh, k), 0.95))
        out[f"{k}_phase_q05"] = float(np.nanquantile(col(ph, k), 0.05))
    out["p_red_beta"] = _p_ge(real["beta"], col(sh, "beta"))
    out["p_red_ceiling"] = _p_ge(real["ceiling"], col(sh, "ceiling"))
    out["p_blue_beta"] = _p_ge(-real["beta"], -col(sh, "beta"))
    out["p_nonlinear"] = _p_ge(-real["diff_ratio"], -col(ph, "diff_ratio"))
    out["p_rank_red_beta"] = _p_rank(real["beta"], col(sh, "beta"))
    out["p_rank_nonlinear"] = _p_rank(-real["diff_ratio"], -col(ph, "diff_ratio"))
    out["n_surrogates"] = n_surr
    return out


def classify(rows, q=0.05):
    """BH over the red p values of every series profiled together, then a colour per series."""
    from .units.s2_units import bh
    if not rows:
        return rows
    nz = lambda v: 1.0 if not np.isfinite(v) else v  # noqa: E731
    pr = bh([nz(max(r["p_red_beta"], r["p_red_ceiling"])) for r in rows])
    pb = bh([nz(r["p_blue_beta"]) for r in rows])
    pn = bh([nz(r["p_nonlinear"]) for r in rows])
    for r, a, b, c in zip(rows, pr, pb, pn):
        r["colour"] = "red" if a <= q else ("blue" if b <= q else "white")
        r["q_red"], r["q_blue"], r["q_nonlinear"] = float(a), float(b), float(c)
        r["nonlinear_order"] = bool(c <= q)
    return rows
