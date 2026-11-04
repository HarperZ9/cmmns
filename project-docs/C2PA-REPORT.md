# Content Credentials validation report

`src/core/c2pa-report.js` turns a file's C2PA manifest into a report with one field per check, so
a valid signature is never read as more than it is. The badge (`src/core/c2pa-badge.js`) is the
strongest statement the report supports. The user page is `docs/guide/CONTENT-CREDENTIALS.md`.

## Why

A C2PA validator can call a manifest valid while three things a reader cares about go unchecked
or unstated. Each was confirmed against the specification text before this was built (C2PA 2.5,
October 2026, HTML; the same clauses are in the 2.3 PDF of January 2026):

1. **Revocation is optional.** Section 14.9.2: when no stapled OCSP response settles it, the
   validator "may choose to query the OCSP responder"; skipping it issues only the informational
   code `signingCredential.ocsp.skipped`. Section 13.3.5: a manifest is Valid when it is not
   rejected with `signingCredential.ocsp.revoked`, so a never-checked certificate passes. Section
   13.5.2 forbids claim generators from using CRLs. Section 14.9 treats a certificate with no
   revocation method as not revoked. Section 14.9.2 counts a certificate revoked after the
   attested time stamp as not revoked at signing. Golaszewski et al. (arXiv:2604.24890) report a
   Nikon Z6 III certificate revoked in November 2025 that Adobe Inspect still showed as valid six
   months later.
2. **The AI-origin field is not required.** Section 16.4.1.2 requires a `digitalSourceType` only
   with `c2pa.created`, and states that none is required with `c2pa.opened`. The validator's
   required-assertion checks (section 14.10.1.2) require a created or opened action but never test
   for a source type. Nemecek et al. (arXiv:2603.02378) signed a manifest with `c2pa.edited` and no
   `digitalSourceType` over watermarked AI pixels; it validated.
3. **The time stamp is outside the signature.** Section 10.3.2.5.4 stores it in the COSE
   unprotected header; section 14.8.2 records a failed time stamp and carries on without it, falls back to the current time without one, and does not require checking the
   time-stamp authority's revocation.

Also from the same sections: exclusion ranges in a data hash may hold EXIF or IPTC metadata
(16.3.1.1), and a soft binding is a fingerprint or watermark, not statistically unique (2.3.14).

## Use

```js
import { credentialReport } from "./src/core/api.js";   // or c2paReport from src/core/c2pa-report.js
const report = await credentialReport(bytes, {
  now: "2026-11-02T00:00:00Z",   // the time checks run at; default: the current time
  trustAnchors: [rootDer],        // DER certificates; none: the chain reads "not checked"
  crls: [crlDer],                 // DER CRLs the caller fetched; checked against the issuer's key
  ocsp: [ocspDer],                // DER OCSP responses the caller fetched
  complete: true,                 // false when only part of the file was read
});
```

CMMNS makes no network call here. The certificate's own OCSP and CRL addresses are in
`signer.revocationPointers`, so a caller with network access can fetch them, pass them in, and
get a status now. The extension passes nothing, so its badge reads `not checked: revocation`.

## JSON shape

Schema: `schema/c2pa-report.v1.json` (`urn:radar:c2pa-report:v1`), checked by
`tests/c2pa-report.test.js`. The report is plain JSON with no byte arrays. A file without
credentials carries only `schema`, `spec`, `checkedAt`, `found`, `format`, `remote` (or `broken`),
`weaknesses` (empty) and `badge`.

| Field | Values | Meaning |
|---|---|---|
| `schema` | `"cmmns.c2pa-report/1"` | Report format. A new major number means a field changed meaning. |
| `spec` | `"C2PA 2.5"` | The version the weakness list cites. |
| `checkedAt` | ISO time | The `now` the checks ran at. |
| `found`, `format`, `manifests` | | Whether a manifest store was found, the container, how many manifests. |
| `signature` | `{ valid, alg, text }` | COSE_Sign1 over the claim with the leaf key. `valid`: `true`, `false`, or `null` when not checkable here. |
| `assertions` | `{ valid, text }` | Every hashed URI in the claim against its box. |
| `signer` | `{ subject, issuer, serial, notBefore, notAfter, selfIssued, revocationPointers: { ocsp, crl } }` | The leaf certificate. `serial` is lower-case hex. |
| `chain` | `{ trusted, at, timeSource, length, anchor, problems, text }` | `trusted`: `true` (reaches a supplied anchor), `false` (a broken link, out of its dates, or reaches none of the anchors), `null` (no anchors, or a signature algorithm CMMNS cannot check). Checked at `at`, the validation time. |
| `revocation.atSigning` | `{ status, method, authorityTime, nextUpdate, revokedAt, reason, text }` | From OCSP responses stapled in the manifest. `status`: `good`, `revoked`, `unknown`, `not-stapled`. |
| `revocation.now` | same, plus `checkedAt` | From the caller's CRLs and OCSP responses. `status`: `good`, `revoked`, `unknown`. `authorityTime` is when the issuer vouched (CRL `thisUpdate`, OCSP `producedAt`). Any verified `revoked` wins. |
| `timestamp` | `{ present, checked: false }` | CMMNS does not check time-stamp tokens. |
| `fields` | `{ title, claimGenerator, claimVersion, actions, firstAction, digitalSourceType, softwareAgent, aiOrigin, aiDisclosureAssertion, assertions, earlierManifests }` | What the active manifest declares. `aiOrigin`: `declared-ai`, `earlier-ai` (an earlier manifest declares it), `declared-not-ai` (a source type that is not AI), `absent`. |
| `binding.hard` | `{ type, valid, text, exclusions: [{ start, length, onlyCredentials }] }` | The hard binding. `onlyCredentials` is `false` for an exclusion that covers bytes outside the credentials. |
| `binding.soft` | `{ present, algorithms, checked: false }` | Soft bindings are listed, never checked. |
| `formatNote` | text or `null` | Set for forms CMMNS does not fully verify (version 1 claims in MP4). |
| `weaknesses` | `[{ id, title, detail, spec, source }]` | Only those that apply to this file. |
| `badge` | `{ level, text, parts: [{ id, text }] }` | `level`: `info`, `warn`, `flag`. `text` joins the parts with "; ". |

