# CMMNS Browser and V8 WebAssembly Verification Bridge V5

SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
SPDX-License-Identifier: MIT

Bridge V5 expands the zero-dependency `HarperZ9/cmmns` Browser and Node V8 WebAssembly verification runtime from 16 to 20 pure-OSI MIT kernels totaling `213,172` bytes (`208.18 KB`, under the `225 KB` budget). V5 leaves Bridge V3 (`kernels/wasm-bridge-v3/`) and Bridge V4 (`kernels/wasm-bridge-v4/`) untouched and adds three Zero-C `0`-import BuildOS microkernel binaries (`buildos_v1_unified_zeroc`, `buildos_smp_mmu_zeroc`, `buildos_iommu_nvme_zeroc`) plus the `CS-031` automated port-equivalence verifier (`cs031_automated_port_verifier`).

## Added V5 Modules (16 -> 20 Pure-OSI MIT Kernels)

| Module | Category | Idea | Size | Verified Live Behavior |
| :- | :- | :- | :- | :- |
| `wasm/buildos_v1_unified_zeroc.wasm` | BuildOS-1.0 | `F1` | `74,577 B` (`72.83 KB`) | Zero-C `0`-import 7-subsystem OS kernel (`status=1, committed=1`), catches `6/6` attacks (`-101..-601`). |
| `wasm/buildos_smp_mmu_zeroc.wasm` | BuildOS SMP | `N49` | `9,255 B` (`9.04 KB`) | Zero-C `0`-import 4-core SMP scheduler + Sv39 MMU/TLB (`cores=4`), catches `4/4` attacks (`-101..-401`). |
| `wasm/buildos_iommu_nvme_zeroc.wasm` | BuildOS Storage | `N53` | `11,147 B` (`10.89 KB`) | Zero-C `0`-import IOMMU DMA sandbox + NVMe WAL (`status=1`), catches `4/4` attacks (`-101..-401`). |
| `wasm/cs031_automated_port_verifier.wasm` | Port Verifier | `AC1` | `3,782 B` (`3.69 KB`) | Verifies `1,000/1,000` clean ports (`0.0` drift) + `50/50` bug detections, rejects `-311/-312`. |

## Running Verification

```sh
node kernels/wasm-bridge-v5/cmmns_wasm_bridge_v5.test.mjs
```
