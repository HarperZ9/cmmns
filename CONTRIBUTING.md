# Contributing to Daylight Commons

Thank you for helping. Daylight Commons is a tool for the commons, so how contributions come in matters as
much as what they change.

## Licence of your contribution

By contributing you agree that your work is offered under the licence of the files you change:
AGPL-3.0-only for code, CC BY 4.0 for data, the catalogue, schemas and documentation (see
`REUSE.toml`). You keep the copyright in your contribution.

## Sign off every commit (Developer Certificate of Origin)

Daylight Commons uses the Developer Certificate of Origin (DCO) 1.1, printed in full below. Add a sign-off line
to every commit to certify that you wrote the change or have the right to submit it:

```
git commit -s -m "fix(reddit): read the new comment shape"
```

This adds `Signed-off-by: Your Name <you@example.org>` to the message. A pseudonym you use
consistently is fine. The name and email in the sign-off must match the commit's author.

Every pull request runs the sign-off check (`.github/workflows/dco.yml`). It fails on any commit
without a matching sign-off and names the commit. Merge commits are skipped. Run the same check
before you push:

```
node scripts/ci.mjs dco
```

It checks `origin/main..HEAD`; set `DCO_BASE` and `DCO_HEAD` to check another range. A pull
request with an unsigned commit cannot be merged until it is signed off
(`git rebase --signoff main` fixes a whole branch).

### Why a DCO and no CLA

A contributor licence agreement usually hands one party the right to relicense everyone's work,
including under closed terms. Daylight Commons has none. Each contributor keeps their copyright and licenses
it under the AGPL or CC BY 4.0, exactly as everyone else receives it. Changing Daylight Commons' licence
would need every copyright holder's consent, so no single party, the author included, can take
contributions closed. The DCO records only that you had the right to contribute.

If you used an AI tool to write part of a change, say so in the pull request and review the result
as your own; the sign-off is still yours.

## How to contribute

1. Open an issue first for anything larger than a small fix, so the approach can be agreed.
2. Branch from `main`. Keep files under 300 lines and functions under 50.
3. Run `npm run ci`. It runs every test and checks the built bundles match a fresh build, exactly as
   GitHub Actions does. After changing `src/core`, run `npm run build` and commit the bundles.
4. Follow the rules in `CLAUDE.md` and `project-docs/DESIGN.md`. In short: evidence, never
   verdicts; political side is never an input, and rhetoric markers must pass the symmetry tests;
   nothing leaves the user's machine unless the user turns on a named feature.
5. New third-party data or code: record its licence in `THIRD-PARTY.md` and `REUSE.toml` in the
   same pull request. Material under a non-commercial or no-derivatives licence cannot ship.
6. Never commit other people's posts. Raw captures stay in `project-docs/evidence/raw/`, which git
   ignores.

The definition catalogue is published as a page, `docs/catalogue.html`, built from `catalogue/` by
`node scripts/catalogue-page.mjs`. After changing an entry, rebuild the page and commit it with the
entry; CI fails when the page and the catalogue differ.

The repository is planned to have a read-only mirror on Codeberg, so the project does not depend on
one code host. `project-docs/MIRROR.md` has the steps.

To challenge a catalogue entry or a badge, follow the challenge process in
`GOVERNANCE.md`. Security problems go through `SECURITY.md`, never a public issue. Everyone
taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Developer Certificate of Origin 1.1

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

Source: https://developercertificate.org/ (retrieved 2026-10-22).
