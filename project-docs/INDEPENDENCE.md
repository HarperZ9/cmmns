# Independence from third parties

Last updated: 2026-10-21. Stream S3 of the 3.0 plan (runtime and distribution).

The design rule: no outside party's behaviour can change what Daylight Commons tells a user without the change
being visible and reversible. Daylight Commons does not need to judge anyone's honesty for that. It needs to
depend on as few parties as it can, pin what it takes in, and say plainly where a dependency remains.

This file covers the runtime and distribution layers. Build-time data (Wikidata, the ClaimReview
feed, Unicode, the Wayback Machine) and signed data packs are stream S1; the integration API and
signed evidence bundles are stream S2.

## Summary

| Dependency | Before | What we did | What remains |
|---|---|---|---|
| GDELT (Other coverage) | the only off-machine request; GDELT chose which outlets exist and saw every query | removed; Daylight Commons asks each outlet's own feed | each outlet sees a feed request from your IP |
| Platform markup (X, Reddit, YouTube, Facebook, Instagram, Bluesky, Threads, Mastodon, TikTok) | a redesign made Daylight Commons silently show nothing | adapter health notice and a self-test | Daylight Commons still cannot read a changed page until its reader is updated |
| Sites with no Daylight Commons reader | no text checks | generic reader from page structure | structural guesses, not a reader |
| Chrome Web Store, AMO | the only install paths | signed, reproducible packages and an install page on Daylight Commons' own site | Chrome blocks off-store installs except Developer mode or enterprise policy; Firefox requires Mozilla's signature |
| GitHub (code host, CI, Pages) | the only copy of the source and the only CI | a git bundle in every release, `npm run ci` runs exactly what CI runs | the repository, releases and the install page are hosted on GitHub today |

## Other coverage: direct feeds, no aggregator

**Decision: GDELT is removed, not kept as a legacy option.** Reasons:

- It was an aggregator in the middle: GDELT decided which outlets were monitored and which articles
  matched, and Daylight Commons could not check either. Every lookup sent the title's main words to it.
- It did not work well. On 100 headlines on 2026-10-21 (Daylight Commons 2.1, `scripts/eval/coverage-eval.mjs`
  at that version), GDELT answered 24 lookups and refused or dropped 76; 9 found three or more other
  outlets; the median lookup took 25.5 s.
- Keeping it as an off-by-default option would keep its code path, its permission, its privacy text
  and its review burden for a feature the direct feeds replace.

On update, Daylight Commons gives back the `api.gdeltproject.org` permission (`src/ext/lifecycle.js`), and the
old consent (`coverageConsent`) does not carry over to the feeds (`feedConsent`).

**How it works now.** The user turns Other coverage on and chooses outlets from a suggested list
(`src/core/outlets.js`) or adds any https RSS or Atom address. Each choice asks the browser for that
one feed host. On a click on the site card, the background worker requests every chosen feed in
parallel (`src/core/feedfetch.js`): GET only, `credentials: "omit"`, no referrer, no added header,
`redirect: "manual"` so a feed that moved to an unapproved host is reported, not followed, a 3 MB cap
and a 10 s timeout. The reader (`src/core/feeds.js`) takes RSS 2.0, RSS 1.0 and Atom without a DOM.
The title is matched on the device (`src/core/coverage.js`): an entry matches when its own headline
shares at least two of the article's main words and a quarter of them, and headline and summary
together share 40%. Each match is labelled with the owner and owner type from the bundled tables.
Every feed asked appears in the card, including the ones that failed and why.

**Suggested outlets: how they were chosen.** 33 outlets, ordered by id. Criteria, all checkable:

1. An original newsroom with general or world news in English.
2. A public feed on https on the outlet's own host, which answered with entries and no redirect on
   2026-10-21. This excluded Breitbart (its feed is only on feedburner.com, a Google service), The
   Spectator (feed address answered 404) and Mail & Guardian (404).
3. The outlet's site is in Daylight Commons' bundled site tables. 27 of 33 have a named owner there; for six
   (Kyiv Independent, National Review, NPR, PBS, The Hill, Times of Israel) the tables state no
   owner and the card says so. The Federalist was excluded because it is not in the tables.
4. Spread: 18 countries; every owner type the tables give (public broadcaster, state media,
   commercial, nonprofit, not stated); the United States has 12 of 33.

The spread across editorial positions was kept even by the maintainer's reading of published
media-bias charts at curation time. That is a judgement, not a measurement: no rating is stored in
Daylight Commons, shown to users or used by any code, and the symmetry test (`tests/sites.symmetry.test.js`)
checks that every outlet gets the same rows from the same facts. `tests/outlets.test.js` checks
criteria 2 to 4.

**Measured (2026-10-21, `scripts/eval/coverage-eval.mjs`).** All 33 feeds answered; asking all of
them took 1.2 s. Using each outlet's three newest headlines as stories (99 lookups), 34 found at
least one other outlet and 17 found three or more; the median was 0 and the most was 10. These are
not comparable with the GDELT numbers above: different stories, and the feeds hold only each
outlet's newest entries. Precision is **not measured**: the script writes the matched pairs for
labelling by hand, and that labelling has not been done. A spot check of four stories found
related-but-different stories among the matches (for example an envoy's meeting matched to a
prisoner release during that meeting).

**What it does not prove.** A match is shared headline words, not the same event. A story told in
other words is missed, and stories in other languages are missed entirely. An outlet that is not
chosen is never asked, so "no other coverage" means none among the chosen feeds' latest entries.

