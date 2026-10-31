"""Read a table: CSV with a header row, JSON {"columns": [...], "rows": [[...]]}, or .npy.

Rows are observations; columns are variables. For a set of time series, rows are time steps in
order and columns are series (pass ordered=True). Never unpickles: .npy loads with
allow_pickle=False and .pkl is refused.
"""
import csv
import json
from pathlib import Path

import numpy as np


class InputError(ValueError):
    pass


def _csv(path):
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f))
    if len(rows) < 2:
        raise InputError(f"{path}: needs a header row and at least one data row")
    head, body = rows[0], rows[1:]
    keep, dropped = [], []
    for j, name in enumerate(head):
        try:
            [float(r[j]) if r[j].strip() not in ("", "NA", "nan", "NaN") else np.nan for r in body]
            keep.append(j)
        except (ValueError, IndexError):
            dropped.append(name)
    X = np.array([[float(r[j]) if r[j].strip() not in ("", "NA", "nan", "NaN") else np.nan
                   for j in keep] for r in body], float)
    return X, [head[j] for j in keep], dropped


def _json(path):
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(d, dict) or "rows" not in d:
        raise InputError(f"{path}: JSON input needs {{'columns': [...], 'rows': [[...]]}}")
    X = np.array([[np.nan if v is None else float(v) for v in r] for r in d["rows"]], float)
    cols = d.get("columns") or [f"v{j}" for j in range(X.shape[1])]
    return X, list(map(str, cols)), []


def load(path, nan="refuse"):
    """Return (X, column names, notes). nan: 'refuse' (default) or 'median' (impute per column)."""
    p = Path(path)
    suf = p.suffix.lower()
    if suf in (".pkl", ".pickle"):
        raise InputError("pickle files are refused; export the table as CSV, JSON or .npy")
    if suf == ".csv":
        X, cols, dropped = _csv(p)
    elif suf == ".json":
        X, cols, dropped = _json(p)
    elif suf == ".npy":
        X = np.load(p, allow_pickle=False).astype(float)
        cols, dropped = [f"v{j}" for j in range(X.shape[1])], []
    else:
        raise InputError(f"{p}: unsupported suffix {suf}; use .csv, .json or .npy")
    return clean(X, cols, nan, dropped)


def clean(X, cols, nan="refuse", dropped=()):
    """Check shape and missing values; drop constant columns. Returns (X, cols, notes)."""
    X = np.asarray(X, float)
    notes = {"non_numeric_columns_dropped": list(dropped)}
    if X.ndim != 2 or X.shape[0] < 10 or X.shape[1] < 3:
        raise InputError(f"need at least 10 rows and 3 columns, got shape {X.shape}")
    bad = ~np.isfinite(X)
    if bad.any():
        if nan != "median":
            raise InputError(f"{int(bad.sum())} missing or infinite cells; clean them or pass --impute median")
        med = np.nanmedian(np.where(bad, np.nan, X), axis=0)
        X = np.where(bad, med[None, :], X)
        notes["cells_imputed_median"] = int(bad.sum())
    sd = X.std(0)
    const = sd <= 1e-12
    notes["constant_columns_dropped"] = [c for c, k in zip(cols, const) if k]
    X, cols = X[:, ~const], [c for c, k in zip(cols, const) if not k]
    if X.shape[1] < 3:
        raise InputError("fewer than 3 non-constant columns")
    return X, cols, notes
