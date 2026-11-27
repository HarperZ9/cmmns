# CMMNS Browser and V8 WebAssembly Verification Bridge V8

SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
SPDX-License-Identifier: MIT

Bridge V8 expands the zero-dependency `HarperZ9/cmmns` Browser and Node V8 WebAssembly verification runtime from 28 to 32 pure-OSI MIT kernels totaling `615,139` bytes (`600.72 KB`, under the `625 KB` budget). V8 leaves Bridges V3 through V7 untouched and adds four BuildLang binaries: Slice 36 `(3,5)` Shamir Threshold HSM (`0` host imports), Slice 37 Reed-Solomon `(4,2)` Self-Healing RAID-6 FS (`0` host imports), the Titan Oracle-Gated RSI Pareto Orchestrator (`5` no-op `env.print_*` stdout stubs), and Superframe PaletteLight Renderer Module #34 (`5` no-op `env.print_*` stdout stubs, `0`-ULP C++23 parity).

## Added V8 Modules (28 to 32 Pure-OSI MIT Kernels)

| Module | Category | Idea | Size | Verified Live Behavior |
| :- | :- | :- | :- | :- |
| `wasm/buildos_shamir_threshold_hsm_zeroc.wasm` | BuildOS HSM | `N49` | `11,087 B` (`10.83 KB`) | Zero-C `0`-import `(3,5)` Shamir + Pedersen VSS + Proactive Refresh (`root=0b8beced748fd970...`), traps `4/4` HSM attacks (`-101..-401`). |
| `wasm/buildos_erasure_coded_raid_fs_zeroc.wasm` | BuildOS RAID-6 | `F1` | `8,979 B` (`8.77 KB`) | Zero-C `0`-import `RS(4,2)` GF(`2^8`) FS (`15/15` 2-erasure heals, `root=8050f7383227a958...`), traps `4/4` storage attacks (`-101..-401`). |
| `wasm/titan_rsi_pareto_orchestrator.wasm` | Titan RSI | `G9` | `9,261 B` (`9.04 KB`) | Print-stub-only `100`-cycle Pareto allocator (`3.020x` gain, `40/40` Goodhart rollbacks, `pareto_hash=1468869863`), traps `2/2` valve attacks (`-101`, `-201`). |
| `wasm/superframe_art_palettelight.wasm` | Renderer #34 | `I16` | `24,777 B` (`24.20 KB`) | Print-stub-only PaletteLight Bayer 8x8 + OKLab shader emitting bit-exact `0xf692a347dda950e0` FNV-1a parity against C++23. |

## Running Verification

```sh
node kernels/wasm-bridge-v8/cmmns_wasm_bridge_v8.test.mjs
```
