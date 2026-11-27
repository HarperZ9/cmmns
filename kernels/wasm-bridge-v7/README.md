# CMMNS Browser and V8 WebAssembly Verification Bridge V7

SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
SPDX-License-Identifier: MIT

Bridge V7 expands the zero-dependency `HarperZ9/cmmns` Browser and Node V8 WebAssembly verification runtime from 24 to 28 pure-OSI MIT kernels totaling `561,035` bytes (`547.89 KB`, under the `575 KB` budget). V7 leaves Bridges V3, V4, V5, and V6 untouched and adds four Zero-C `0`-import BuildOS binaries covering BFT consensus, Curve25519 Pedersen/Schnorr zero-knowledge proofs, the BuildOS-2.1 distributed sovereign cluster, and the unified 12-subsystem BuildOS-2.0 kernel (`22/22` live fail-closed attacks trapped).

## Added V7 Modules (24 to 28 Pure-OSI MIT Kernels)

| Module | Category | Idea | Size | Verified Live Behavior |
| :- | :- | :- | :- | :- |
| `wasm/buildos_bft_consensus_ledger_zeroc.wasm` | BuildOS BFT | `N49` | `30,622 B` (`29.90 KB`) | Zero-C `0`-import 4-validator BFT quorum ledger (`head=1,1,4,3,3`), traps `4/4` Byzantine attacks (`-101..-401`). |
| `wasm/buildos_zk_pedersen_merkle_zeroc.wasm` | BuildOS ZK | `N11` | `29,478 B` (`28.79 KB`) | Zero-C `0`-import Curve25519 Pedersen + Schnorr ZK verifier (`count=26`), traps `4/4` ZK attacks (`-101..-401`). |
| `wasm/buildos_v2_distributed_sovereign_zeroc.wasm` | BuildOS-2.1 | `F1` | `66,784 B` (`65.22 KB`) | Zero-C `0`-import distributed sovereign cluster (`head=1,1,4,7,512,447`), traps `6/6` cluster attacks (`-101..-601`). |
| `wasm/buildos_v2_sovereign_zeroc.wasm` | BuildOS-2.0 | `F1` | `134,198 B` (`131.05 KB`) | Zero-C `0`-import 12-subsystem kernel (`root=b0169274ea5bb300...`), traps `8/8` kernel attacks (`-101..-801`). |

## Running Verification

```sh
node kernels/wasm-bridge-v7/cmmns_wasm_bridge_v7.test.mjs
```
