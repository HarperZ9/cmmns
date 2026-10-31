"""Puts the analysis packages on the import path for `python -m pytest analysis` from the repository root."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
for pkg in ("formulas", "latent"):
    sys.path.insert(0, str(HERE / pkg))
