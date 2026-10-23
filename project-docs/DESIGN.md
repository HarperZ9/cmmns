# Design: Daylight Commons (provenance badges and the thread norm report)

## The problem
Coordinated accounts shape what readers think "people like them" believe. Two patterns matter:
accounts that speak as locals of a place they are not based in, and accounts that inject unusually
extreme rhetoric so it reads as normal for a group. A reader scrolling replies cannot check either.

## What the tool shows
1. **Per reply, evidence badges.** Where the platform labels the account as based, account age,
   username changes, the sign-up handle pattern, a "speaks as local, labelled elsewhere" mismatch,
   and "same text as other replies". Each badge opens a popover with its evidence and what it does
   not prove.
2. **Per thread, the norm report.** The flagged share among the most extreme replies against the
   flagged share among the rest, each with a 95% Wilson interval. It says "skewed" only when the two
   intervals do not overlap.

## What it never does
- Call anyone a bot, propagandist, extremist or liar.
- Use political side or stance as an input. `tests/rhetoric.symmetry.test.js` holds the rhetoric
  scoring to identical treatment of the same sentence about 25 groups from every direction, plus
  matched pairs of coded slogans.
- Flag a person for extremity. Rhetoric scores only feed the thread-level comparison.
- Collect IP addresses or anything the platform does not show the viewer. No server, no telemetry.

## Data sources
| Platform | Location signal | Status |
|---|---|---|
| X | "About this account": inferred country or region, join date, username changes, how the app was installed (rolled out November 2025) | milestone 1 and 2 |
| Instagram | "About this account": date joined, "Account based in", former usernames, verified | shipped 2026-10-21, passive only |
| Facebook | Page transparency: creation date, name changes, countries of the people who manage a Page | shipped 2026-10-21, passive only; wording unconfirmed live |
| Bluesky | none; join date and moderation labels from the app's own thread data | shipped 2026-10-21 |
| YouTube | self-declared channel country only | milestone 3, behaviour signals |
| Reddit | none | milestone 3, behaviour signals |

## How account data is read on Facebook, Instagram and Bluesky
- **Instagram and Facebook, passive only.** When the viewer opens an account's "About this account"
  dialog or a Page's transparency view, src/ext/meta.js reads the rendered text and keeps it per site
  for 14 days. Daylight Commons never opens these itself. Instagram delivers the dialog as a Bloks UI payload
  from `/async/wbloks/fetch/`, not as data, so there is no stable request to repeat the way
  src/ext/sniff.js repeats X's About request; Facebook shows transparency only for Pages, one Page
  at a time. Automatic lookups on Meta would need either, and stay out of scope until one is stable.
- **Facebook manager countries.** A Page lists every country of the people who manage it. Daylight Commons
  uses it as the account's label only when exactly one country is listed; with several, the card
  lists them and no "speaks as a local" comparison is made.
- **Bluesky.** src/ext/bskysniff.js copies the thread, profile and feed responses the Bluesky app
  already requested. Moderation labels about authenticity (spam, impersonation, scam, inauthentic,
  engagement-farming) raise the "moderation label" flag; labels about content are shown, never
  flagged, and self-labels are ignored.

## How account data is read on X
- **Passive:** whenever the user opens an account's About page, the reading is cached locally.
- **On request:** "Look up" on a reply, or "Look up N more" in the thread report, opens that
  account's About page in a background tab, reads what X renders, and closes the tab. One account
  every 4 seconds, at most 60 per click. No private API calls.