Revocation evidence counts only when it is signed by the certificate's issuer (or an OCSP
responder the issuer authorised), names this certificate, and is current at `now`. Anything else
is `unknown` with the reason in `text`, never `good`.

### Badge parts

Read `parts[].id`. The wording may change in a patch.

| id | When |
|---|---|
| `none`, `remote`, `broken` | No credentials, credentials stored online, unreadable credentials. Alone. |
| `signature-fails`, `assertions-changed`, `signature-unchecked` | The claim cannot be relied on. Alone. |
| `signer` | "signed by X" when `chain.trusted` is `true`; otherwise "valid signature from a certificate naming X". |
| `changed` | The hard binding failed. Level `flag`. |
| `revoked` | `revocation.now.status` is `revoked`. Level `flag`. |
| `untrusted` | `chain.trusted` is `false`. Level at least `warn`. |
| `ai-declared`, `source-declared`, `ai-absent` | One of the three, from `fields.aiOrigin`. AI declared raises the level to `warn`. |
| `unchecked` | Lists what did not run: trust list, revocation, file bytes, older manifest format. |

### Weakness ids

| id | Applies when | Spec |
|---|---|---|
| `revocation-optional` | the signature is valid | 13.3.5, 14.9.2 |
| `revoked-after-signing` | revoked now | 14.9.1, 14.9.2 |
| `no-revocation-pointer` | the certificate names no OCSP or CRL address | 14.9 |
| `timestamp-unbound` | a time stamp is present | 10.3.2.5.4, 14.8.2 |
| `expiry-unverifiable` | valid signature, no time stamp | 14.8.2 |
| `ai-origin-optional` | valid signature, `aiOrigin` is `absent` | 16.4.1.2, 14.10.1.2 |
| `exclusion-range` | an exclusion covers bytes outside the credentials | 16.3.1.1 |
| `soft-binding-not-cryptographic` | a soft binding is present | 2.3.14 |
| `validators-disagree` | the signature is valid | none (conformance program) |

## Fixtures and tests

`scripts/c2pa-report-fixtures.mjs` (with `scripts/c2pa-pki-fixtures.mjs`) builds
`tests/fixtures/c2pa-report/`: a test root and an impostor root, a signer (serial 1001) and a signer
revoked on 2026-06-01 for key compromise (serial 1002), the root's CRL of 2026-10-01 (next update
2027-01-01), a forged CRL with the root's name and another key, OCSP responses for both signers,
and four JPEGs over the flat-colour `tests/fixtures/c2pa/plain.jpg`: `complete.jpg`, `revoked.jpg`
(both with an OCSP response of 2026-03-01 stapled), `ai-stripped.jpg` (`c2pa.opened` then
`c2pa.edited`, no source type) and `created-no-source.jpg`. The keys exist only in memory while the
script runs; nothing private is committed.

`tests/c2pa-report.test.js` gives each case a positive, a negative and a false-positive control:

| Case | Positive | Negative | False-positive control |
|---|---|---|---|
| Revoked certificate | the reader still says `unchanged`; the report says revoked since 2026-06-01 by CRL and by OCSP | the same CRL leaves serial 1001 `good` | no evidence, a forged CRL, a CRL past its next update, and an OCSP answer about another serial all give `unknown` |
| AI field stripped | both stripped files pass every C2PA check and read `absent` with `ai-origin-optional` | the complete manifest reads `declared-ai` | a capture manifest reads `declared-not-ai`; an earlier AI manifest reads `earlier-ai`; a changed byte still flags |
| Valid, complete | trusted chain, good revocation, hard binding, exact badge | a changed pixel fails the binding, a changed claim fails the signature | no anchor gives `null`, the impostor anchor gives `false`, a date past the certificates gives `false` |

The c2pa-reference CI job also builds the report on the 43 c2pa-rs fixtures and checks it finds
credentials where the reader does, never says "signed by" without a trust list, and flags every
changed file.

**Verified** (2026-11-02):
- The clauses above: read in the C2PA 2.5 HTML and the 2.3 PDF.
- The fixture certificates, CRL and OCSP responses: OpenSSL 3.5.4 parses each; `openssl verify
  -crl_check` passes serial 1001 and fails serial 1002 as revoked; `openssl ocsp` verifies both the
  stapled and the later responses against the root; the forged CRL fails signature verification.
- `node scripts/ci.mjs test` and `node scripts/ci.mjs c2pa`: pass.

The fixtures were built by this project's own writer. No other C2PA implementation has checked
them, so agreement with one on these files is not shown. The reader that checks them is the one the c2pa-reference
job holds to c2patool's verdicts.
