<!-- writing-profile: research -->
# Completion ledger

This ledger lists every feature in the project's direction (`project-docs/VISION.md`, the charter, the
commons plan and the explainer plan) as a criterion with a check that can fail, its status on `main`
and the evidence, and the tool a user would compare it with. The wave plan that works through it is
`docs/WAVES.md`.

First written 2026-10-23 against `main` at `aaa65a1` (release 3.0.0); export rows updated by wave 1. Update the row in the same
commit as the change that moves it.

## Status words

- **PASS**: the check exists and passes on `main`.
- **PARTIAL**: part is built and checked; the row says which part is missing.
- **FAIL**: the check exists, or the bar is set, and `main` does not meet it.
- **NOT BUILT**: nothing on `main` does this yet.

A check is one of: a test in `tests/`, a labelled evaluation with 95% intervals, a capture a person
looks at, or a live check on a real site. "Inspection" is never enough for PASS.

## Hard lines

These do not move for any feature below. A row that would cross one is out of scope, not deferred.

1. No private identities. Private accounts appear only as patterns or salted pseudonyms.
2. Local by default. Each network feature is named, off by default and says what it sends.
3. No engagement mechanics: no alarms, counters, streaks or notifications.
4. Naming of organisations stays held (`NAMING_HELD`) until a media lawyer has reviewed the wording.
5. The whistleblower channel is never built in-house. Daylight Commons only points to audited systems.
6. Platform terms are respected: no account farms, no rate-limit evasion, no logged-out crawling.
7. Fairness strata: organic false-positive rates are reported per language and region stratum, and
   a stratum that breaks the 5-point bound keeps the lead off.
8. Accuracy before breadth: a detector shows a claim only after a labelled evaluation passes its bar.

## Counts

| Status | Rows |
|---|---|
| PASS | 28 |
| PARTIAL | 36 |
| FAIL | 4 |
| NOT BUILT | 33 |
| **All** | **101** |

## 1. Measurement

| ID | Criterion | Check | Status | Evidence | Competitive bar |
|---|---|---|---|---|---|
| M1 | Every detector that shows a sign has a labelled evaluation that passed its bar | `measured.js` row per detector family; precision lower bound at least 0.7 | **FAIL** | 4 of 35 detectors measured (release audit row 20); the rest show "not measured yet" | Bot Sentinel claims "99% accuracy" with no method; we beat it by publishing interval and method for every sign |
| M2 | X campaign lens measured: 30 organic and 30 paid cases, two labellers | `EVALUATION.md` protocol; Wilson intervals | **FAIL** | 0 graded cases; 2 development cases, both `unsure` | Botometer X (archival, no accounts after 2023-05-31): beat it on recency and on per-stratum error rates it does not publish |
| M3 | Campaign lens fairness: organic false-positive gap at most 5 points between strata with 30+ cases | per-stratum table | **NOT BUILT** | no labelled cases to stratify | none of the field publishes per-stratum false-positive rates |
| M4 | Modern X engagement baseline: 200 ordinary posts per follower stratum | `campaign-baselines.json` | **FAIL** | 0 posts per stratum; PHEME 2014-15 kept as a labelled historical reference only | none |
| M5 | Rhetoric families measured on held-out human labels | `scripts/eval.mjs`, test split read once | **PASS** | strong signs 90.7% (Wilson 89.8 to 91.5), n 4,578 | Perspective API publishes model cards, not per-family precision on held-out public corpora |
| M6 | Side balance on rhetoric | side-recall table | **PARTIAL** | closed on HateXplain; open on MHS (10.1% against 7.9%) | none |
| M7 | Persuasion techniques shown only where they pass | `MEASURED_PERSUASION` | **PASS** (gate holds; none ship) | 0 of 11 meet the bar | SemEval-2020 Task 11 systems; beat their span precision at the same recall on the PTC test split |
| M8 | Each sign's figure reaches the user | `tests/measured.test.js`, options page | **PASS** | release audit row 20 | MBFC shows confidence labels; we show intervals |

## 2. The five senses

