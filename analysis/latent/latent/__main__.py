"""Command line.

  python -m latent run --input TABLE --out DIR [--ordered] [--impute median] [--seed N] [--quick]
                       [--no-controls] [--title TEXT]
  python -m latent render --json DIR/report.json --out PAGE.html [--title TEXT]
                       (rebuild the page from a saved report; the numbers come from the JSON as saved)

Writes DIR/report.json and DIR/report.html. Exit codes: 0 valid run, 1 controls failed (the run is
marked invalid), 2 bad input, 3 controls skipped (not a result).
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

from . import io, report_html
from .run import run

QUICK = {"n_perm": 99, "n_pa": 50, "n_shuf": 29, "n_surr_latent": 19, "n_surr_var": 9}


def _default(o):
    if isinstance(o, (np.floating, np.integer)):
        return o.item()
    if isinstance(o, np.bool_):
        return bool(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    raise TypeError(f"not serialisable: {type(o)}")


def write(result, out_dir, title):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.json").write_text(json.dumps(result, default=_default, indent=1) + "\n", encoding="utf-8")
    (out / "report.html").write_text(report_html.page(result, title, out / "report.html"), encoding="utf-8")
    return out / "report.json", out / "report.html"


def main(argv=None):
    ap = argparse.ArgumentParser(prog="latent", description="find hidden variables, with falsification built in")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--input", required=True)
    r.add_argument("--out", required=True)
    r.add_argument("--ordered", action="store_true", help="rows are time steps in order (a set of time series)")
    r.add_argument("--impute", choices=["refuse", "median"], default="refuse")
    r.add_argument("--seed", type=int, default=20261029)
    r.add_argument("--quick", action="store_true", help="fewer shuffles and surrogates, for a first look")
    r.add_argument("--no-controls", action="store_true", help="skip the controls; the run is then not a result")
    r.add_argument("--title", default=None)
    g = sub.add_parser("render")
    g.add_argument("--json", required=True)
    g.add_argument("--out", required=True)
    g.add_argument("--title", default=None)
    a = ap.parse_args(argv)
    if a.cmd == "render":
        rep = json.loads(Path(a.json).read_text(encoding="utf-8"))
        Path(a.out).write_text(report_html.page(rep, a.title or "Latent report", Path(a.out)), encoding="utf-8")
        print(f"page {a.out}")
        return 0
    try:
        X, cols, notes = io.load(a.input, a.impute)
    except io.InputError as e:
        print(f"bad input: {e}", file=sys.stderr)
        return 2
    res = run(X, cols, a.ordered, a.seed, QUICK if a.quick else None, not a.no_controls)
    res["input"] = {"path": str(Path(a.input).resolve()), **notes}
    j, h = write(res, a.out, a.title or f"Latent report: {Path(a.input).name}")
    print(f"survivors: {len(res['survivors'])}; counted latents {res['k_found']}; report {h}")
    if a.no_controls:
        return 3
    print("controls: " + ("valid" if res["valid"] else "FAILED, run marked invalid"))
    return 0 if res["valid"] else 1


if __name__ == "__main__":
    sys.exit(main())
