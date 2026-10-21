# Changelog

All notable changes to Radar. Dates are UTC. Versions before 1.0.0 were development builds and
were not published to a store.

## 1.0.0 (2026-10-21)

First public-quality release. Every sign either carries a measured error rate from
`project-docs/EVALUATION.md` or says "not measured yet".

### Added
- Fact-checked claims: posts that closely match a claim reviewed by one of 328 fact-checkers
  (19,728 reviews, Google Data Commons ClaimReview feed, CC BY 4.0) show the checker's own rating
  and a link. Matching runs offline in the browser; Radar never rules a claim false itself.
  Community Notes show first when X loads one.
- Rhetoric markers in French, Spanish, German, Portuguese and Italian, each with symmetry tests
  across targets from every political direction.
- Facebook, Instagram and Bluesky: comments feed duplicate, rhetoric and thread reports; account
  context comes only from what the viewer opens (Page transparency, "About this account") or what
  the app already loads (Bluesky labels).
- Measured precision and recall for the rhetoric families on human-labelled public corpora
  (Measuring Hate Speech, HateXplain, Civil Comments, MLMA), test split only, reproducible with
  `node scripts/eval.mjs`.
- A YouTube video with no comments still shows its channel and YouTube's funding and
  paid-promotion labels; the collapsed button says "funding label" when YouTube shows one.
- CI on Linux and Windows for every change.
- First-run page on install: what Radar shows, what it never does, site switches and a one-click
  start (which also asks Firefox for site access).
- Options page: per-site switches and a pause for everything, the window's areas, feeds and
  automatic reading, retention for history and account details, "Clear all Radar data",
  reduced motion and larger text, and the measured accuracy of every sign.
- Every sign in the window shows its measured precision from the evaluation, or "not measured
  yet". Signs that repeat a site's own label, or match a cited table, say so instead.
- Icons at 16, 32, 48 and 128 px from original SVG sources, and toolbar states for reading and
  paused.
- Keyboard: focusing a post opens its window, Alt+R moves into it, arrow keys move between its
  tabs, Esc closes it and returns focus to the post. Tabs carry tab and tab-panel roles.
- X's dim theme gets its own window ground; contrast is tested in light, dim and dark.
- `npm run package`: deterministic Chrome zip and Firefox xpi with SHA256SUMS.
- PRIVACY.md, a store listing draft, this changelog, and the FSL-1.1-MIT licence.

### Changed
- An account counts as flagged on one strong sign or two different weak ones. Place and timing
  context alone (app store, typed location, a flag in the name, active hours) no longer does; on
  a live thread it had put half the repliers in the flagged group.
- Violence markers catch active calls ("we should exterminate X") and a violent fate carried
  over to a named group, not only the passive form.
- Automatic About lookups on X follow X's rate-limit headers, keep requests in reserve for the
  viewer's own use of X, and retry a rate-limited account.
- Threads are keyed by post id, so one thread reached by two paths no longer counts its own
  replies as copied from elsewhere. The connections log restarts under a new key.
- Feed pages compare an account with "this page", not "this thread".
- Duplicate detection keeps combining marks inside words (Indic scripts).
- Links and focus outlines in the window use ink instead of an accent blue; colour is kept for
  signs worth a look.
- Settings are read in one place (`src/core/settings.js`), and the background worker deletes data
  older than the user's retention.

## 2026-10-20
- Automatic About lookups pace themselves from X's rate-limit headers.
- Rhetoric recall for active calls, carried-over fate and French replies.

## 2026-10-19
- The hover window: an area strip, tabs, small charts and a comparison with the thread.
- Posting patterns from the posts X loads for an account.
- Reddit account age, karma and sign-up names.
- History page across viewed threads: upstream sources, recurring accounts, trend.
- Deterministic core builds and signal tests.

## 0.3.0 (2026-10-18)
- One compact row per post, hover card, collapsible thread panel, toolbar popup.
- Source trails, upstream summary, government designations and verified report data.
- State links from Wikidata and 17 cited influence-operation reports.
- Media upload dates and reverse image search; YouTube's synthetic-content label.
- Feed mode on X, timing bursts, translation guard, JSON export.

## 0.2.0 (2026-10-18)
- Post metadata X loads but does not show, YouTube page data, cross-thread copied text and pushed
  links.
- Local connections log, inferred active hours and fast-reply flags.
- Machine-writing signs with cautious thresholds, leaked chatbot text, spam patterns.
- Live account data from what X already loaded; automatic in-page About lookups.
- Outlet ownership for links and accounts from 7,374 sourced Wikidata rows.

## 0.1.0 (2026-10-17)
- Duplicate-text clusters, local-claim mismatch and account flags.
- Stance-neutral rhetoric markers with a symmetry test, and the thread norm report.
- The extension: badges, popovers, lookups, thread report; adapters for X, Reddit and YouTube.
- App-store and name-flag location signals; coded-hate markers with precision tests.