| ID | Criterion | Check | Status | Evidence | Competitive bar |
|---|---|---|---|---|---|
| S1 | Room map: behaviour groups, burst share, paid against look-alike against ordinary, post against ordinary size | per-platform labelled set; invariance test that groups never use identity features; capture | **NOT BUILT** | thread report and coordination signs exist; no map | Hoaxy/OSoMeNet and Bot Sentinel v3 graphs; beat them with every edge linked to its receipt and 500 nodes drawn in under 1 s |
| S2 | Thread report: extreme replies against flagged accounts, with intervals | `tests/report.test.js` | **PASS** | README, "Thread report" | no consumer tool does this |
| S3 | Coordination signs: copies, same upload, bursts, cross-thread wording | unit tests; synthetic pilot | **PARTIAL** | duplicates 97.7% on SYNTHETIC cases only | InVID offers search, not coordination; beat on measured precision on real threads |
| S4 | Technique lens, stance-neutral, with a fairness audit | per-technique precision at the bar; symmetry suite | **PARTIAL** | symmetry suites pass; no technique ships | Bad News and Go Viral teach techniques; we name them in place |
| S5 | Mirror: sources seen, owners, promoted share, recurring framings, accounts seen most | network log empty during use (test); capture | **PARTIAL** | `src/ext/history.*`, `src/ext/dashboard.*` | Ground News "My News Bias"; beat it on owner and state-link depth and on sending nothing |
| S6 | Mirror: "what you never saw" (the other half of a story) | fixture with a known missing side | **NOT BUILT** | none | Ground News Blindspot |
| S7 | Machinery: "why this is in front of me", labelled as inferred | fixtures per platform; live check | **NOT BUILT** | none | platform "Why am I seeing this" menus; beat them by showing the signals, not a summary |
| S8 | Machinery: trackers and fingerprinting on the page | recall against a fixed page set; list licence checked | **NOT BUILT** | none | Privacy Badger, uBlock Origin; match their detection on the test set without blocking claims we cannot back |
| S9 | Machinery: dark patterns (infinite scroll, urgency, outrage cues) | labelled dark-pattern set | **NOT BUILT** | none | academic dark-pattern crawlers (Mathur et al. 2019, from memory, moderate) |
| S10 | Time: repository age, domain age, first archive capture | `tests/evidence.layer.test.js`; Chrome synthetic run | **PASS** | release audit row 10 | star-history.com, whois; beat them with a sealed receipt per fact |
| S11 | Time: GitHub star bursts | unit tests; live check | **PARTIAL** | needs the user's own token | star-history.com |
| S12 | Time: ad repository entries (DSA Art. 39, Meta, Google) | fixtures; live check | **PARTIAL** | `evidence-ads.js` registers the link; no lookup | Meta Ad Library itself; beat it by sealing what was seen |
| S13 | Time: local engagement-history ledger | `evidence-ledger.js` tests | **PASS** | `tests/evidence.test.js` | none |

## 3. The watchdog's discipline

| ID | Criterion | Check | Status | Evidence | Competitive bar |
|---|---|---|---|---|---|
| W1 | Ladder wording: fact flat, inference as inference, weak sign no claim | strings and tests in `campaign.js` | **PASS** | release audit row 7 | NewsGuard scores; we never score |
| W2 | Organisation naming held until legal review | `NAMING_HELD` test | **PASS** | release audit row 5 | none |
| W3 | Legal review of the ladder in US, UK and EU | signed review on file | **NOT BUILT** | author decision and counsel | none |
| W4 | Ordinary accounts never named or called bots | campaign controls | **PASS** | `tests/campaign.test.js` | Bot Sentinel scores individuals; we never do |
| W5 | Stance symmetry on every text detector | `tests/*.symmetry.test.js` (9 suites) | **PASS** | CI | none in the field publish one |
| W6 | Nothing leaves without a named, opt-in feature | `tests/network.test.js`; privacy text | **PASS** | release audit rows 19, 21 | Ground News reviewers report every URL sent; NewsGuard needs an account |
| W7 | No engagement mechanics | a test that bans notification permission, badge counts and streak state | **PARTIAL** | manifest asks only `storage`, `scripting`, `activeTab`; no test guards it | none |
| W8 | Every badge has a source and a does-not-prove line | tests; stills | **PASS** | release audit row 8 | Community Notes link sources; few others do |
| W9 | Wrong badge reportable, corrected in the open | local feedback test; public corrections log | **PARTIAL** | `feedback.js` local; challenge template; no public log | Community Notes |
| W10 | "Insufficient baseline" where the baseline is thin | test on each baseline-backed sign | **PARTIAL** | campaign shape says so; not checked for every sign | none |

## 4. Jurisdiction and the open catalogue

