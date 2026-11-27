# CMMNS Portable BuildLang Verification Kernels

SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
SPDX-License-Identifier: MIT

This directory holds forty standalone, zero-dependency BuildLang verification kernels graduated into `HarperZ9/cmmns` under the MIT license (`17` Batches 1 to 4 below, `4` Batch 5 in `kernels/BATCH5.md`, and `19` Batches 6 to 10 in `kernels/BATCHES_6_TO_10.md`), together with the zero-dependency Browser and V8 WebAssembly Verification Bridge V3 in `kernels/wasm-bridge-v3/` (`12` compiled MIT `.wasm` modules totaling `69.46 KB`, `0` network calls, `0` Node imports in the bridge runtime). Each kernel encodes a fail-closed commons, provenance, erasure-coding, accessibility, discourse, resilience, civic economics, archival stewardship, or anti-Sybil invariant and ships with deterministic reference tests in `tests/buildlang-kernels.test.js`, `tests/buildlang-kernels-batch5.test.js`, `tests/buildlang-kernels-batches-6-to-10.test.js`, and `tests/wasm-bridge-v3.test.js`.

## Kernel Inventory

| Kernel | Idea | Formula | What It Verifies | Planted Fail-Closed Controls |
| :- | :- | :- | :- | :- |
| `commons_pipe_mirror.bld` | `I2` | `SIG-119` | Pure FIPS 180-4 SHA-256 mirror integrity across 4 nodes, zero paywall or auth header leakage, and `>= 3/4` Byzantine mirror quorum. | Double mirror 1-bit corruption (`2/4`) and paywall/auth header injection (`2/4`) both rejected. |
| `boring_bridge_verifier.bld` | `N70` | `SIG-100` | Zero-dependency offline `engine-receipt/1` SHA-256 payload digest and 3-step RFC 6962 Merkle inclusion proof verification (`leaf_idx = 5`). | 1-bit payload tamper, 1-bit sibling proof tamper, and leaf-index spoofing all rejected. |
| `accessible_surface_gate.bld` | `I7` | `SIG-120` | W3C WCAG 2.1 relative luminance (`>= 7.0` AAA / `>= 4.5` AA), APCA W3 (`0.0.98G-4g`) perceptual `Lc`, reduced-motion compliance, and semantic heading depth monotonicity. | Low-contrast `#777777` on `#BBBBBB` (`CR = 2.33`), skipped heading (`h1 -> h4`), and reduced-motion violation (`450 ms`) all rejected. |
| `reach_gradient.bld` | `I14` | `SIG-092` | Reach-scaled privacy-to-accountability disclosure policy: zero external traces for local queries (`reach == 0`), mandatory signed SHA-256 receipt for high-reach public releases (`reach > 50`). | Local telemetry leak (`code = -1`) and unsigned or invalid-signature public release (`code = -2`) blocked. |
| `merit_ledger.bld` | `I9` | `SIG-091` | Sybil-resistant verified-information merit accounting requiring independent oracle re-derivation (`verifier_id != author_id`). | 10-account Sybil voting ring (`0.0` merit vs `10.0` naive inflation) and self-verification (`0.0` merit) blocked. |
| `blackout_commons_sync.bld` | `N58` | `SIG-126` | GF(2^8) Reed-Solomon `(n=6, k=4)` Cauchy erasure coding with pure FIPS 180-4 SHA-256 recovering `15/15` two-shard blackout patterns bit-for-bit. | Unrecoverable 3-shard loss (`surviving < 4`) rejected fail-closed (`rc = -101`). |
| `honest_journal_kinetic.bld` | `A22` | `SIG-117` | Pure FIPS 180-4 SHA-256 tamper-evident hash-chained journal commitments with 7-day open-commitment half-life decay and kinetic action-completion ratio. | 1-hour backdated entry and retroactive weight edit both rejected fail-closed. |
| `bulletin_feed_ranker.bld` | `E20` | `SIG-118` | Shared human+model feed deduplicator (32-bit Hamming `<= 2`) and receipt-weighted novelty-over-age ranker. | 3-copy duplicate flood and 2 unverified hype spam posts dropped fail-closed. |
| `disclosure_penalty_game.bld` | `N71` | `SIG-101` | 100-seed Bayesian Nash and replicator-dynamics simulator proving punitive stigma collapses honest disclosure (`p=0.0`) while zero-penalty audit verification restores full honesty (`p=1.0`). | Zero-audit collapse (`p_zero < 0.02`) and out-of-simplex probability (`p = 1.25`) verified fail-closed. |
| `quote_provenance_lint.bld` | `N34` | `SIG-098` | Standing-rule verbatim quotation provenance linter verifying ISO `YYYY-MM-DD` date, distinct 32-bit FNV-1a ruling digest, and exact verbatim substring match. | Subtle paraphrase (`mask=4`), bad date (`mask=1`), hash tamper (`mask=2`), and stub quote (`mask=8`) rejected. |
| `anti_softness_critic.bld` | `N68` | `SIG-099` | Adversarial dialogue critic scoring sycophancy, premature hedging, and tidy-redemption tropes against direct falsification markers (`soft == 0` and `direct >= 3`). | Pure sycophancy (`ratio=1.0`), tidy redemption (`ratio=1.0`), and mixed hedging (`ratio=0.75`) rejected. |
| `cook_seam_register.bld` | `N37` | `STA-056` | Multi-fault seam-register incident graph analyzer enumerating exact minimal 1-cut SPOFs (`4`) and 2-cut pairs (`4`) with SPOF centrality (`8.00`). | Hidden common-mode dependency collapsing redundant DB nodes via `ClockA` (`one_cuts: 4 -> 5`, `rc=-201`) caught. |
| `community_homeostasis.bld` | `N59` | `STA-057` | Delayed PI feedback stability simulator comparing localized (`tau=1`, `ISE=86.37`) vs centralized (`tau=10`, `ISE=203,068.27`, `2,351x`) control latency. | Runaway gain instability (`peak=1286.21 > 1000`, `rc=-301`) caught fail-closed. |
| `catastrophe_surge_sim.bld` | `N26` | `STA-055` | Acute supply-shock reallocation curve simulator comparing surge pricing vs priority rationing across `30%`, `50%`, and `70%` shocks on unmet essentials, welfare, and Gini. | `+5.0` unit supply-conservation leak rejected fail-closed (`rc = -101`). |
| `non_extractive_attention.bld` | `I10` | `SIG-110` | Non-extractive time-return platform scorer auditing task throughput, clean exit-ramp latency (`<= 1` click), and zero infinite-scroll or variable-reward dark patterns. | All 3 planted extractive dark-pattern platforms rejected fail-closed (`rc = -301`, `dmean = 0.2617` vs `0.9579`). |
| `steward_queue.bld` | `C9` | `SIG-090` | Non-destructive archive integrity and bit-rot curation scanner over 500 records flagging corrupted checksums and orphans for human sign-off (`deleted = 0`). | All 5 planted defects (`3` bit-rot flips + `2` orphans) flagged with `0` false positives and `0` auto-deletes. |
| `silhouette_def.bld` | `A16` | `SIG-089` | Silhouette definition validator requiring non-empty etymology root, positive inclusion boundary, distinct negative counterexample, and non-tautology. | Missing etymology (`1`), missing inclusion (`2`), missing counterexample (`3`), and tautology (`4`) rejected. |

## Running Verification

Standard repository test suite (runs on Ubuntu, Windows, and macOS without requiring `buildc`):

```sh
npm test
```

When `buildc` (`1.15.0+`) is installed on `PATH`, the kernel test suites automatically run `buildc check`, `buildc lint`, and release superoptimized execution on all forty kernels and assert exact parity with the JavaScript reference oracles. Set `CMMNS_REQUIRE_BUILDC=1` to fail closed if `buildc` is unavailable:

```sh
CMMNS_REQUIRE_BUILDC=1 npm test
```