## Detectors
- **Mismatch** (`src/core/mismatch.js`): explicit local-claim patterns ("here in X", "as a
  Frenchman", "we Americans", "ici en France", "nous les Français") compared with the label at
  country or region level.
- **Duplicates** (`src/core/similarity.js`): word 3-gram MinHash with banding, confirmed by exact
  Jaccard of at least 0.6, across distinct authors, ignoring replies under 6 words.
- **Rhetoric** (`src/core/rhetoric.js`): strong families (dehumanise, violence, vigilante, slur,
  stereotype) that label the post, and weak ones (motive, essentialise, conspiracy, absolutist,
  contempt, context-dependent slurs) that only feed "extreme". Negation, reported speech and quoted
  words do not count. Policy positions such as deportation under law score zero. Measured precision
  per family is in `src/core/measured.js` (EVALUATION.md).
  French, Spanish, German, Portuguese and Italian grammars (`rhetoric-<lang>.js` with
  `lexicon-<lang>.js`) run after English in the order listed in `LANGUAGES`, and each adds only
  families not yet found. Each language negates with its own words and has its own symmetry test
  (`tests/rhetoric.<lang>.test.js`; French in `tests/rhetoric.recall.test.js`). Word-list sources: `evidence/LEXICON-SOURCES.md`.
- **Report** (`src/core/report.js`): as above; needs at least 10 extreme replies.

## Known limits
- X's labels can be wrong; VPNs and travel move them; users can broaden them to a region.
- The local-claim patterns are English and a little French. Other languages read as "no claim".
- The rhetoric lexicons are hand-built. The non-English ones cover dehumanise, violence,
  stereotype, conspiracy and (except French) slurs; motive, essentialise, vigilante and
  absolutist are English only. Every lexicon needs precision and recall measured on
  labelled data before anyone relies on the report (EVALUATION.md).
- The report sees only the replies X chose to render and the accounts that were looked up.

## Ownership table
`src/ext/owners.json` is built from Wikidata (CC0) by `scripts/owners-build.mjs`: news outlets,
broadcasters, news websites and platforms with an official website and a current owner (P127 with
no end date, not deprecated; owners who have died or companies that were dissolved are dropped).
Built 2026-10-18: 7,374 domains, 3,602 with an X handle. The background worker holds it; pages ask
only for the domains and handles they show. Known limits: Wikidata lags sales, some rows name a
division rather than the parent company, and one domain can map to an edition rather than the
main outlet. Rebuild with the author's approval and review the diff before committing.

## State links and media provenance (2026-10-18)

**State links** (`src/core/state.js`, built by `scripts/state-build.mjs`). A link or account gets a
state chip only when a cited source ties it to a government. There are two bases: an ownership
chain on Wikidata that ends at a government or state agency, or a mention in a published
influence-operation report (platform threat reports, government filings, sanctions listings),
with the report's title, URL and date. The same rule applies to every country. Daylight Commons does not
attribute a reply, account or narrative to a state from its wording or behaviour. That would
present a guess as a finding, and coordination looks the same whether a state, a PR firm or a
fan group runs it. The table ships empty until the build runs with the author's approval.

**Media provenance** (`olderMedia` in `src/core/xdata.js`). X ids encode their creation time, so
a media id dates the first upload, and a reused source post id dates the original post. Media
uploaded two or more days before the post that shows it gets a "media from <date>" chip. Every
media chip offers reverse image searches (Google Lens, TinEye, Bing, Yandex), and nothing is sent
until the user clicks one. Daylight Commons cannot tell real media from AI-made media. It shows only what
the platform or uploader discloses, such as YouTube's "Altered or synthetic content" label.

### State links: what shipped on 2026-10-18

`src/ext/state.json` holds 1,604 rows, built by `scripts/state-build.mjs`:

- **977 report rows**, from 17 primary documents: Meta threat reports (2022 to 2026), OpenAI threat reports, the US Justice Department's 2024 Doppelganger affidavit and a 2024 State Department fact sheet. `scripts/verify-reports.mjs` downloads each document and confirms every domain or handle appears verbatim. On 2026-10-18 it found 977 of 977. Each row says who the report blames, in the report's own words: a government (86 rows), a commercial firm (217) or individuals or a group (674). A firm is never upgraded to a government. By country: Russia 698, China 131, Iran 44, Togo 29, Bangladesh 18, the United States 11, Vietnam 10, Israel 8, Venezuela 7, Türkiye 7, and 5 more with under 5 each. The counts follow what the reports published, which is not a measure of how much each country does. For example, Meta's 2022 report on a US military-linked network named no domains, so it adds no rows.
- **627 Wikidata rows.** An outlet counts as state-owned when Wikidata classes it as state media, or when its chain of parent organisations and majority owners reaches a national government body (370 rows). Regional and city government bodies are labelled "regional govt" (136 rows), and public broadcasters get their own label (121 rows). Sovereign wealth funds, pension funds, investment funds and universities never count as controllers, and governments' own .gov-style websites are left out.

Known gaps:

- Wikidata files Chinese party media (Global Times, China Daily) under Chinese Communist Party bodies, which are not government entities, so under the same rule for every country those two outlets get no chip.
- Press TV, TASS and Kan are missing because of how Wikidata models them.
- The State Department's 2020 foreign-mission designations of Chinese outlets could not be read.
- Google Threat Analysis Group (TAG) bulletins have not been searched yet.
- EU sanctions name RT and Sputnik without giving domains.

`data/state-reports.README.md` lists every document, the exclusions and the judgment calls.

### Source trails and designations (2026-10-18, later)

**Source trails** (`src/core/trail.js`) follow a post upstream through pointers X itself records: the post it quotes or reposts, the earlier post its media was lifted from, the media's first upload time (from the media id), and the real address behind each t.co link. Daylight Commons keeps a 30-day local log of which posts carried each upload and link, so the card can say "in 6 posts by 5 accounts you have seen; first by @x at 01:00 UTC". The panel's Upstream section counts which accounts and sites a thread's material leads back to. The trail stops at the first upload: who filmed it, and who paid for it, is not in the data.

**Designations** (`data/state-designations.json`): official documents in which a government or the EU classifies a named outlet as state-controlled. These are the US State Department's foreign-mission designations (China 2020, Russia 2024), EU Annex XV broadcasting suspensions, UK sanctions, US Treasury (OFAC) on IRIB, and the EU on Belteleradio. They name outlets and rarely give domains. `scripts/designations-match.mjs` maps a name to its official sites only on an exact Wikidata label or alias match in the same country, and each row cites the designation and the Wikidata match separately. The chip reads "govt-designated", and its does-not-prove line says a designation records one government's assessment, not an independent finding.

**Verification.** `scripts/verify-reports.mjs` checks every report row and every designated outlet name against its cited document. It falls back to curl, the EUR-Lex PDF route and Internet Archive copies when a host blocks scripted readers. On 2026-10-18 it found 1,171 of 1,171.

### History page (2026-10-18)

Daylight Commons saves a small snapshot of each thread report locally (`pb.history.v1`, 60 days, at most 600 threads). `src/core/history.js` pools those snapshots with the connections log and the trail log. The history page shows the pooled flagged share with a Wilson interval, the upstream "funnel" (the accounts and sites that the quotes, lifted media and links in the user's threads lead back to, counted by threads, and how concentrated they are), recurring accounts, uploads carried by three or more accounts, a per-day flagged share, origins and state links. The page states its limit: these totals cover only what the user opened, in platform-ranked order, so they are not a sample of any platform. The concentration figure is shown only when there are more than five upstream sources.

### Your feed, the coordination graph and thread cards (2026-10-21)

"Your feed" (`dashboard.html`, `src/core/feed.js`) pools thread snapshots and a per-day feed tally (`pb.feed.v1`, each post id once per site and day) over 7, 30 or 60 days: sites linked and their owners, the share of links to state-linked sites, the share of posts and replies with strong rhetoric signs (the report's extreme score), technique counts for techniques that passed their measurement only, the flagged share, Community Notes and fact-check matches, and pairs of accounts that replied in three or more of the same threads, each with links to those threads. Every proportion is shown with its count, denominator and 95% Wilson interval, as a bar with the numbers written beside it. Snapshots saved before a field existed are left out of that field's denominator. The page makes no network request (checked in a headless profile: every request was to the extension itself). It has no streaks, goals, badges or notifications.

The history page draws accounts that replied in two or more of the same threads (`src/core/graph.js`) as a deterministic Fruchterman-Reingold layout with gravity, fitted to the box. All-pairs repulsion is O(n^2) per round, so rounds shrink as the graph grows (30000 / n, 40 to 300). Measured: 500 accounts and 2,250 links built and laid out in 52 to 98 ms in node, and drawn in 115 to 135 ms in a headless Edge page. Every account is a focusable button; Enter or a click lists the evidence, the threads where each pair replied together (newest 20, linked where the thread key allows, with same-wording counts). The table under the drawing holds the same pairs.

Thread cards (`src/core/evidence.js`, `evidence-card.html`) hold the thread report, fact-check matches, linked sites with owners and state links, upload reuse, sources and does-not-prove lines, and a SHA-256 over the canonical JSON (sorted keys). The PNG prints the same text and the hash. A card names no account: counts replace handles, and an X link is rewritten to `/i/status/<id>`. It is refused for anything but a thread and for threads with fewer than five reply accounts. Files the user checked for Content Credentials go on the card as counts of credential states and AI-generation marks, never a signer name; with none checked, the card says so.

Fixed on the way: the history page and the retention prune read the old connections log key (`pb.net.v1`) after the log moved to `pb.net.v2`, so "Accounts that keep appearing" showed stale or no data and v2 was never pruned to the user's setting.

### The hover window (2026-10-19)

Daylight Commons draws nothing on the page. Resting the pointer on a post for 450 ms fades in a window beside it: to the right of the timeline column when there is room, else to its left, else below or above the post. It stays while the pointer is on the post or the window, fades out 260 ms after the pointer leaves, and stays open after a click inside it until Escape or a click elsewhere. Alt+R opens it for a focused post. The first lines are a glance: the account, where the platform places it (or its age where the site shows no location), the warn-level signals by name, and how many more signs are below. The full card follows.

Daylight Commons describes how an account operates. It does not try to work out who runs an account: no linking accounts across platforms, no guessing names, employers, ages or homes, no reverse search of profile photos, and no payment or tip-jar handles. Those steps would identify people, most of whom are ordinary users, and they add nothing to the evidence that an operation exists.

### Fact-checked claims (2026-10-21)

`src/core/claims.js` matches each post against claims fact-checkers have already reviewed, from a
table bundled with Daylight Commons (`src/ext/claims.json`, 19,728 reviews from 328 fact-checkers at the time; 19,387 from 319 since the 2026-10-22 rebuild, 6 MB,
built from the Data Commons ClaimReview feed under CC BY 4.0 by `scripts/claims-build.mjs`). The
background worker indexes the table once; pages send the text of the posts they show and get back
only the matches. A match reads "A fact-checker reviewed a similar claim", with the fact-checker's
name, their rating in their own words, the claim they reviewed, the date and a link. Its
does-not-prove line: similar wording is not the same claim; check the source. Daylight Commons never rates a
post itself. A Community Note X attached to a post is now the first signal in the window.

A post matches only when it carries at least 85% of the claim's rarity-weighted content words,
every name and number in the claim, at least 30% of the claim's word pairs in order, and no claim
word swapped for another between the same neighbours. `tests/claims.test.js` holds the
false-match controls (same topic, different year, different place, a swapped word, scattered
words, stock phrases) and `tests/claims.symmetry.test.js` holds the matcher to the same decision
and score for 24 named actors and 12 groups from every direction. On the built table, each of
2,000 sampled claims finds its own review (1,998 of 2,000), seven generic posts on politics, health
and conflict match nothing, and 41 of 3,000 sampled claims match a different review; read by hand,
those were the same claim reviewed twice in different words.

Sources whose terms are unknown are not bundled: EUvsDisinfo, Community Notes downloads, the Duke
Reporters' Lab dataset and the IFCN signatory list (`data/claims.README.md`). Known limits: the
matcher splits words on spaces, so Chinese, Japanese and Thai claims match only near-verbatim; the
stemmer is English-centred; the table covers 2024-03 to 2026-10; and which claims are in it is
what fact-checkers chose to check.

### The window, reorganised (2026-10-19)

The head shows the account, the key facts, warnings by name, and a strip of seven areas: Place, Account, Posting, Coordination, Language, Sources and Media. Each area's dot is warm when something there is worth a look, ink for a sign, faint for context, and hollow when nothing was found. Clicking an area opens the Overview at that area's evidence. Four tabs follow: **Overview** (the evidence grouped by area, and a comparison with the other accounts read in the thread), **Account** (where, the account record, and how it posts, with a 24-hour posting clock, the last 14 days and the share of posts per app), **This post** (post metadata and the source trail) and **History**. The window remembers the last tab used. The charts are single-series, in one ink hue, with a title on each bar and the same numbers as text below them.

### Product surfaces (2026-10-21)

**Settings** (`src/core/settings.js`, read by `src/ext/settings.js`). One normalised shape for the popup, the first-run page, the options page and the content scripts: per-site switches and a global pause, the window's areas, feeds, automatic reading, retention (history 1 to 60 days, account details 1 to 30), and two accessibility switches (reduced motion, larger text) applied as `pb-calm` and `pb-large` on the page root. The background worker (`src/ext/lifecycle.js`) deletes entries older than the retention on start-up and on every settings change, and the content scripts follow storage changes so an old in-memory copy is never written back.

**Measured accuracy** (`src/core/families.js`, `src/core/measured.js`). Every sign carries a family. Detector families show the precision from `measured.js` with its 95% interval and sample size, or "not measured yet"; a row without a sample size is not shown as a measurement. Families that repeat a site's own label, or match a cited table, say so instead of showing a precision.

**Toolbar states.** The content script reports idle, reading or paused for its tab, and the worker swaps the icon. Icons are drawn by `scripts/render-icons.py` from the SVG sources in `assets/icons/`: the aperture, a luminous orb in fine concentric line-work on an ink disk, with one warm mark for reading and the orb closed to a ring for paused.

**Keyboard.** Focusing a post opens its window; Alt+R moves focus into it; arrow keys move between tabs (tablist, tab and tabpanel roles); Escape closes it and returns focus to the post without reopening it.

**Packaging** (`scripts/package.mjs`, `scripts/zip.mjs`). A dependency-free zip writer with sorted entries, a fixed 1980-01-01 timestamp and deflate level 9; Chrome gets a service worker manifest, Firefox background scripts and a minimum version of 128. The same tree gives the same bytes on the same Node zlib; a different zlib build can change the compressed bytes.

**Type.** Extension pages bundle Hanken Grotesk and JetBrains Mono, both under the SIL OFL 1.1. JetBrains Mono replaced Conso in 3.0.0: Conso's licence is not open source, and JetBrains Mono is the next face in the author's site's own mono stack (`src/ext/fonts/FONTS.md`).

### Add-on identity (2026-10-21)
The Firefox add-on id is `radar@harperz9.github.io` (`browser_specific_settings.gecko.id`). It must
never change. AMO ties every signed version, every user's installed copy and its update path to
this id; a new id is a new add-on, and existing users would never receive an update. The author
owns harperz9.github.io through GitHub Pages, so the id stays theirs. `tests/store-listing.test.js`
fails if it changes.

### Trust: feedback, calibration and the transparency page (2026-10-21)
- Every sign in the window that belongs to a badge family has "This was right" and "This was
  wrong" (src/ext/feedback.js, pure logic in src/core/feedback.js). A mark holds the sign id
  (family, post id, hash of the label), the family, the thread key, the verdict and the time, in
  `pb.feedback.v1`. The post text is kept only when the user ticks "include the text", cut to 1,000
  characters. At most 2,000 marks; the oldest go first. "Clear all Daylight Commons data" deletes them.
- After 10 marks on one family the window adds "Your feedback: N of M right" under the "Measured"
  row. It is the user's own count, labelled "not a measurement", and never replaces or changes the
  measured figure.
- The options page saves the marks as a JSON file (format `radar-feedback/1`) only on a click. No
  code path sends it; the user chooses whether to share it.
- scripts/transparency.mjs builds the transparency page from eval-results.json,
  persuasion-results.json, families.js, EVALUATION.md (the "do not prove" bullets) and CORPORA.md
  (corpora and licences). scripts/privacy.mjs builds the public privacy policy from PRIVACY.md.
  Both write into src/ext (opened from the options page and the popup) and into docs/ for GitHub
  Pages. `tests/pages.test.js` fails when either copy is stale or leaks a local path.
- The fact-check table ships as claims.json plus claims-2.json (src/core/claims-parts.js): the
  Firefox add-on linter refuses any file over 5 MB, and AMO will not sign a package it cannot read.

### Media checks: Content Credentials, frames and first seen (2.0.0, unreleased)

**What the user gets.** The window's This post tab has a Media section for each image or video in the post: when X says it was first uploaded, "First seen" (the earliest post Daylight Commons has seen carrying the same upload, or the post X credits it to with "From @account", whichever is earlier), reverse search links, a "Check this file" button and, for videos, "Take 4 frames".

**Where the bytes come from.** Daylight Commons reads media the page already loaded, and only when the user clicks. It re-requests the exact address the page's own `<img>` or `<video>` element shows (`src/ext/media.js`, `inPost`), with `cache: "force-cache"` and no cookies, so the browser usually answers from its cache; X's media server allows x.com to read its images this way. One file per click, at most 25 MB; a longer file is read in part and its binding is reported as not checked. It never fetches in bulk, never on hover alone, and never fetches a variant the page did not show (an X image that is not on screen gets no check). Streamed video (`blob:` sources, which is how X plays video) has no single file, and the window says so. Results stay in memory for the tab.

**Content Credentials reader** (`src/core/cbor.js`, `jumbf.js`, `der.js`, `c2pa-verify.js`, `c2pa.js`; no dependency). It finds the JUMBF manifest store in JPEG APP11 segments (joined by box instance and sequence number), PNG `caBX` chunks, WebP `C2PA` chunks and the MP4 top-level `uuid` box with the C2PA UUID. It parses the active manifest (the last in the store), its claim (`c2pa.claim` version 1 or `c2pa.claim.v2`), its assertions (actions with digital source type and software agent, ingredients) and its COSE_Sign1 signature, and the earlier manifests an edited file carries. It checks, with WebCrypto and no network call:

- the claim signature over the COSE Sig_structure with the key in the leaf certificate (ES256, ES384, ES512, PS256, PS384, PS512, Ed25519). A version 2 claim whose certificate sits outside the signed header is reported as not checked, because a certificate with the same key and another name could be swapped in; version 1 files did this routinely and the 1.x specification allowed it;
- every hashed URI in the claim, over the referenced box without its 8-byte header;
- the hard binding: `c2pa.hash.data` (the file outside the exclusion ranges) and `c2pa.hash.bmff` v1 to v3 (top-level boxes, each preceded by its 8-byte offset from v2 on, with path, data, version, flags and subset exclusions down to nested boxes). An update manifest uses its parent's binding, retried over the store's current place in the file. Merkle (fragmented) video and `c2pa.hash.boxes` are reported as not checked.

Not checked: whether the certificate chains to a trusted issuer or is on the C2PA trust list, revocation (OCSP), the time-stamp authority's signature, certificate profile rules, and credentials stored online (a file that points to a remote manifest gets "Daylight Commons does not fetch them"). The window says so beside the signer's name: "anyone can make a certificate with any name on it".

**States and words** (`src/core/mediacheck.js`). `unchanged` (all three checks passed: "found and checked: the file has not changed since it was signed"), `changed` (any check failed, naming which), `unchecked` (some part could not be checked here, naming which), `remote`, and `none`, which reads "No Content Credentials found (platforms often strip them on upload). This says nothing about the file either way." Daylight Commons never calls a file authentic, genuine, real or fake; a test holds the wording to that. Signals: "credentials: made with AI" (warn) when the active or an earlier manifest declares trainedAlgorithmicMedia or compositeWithTrainedAlgorithmicMedia; "content credentials" (info) for other intact credentials; "credentials do not match" (flag); "metadata: made with AI" (flag) from unsigned metadata. Their measured line is "what the file itself declares; Daylight Commons checks the signature, not the claim".

**Other metadata** (`src/core/aimeta.js`). IPTC digital source type in XMP (JPEG APP1, PNG iTXt, WebP XMP chunk), generator settings that image tools write into PNG text chunks (`parameters`, `prompt`, `workflow` and similar), the EXIF Software, Artist, Make and Model fields, and a fixed list of generator names in those fields. Metadata is unsigned and the window says so.

**Video frames** (`src/core/keyframes.js`, `src/ext/media.js`). "Take 4 frames" pauses the page's own video, seeks to four points spread across the part the browser has buffered, draws each to a canvas, and restores the position and play state. Each frame has Google Lens, Bing, TinEye and Yandex buttons: the frame goes to the clipboard and the service's upload page opens in a new tab, so nothing reaches the service until the user pastes it. A player whose frames the page may not read (a cross-origin video) gets "the site's player does not let the page read its frames".

**Evidence.** Fixtures in `tests/fixtures/c2pa/` are synthetic flat-colour images and a minimal MP4, signed with c2patool 0.27.22 and its bundled test certificate by `scripts/c2pa-fixtures.py` (R&D only; neither tool ships). Controls that must fail: a changed image byte (committed `tampered.jpg`), a changed assertion, a changed claim, a changed video byte, a truncated store and a partial read; and every signed fixture with its credential container removed must read `none` with no signal. Cross-check against c2patool 0.27.22 on the 43 media files in the c2pa-rs test fixtures (commit 60f7cbd, `scripts/c2pa-crosscheck.mjs`): all 13 files with embedded credentials that c2patool rates valid read `unchanged`, except video1.mp4, which now reads `unchecked` under the fail-safe below; all 18 files without credentials read `none`; the remote-manifest file reads `remote`. Every file c2patool rejects reads `changed`, `unchecked`, `remote` or `none`, never `unchanged`. exp-test1.png reads `unchanged` because c2patool's only failure there is an untrusted signer, which Daylight Commons does not check and says so.

**legacy.mp4, root cause (2026-10-21).** c2patool 0.27.22 reports `claimSignature.mismatch`; Daylight Commons' check passed. Both sign over the same bytes: coset's `tbs_data` and Daylight Commons' Sig_structure are byte-identical (678 bytes), and the PS256 signature verifies under OpenSSL, WebCrypto and c2pa-rs's own `c2pa_raw_crypto` validator. Instrumenting c2pa 0.90.22 (the library inside that c2patool) shows `verify_signature` returning `CoseX5ChainMissing` after the signature had validated: it then reads the signer certificate's Organization name with `ok_or(MissingSigningCertificateChain)`, and this certificate (an S/MIME certificate with only a common name and an email address) has none. The library folds that error into "claim signature is not valid". Current c2pa-rs main treats the Organization as optional. Daylight Commons' cryptographic result is right; c2patool's code is a reporting fault. Daylight Commons fails safe anyway: a version 1 claim in MP4 reads "could not fully verify (older manifest format)" and the state `unchecked`, never `unchanged`, until agreement is shown. `tests/c2pa.reference.test.js` holds Daylight Commons to never being more favourable than c2patool on any of the 43 fixtures (verdicts in `tests/fixtures/c2pa-reference.json`); the CI job `c2pa-reference` fetches the fixtures at the pinned commit to run it. With the fail-safe removed, that test fails on legacy.mp4. Not live-verified yet: reading files on X, Bluesky and Reddit, and taking frames from X's player.
### Learn: lessons, self-check and tour (2026-10-21)

**Lessons** (`src/ext/learn/`, shown by `learn.html` and `learn-page.js`). One lesson per badge family and persuasion technique, plus one for the thread report, 52 in all. Each runs one to two minutes aloud at 150 words a minute (`readSeconds`, tested 60 to 120 s). The order follows the inoculation studies: name the move, refute it, show a weakened made-up dose. Every lesson also shows a fair use of the same words or an ordinary account that trips the same sign, and ends with "A post that shows this sign can still be true". Replications of Bad News (Modirrousta-Galian and Higham 2023; Graham et al. 2023; Seabrooke et al. 2025) found the game raised doubt about true and false items alike with no gain in discrimination, so the lessons train telling the two apart. A lesson for an account flag reuses the badge's own `DOES_NOT_PROVE` line. `tests/learn.symmetry.test.js` holds sign examples to one each from left, right and centre per political lesson, and topics to at most 15% each.

**Link wiring.** `PBSignals.all` adds a "Learn" row to every sign with a family. The window renders it as a button that sends `pb-open-page` to the worker; `lifecycle.js` opens only paths that pass `PB.safePage` (learn.html or quiz.html, with an optional lesson id), so no page can make Daylight Commons open another address, and the lesson pages need no web-accessible resources.

**Self-check** (`quiz.html`, `src/ext/learn/quiz.js`). Eighteen made-up posts, nine that lean on a move and nine that give support, three per direction in each half, hard to easy (Modirrousta-Galian et al. 2026). Every answer gets its reason. "How you are doing" is closed by default and shows hits, false alarms, their difference and d' with the log-linear correction (`PB.discernment`), never a count of fakes caught. Answers live in `pb.learn.v1`, cleared with the rest of Daylight Commons' data.

**Tour** (`src/core/learn.js` rules, `src/ext/tour.js`). Three tips in order: the window, the thread report, a lesson. Each shows once, at most one an hour, only in the first week after the first tip. "No more tips" sets `pb.tour.off`, which clearing data keeps.

**Writing.** `node scripts/learn-text.mjs <dir>` writes every page as text for `check_writing.py --profile readme`. On 2026-10-21, 51 of 55 pages had no counted violation; the other four carry a semicolon from a shared badge line or the machine-writing specimen's stock phrase.

Known limits: no measurement yet that these lessons improve discernment for Daylight Commons users; the planned pre/post check (COMPETITORS.md target 7) needs a study design. Lessons are English only.

### Site context and other coverage (2026-10-21)

**Site cards** (`src/core/sites.js`, `src/core/hosts.js`, `src/ext/linkcard.js`). Resting the pointer on an outbound link, or focusing it, opens Daylight Commons' window for the linked site: the owner (Wikidata P127; where none is stated, the parent organisation P749 or the publisher P123, each named as what it is), the owner type, the founding year and country, any state link, and the site's fact-check record: "N reviews by M fact-checkers since <date>, ratings as the checkers wrote them", the three newest reviews and a button that opens the full list (`sites.html`). The same card replaces the owner row in the post window's Sources area. Redirects (t.co, Facebook, YouTube, Reddit, Google, Bing, DuckDuckGo) resolve to the real address before lookup; links to the page's own site and to platforms show nothing. Tables: `owners.json` (19,864 domains), `sites.json` (facts for 48,341 sites, records for 2,451), built by `scripts/owners-build.mjs` and `scripts/sites-build.mjs`; rules and measured rates in `data/sites.README.md`.

**No score.** The card never combines its facts into a rating. Owner types come from Wikidata and Daylight Commons' cited state table in a fixed order (state media, public broadcaster, regional govt, nonprofit, commercial, not stated). A review count sits beside its does-not-prove line: a review lists a site as where a claim appeared, the site may have carried someone else's words, the rating is about the claim, and fact-checkers choose what to check. For that reason the count stays out of the one-line labels under search results.

**Where it runs.** On the six social sites, inside Daylight Commons' existing content scripts. On a news site, only when the user presses "Site card for this page" in the toolbar menu (`activeTab` and `scripting`, injected into that tab for that click). On Google, Bing and DuckDuckGo result pages, only for the engines the user turns on in the options page; the browser asks for that engine's access at that moment, and `src/ext/sources-bg.js` registers the script then and removes it when the switch goes off.

**Other coverage** (`src/core/coverage.js`, `src/core/feeds.js`, `src/core/feedfetch.js`, `src/core/outlets.js`). Off by default. The user turns it on, then chooses outlets from 33 suggested feeds or adds any https RSS or Atom address; each choice asks the browser for that one feed host. On a click on the site card, the worker requests every chosen feed from its own host in parallel, with no cookies, no referrer, no added header and no redirect followed, then matches the article's title against the headlines on the device. Nothing from the page is sent. Before the first request the card lists every host it will ask and waits for "Ask these outlets"; adding an outlet resets that consent. Each match is labelled by owner and owner type from the bundled tables, never by a side. Every feed asked is listed with its result. GDELT, used through 2.x, is removed; the reasons and the outlet criteria are in project-docs/INDEPENDENCE.md. The text shown before use:

> Other coverage is off unless you turn it on. When it is on and you click "Find other coverage" on an article, Daylight Commons asks each outlet you chose for its public news feed, at the feed's own address, and compares the article's title with the feed's headlines on your device. Daylight Commons sends nothing from the page: not the title, not the page address, not your history, not any post. Each outlet receives an ordinary request for its feed, so it sees your IP address, the time and your browser's standard headers, and could guess you were reading news at that moment. No aggregator or Daylight Commons server is involved. Nothing is requested until you click.

**Measured.** Feeds (2026-10-21, `scripts/eval/coverage-eval.mjs`): all 33 suggested feeds answered and asking all of them took 1.2 s; of 99 lookups (each outlet's three newest headlines), 34 found at least one other outlet and 17 found three or more; median 0. Precision not measured. GDELT before it, on a different set of 100 headlines: 24 answered, 9 found three or more, median 25.5 s. Site-table coverage: of 500 news links from Google News search feeds in 14 editions, 42.2% resolve to an owner row and 55.4% to any site fact (`scripts/eval/sites-match.mjs`). Live check in Chromium 141 with synthetic Google, Bing and DuckDuckGo result pages (`scripts/eval/live-sites.mjs`): labels on 5 of 7 results (Breitbart has no owner or owner type on Wikidata; the seventh is an invented site), the card in 86 to 226 ms, and no long task and 3 to 11 ms of main-thread time per idle 10 s on the article page before and after the card.

**Symmetry.** `tests/sites.symmetry.test.js` gives 18 outlets from across the spectrum and countries the same facts and checks for identical rows, labels and coverage treatment; the same state basis gives the same type for ten countries; posting services from every direction count as platforms alike; and no site or coverage code names a side.
