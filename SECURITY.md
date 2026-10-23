# Security policy

## Report a vulnerability privately

Use GitHub's private vulnerability reporting: open
https://github.com/HarperZ9/daylight-commons/security/advisories/new, or go to the repository's **Security**
tab and choose **Report a vulnerability**. Only the maintainers see the report. Please do not open a
public issue, pull request or discussion for a security problem.

If that form is not available to you, write to the contact address on the maintainer's GitHub
profile (https://github.com/HarperZ9) with "Daylight Commons security" in the subject, and say only that you
have a report; the maintainer will reply with a private channel.

Please include:
- the Daylight Commons version (toolbar popup, or `manifest.json`) and the browser and its version;
- what an attacker can do, and what they need first;
- steps to reproduce, or a proof of concept that touches only your own accounts and data.

## What happens next

- You get an acknowledgement as soon as the maintainer reads the report.
- The fix is developed in a private advisory fork. You are credited in the advisory unless you ask
  not to be.
- Public description follows the fix, or a date agreed with you. A fix that changes what Daylight Commons
  sends or stores is also recorded in `CHANGELOG.md` and `PRIVACY.md`.

Daylight Commons is maintained by one person, so no response time is promised.

## In scope

- The extension in `src/ext` and the core in `src/core`: anything that lets a page, a post or a
  data file run code, read Daylight Commons' stored data, or make Daylight Commons send data the user did not choose to
  send.
- The signing and verification of releases, data packs and evidence bundles
  (`scripts/release.mjs`, `scripts/verify-release.mjs`, `src/core/evidence-bundle.js`).
- The signed head and its rules: the size limit, the signature count, rollback refusal, expiry and
  the clock rule (`src/core/head.js`, `scripts/head-lib.mjs`, `src/ext/options-head.js`). A way to
  make a device accept an older head, or a head no trusted key signed, is a vulnerability. The head
  format has had no independent audit.
- The offline kit checker and the mirror check (`docs/verify-offline.html`, built by
  `scripts/verify-offline.mjs` from `src/core/kit-verify.js`; `scripts/kit.mjs`;
  `scripts/mirror-check.mjs`). A kit that the page reports as verified although a signed file
  changed, or a page that makes any network request, is a vulnerability. Not audited.
- The command line tool in `bin/`.

Out of scope: problems in the browsers or the social platforms themselves, and wrong evidence that
is not a security problem. A wrong badge or catalogue entry goes through the challenge process in
`GOVERNANCE.md`.

## Supported versions

Only the latest release receives fixes.
