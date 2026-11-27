# CMMNS Browser and V8 WebAssembly Verification Bridge V6

SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
SPDX-License-Identifier: MIT

Bridge V6 expands the zero-dependency `HarperZ9/cmmns` Browser and Node V8 WebAssembly verification runtime from 20 to 24 pure-OSI MIT kernels totaling `299,953` bytes (`292.92 KB`, under the `300 KB` budget). V6 leaves Bridges V3, V4, and V5 untouched and adds four Zero-C `0`-import BuildOS security binaries covering confidential enclave attestation, post-quantum hybrid key exchange, QUIC zero-copy firewall enforcement, and capability-scoped sandbox VM execution (`16/16` live fail-closed attacks trapped).

## Added V6 Modules (20 to 24 Pure-OSI MIT Kernels)

| Module | Category | Idea | Size | Verified Live Behavior |
| :- | :- | :- | :- | :- |
| `wasm/buildos_enclave_attest_zeroc.wasm` | BuildOS Enclave | `N11` | `35,925 B` (`35.08 KB`) | Zero-C `0`-import confidential enclave sealing + Ed25519 quote (`head=1,1,28,42,5`), traps `4/4` attacks (`-101..-401`). |
| `wasm/buildos_pq_hybrid_kem_zeroc.wasm` | BuildOS PQ KEM | `N11` | `25,674 B` (`25.07 KB`) | Zero-C `0`-import FIPS 203 `q=3329` ML-KEM-512 + X25519 hybrid KEM (`head=1,1,3329,256,2`), traps `4/4` attacks (`-101..-401`). |
| `wasm/buildos_quic_zero_copy_net_zeroc.wasm` | BuildOS QUIC | `N53` | `12,839 B` (`12.54 KB`) | Zero-C `0`-import QUIC-Lite encrypted transport + `CAP_NET_PEER` firewall (`count=25`), traps `4/4` attacks (`-101..-401`). |
| `wasm/buildos_wasm_cap_vm_zeroc.wasm` | BuildOS CapVM | `AC1` | `12,343 B` (`12.05 KB`) | Zero-C `0`-import capability-scoped guest sandbox VM (`head=1,1,512,447,3`), traps `4/4` attacks (`-101..-401`). |

## Running Verification

```sh
node kernels/wasm-bridge-v6/cmmns_wasm_bridge_v6.test.mjs
```
