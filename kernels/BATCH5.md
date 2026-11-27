# CMMNS Portable BuildLang Verification Kernels: Batch 5

SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
SPDX-License-Identifier: MIT

Batch 5 adds four standalone, zero-dependency BuildLang verification kernels under the MIT license (bringing the portable MIT kernel suite in `HarperZ9/cmmns` to 21 kernels alongside Batches 1 through 4). Every kernel in this batch has deterministic Node reference tests and live `buildc` checks in `tests/buildlang-kernels-batch5.test.js`.

## Batch 5 Kernel Inventory

| Kernel | Idea | Formula | What It Verifies | Planted Fail-Closed Controls |
| :- | :- | :- | :- | :- |
| `gather_refit_graph.bld` | `N32` | `SIG-108` | Pure FIPS 180-4 SHA-256 provenance DAG (`source_sha256 -> crop_bbox -> quote_hash -> claim_hash`) and Kahn topological cycle detector. | Orphan claim node (`rc = -101`) and cyclic edge (`3 -> 1`, `rc = -102`) both rejected fail-closed. |
| `neglected_research_ranker.bld` | `A15` | `SIG-109` | Historical research resurfacing ROI ranker (`ln(1+age) * compute_lev * falsif * evid`) producing exact top-5 order `[8, 10, 5, 4, 3]` (`sum = 184.277044`). | Unfalsifiable zero-evidence claim rejected fail-closed (`rc = -201`, `score = 0.0`). |
| `systems_empathy_transfer.bld` | `C13` | `SIG-111` | Coupled adaptive oscillator mutual information `I(S_sender; S_receiver)` (`1.2348 bits`) and calibration RMSE (`0.146842`, `5.81x` improvement over projection bias). | Zero-feedback projection bias (`mi = 0.0007 bits`, `rmse = 0.8536`) caught fail-closed (`rc = -401`). |
| `federated_bm25_graph.bld` | `E24` | `SIG-093` | Hybrid BM25 plus 1-hop graph-boost query engine over `68,500` synthetic catalogued artifacts (`p95 < 25 ms`, exact deterministic top-10 IDs). | Empty query (`rc = -601`) and negative IDF (`rc = -602`) rejected fail-closed. |

## Running Batch 5 Verification

```sh
npm test
```

With `buildc` (`1.15.0+`) installed on `PATH`, `tests/buildlang-kernels-batch5.test.js` runs `buildc check`, `buildc lint`, and release superoptimized execution on all four Batch 5 kernels. Set `CMMNS_REQUIRE_BUILDC=1` to fail closed if `buildc` is absent:

```sh
CMMNS_REQUIRE_BUILDC=1 npm test
```
