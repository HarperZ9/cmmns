# analysis: the Python side of the CMMNS research layer

Two packages and one shared contract.

- **`formulas/`** keeps a statistic only after it beats the version it replaces on held-out data: an exact one-sided binomial bound with a Holm, Bonferroni or Benjamini-Hochberg family correction, the two-lines guard for interior-optimum claims, and a shareability measure. See `formulas/README.md`.
- **`latent/`** looks for hidden variables in a table. It decomposes the table across several lenses, checks which candidates are stable, rebuilds held-out rows, and runs a planted-signal control and a pure-noise control on every run. It writes one self-contained HTML report. See `latent/README.md`.
- **`vectors/stats_vectors.json`** is the statistics contract, released under CC0 1.0. `tests/test_stats_vectors.py` holds `formulas` to it, and `tests/stats-vectors.test.js` holds the Wilson interval in `src/core/discourse/stats.js` to it. Other repositories copy this file and test their own code against it, so no code crosses a licence line.

```bash
python -m pip install -r analysis/requirements.txt
python -m pytest analysis            # or: node scripts/ci.mjs analysis
```

Optional checks against private research folders run only when an environment variable points at one: `FORMULA_ROUND1_DIR`, `TWOLINES_SOURCE`, `LATENT_SOURCE_ROOT`. `LATENT_SITE_KIT` inlines the site's design kit into the latent report; without it the report carries its own light and dark tokens.

The vendored units in `latent/latent/units/` are byte-for-byte copies pinned by sha256 in `PROVENANCE.json`. Two of them were validated with CRLF line endings, so `.gitattributes` keeps their bytes.