| ID | Criterion | Check | Status | Evidence | Competitive bar |
|---|---|---|---|---|---|
| J1 | Each entry carries jurisdiction, source, version, retrieval date and source hash | `tests/definitions.test.js` against the schema | **PASS** | 15 entries | none |
| J2 | Catalogue covers the US, EU, UK and each supported platform's own policy | coverage table test | **PARTIAL** | 15 entries; no common-law fraud, no UCPD transpositions, X only among platform policies | none |
| J3 | Element tables shown in the window | fixture test; capture | **NOT BUILT** | release audit, known limits | none |
| J4 | Every applicable jurisdiction shown, never the most damning alone | test over a multi-jurisdiction case | **PARTIAL** | library only | none |
| J5 | Every badge links to its catalogue entry and version | test over `catalogue/signals.json` | **PARTIAL** | 23-line signal map; badges do not link | none |
| J6 | Challenge route with a public decision for each challenge | issue template; decisions log; test that the log parses | **PARTIAL** | `.github/ISSUE_TEMPLATE/challenge.yml`; no decisions log | Community Notes rating; Wikipedia talk pages |
| J7 | Symmetry results published with each catalogue release | release asset or page | **PARTIAL** | tests run; nothing published per release | none |

## 5. Provenance and the evidence chain

| ID | Criterion | Check | Status | Evidence | Competitive bar |
|---|---|---|---|---|---|
| P1 | Capture: what, where, when, how, raw hash | `receipt.js` tests | **PASS** | `radar-receipt/1` | Hunchly captures pages for investigators; we capture extracted facts with hashes |
| P2 | Append-only hash chain with RFC 9162 Merkle proofs | tamper controls in `tests/evidence.layer.test.js` | **PASS** | release audit row 11 | Webrecorder WACZ signing |
| P3 | Witness: Save Page Now request recorded in the receipt | test; live check | **PARTIAL** | `evidence-bg.js` records the request; not live-checked | Bellingcat auto-archiver |
| P4 | Offline verifier rejects tampered chains | `radar verify`; tests | **PASS** | release audit row 12 | none consumer-facing |
| P5 | Signed bundle export | CLI tests | **PASS** | release audit row 13 | none consumer-facing |

## 6. The four export profiles

| ID | Criterion | Check | Status | Evidence | Competitive bar |
|---|---|---|---|---|---|
| E1 | Legal dossier: exhibits, chain-of-custody log, definitions with element tables, method, limits, verifier steps | `tests/export-profiles.test.js`; refuses a chain that fails its check | **PARTIAL** | `radar export --profile legal` (wave 1); elements listed per cited entry, but a per-element matched status is not carried in receipts yet | Page Vault and Hunchly reports; beat them on an offline verifier anyone can run |
| E2 | Legal dossier as PDF/A | veraPDF passes | **NOT BUILT** | | Page Vault PDFs |
| E3 | Technical: observations, receipts, versions, W3C PROV, reproduction steps | `tests/export-profiles.test.js` PROV structure test | **PARTIAL** | `--profile technical` (wave 1); no independent PROV validator run yet | Webrecorder WACZ metadata |
| E4 | Journalistic: write-up, sourcing note per claim, right-of-reply log, archive links, corrections | `tests/export-profiles.test.js` | **PASS** | `--profile journalistic` (wave 1) | Bellingcat methodology notes, written by hand |
| E5 | Research and ML: JSONL, fixed hashed splits, Croissant metadata, datasheet, lineage per row | `tests/export-profiles.test.js` split stability and hash tests | **PARTIAL** | `--profile research` (wave 1); `mlcroissant` validation not run (no shipped dependency; run it in R&D) | Hugging Face dataset cards; beat them on lineage per row |
| E6 | Exports default to identifiers, hashes and features, never post text | refusal controls in `tests/export-profiles.test.js` | **PASS** | text, raw handles and non-feature content refused | none |
| E7 | Export from the extension in one step | capture | **NOT BUILT** | CLI only after wave 1 | |

## 7. Research commons (phase 1 now, later phases after)

