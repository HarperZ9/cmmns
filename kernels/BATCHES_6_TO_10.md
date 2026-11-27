# CMMNS Portable BuildLang Verification Kernels: Batches 6 to 10

SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
SPDX-License-Identifier: MIT

Batches 6 to 10 graduate nineteen standalone, zero-dependency public-interest, accountability, provenance, and discourse BuildLang kernels under the MIT license, expanding the portable MIT kernel library in `HarperZ9/cmmns` from `21` to `40` unique kernels. Every kernel ships with deterministic Node reference oracles and live `buildc` verification in `tests/buildlang-kernels-batches-6-to-10.test.js`.

## Batches 6 to 10 Kernel Inventory (19 New Pure-OSI MIT Kernels)

| Batch | Kernel | Idea | Formula | Verified Invariant & Planted Controls |
| :- | :- | :- | :- | :- |
| 6 | `honest_exit_valve.bld` | `N25` | `SIG-094` | Arm C cuts reward hacking `98.67% -> 0.00%` (`300` reseats, `cost 1311` vs `1611`); disabled valve caught. |
| 6 | `typed_second_channel.bld` | `N27` | `SIG-115` | `4/4` orthogonal envelopes verified; rejects empty (`-401`), circular (`-402`), copy (`-403`), reversed ts (`-404`). |
| 6 | `three_control_negatives.bld` | `N28` | `SIG-095` | `r_sig=0.9993 (p=0.004975)` vs shuffled null `0.1602 (p=0.1095)`; rejects `-201/-202/-203`. |
| 6 | `anti_self_audit_chain.bld` | `N49` | `SIG-096` | 16-entry FIPS 180-4 SHA-256 out-of-band chain + MAC (`head=8b259143...086ada7`); rejects `-301/-302`. |
| 7 | `isomorphism_entropy.bld` | `D6` | `SIG-097` | Bijective affine-XOR `H(M|R)=0.0`, `I(M;R)=8.0`, `256/256` roundtrip; rejects trunc/coll (`-401`). |
| 7 | `confidence_word_calib.bld` | `N30` | `SIG-129` | Calibrated bands `3,2,1,0`; rejects wide-CI overclaim (`-401`), uncontrolled (`-402`), invalid (`-403`). |
| 7 | `uncheatable_search_forge.bld` | `N43` | `SIG-112` | FIPS 180-4 SHA-256 byte-offset citation prover (`mean_ground=1.000000`); rejects `-101/-102/-103`. |
| 7 | `truth_econ.bld` | `G7` | `O-01` | 3-strategy RK4 replicator lifts truth `0.000000 -> 0.999999` (`simplex_err=0.0`); rejects zero cost/det. |
| 8 | `personal_voice_twin.bld` | `N51` | `SIG-113` | Single-user voice distance `d_match=0.0105` vs `d_slop=1.1686`; rejects slop (`-201`) & impersonation (`-202`). |
| 8 | `universal_articulate_pipe.bld` | `N52` | `SIG-114` | `4/4` register profiles (`strict/research/personal_email/readme`); rejects `-301/-302/-303`. |
| 8 | `concept_phase_states.bld` | `D11` | `D11` | Landau-Ginzburg `psi=0.6804`, `fe_err=0.0`, `4/4` matter states (`17.0 K` hysteresis); rejects bad `T`/`b`. |
| 8 | `cross_layer_overlap.bld` | `A9` | `A9` | 256-lag 2D NCC recovers exact `(dx=5, dy=3)` (`err=0.0 px`, `ncc=0.9986`); rejects flat layer. |
| 9 | `cmmns_evidence_quorum.bld` | `N49`/`N32` | `SIG-156` | BFT `3f+1` FIPS SHA-256 quorum (`f=1: 3/3`, `f=2: 5/5`, `pin_f1=834a66c9...9aec7f0c`); rejects `-501/-502/-503`. |
| 9 | `cmmns_citation_decay.bld` | `N43`/`N28` | `STA-073` | 4-mirror survival lifts 10-yr retention `13.53% -> 99.64%` (`239.96x` loss cut); rejects `-601/-602/-603`. |
| 9 | `first_principles_dag.bld` | `I1` | `I1` | Kahn topological mastery DAG (`20/20` visited, `max_depth=4`, `sum=40`); rejects cycles & leaps. |
| 9 | `potential_space_transmute.bld` | `A8`/`C12` | `A8`/`C12` | Zero-telemetry Reverie Mode (`reverie_telem=0`, `peak=0.9524`); rejects flat entropy & blowup. |
| 10 | `cmmns_source_corroboration.bld` | `N32`/`N43` | `STA-074` | Acyclic Bayesian corroboration lifts `0.20 -> 0.996136` (`4` roots); rejects cycles (`-701`) & echo (`-702`). |
| 10 | `cmmns_archive_merkle_diff.bld` | `N49` | `SIG-157` | RFC 6962 append-only snapshot diff (`4 -> 6`, bit-exact roots); rejects edit (`-801`), delete (`-802`), forge (`-803`). |
| 10 | `cmmns_attention_valve.bld` | `I10` | `SIG-158` | Voluntary session stop-ramp (`20/30` active, `30/30` ramp); rejects dark patterns (`-901`) & suppression (`-902`). |

## Running Verification

```sh
npm test
```

Set `CMMNS_REQUIRE_BUILDC=1` to enforce live `buildc check`, `buildc lint`, and release superoptimized execution across all 40 MIT kernels:

```sh
CMMNS_REQUIRE_BUILDC=1 npm test
```
