# latent

An instrument for hidden variables. It takes a table apart into candidate latents, maps where the
data are ordered and where they are noise, checks which latents survive a change of lens, puts the
data back together out of sample, and tests itself on planted structure and on pure noise in every
run.

## Mission

Make what is hard to see measurable, and make the measurement checkable. A pattern this tool reports
has already beaten the controls that would expose it as an artefact. Anyone can rerun the check, take
the result apart again, and share the report as one file.

## Ideals

- **Falsify by default.** Every run carries a planted-structure control and a pure-noise control. A
  run whose controls fail is marked invalid, and the report says so first.
- **The lens is part of the measurement.** A latent that only one decomposition finds is flagged
  lens-dependent. A latent whose stability changes with the decoder is flagged decoder-dependent.
- **Found means it predicts.** A latent counts only when hiding it makes held-out prediction worse
  than a shuffled copy of itself, after Benjamini-Hochberg across every latent of every lens.
- **Reuse what was tested.** The statistics are units validated earlier in this program, copied
  verbatim and hash-checked (`latent/units/PROVENANCE.json`). The library wraps them and does not
  edit them.
- **A pattern is not a cause.** A latent that survives is a stable pattern in these data. Naming
  what it means is a separate step that needs domain evidence.

## Use

```
python -m latent run --input TABLE --out DIR [--ordered] [--impute median] [--seed N] [--quick]
```

- `TABLE`: CSV with a header row, JSON `{"columns": [...], "rows": [[...]]}`, or `.npy`. Rows are
  observations and columns are variables. For a set of time series, rows are time steps in order and
  columns are series; pass `--ordered`. Pickle files are refused.
- Missing cells stop the run unless `--impute median` is given. Constant columns are dropped and
  listed.
- Output: `DIR/report.json` (every number) and `DIR/report.html` (one self-contained page, light and
  dark, no scripts, Google Fonts as the only external host).
- Exit codes: 0 valid, 1 controls failed (run invalid), 2 bad input, 3 controls skipped.

From Python:

```python
from latent.run import run
report = run(X, column_names, ordered=False)
```

Tests (about 40 s): `python -B -m pytest -q -p no:cacheprovider tests`

## Method

1. **How many latents.** Parallel analysis on the correlation matrix (F55 unit `pa_count`). For
   ordered rows the null is a phase randomisation of each column, because independent red series
   correlate by chance more than white ones. Held-out probabilistic PCA picks a second count
   (`cv_ppca`); it is used only when the two-lines test (F49 unit) confirms an interior optimum on
   the per-fold curve. The fitted k is the larger count, capped at 12. When both counts are 0,
   nothing is fitted and the run reports no latent.
2. **Take apart.** PCA, FastICA, NMF (only when every value is non-negative) and a small sparse
   autoencoder (ReLU code with L1, linear decoder, two units per latent). Columns are scaled by their
   SD.
3. **Put back together.** Five folds (contiguous blocks for ordered rows). Each test row shows half of
   its columns; the latent scores come from the Gaussian posterior through the lens's decoder, and the
   hidden half is predicted. The report gives held-out R² with all latents and with the survivors only.
4. **Found test.** For each latent, its test-row scores are shuffled (199 times) while the others stay.
   p = share of shuffles that predict at least as well. Benjamini-Hochberg at q 0.05 across all
   latents of all lenses.
5. **Check the lens.** Following F73 (one linear map per lens carries a shared property), a latent is
   lens-stable when the found latents of a lens from another family predict its scores out of sample
   (ridge R² at least 0.5 and above a row-shuffle q95). PCA and ICA are one family, since they span
   the same subspace; NMF and the autoencoder are the others. Following F72 (transparency depends on the decoder), the
   check is repeated with a k-nearest-neighbour decoder and disagreement is flagged.
6. **Order and disorder.** For ordered rows, every latent and every variable gets the spectral
   exponent (F74 `welch_beta`), the predictability ceiling 1 - spectral flatness (F76, read with its
   surrogate envelope), and the neighbour-difference compression ratio (F61 pixel unit, on 32-level
   quantised values). Shuffled surrogates decide red, white or blue; phase-randomised surrogates keep
   the spectrum, so compression beyond them is flagged as nonlinear order. Benjamini-Hochberg across
   series. Unordered rows have no spectrum; latents report excess kurtosis against Gaussian samples.
7. **Controls.** Planted: k latents (k = fitted k, at most 5) mixed into a table of the same size, with
   the noise share and lag-1 autocorrelation matched to the data; recovered when the survivors predict
   a planted latent at cross-validated R² of at least 0.7; pass at 80% recovered. Noise: each column
   scrambled on its own (permutation, or phase randomisation for ordered rows); pass only with zero
   survivors. Either failure marks the run invalid.

A null run can be invalid. When the data carry little shared variance, the matched noise share is
high, and planted structure at that level may not be recoverable; the run is then marked invalid,
because finding nothing where nothing could have been seen is not evidence of absence.

A survivor is a latent that is found and lens-stable. `k_found` counts survivors in the linear lenses;
the autoencoder's count is reported apart because it has two units per latent.

## Limits

- PCA and ICA span the same subspace, so they never confirm each other. The autoencoder carries the
  cross-family check on data with negative values; NMF joins it only on non-negative data.
- Held-out prediction runs through each lens's linear decoder. A latent that acts only nonlinearly
  can be missed; the validation measures how often.
- The planted control uses linear mixing. Passing it shows the instrument can see structure of this
  kind at this size and noise, not every kind.
- Spectra need ordered rows and say nothing about frequencies below one cycle per series.
- The predictability ceiling is a linear one-step bound under stationarity (F76); drifting series can
  exceed it.
- Does not prove: a latent that survives is a stable pattern in these data, not a cause. Naming what
  it means is a separate step that needs domain evidence.

## Versions

- 0.3.0 (2026-10-30): the held-out PPCA curve's interior-optimum test uses the two-lines guard
  from formula round 1 (F91 C3). A side with zero variance or zero standard error no longer counts as
  a significant line, which removed every false U on a fall to an exact floor there (37.7% to 0.0%).
- 0.2.0 (2026-10-29): nothing is fitted when no count beats its null, and lens stability needs a lens
  of another family. Both fix a false-positive rate of 5 in 30 on independent red series in the
  first validation round.
- 0.1.0 (2026-10-29): first build.

## Validation

Two preregistered rounds in the private study folder `2026-10-29-latent/`, logged as F94.

- Synthetic (round 2, v0.2): planted latents were recovered at 1.00 with noise share 0.5 (n 100 to
  1000), and at 0.54 against an oracle ceiling of 0.58 with noise share 0.75 (n 1000). At noise
  share 0.9 nothing is recoverable by any linear method. Nonlinear mixing reached 0.12 overall.
- False positives: 0 of 90 pure-noise tables and 1 of 60 independent red-noise tables gave a
  survivor. On planted data the false-discovery proportion was 0.04.
- Real data (all runs valid): the survivors carry summer drought in ITRDB tree rings, the scripted
  states in WESAD, and the saves against the references in the taste properties.
- Round 1 (v0.1) failed its kill rule on red noise (5 of 30 tables gave a survivor). That failure
  produced the two v0.2 fixes.
