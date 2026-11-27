# CMMNS Browser and V8 WebAssembly Verification Bridge V4

SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
SPDX-License-Identifier: MIT

Bridge V4 expands the zero-dependency `HarperZ9/cmmns` Browser and Node V8 WebAssembly verification runtime from 12 to 16 pure-OSI MIT kernels totaling `114,411` bytes (`111.73 KB`, under the `125 KB` budget). V4 preserves all 12 Bridge V3 modules untouched (`kernels/wasm-bridge-v3/`) and adds three Zero-C `0`-import BuildOS microkernel binaries (`buildos_e2e_triad_zeroc`, `buildos_compositor_zeroc`, `buildos_input_audio_zeroc`) plus the `CS-024` posterior rare-tail importance-sampling verifier (`cs024_posterior_rare_tail_audit`).

## Added V4 Modules (12 -> 16 Pure-OSI MIT Kernels)

- `wasm/buildos_e2e_triad_zeroc.wasm` (`21,867 B`, `0` imports, Slice 20): clean triad (`status=1, triad_committed=1, boot_slot=2, epoch=20, ticks=9, vfs_blocks=4`), rejects `4/4` attacks (`-101` epoch rollback, `-201` W^X escalation, `-301` IPC double send, `-401` VFS corruption).
- `wasm/buildos_compositor_zeroc.wasm` (`7,976 B`, `0` imports, Slice 22): clean 2-frame scanout (`status=1, scanout_committed=1, frames=2, dirty_px=16, px0=0xff182638`), rejects `4/4` display attacks (`-101` screen scrape, `-201` rect overflow, `-301` z-order clickjacking, `-401` display log tamper).
- `wasm/buildos_input_audio_zeroc.wasm` (`7,369 B`, `0` imports, Slice 23): clean HID + Q15 audio mix (`status=1, io_committed=1, hid=16, sak=2, pcm=32, clipped=5`), rejects `4/4` I/O attacks (`-101` keylogger tap, `-201` mic eavesdrop, `-301` ring overrun, `-401` I/O log tamper).
- `wasm/cs024_posterior_rare_tail_audit.wasm` (`6,076 B`, `CS-024`): posterior rare-tail importance-sampling verifier (`run_audit(0)=0`), rejects probability-sum violation (`-241`) and martingale violation (`-242`).

## Running Verification

```sh
node kernels/wasm-bridge-v4/cmmns_wasm_bridge_v4.test.mjs
```