**What remains.** Each chosen outlet receives a request from the user's IP address at the moment
they click, with the browser's standard headers, and could infer that someone was reading news
then. Daylight Commons cannot hide that without a proxy, which would be a new third party.

## Adapter health

Platforms change their markup without notice. Before 3.0, a reader that found nothing showed
nothing, which looked the same as a quiet thread. Now, after each read, `src/ext/health.js` passes
counts (boxes found, boxes read, boxes with text, time stamps and article boxes on the page) to
`src/core/health.js`, which gives one of: ok, waiting (under 8 s since the page changed), empty,
partial, changed. On partial or changed, a small notice says, for example, "Reddit changed its page;
Daylight Commons cannot read replies here yet." The toolbar popup's "Self-test on this page" runs the reader
on demand and shows the counts.

A post page with no time stamp and no article box at all (a sign-in wall, a removed post) is not
called a change. Only counts are read; no text is kept or sent.

**Does not prove.** A pass means the reader found and read boxes, not that every field is right.

## Generic reader

On a site Daylight Commons has no reader for, the site card adds "Text on this page"
(`src/ext/generic-page.js`, `src/core/generic.js`): the article body is the block with the most
paragraph text; comments are the largest run of same-shaped sibling boxes where most carry an
author link or a time stamp. Daylight Commons runs its rhetoric, persuasion and machine-writing checks on
them and shows counts only, plus repeated comment texts. It runs only on the user's click on the
site card and sends nothing.

**Does not prove.** These are layout guesses. They can miss comments or count a link list as
comments. Not measured against labelled pages.

## Distribution

**Reproducible, signed releases** (`scripts/release.mjs`). One command builds
`dist/release-<version>/`: the Chrome zip, the AMO xpi, a self-distribution xpi whose manifest has
`update_url` on Daylight Commons' own site, `FILES-<version>.sha256` (every file inside each package, which
does not depend on the zlib build), a `git bundle` of HEAD, `SOURCE` (commit and Node version), the
public key, `SHA256SUMS` over all of them and `SHA256SUMS.sig`, an ECDSA P-256 signature made with
WebCrypto (`src/core/signing.js` over `src/core/sig.js`). The release refuses a dirty tree, a key inside the repository,
and a key that does not match `docs/release-key.json`. It verifies itself before finishing.

**One project key.** Releases are signed with the same key as S1's data packs. Its key id,
`0e5e 1984 0565 840c 977e 0f03 6c9a c021`, is the first 32 hex characters of the key's RFC 7638
thumbprint hash, the same id S1 shows. The private key is kept outside the repository and never
copied; `tests/no-private-keys.test.js` (S1) fails if any tracked or addable file holds private key
material. `src/core/signing.js` makes and checks signatures with `src/core/sig.js`, the one copy of
Daylight Commons' signing primitives that data packs and evidence bundles also use.

**Checking without the code host.** `node scripts/verify-release.mjs <folder>` checks the signature,
every hash and the bundle with no network. The install page (`INSTALL.md`, built to
`docs/install.html` by `scripts/install-page.mjs`) explains verification and installation without a
store, and has an in-browser checker (`docs/verify.js`) that runs a generated copy of the same
signing code.

**Firefox updates.** `scripts/firefox-updates.mjs <signed.xpi>` writes `docs/firefox/updates.json`
with the signed file's hash. It must run on the file Mozilla returns, since signing changes it.

**CI parity.** `.github/workflows/test.yml` runs only `node scripts/ci.mjs <stage>`, and
`npm run ci` runs the same "test" stage locally (every test, a fresh build, the bundle diff).
`node scripts/ci.mjs c2pa` fetches the pinned c2pa-rs fixtures and runs the reference test.
`tests/ci.test.js` fails if the workflow gains a step that is not a ci.mjs stage.

### What stays unavoidable, and why

- **Chrome.** Chrome installs extensions from outside the Web Store only in Developer mode (load
  unpacked; no automatic updates; a warning) or by enterprise policy (`ExtensionInstallForcelist`,
  managed machines only). That is Google's rule.
- **Firefox.** Release Firefox installs only Mozilla-signed add-ons, even self-distributed ones.
  The self-distribution build must go through Mozilla's unlisted signing. Developer Edition,
  Nightly and unbranded builds can disable the check.
- **GitHub.** The repository, release downloads, CI and the install page are on GitHub today. The
  bundle in each release, the signed sums and `npm run ci` mean the project can move: any git host
  or static web server that serves the same signed files is as good as the original.
- **Node and the browser's WebCrypto.** The signatures and the build rely on them. They are the
  platform, not a service.

### What each measure does not prove

- A valid signature shows the holder of the key signed these bytes. It does not show who holds the
  key, that the key was never stolen, or that the code is safe.
- A reproducible build shows the package came from the published commit. It does not show that
  commit is free of mistakes or malice.
- CI parity shows the same checks run in both places. It does not show the checks are enough.
- The bundle preserves history up to the release. It is not a backup of issues, discussions or
  anything outside git.

## Not done in this stream

- No live browser check of the feed card, the health notice, the self-test or the generic reader.
  The lead runs those (project-docs/LIVE-CHECKS.md).
- No Mozilla-signed self-distribution xpi yet, so `docs/firefox/updates.json` is not written.
- No mirror is set up; the install page explains how to make one.
- Precision of feed matching is not measured.
