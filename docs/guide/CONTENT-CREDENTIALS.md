<!-- writing-profile: readme -->
# Content Credentials: what the line tells you

When you check a picture or a video, CMMNS reads its Content Credentials (the C2PA standard) and
puts one line at the top of the card. The line is the strongest statement the checks support, and
nothing stronger. A valid signature alone is never shown as more than a valid signature.

## Reading the line

| You see | It means |
|---|---|
| `valid signature from a certificate naming "Example News"` | The signature matches, and the certificate carries that name. Anyone can make a certificate with any name, so the name is the certificate's own claim. |
| `signed by Example News` | The same, and the certificate chains to a trust list you gave CMMNS. The extension carries no trust list, so you see this only through the API with a list you chose. |
| `certificate revoked since 2026-06-01` | The issuer's revocation list or OCSP answer says the certificate was revoked on that date. Other tools may still show the file as valid. |
| `the file changed after signing` | The file's bytes no longer match the signed hash. Editing tools and platforms also do this in ordinary use. |
| `says it was made with generative AI (Generator 1.0)` | The signing tool declared AI origin and named the generator. |
| `AI-origin field absent, which the spec does not require` | The credentials make no statement about AI. That says nothing either way about how the picture was made. |
| `declares its source: captured by a camera or recorder (digitalCapture)` | The signing tool declared a capture. It is the tool's claim, checked for tampering, not for truth. |
| `not checked: trust list, revocation` | Those checks did not run. CMMNS never fills a gap with a guess. |
| `no Content Credentials found` | The usual case: most platforms strip credentials on upload. |

## What the line can tell you

- Whether the signature matches the signed claim, and whether every assertion still matches it.
- Whether the file's bytes still match the signed hash, outside the ranges the credentials exclude.
- What the signing tool declared: AI origin, the generator, the actions, earlier versions.
- Whether the certificate was revoked, when you hand CMMNS the issuer's CRL or OCSP answer.

## What it cannot tell you

- **Whether the picture shows what happened.** Credentials record what a tool declared. A valid
  signature shows who signed and that the file has not changed since.
- **Whether the certificate was revoked, in the extension.** CMMNS makes no network call for this,
  so the line says `not checked: revocation`. The C2PA spec makes this check optional, and a
  camera certificate revoked in November 2025 was still shown as valid by one widely used tool six
  months later.
- **Whether a file without an AI field was made without AI.** The spec requires the field only when
  a file is created, never when it is opened and edited, and no validation step checks for it. A
  manifest that leaves it out still passes, even when a watermark in the pixels says AI.
- **When it was signed, for sure.** The time stamp sits outside the signed data, so it can be
  swapped. CMMNS does not check time stamps. Without one, a file stops validating once its
  certificate expires, even though nothing in it changed.
- **Anything a watermark or fingerprint says.** Those soft bindings are not checked.
- **What another tool will say.** Conforming tools have given opposite answers on the same file.

The full report lists every weakness that applies to the file, with the clause of the C2PA
specification that allows it. The research behind them: Golaszewski et al. 2026, "Verifying
Provenance of Digital Media: Why the C2PA Specifications Fall Short" (arXiv:2604.24890), and
Nemecek et al. 2026, "Authenticated Contradictions from Desynchronized Provenance and
Watermarking" (arXiv:2603.02378).
