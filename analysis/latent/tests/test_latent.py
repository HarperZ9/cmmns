"""Tests built on the planted controls. Each asserts what the instrument must get right or refuse.

Run: python -m pytest analysis   (from the repository root)
"""
import hashlib
import json
import os
import re
from pathlib import Path

import numpy as np
import pytest

from latent import controls, io, order, pipeline
from latent.__main__ import QUICK, main

ROOT = Path(__file__).resolve().parents[1]
FAST = {**QUICK, "n_perm": 99}


def test_vendored_units_are_verbatim():
    prov = json.loads((ROOT / "latent/units/PROVENANCE.json").read_text(encoding="utf-8"))
    for name, row in prov["units"].items():
        mine = hashlib.sha256((ROOT / "latent/units" / name).read_bytes()).hexdigest()
        assert mine == row["sha256"], f"{name} was edited"
        src = Path(os.environ.get("LATENT_SOURCE_ROOT", "__absent__")) / row["source"]
        if src.exists():
            assert hashlib.sha256(src.read_bytes()).hexdigest() == row["sha256"], f"{name} source moved on"


@pytest.mark.parametrize("mixing", ["linear", "sparse"])
def test_planted_latents_are_recovered(mixing):
    rng = np.random.default_rng(11)
    X, Z = controls.planted(300, 20, 2, 0.5, rng, mixing)
    r = pipeline.discover(X, False, rng, FAST)
    rec = controls.recovery(Z, r["_union"], r["_labels"])
    assert r["k_found"] == 2
    assert rec["rate"] == 1.0, rec


def test_pure_noise_finds_nothing():
    rng = np.random.default_rng(12)
    r = pipeline.discover(rng.normal(size=(300, 20)), False, rng, FAST)
    assert not r["any_survivor"], r["n_survivors"]


def test_nothing_is_fitted_when_no_count_beats_its_null():
    rng = np.random.default_rng(16)
    r = pipeline.discover(rng.normal(size=(200, 12)), False, rng, FAST)
    assert r["k"]["k_pa"] == 0 and r["k"]["k_cv"] == 0
    assert r["k"]["k_fit"] == 0 and r["lenses"] == {} and r["k_found"] == 0


def test_pca_and_ica_do_not_confirm_each_other():
    from latent.stability import FAMILY
    assert FAMILY["pca"] == FAMILY["ica"] != FAMILY["sae"]


def test_independent_red_series_find_nothing():
    """Independent AR(1) columns correlate by chance; the ordered pipeline must not call that a latent."""
    rng = np.random.default_rng(13)
    X = controls._ar1(250, 16, 0.8, rng)
    r = pipeline.discover(X, True, rng, FAST)
    assert r["k"]["pa_null"] == "phase"
    assert not r["any_survivor"], r["n_survivors"]


def test_order_tells_red_from_white():
    rng = np.random.default_rng(14)
    red = controls._ar1(400, 1, 0.8, rng)[:, 0]
    white = rng.normal(size=400)
    rows = order.classify([order.profile(red, rng, 39), order.profile(white, rng, 39)])
    assert rows[0]["colour"] == "red"
    assert rows[1]["colour"] == "white"
    assert rows[0]["diff_ratio"] < rows[1]["diff_ratio"]


def test_input_refusals(tmp_path):
    with pytest.raises(io.InputError):
        io.load(tmp_path / "x.pkl")
    p = tmp_path / "t.csv"
    p.write_text("a,b,c\n" + "\n".join("1,,3" if i == 0 else f"{i},{i * 2 % 7},{i % 3}" for i in range(12)),
                 encoding="utf-8")
    with pytest.raises(io.InputError):
        io.load(p)
    X, cols, notes = io.load(p, "median")
    assert notes["cells_imputed_median"] == 1 and cols == ["a", "b", "c"]


def test_cli_writes_reports_with_no_foreign_hosts(tmp_path):
    rng = np.random.default_rng(15)
    X, _ = controls.planted(120, 10, 1, 0.4, rng)
    p = tmp_path / "planted.csv"
    p.write_text("\n".join([",".join(f"v{j}" for j in range(10))] + [",".join(map(str, r)) for r in X]),
                 encoding="utf-8")
    code = main(["run", "--input", str(p), "--out", str(tmp_path / "out"), "--quick"])
    rep = json.loads((tmp_path / "out/report.json").read_text(encoding="utf-8"))
    html = (tmp_path / "out/report.html").read_text(encoding="utf-8")
    assert code == 0 and rep["valid"] and rep["controls"]["positive"]["pass"]
    hosts = set(re.findall(r"https?://([^/'\"]+)", html))
    # Named, never fetched: the SVG namespace and the site kit's home link.
    assert hosts <= {"www.w3.org", "harperz9.github.io"}, hosts
    assert "<link rel='stylesheet'" not in html
    assert "prefers-color-scheme: dark" in html and '[data-theme="dark"]' in html


def test_floor_fall_is_not_a_u_once_guarded():
    """F91 C3: a fall to an exact floor fools the base two-lines test; the guard removes it."""
    from latent.twolines_guard import two_lines_guarded
    from latent.units import twolines
    rng = np.random.default_rng(11)
    base, guarded = [], []
    for _ in range(60):
        x = rng.uniform(0, 1, 300)
        c = rng.uniform(0.3, 0.6)
        y = np.where(x < c, 4 * (c - x) + rng.normal(0, 0.5, 300), 0.0)
        base.append(bool(twolines.two_lines(x, y).get("u", False)))
        guarded.append(bool(two_lines_guarded(x, y).get("u", False)))
    assert np.mean(base) >= 0.2
    assert np.mean(guarded) <= 0.05


def test_select_uses_the_guarded_two_lines():
    from latent import select
    src = Path(select.__file__).read_text(encoding="utf-8")
    assert "two_lines_guarded(" in src and "twolines.two_lines(" not in src