| ID | Criterion | Check | Status | Evidence | Competitive bar |
|---|---|---|---|---|---|
| C1 | Contributions by pull request under the DCO | DCO check on pull requests | **PARTIAL** | `CONTRIBUTING.md`; no automated sign-off check | Wikipedia edits; Community Notes |
| C2 | Dispute template for entries, badges and findings | template test | **PARTIAL** | entries and badges covered; findings not | Wikipedia talk pages |
| C3 | Public catalogue page generated from `catalogue/` | page regenerates in CI; no entry missing | **NOT BUILT** | | none |
| C4 | Codeberg mirror | live mirror | **NOT BUILT** | author account | |
| C5 | Fixed, hashed evaluation splits for shared data | split hash test | **PARTIAL** | rhetoric eval seed fixed and inputs hashed | |
| C6 | Labels need independent agreement; poisoning controls | control set with planted bad rows | **NOT BUILT** | | |
| C7 | Scheduled full dumps | release asset | **NOT BUILT** | | Wikipedia dumps |
| C8 | Campaign lens run on the commons' own edit stream, in public | report | **NOT BUILT** | | Wikipedia's manual sockpuppet work |
| C9 | Web reader with history and talk pages, no git needed | capture; tests | **NOT BUILT** | phase 2 | Wikipedia |
| C10 | Reviewer standing from verified work, lapsing | tests | **NOT BUILT** | phase 3 | |

## 8. Epistemic commons and source protection

| ID | Criterion | Check | Status | Evidence | Competitive bar |
|---|---|---|---|---|---|
| X1 | Claim status: observed, inferred, contested, retracted, with history | schema test | **NOT BUILT** | | Wikipedia's contested-page practice |
| X2 | No in-house whistleblower channel; a page pointing to SecureDrop and GlobaLeaks over Tor | test that no submission endpoint exists; page with verified links | **PARTIAL** | nothing in-house; no pointer page | SecureDrop directory |
| X3 | Strip file metadata before any share | EXIF fixtures | **NOT BUILT** | | MAT2 |
| X4 | Warn when writing style could identify a source | labelled style set | **NOT BUILT** | Articulate dependency | |

## 9. The practitioner's kit

