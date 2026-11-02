"""The parameter-recovery gate, the same rule the pipeline's patch section names.

For trial i (seed base+i): draw a planted value p_i, synthesise a signal from it, measure it,
get r_i. Observed error E = median_i dist(r_i, p_i). Seed-shuffled null: pair each recovered
value with the planted value of another seed, r_pi(i) against p_i, for 'perms' random
permutations; each gives a null median error. The measure PASSES when E is below the 5th
percentile of the null medians (the mirror of the studyrun 'beyond q95' rule, since lower
error is better). The ratio E / median(null) is reported beside the verdict as the effect size.

Vector-valued measures (the envelope) pass only when the aggregate AND every component pass:
a control showed that a fit to a shuffled profile passes on the aggregate through one leaking
component (sustain is readable from the value histogram alone). 'strong' additionally asks for
ratio <= 0.5 on the aggregate and every component; the pipeline rule is 'pass'.

False-success control: a constant estimator gives identical errors under every permutation, so
E equals the null and it fails; tests check that the gate rejects it.
"""
import numpy as np


def _dist(r, p):
    r = np.atleast_2d(np.asarray(r, dtype=np.float64).T).T
    p = np.atleast_2d(np.asarray(p, dtype=np.float64).T).T
    return np.abs(r - p).mean(axis=1)


def gate(planted, recovered, perms=1000, seed=0, transform=None):
    """planted, recovered: sequences of scalars or of equal-length vectors."""
    p = np.asarray(planted, dtype=np.float64)
    r = np.asarray(recovered, dtype=np.float64)
    if transform is not None:
        p, r = transform(p), transform(r)
    good = np.all(np.isfinite(r.reshape(len(r), -1)), axis=1)
    p, r = p[good], r[good]
    if len(p) < 8:
        return {"pass": False, "why": "fewer than 8 finite recoveries", "n": int(len(p))}
    obs = float(np.median(_dist(r, p)))
    rng = np.random.default_rng(seed)
    null = np.array([np.median(_dist(r[rng.permutation(len(r))], p)) for _ in range(perms)])
    q05 = float(np.quantile(null, 0.05))
    return {"pass": bool(obs < q05), "n": int(len(p)), "dropped": int((~good).sum()),
            "median_error": obs, "null_q05": q05, "null_median": float(np.median(null)),
            "ratio": obs / float(np.median(null)) if np.median(null) > 0 else float("nan")}


def run(draw, make, measure, trials=40, base_seed=1000, transform=None):
    """draw(rng) -> planted; make(rng, planted) -> signal; measure(signal) -> recovered."""
    planted, recovered = [], []
    for i in range(trials):
        rng = np.random.default_rng(base_seed + i)
        p = draw(rng)
        planted.append(p)
        try:
            recovered.append(measure(make(rng, p)))
        except (ValueError, FloatingPointError) as e:
            print(f"recovery trial {i} failed: {e}")
            recovered.append(np.full(np.shape(p), np.nan))
    out = gate(planted, recovered, transform=transform)
    pa, ra = np.asarray(planted, dtype=np.float64), np.asarray(recovered, dtype=np.float64)
    if pa.ndim == 2:
        # Transform whole vectors first: a transform may add derived components (for example a
        # frequency movement ln f1 - ln f0), and each derived component is gated too.
        if transform is not None:
            pa, ra = transform(pa), transform(ra)
        comps = [gate(pa[:, j], ra[:, j]) for j in range(pa.shape[1])]
        out["per_component"] = [{k: c.get(k) for k in ("pass", "median_error", "null_q05", "ratio")}
                                for c in comps]
        out["pass_aggregate"] = out["pass"]
        out["pass"] = out["pass"] and all(c["pass"] for c in comps)
    ratios = [out.get("ratio", np.nan)] + [c["ratio"] for c in out.get("per_component", [])]
    out["strong"] = bool(out["pass"] and all(r <= 0.5 for r in ratios))
    out["planted"] = np.asarray(planted).tolist()
    out["recovered"] = np.asarray(recovered).tolist()
    return out
