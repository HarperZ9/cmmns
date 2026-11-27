# CMMNS Browser and V8 WebAssembly Verification Bridge V3

SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
SPDX-License-Identifier: MIT

Bridge V3 expands the zero-dependency `HarperZ9/cmmns` Browser and Node V8 WebAssembly verification runtime from 8 to 12 pure-OSI MIT kernels totaling `71,123` bytes (`69.46 KB`, under the `75 KB` budget with every single module `<= 13.96 KB`). V3 bundles the complete TLS 1.3 cryptographic triad (`SHA-256`, `ChaCha20-Poly1305 AEAD`, `X25519`), end-to-end Zero-C TLS handshake (`0` imports), RFC 6962 Merkle proofs, Byzantine `3f+1` evidence quorum consensus, 4-mirror archival survival, and five statistical and governance verification gates.

## Module Inventory (12 Pure-OSI MIT Kernels)

| Module | Category | Idea | Size | Verified Live Behavior |
| :- | :- | :- | :- | :- |
| `wasm/merkle_rfc6962.wasm` | Merkle | `N49` | `8,662 B` (`8.46 KB`) | RFC 6962 root `3c534b22...ae22d2` (`4/4` leaves), catches `-902/-903`. |
| `wasm/honest_exit_valve.wasm` | Governance | `N25` | `2,688 B` (`2.62 KB`) | Arm C `0.0` hacking, `300` reseats, catches broken valve `-101`. |
| `wasm/isomorphism_entropy.wasm` | Epistemic | `D6` | `2,974 B` (`2.90 KB`) | Bijective `H(M|R)=0.0`, `256/256` roundtrip, catches trunc/coll `-401`. |
| `wasm/confidence_word_calib.wasm` | Epistemic | `N30` | `1,582 B` (`1.54 KB`) | Bands `3,2,1,0`, catches overclaim `-401`, no-control `-402`, invalid `-403`. |
| `wasm/sha256_zeroc.wasm` | Crypto Triad | `F1` | `7,681 B` (`7.50 KB`) | FIPS 180-4 `SHA256("abc") = ba7816bf...f20015ad`, catches 1-bit flip (`8/8` words). |
| `wasm/aead_chacha20_poly1305.wasm` | Crypto Triad | `F1` | `14,298 B` (`13.96 KB`) | RFC 8439 tag `1ae10b59...d0600691`, ct word `d31a8d34`, catches `2/2` tampers. |
| `wasm/x25519_curve25519_zeroc.wasm` | Crypto Triad | `F1` | `4,392 B` (`4.29 KB`) | Zero-C `0`-import RFC 7748 ECDH `4a5d9d5b...1e161742`, rejects low-order & flip. |
| `wasm/three_control_negatives.wasm` | Governance | `N28` | `3,915 B` (`3.82 KB`) | `r_sig=0.9994 (p=0.00498)` vs `r_null=0.0923 (p=0.2736)`, catches `-201/-202/-203`. |
| `wasm/tls_mini_handshake_zeroc.wasm` | TLS Handshake | `F1` | `11,829 B` (`11.55 KB`) | Zero-C `0`-import X25519+HKDF+AEAD handshake (`status=1`), catches MITM `-101` & tamper `-201`. |
| `wasm/cmmns_evidence_quorum.wasm` | BFT Quorum | `N32` | `9,227 B` (`9.01 KB`) | BFT `3f+1` FIPS SHA-256 pin `834a66c9...9aec7f0c`, catches `-501/-502/-503`. |
| `wasm/cmmns_citation_decay.wasm` | Archival | `N28` | `2,461 B` (`2.40 KB`) | 4-mirror 10-yr survival `99.64%` vs `13.53%` SPOF, catches `-601/-602/-603`. |
| `wasm/cmmns_attention_valve.wasm` | Governance | `I10` | `1,414 B` (`1.38 KB`) | Voluntary stop-ramp (`20/30` active, `30/30` ramp), catches `-901/-902/-903`. |

## Running Verification

```sh
node cmmns_wasm_bridge_v3.test.mjs
```
