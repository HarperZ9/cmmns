# Release audit: Daylight Commons 3.0.0

Date: 2026-10-23. Checked on the release branch, built from `main` at `db360af`, with every fix
below applied. The audit compares `main` with the first phase of the project's direction (the
campaign lens, and the evidence layer that followed it) and with every checkable claim in the README,
the privacy policy, the install page, the store listing, the changelog and the launch drafts.

## How it was checked

- **Chrome.** Google Chrome 155, headless, fresh profile. The release zip was unpacked and loaded
  through the DevTools protocol, the way a developer loads it unpacked. x.com was answered inside
  the browser with synthetic pages and X-shaped responses (`scripts/demo/`), so the real content
  scripts ran on them and nothing reached X. Every other request was logged; the only ones that
  left the browser were the evidence lookups to api.github.com and web.archive.org that the
  recording asked for.
- **Firefox.** Firefox 154, headless, fresh profile. The release xpi was installed as a temporary
  add-on over WebDriver BiDi (`scripts/demo/firefox.mjs`). First run, Options, Analyse a file and
  the privacy page loaded; the saved evidence chain passed its check on the Analyse a file page; on
  the synthetic thread the window opened beside a reply with its signs (`demo/firefox-thread-window.png`).
- **Command line.** `bin/`, `src/`, `schema/` and `package.json` copied from `git archive` into an
  empty folder with no `node_modules`: `analyze`, `analyze --bundle`, `verify` on the bundle and
  `verify` on a saved evidence chain all ran.
- **Tests.** `npm test`: 1,053 tests, 1,051 passing and 2 skipped (the c2pa reference tests, which need the c2pa-rs fixtures that CI fetches), on Windows; CI runs the same on Ubuntu and Windows.
- **Text.** Claim by claim against the code, with counts recomputed from the shipped tables.

## Results

