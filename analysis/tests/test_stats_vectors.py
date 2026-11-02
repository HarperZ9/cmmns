"""analysis/formulas against the shared statistics vectors (analysis/vectors/stats_vectors.json, CC0 1.0).

Other repositories copy the vectors, not this code, so the contract crosses licences. The same file
is read by tests/stats-vectors.test.js for the Wilson interval in src/core/discourse/stats.js.
"""
import json
from pathlib import Path

from formulas import bounds as B

VECTORS = json.loads((Path(__file__).resolve().parents[1] / "vectors" / "stats_vectors.json").read_text(encoding="utf-8"))


def test_upper_tail():
    rows = VECTORS["binomial_upper_tail"]
    assert len(rows) >= 10
    for row in rows:
        if row["bound"] == 0 and row["k"] > 0:
            continue  # formulas clamps the bound away from 0 and 1; the vectors record the exact limit
        got = float(B.exact_p(row["k"], row["n"], row["bound"]))
        assert abs(got - row["p_upper"]) <= 1e-9 * max(row["p_upper"], 1e-300), row


def test_family_corrections():
    checked = 0
    for fam in VECTORS["families"]:
        if not fam["p"]:
            continue
        for method in ("holm", "bonferroni", "bh"):
            got = [bool(x) for x in getattr(B, method)(fam["p"], fam["alpha"])]
            assert got == fam[method], (fam["id"], method)
            checked += 1
    assert checked >= 18


def test_the_tie_case_is_present():
    tie = next(f for f in VECTORS["families"] if f["id"] == "holm-tie")
    assert tie["p"][0] * len(tie["p"]) == tie["alpha"] and tie["holm"][0] is True