| ID | Criterion | Check | Status | Evidence | Competitive bar |
|---|---|---|---|---|---|
| K1 | Belief ledger with confidence and evidence, local | tests | **NOT BUILT** | | Metaculus and Fatebook for forecasts |
| K2 | Steelman on demand, labelled | labelled review | **NOT BUILT** | Articulate dependency | |
| K3 | Own receipts: sign and timestamp what you publish | signature round-trip test | **PARTIAL** | bundle signing exists for analyses | Keybase-style proofs |
| K4 | Privacy shield: see trackers; export or delete everything in one step | tests | **PARTIAL** | two-step Clear all; no tracker view | Privacy Badger |
| K5 | Terms of engagement the user sets | tests | **NOT BUILT** | | |
| K6 | Commons contribution credited by pseudonym | template field | **PARTIAL** | DCO allows pseudonyms | |
| K7 | Lessons on every shipped sign | `tests/learn.*` | **PASS** | lessons and quiz in `src/ext/learn/` | Bad News; beat it by measuring discernment (d'), not "false" answers |

## 10. Independence

| ID | Criterion | Check | Status | Evidence | Competitive bar |
|---|---|---|---|---|---|
| I1 | No dependency on platform APIs, labels or goodwill | network test; platform labels typed as platform claims | **PASS** | `families.js` type `platform` | Ground News depends on rating vendors |
| I2 | Adapters survive markup rotation; OCR as last fallback | rotation tests per platform | **PARTIAL** | X rotation tests; OCR CER 1.0% synthetic, 3.0% real; other platforms not rotated | |
| I3 | Data donation imports | `tests/imports.test.js` | **PASS** | X archive, Reddit CSV, Mastodon outbox, Bluesky CAR | |
| I4 | No npm dependencies; CLI runs from a clean folder | clean-folder run | **PASS** | release audit row 14 | |
| I5 | Reproducible packages, signed sums | two builds | **PASS** | release audit rows 24, 25 | |

## 11. Universal discernment: adapters

Each adapter needs its own labelled evaluation and fairness audit before it makes claims (hard line 8).

| ID | Medium | Check | Status | Evidence | Competitive bar |
|---|---|---|---|---|---|
| U1 | X | fixtures; live check; labelled set | **PARTIAL** | live-checked; not evaluated per platform | |
| U2 | YouTube, Reddit | fixtures; live check; labelled set | **PARTIAL** | fixtures and live checks; no labelled set | |
| U3 | Facebook, Instagram, Bluesky, Threads, Mastodon | fixtures; live check; labelled set | **PARTIAL** | synthetic and live structure; no labelled set | Community Notes on Meta |
| U4 | TikTok | live check | **PARTIAL** | not checked live (sign-up wall) | TikTok Footnotes |
| U5 | LinkedIn | fixtures | **NOT BUILT** | | Ground News covers it |
| U6 | News and articles: owner, state links, look-alike addresses, other coverage | tests; 500-link resolution check | **PARTIAL** | 7,374 owner rows; resolution rate not measured | NewsGuard 35,000+ sources rated |
| U7 | Search results | engine fixtures | **PARTIAL** | Google, Bing, DuckDuckGo labels, opt-in | NewsGuard |
| U8 | Video and podcasts: sponsor reads, affiliate links | labelled set | **NOT BUILT** | | SponsorBlock (crowd-marked segments) |
| U9 | Reviews and stores | labelled set; 16 CFR 465 matching | **NOT BUILT** | | Fakespot (closed 2025, from memory, moderate) |
| U10 | Ads and political ads | fixtures | **PARTIAL** | ad labels repeated; repositories registered | Meta Ad Library |
| U11 | Images and media: C2PA, first appearance | c2pa reference CI | **PARTIAL** | never more favourable than c2patool; deepfake detection not claimed | InVID, Adobe Content Authenticity |
| U12 | Charts and statistics | labelled set | **NOT BUILT** | | |
| U13 | AI assistant answers | fixture per assistant | **NOT BUILT** | no content script on assistant sites | NewsGuard in ChatGPT and Gemini citations |
| U14 | Email, SMS, commerce pages | labelled set | **NOT BUILT** | | |

## 12. Form factors, explainers and stores

| ID | Criterion | Check | Status | Evidence | Competitive bar |
|---|---|---|---|---|---|
| F1 | Browser extension, Chrome and Firefox | release zip and xpi load | **PASS** | release audit rows 1, 2 | |
| F2 | Firefox for Android | device check on X and YouTube | **PARTIAL** | `project-docs/ANDROID.md`; not checked on a device | Ground News apps |
| F3 | Phone share target with local OCR | store review; offline test | **NOT BUILT** | OCR engine exists | Ground News, NewsGuard apps |
| F4 | Desktop companion | | **NOT BUILT** | | |
| F5 | Open API and CLI | `tests/api.test.js`, `tests/cli.test.js` | **PASS** | `project-docs/INTEGRATION.md` | |
| F6 | Taxonomy as an open dataset | release asset with schema | **PARTIAL** | catalogue and families in the repository; no packaged dataset | |
| F7 | Explainer series, first piece, with sources and right-of-reply | capture; Articulate check; legal review if it names anyone | **NOT BUILT** | slate in the plan | Bad News; Kurzgesagt-style explainers |
| F8 | Store listing kit ready for the author | `tests/store-listing.test.js` | **PASS** | `docs/store/` | |
| F9 | Mozilla-signed Firefox build | signed xpi | **NOT BUILT** | author submits | |
| F10 | Private vulnerability reporting on | repository setting | **FAIL** | release audit row 28 | |
| F11 | Public pages follow the site canon | captures beside the live site | **PASS** | release audit row 29 | |

## Top ten gaps, by what they unlock

1. **M1, M2, M3: detectors unmeasured.** 31 of 35 detectors and the whole campaign lens show signs
   with no labelled evaluation. Hard line 8 says that must change before breadth grows. Needs human
   labellers, so it needs the author.
2. **W3: legal review.** Naming, the journalistic and legal exports and the explainer series all wait
   on counsel.
3. **E1, E2, E7: export profiles finished.** Wave 1 built all four in the command line tool. PDF/A,
   per-element match status and an export button in the extension remain.
4. **J3, J5: element tables in the window and badge links to entries.** The catalogue is invisible to
   users.
5. **J6, C1 to C3: the challenge route and commons phase 1.** A template with no decisions log is not
   yet a working route.
6. **M4: modern X baseline**, 0 of 800 posts.
7. **S1: the room map**, the first sense in the vision.
8. **F3: phone share target.** The author's own evidence arrives as phone screenshots.
9. **S7 to S9: the machinery lens.**
10. **F10, F9: store and security readiness** that only the author can switch on.

## Does not prove

A PASS here means the named check passes on `main`. It does not mean the feature is right on real
threads, and a check can be weaker than its row claims. Recheck the evidence column before quoting
any row.
