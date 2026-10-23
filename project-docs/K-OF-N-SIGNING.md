<!-- writing-profile: research -->
# Several signers for the head (P3): design on paper

Status: design only. Nothing here is built beyond what the head already carries. Written
2026-10-23 with increment 1 of the resilience backlog. The key at the maintainer's offline store is
not touched and no key is rotated by this note.

## Why

A release today carries one signature. Whoever holds the project key, or takes it, or makes its
holder sign under pressure, can publish a head that every device accepts. The head's rollback and
expiry rules do nothing against that. Several independent signers do: no single key can move
devices to a new release.

## What the head already holds

`src/core/head.js` reads `signers: { k, keys }` and counts valid signatures only from keys that are
both listed in the head and trusted on the device, each key once. A device can also demand more
than the head asks for (`minK`). With `k = 1` and one key, that is the single-signer release the
card names. So the format needs no change for k of n. What is missing is the trust list, the
ceremony and the people.

## Proposed rules

1. **Trusted set lives on the device, not in the head.** The head lists which keys signed; the
   device decides which keys it trusts. A head cannot add a key to the trusted set.
2. **Policy 2 of 3 to start.** Signer 1 is the maintainer. Signers 2 and 3 are independent people
   or organisations who rebuild from the release's git bundle, compare package hashes, and sign
   the head only on a match. None has been asked yet.
3. **Distinct keys, distinct hardware.** A signer's key sits on separate hardware from every other
   signer's. Two signatures from one key count once (already enforced).
4. **The minimum lives in the shipped code.** Once two independent signers exist, the extension and
   `verify-release` ship with `minK = 2`. A head that asks for `k = 1` then still needs two.
5. **Changing the set needs the old set.** A new trusted set ships inside a release whose head is
   signed by k of the old set. That is the only way a set changes. A lost key is replaced the same
   way; a device never accepts a set change from a file alone.
6. **Rebuilders attest, then sign.** `scripts/rebuild-attest.mjs` (not written) clones the bundle,
   runs `npm run package`, compares `dist/SHA256SUMS` with the release, and prints a signed
   attestation only on a match. The signer then signs the head over the same `SHA256SUMS`.
7. **Honest label.** The card says "single-signer release" while the active head has `k = 1`, and
   "k of n signatures" otherwise.

## Acceptance tests for when it is built (from BACKLOG P3)

1. A head with 1 valid signature of `k = 2` is refused (the `threshold` rule exists today).
2. The same key listed twice counts once.
3. A signature from a key outside the trusted set is ignored and does not count toward k.
4. A rebuild with one changed source byte produces no attestation and exits non-zero.
5. A head with signatures valid for different content is refused.
6. The UI says "single-signer release" whenever the active head has `k = 1`.

## Limits

- Threshold signing helps only when the signers are independent and their keys sit on separate
  hardware. Recruiting them takes weeks and has not started.
- It misses a malicious change that every rebuilder also fails to see. A rebuild shows the package
  came from the source; it says nothing about the source.
- It does not protect a person whose device is seized or compromised.

## Needs an independent audit

The head format, its parser, the signature counting and the trusted-set update path (rule 5) need
an independent security audit before anyone at risk relies on them. No audit has been requested.
