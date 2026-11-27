# CMMNS Portable BuildLang Verification Kernels

SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
SPDX-License-Identifier: MIT

This directory holds nine standalone, zero-dependency BuildLang verification kernels graduated into `HarperZ9/cmmns` under the MIT license. Each kernel encodes a fail-closed commons, provenance, erasure-coding, accessibility, game-theory, or anti-Sybil invariant and ships with deterministic reference tests in `tests/buildlang-kernels.test.js`.

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

## Running Verification

Standard repository test suite (runs on Ubuntu, Windows, and macOS without requiring `buildc`):

```sh
npm test
```

When `buildc` (`1.15.0+`) is installed on `PATH`, `tests/buildlang-kernels.test.js` automatically runs `buildc check`, `buildc lint`, and release superoptimized execution on all nine kernels and asserts exact parity with the JavaScript reference oracles. Set `CMMNS_REQUIRE_BUILDC=1` to fail closed if `buildc` is unavailable:

```sh
CMMNS_REQUIRE_BUILDC=1 npm test
```