| # | Claim | Where it is made | How checked | Result on `main` before | Now |
|---|---|---|---|---|---|
| 1 | Install from the release zip in Chrome, Edge, Brave | README | Chrome 155, release zip | pass | pass |
| 2 | Firefox 128 or later loads the xpi | README, INSTALL | Firefox 154, BiDi install; packaged manifest says 128.0 | pass | pass |
| 3 | First run lets you pick sites, "Start Daylight Commons" | README | Chrome and Firefox first-run pages | pass | pass |
| 4 | Signs show where the platform places the account, coordination, posting, language, sources, fact-checks | README, store description | synthetic thread, each finding opened (`demo/finding-*.png`) | pass | pass |
| 5 | Launch campaign lens names a company only when signs agree, never an ordinary account | README, CAMPAIGN-LENS | code and tests; synthetic paid launch | pass, but named inferences shipped before the media-lawyer review the lens design requires before a public release | naming held (`NAMING_HELD`), tested; claims read "this launch" |
| 6 | Launch campaign lens says "no campaign signs" on an ordinary launch | CAMPAIGN-LENS controls | synthetic launch with quotes nine hours apart | **fail**: any five quotes read as "looks coordinated" | fixed: only five quotes inside an hour count; control 3 |
| 7 | Accusation ladder wording: documented fact, inference said as inference, weak sign makes no claim | VISION, CAMPAIGN-LENS | strings in `src/core/campaign.js`, tests | pass | pass |
| 8 | Every sign has a source and a does-not-prove line | README, store | code, tests, stills | pass | pass |
| 9 | Dispute route on campaign findings | CAMPAIGN-LENS | panel text | pass (plain text, not a link) | pass |
| 10 | Evidence lookups: repository creation date, domain registration, first archive capture | README, EVIDENCE-LAYER | Chrome, synthetic post linking this project's repository and site | **fail**: the archive lookup failed (its index stopped sending a CORS header), and a site on github.io was looked up as github.io | fixed: Options asks for web.archive.org; hosted sites looked up whole, RDAP not asked; tests |
| 11 | Receipts sealed in a hash chain with Merkle proofs; edits, swaps, removals, reordering and re-rooting are rejected | EVIDENCE-LAYER, CHANGELOG | `tests/evidence.layer.test.js` | pass | pass |
| 12 | A saved evidence chain can be checked offline | EVIDENCE-LAYER, launch drafts | `radar verify` on a saved chain | **fail**: only a library function existed; `radar verify` refused the file | fixed: `radar verify` and the Analyse a file page check chains, line by line; tests |
| 13 | Signed bundles verify offline; a changed bundle fails | README | CLI, clean folder | pass | pass |
| 14 | No npm dependencies; the CLI runs without installing anything | README, SHOW-HN draft | clean folder, no `node_modules` | pass | pass |
| 15 | About 20,000 fact-check reviews from 328 fact-checkers | README | counted `claims.json` and `claims-2.json` | **fail**: 19,387 reviews from 319 fact-checkers | fixed in README and the design notes |
| 16 | 33 suggested feeds across 18 countries | README, CHANGELOG | counted `src/core/outlets.js` | pass | pass |
| 17 | Retention 14 days for account details, 60 for history | README | settings code | pass | pass |
| 18 | "One-click" Clear all | README, store, GOVERNANCE | Options page | **fail**: two steps by design | wording fixed; PRIVACY lists what it keeps |
| 19 | Nothing leaves the browser unless you opt in | manifest, store, welcome, popup, page footers | network code | **fail**: account lookups go to the site you are on by default, and evidence lookups were left out | wording fixed everywhere it appeared |
| 20 | Each sign with its error rate | manifest, store | measured-figure code | **fail**: 4 of 35 detectors are measured | wording fixed; a test bans the old phrase |
| 21 | Privacy policy covers every request | PRIVACY | network code | **fail**: intro and "never does" left out evidence lookups, and named title words Other coverage no longer sends | fixed |
| 22 | Firefox and Chrome Web Store data declarations | manifest, store listing | evidence lookups send domains and repository names | **fail**: declared no collection | fixed: Firefox `optional: websiteContent`, asked for in Options; store form says website content sent |
| 23 | Every released version is under the AGPL | GOVERNANCE | `git show` of each tag's LICENSE | **fail**: 1.0.0 to 2.1.0 are FSL-1.1-MIT | fixed: "from 3.0.0 on" |
| 24 | Releases carry a signed SHA256SUMS, a git bundle and the key | README, INSTALL, GOVERNANCE | v2.1.0 release assets | **fail** for 2.1.0 (unsigned sums only) | true from 3.0.0: checked after download (release notes) |
| 25 | Packages rebuild byte for byte | INSTALL, SHOW-HN draft | two builds of the same commit | pass for the same commit | pass |
| 26 | Every packaged file is under a free licence | README, licence section | REUSE.toml, package file list | **fail**: the Conso font was not open source | fixed: JetBrains Mono (OFL); a test checks every licence and font |
| 27 | Firefox self-updates from the project's site | INSTALL | `firefox/updates.json` | **fail**: no Mozilla-signed build exists, so no update file | INSTALL now says so; signing steps for the author in `store/LISTING.md` |
| 28 | Private vulnerability reports through GitHub | SECURITY | repository setting | **fail**: the setting is off | open: a repository setting for the author to turn on |
| 29 | Public pages follow the author's site design | design rule, 2026-10-23 | screenshots, light and dark, beside the live site | the pages had their own shell | install, privacy, measurement and how-it-works pages now use the site's cascade and navigation |
| 30 | `npm run ci` is exactly what GitHub Actions runs | README, INSTALL | `scripts/ci.mjs`, workflow | the test stage matches; Actions also runs the c2pa reference job | unchanged; noted here |
| 31 | Tests are reliable | CI | full suite repeated | **fail**: two tests rebuilt shared files in place while other tests read them, and could fail at random | fixed: both build in a temporary copy |

## Known limits carried into 3.0.0

- No signed Firefox self-distribution build; Firefox users load the xpi temporarily until Mozilla
  signs it or lists the add-on.
- The campaign lens has no measured precision, and organisation naming is held until the
  media-lawyer review.
- The definition catalogue ships as data and a library only; the window does not show element
  tables yet.
- Private vulnerability reporting must be turned on in the repository settings.
- Software Heritage holds the repository under its earlier address until it archives the new one.
- Star bursts need the user's own GitHub token.
- The git bundle carries the whole history, so commits before 3.0.0 still hold the Conso font under
  its designer's licence.

## Does not prove

This audit checks that what the project says matches what the code does on synthetic pages and in
tests. It does not measure how often a sign is right on real threads, and a passing check here is
not a security review.
