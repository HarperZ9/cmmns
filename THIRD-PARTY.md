# Third-party material in Radar

Radar's own code is under AGPL-3.0-only and its own data and documentation under CC BY 4.0
(see `LICENSE`, `LICENSES/` and `REUSE.toml`). The items below are not Radar's own work, or not
only Radar's, and keep their own terms. Radar has no npm dependencies and vendors no third-party
code.

## Shipped inside the extension or the repository

| Item | Files | Licence | Notes |
|---|---|---|---|
| Hanken Grotesk font | `src/ext/fonts/hanken-grotesk.woff2`, `docs/fonts/hanken-grotesk.woff2` | SIL Open Font License 1.1 (`LICENSES/OFL-1.1.txt`, and `OFL-hanken-grotesk.txt` beside each copy) | Copyright 2021 The Hanken Grotesk Project Authors. |
| Conso font | `src/ext/fonts/conso-regular.woff2`, `docs/fonts/conso-regular.woff2` | The designer's licence, held by Radar's author (`LICENSES/LicenseRef-Conso.txt`) | By Pavel Larin. Not covered by Radar's licences and not offered for reuse. A fork must remove it or license it itself. |
| Unicode confusables table (UTS #39) | `data/snapshots/unicode-confusables.txt`, and the table built from it in `src/core/confusables-data.js` | Unicode License v3 (`LICENSES/Unicode-3.0.txt`; notice also in `data/confusables.README.md`) | Copyright 1991-2026 Unicode, Inc. |
| Wikidata statements | `src/ext/sites.json` (facts), `src/ext/owners.json`, parts of `src/ext/personalities.json` | CC0 1.0 | Source and retrieval date in `data/LOCK.json`. |
| Fact-check reviews (ClaimReview) | `src/ext/claims.json`, `src/ext/claims-2.json`, `src/ext/sites.json` (records) | CC BY 4.0, via the Data Commons fact-check feed | Each match Radar shows names the fact-checker and links the review. See `data/claims.README.md`. |
| Cited reports and official documents | `data/ops-sources/`, `data/state-reports.json`, `data/personalities-sources/`, `data/owner-corrections.json` | Each document keeps its own terms | Radar's records state facts with short quotes and a link. Government documents are often public domain or under an open reuse policy; others are quoted for commentary. Details in each `data/*.README.md`. |

## Used but not shipped

| Item | Licence | How it is used |
|---|---|---|
| c2pa-rs test fixtures | MIT or Apache-2.0 | Fetched by CI at a pinned commit into `.cache/` and never committed (`scripts/ci.mjs`). |
| Evaluation corpora (Measuring Hate Speech, Civil Comments, PHEME, the Propaganda Techniques Corpus, Multilingual HateCheck and others) | Each corpus's own licence, listed in `project-docs/evidence/CORPORA.md` | Downloaded outside the repository for measurement. Only aggregate results are committed. |
| Word references (Hurtlex, Wiktionary and others) | Listed in `project-docs/evidence/LEXICON-SOURCES.md` | Consulted to check single words. No rows, ids or scores were copied. |
| OCR training fonts | Each font's own licence | Used to draw synthetic training lines. The shipped weights (`src/ext/ocr/latin.bin`) are Radar's own and contain no font data. |

## Quoted law and platform content

The definition catalogue quotes statutes, regulations and official guidance. That text keeps its
own status: many are government works, and the rest are quoted for commentary with their source and
retrieval date. Radar's CC BY 4.0 grant covers Radar's own structure, summaries and annotations, not
the quoted text.

Radar never redistributes platform content. Posts belong to their authors and are governed by each
platform's terms. Captures of other people's posts stay on the user's device, and only aggregate
results are committed here.
