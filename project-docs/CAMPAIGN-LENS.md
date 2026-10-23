# Launch campaign lens: design and bounds

Status: built, unit-tested on synthetic fixtures, not measured. No precision or recall is claimed
until the hand-labelled evaluation in `EVALUATION.md` ("Launch campaigns: hand-labelling protocol")
has enough cases in every stratum. Not live-checked on X.

## The problem

Product launches on X are often amplified by paid campaigns: an agency buys reposts from account
farms, and pays a ring of accounts to quote the launch inside the same hour with a shared template.
Some quotes carry X's "Paid partnership" label; look-alikes without the label are what a reader
cannot tell apart. A reader who sees 5,000 reposts reads "many people care". The lens answers one
question for the viewer: does this engagement carry indicators of paid or fake-account
amplification, and what exactly are they?

Two threads the author shared on 2026-10-22 are the first labelled cases (structure only, kept
outside the repository). Their pattern: a launch post with reposts about 8 times its likes; a
repost list of accounts with random-suffix handles, slot-filled persona bios and token tags,
unrelated to the post's topic; and quote posts labelled "Paid partnership" within the same few
hours sharing an opener.

## Requirements the author set (2026-10-22)

1. Evidence from what the platform discloses and what the page shows. No cross-site identity
   resolution, no compiling of personal data across sources, no IP addresses.
2. Stance-neutral. Every sign ships with what it does not prove.
3. "These may look and behave differently on different platforms, and in different demographics."
   So: one definition per platform with no shared thresholds; baselines stratified by audience size
   and community; a thin stratum says "insufficient baseline", never a verdict.
4. Coordinated is not inauthentic. Fandoms, mutual aid, protest hashtags and diaspora communities
   coordinate in the open. Coordination alone is reported as neutral context. The lens's lead line
   names inauthenticity indicators only.

## Banned features

These are never an input to any campaign sign, and `tests/campaign.fairness.test.js` checks that
changing them leaves every score unchanged:

- language or script of a bio, a post or a name;
- any country, city or place, including places named in a bio;
- name origin, display name style, or a "non-English bio";
- avatar appearance. Daylight Commons does not guess whether an avatar is AI-made. The only avatar fact used is
  X's own `default_profile_image` disclosure, and it is context, never an indicator.

The screenshots invite all of these (bios naming two African countries, bios in Japanese). A
detector that leaned on them would flag real people for who they appear to be. The signal is the
template, the timing and the topic mismatch.

## Signals

Each sign is computed on accounts the viewer's page loaded: the repost list, the quote list and the
replies X rendered. Daylight Commons never pages through lists on its own.

### 1. Engagement shape (post level)

Ratios of reposts, likes, replies, bookmarks and views. The window shows where the post sits
against three references, in this order:

1. **The author's own posts** loaded on this device in the last 30 days (at least 5 posts with 20 or
   more interactions). "Reposts per like here: 8.2. This account's other posts: median 0.07, highest
   0.4." This is the strongest reference because it stratifies by account, audience and topic at once.
2. **A stratified platform baseline** for the post's audience size. Shipped strata for X today: none.
   The window says "insufficient baseline for X in 2026" until the modern hand-collected baseline in
   `EVALUATION.md` exists.
3. **A historical reference**, labelled as such: PHEME source posts, Twitter 2014 and 2015 breaking
   news, 5,920 posts with 20 or more interactions, by follower stratum
   (`scripts/campaign-baselines.mjs`). Measured result: in that corpus reposts usually exceeded
   likes (median reposts per like 2.3 to 3.0 by stratum, 95th percentile 7.4 to 11.7). The intuition
   that "likes run well above reposts" holds for today's X by common observation, but Daylight Commons has not
   measured it, and the 2014 news baseline contradicts it. That is why the historical line is
   context only and never feeds the lead.

Indicator: `shape-outlier-own` fires when reposts per like exceeds both 5 times the author's own
median and the author's own highest, with at least 5 reference posts. No platform-baseline indicator
ships until a stratum has 200 or more hand-collected posts.

Does not prove: a post can travel through repost-heavy communities (news, giveaways, art shares),
and a launch is unusual for an account by nature.

### 2. Reposter and replier sample

On a sample of at least 12 accounts:

| Sign | What it measures | Weight |
|---|---|---|
| `bio-template` | Groups of 3 or more bios that share a skeleton. A skeleton masks numbers, cashtags, capitalised words and every token with no Latin letter, then compares word 3-shingles that hold at least one fixed word (Jaccard 0.5 or more). A slot filled in any script reads the same. Known limit: a template whose fixed words are not in Latin script is not grouped, so recall is lower for those bios (see the fairness audit). | indicator |
| `stock-persona` | Bios that combine 3 or more cue families from a short list: an age statement, a passion statement ("passionate about", "obsessed with"), a crypto token or slogan, a pet tag, a filler slogan ("here for the memes", "like a pro", "chasing dreams"). Counted as the share of the sample. English phrases only; a bio in another language matches nothing, which lowers recall and never raises suspicion. | indicator when 25% or more of the sample |
| `join-cluster` | Share of accounts with a known join date that joined within the same 14 days. X discloses the join date. | indicator when 5 or more and 30% or more of known |
| `topic-mismatch` | Share of bios dominated by a topic family (crypto tokens, gambling, adult, generic engagement) that the post does not share. A bio with no topic family is "unknown", never a mismatch. | indicator when 40% or more of bios with a topic |
| `random-suffix` | Handles ending in a digit and letter tail ("_x5", "8t9", "c8s"). Many people pick such handles for privacy or safety. | context only; never counts toward the lead, never alone |
| `default-avatar` | X's own default-image disclosure. | context only |

### 3. Quote cluster

Quote posts of the launch on the page, split into those X labels "Paid partnership" and those
without the label.

- **Bunching:** the narrowest window that holds 5 quotes, and how many quotes fall in the densest
  hour.
- **Shared template:** groups of quotes whose own words share a skeleton, plus promo-template cues.
  Cues come from a provider interface (below); without one, a local list runs ("they just dropped",
  "sir...", "this changes everything", "game changer", "is insane", "you need to try").
- **Undisclosed look-alikes** (indicator): unlabelled quotes that share a template group with
  labelled ones, or 3 or more unlabelled quotes in one template group inside a 2-hour window.
- Disclosed paid partnerships on their own are reported plainly. Disclosure is the honest path,
  so the label alone is context, not an indicator.

### 4. Cross-launch overlap

Across launches the viewer opened, the share of this launch's sampled accounts already seen
amplifying 2 or more other launches. Storage: `chrome.storage.local` only, key `pb.campaign.v1`,
30 days, at most 200 launches. Accounts are stored as salted hashes (a random salt made on the
device, never exported), so the store cannot be read back as a list of handles. "Forget launches I
viewed" in the panel and "Clear all Daylight Commons data" in the options wipe it.

Indicator: `cross-launch` when 5 or more sampled accounts and 20% or more of the sample were seen on
2 or more other launches.

Does not prove: fans of a genre, employees and investors reshare each other's launches.

### Combining

- **Inauthenticity indicators:** `shape-outlier-own`, `bio-template`, `stock-persona`, `join-cluster`,
  `topic-mismatch`, `undisclosed-lookalike`, `cross-launch`.
- **Coordination context:** quote bunching, overlap below the threshold, disclosed paid partnerships,
  random-suffix share, default avatars.

Lead lines:

| Indicators firing (independent families) | Lead |
|---|---|
| 2 or more | "This engagement is consistent with purchased amplification, and here is why." |
| 1 | "One sign of paid or fake-account amplification. One sign is weak evidence, so this is context, not an accusation." |
| 0, with coordination context | "The engagement looks coordinated. Coordination alone is common and often organic." |
| 0 | "No campaign signs in what this page loaded." |
| sample under 12 accounts and no quotes | "Too few accounts loaded to read." |

The independent families are shape, bios (`bio-template` and `stock-persona` count as one family),
join dates, topic, quotes and overlap.

## Accusation ladder (author, 2026-10-22)

The author, verbatim: "I am alright with accusations as long asbthey are grounded and plausible, and
do not tread the threads of legality. But I am willing to confidently walk right up to the line, and
spit in the faces of those who weaponize legality for their manipulation of language, ethics, and
culture." This replaced the earlier "never accuse named individuals" rule for this lens.

1. **Documented fact, stated flatly.** Paid partnership labels on quote posts: "Documented: 4 quote
   posts promoting @examplecorp's launch carry X's Paid partnership label, the posters' own
   disclosure."
2. **Strong inference, named, phrased as an inference.** Two or more independent indicator families:
   "Inference: the engagement on @examplecorp's launch is consistent with purchased amplification (4
   independent signs below)." When unlabelled look-alike quotes are one of the families, the blunt
   line is added: "Inference: paid buzz dressed as organic."
3. **Weak signal.** One family, or coordination alone: context, no claim.

Who can be named: only the launch's own account, and only when X discloses it as an organisation
(gold Business or grey Government checkmark, or a Business professional profile; `actorOf` in
`src/core/campaign.js`). Otherwise the copy says "this launch". Sampled accounts are never named and
never called bots; they appear only inside counts. Every claim sits above its evidence, each sign's
"does not prove" line, and the dispute route ("Report it at github.com/HarperZ9/daylight-commons/issues.
Corrections are made in the open."). The lens never claims a crime and never reveals a private
identity. Tests check that the output contains no handle of a sampled account and none of "bot",
"fraud", "crime", "illegal" or "scam".

**Legal review before public release.** A media lawyer should review the ladder's wording before
this lens ships in a public release. UK and EU defamation law is stricter than US law, and "consistent
with purchased amplification" about a named company is a statement a court could read as fact.

**Held in 3.0.0.** The first public release ships before that review, so naming is held:
`NAMING_HELD` in `src/core/campaign.js` keeps every claim at "this launch", whatever the launch
account discloses, and leaves out the blunt "paid buzz dressed as organic" line. The lead, the
evidence rows and the unnamed step-2 inference are unchanged, and a test checks that holding the
name changes no evidence. Turn naming on only after the review, in the same commit as its record.

## Definition matching (data and library built, not in the window yet)

Built on 2026-10-22 as the definition catalogue: `catalogue/`, `src/core/definitions.js` and
`project-docs/DEFINITION-CATALOGUE.md`. Fifteen entries, each verified against its official source
with the retrieval date and a SHA-256 of the page. `signalsFromCampaign(lens)` turns this lens's
rows into the signals the element tables cite. The design notes below are kept as written; where
they differ, the catalogue document governs (the data lives in `catalogue/definitions/`, not
`data/campaign-definitions.json`).

The author, verbatim, 2026-10-22: "this could be highlighted honestly as 'What could be considered
fraud, if looking at the definition rather than the judgement.' If an action is visible, and it
matches the definition there is no reason to skirt that."

Design:
- Definitions are data (`data/campaign-definitions.json`, not created yet), one record each with
  its official URL, retrieval date, the quoted text, and its elements split into rows. Planned set:
  FTC Endorsement Guides, 16 CFR Part 255 (undisclosed material connection); FTC rule 16 CFR Part
  465 (buying or selling fake indicators of social media influence for commercial use); EU Unfair
  Commercial Practices Directive, Annex I (falsely presenting oneself as a consumer); UK Digital
  Markets, Competition and Consumers Act 2024, fake reviews; X's own paid-partnership and
  platform-manipulation policy text; and a general fraud definition whose intent and reliance
  elements are almost always "not observable".
- No definition text ships until it is checked against the official source, with the URL and the
  retrieval date recorded in the record. Nothing is quoted from memory.
- The window shows an element table: each element as matched, not matched or not observable, each
  with its evidence row from the lens. The phrasing is "matches elements A and B of [definition]",
  next to the elements that are not observable. It never says "committed fraud" or any other
  finding a court makes, and a definition with an unobserved required element is never summarised
  as met.
- The no-crime-words test in `tests/campaign.test.js` changes with this layer: the name of a
  definition may appear inside the element table, and the verdict words ("committed", "guilty",
  "is fraud") stay banned.
- The legal review above covers this layer too.

## Platforms

One definition per platform (`src/core/campaign-platforms.js`). No threshold is shared.

| Platform | Shape counts | Sample source | Platform-specific signs | Status |
|---|---|---|---|---|
| X | reposts, likes, replies, quotes, bookmarks, views | repost list, quote list, replies | Paid partnership label, X's default-image flag | built, not measured |
| Reddit | score, comments, upvote ratio where shown | commenters | account age, karma for age (already read), brigading arrival burst | definitions only; thresholds not set, the lens says "not defined yet" |
| Instagram | likes are often hidden, so no shape | commenters | engagement pods (same commenters across a creator's posts) | not defined |
| TikTok, LinkedIn | | | pods | not defined |

## Promo-template interface (Articulate)

A provider is a function `(text) -> { cues: [{ id, match, source }] }`, registered with
`setPromoTemplateProvider(fn)` in `src/core/campaign-text.js`. Without one, the local list runs, and
each cue says which list matched.

Articulate's campaign detectors (HarperZ9/articulate PR #40; report format
`articulate-campaign-report/1`; expected in the first Articulate release after 0.12.0) are Python,
so the route is by file on the user's machine:

1. `articulateInput({ quotes, bios })` writes the schema's input list: texts only, ids `q:<post id>`
   and `b:<n>`, no handles.
2. `articulate campaign input.json --platform x --json > report.json`.
3. `providerFromReport(report, input)` checks the format string (a different format throws, so a
   mismatch is never read silently) and returns a provider whose cues come from Articulate's
   `promo` findings, plus the count of bios Articulate scored as persona templates and its clusters'
   skeletons. Texts Articulate did not see fall back to the local list.

The generic `providerFromPack({ version, templates: [{ id, pattern, flags, source }] })` stays for a
plain pattern list. The extension does not yet load a report from a file; that wiring is listed in
"What remains".

## Controls that must fail (tests)

Each is a synthetic fixture where the lens must NOT reach the two-indicator lead:

1. An organic fandom launch: 40 accounts, varied bios, a burst of quotes inside an hour, high
   overlap with two other launches below threshold. Expected: coordination context only.
2. A diaspora community resharing a post: bios in one non-Latin script, many naming the same
   country, random-suffix handles. Expected: 0 indicators.
3. A protest hashtag: many accounts quoting with the same slogan, all with unique bios, old accounts.
   Expected: at most one indicator (template quotes), lead not reached.
4. A small account's normal post: too few reference posts. Expected: "insufficient baseline".
5. Disclosed paid partnerships only, no look-alikes. Expected: context, not an indicator.
6. Invariance: swapping every place name, or translating the template slots into another script,
   leaves every score unchanged.

And the positive fixture modelled on the labelled pattern must reach the lead, so the controls are
not passing because the lens never fires.

## What the controls found while building

Control 2 (a community writing in Japanese) failed on the first build: the katakana length mark
belongs to no single script, so it survived masking as a "fixed word" and grouped unrelated Japanese
bios into templates. The fix makes every token without a Latin letter a slot. The control is the
reason this was caught; it is kept as a regression test.

## What remains

- Live check on X (needs the author's go-ahead): the repost-list response, the "Paid partnership"
  span, bookmark counts, and that X's Human and AI account labels can be read (not read yet).
- Loading an Articulate campaign report in the extension (file picker beside "Analyse a file").
- The modern X baseline (200 ordinary posts per stratum) and the labelled cases the evaluation needs.
- Reddit thresholds, after labelled Reddit cases.
- Legal review of the ladder's wording before a public release.
- Definition matching: the catalogue and the element tables are built
  (`project-docs/DEFINITION-CATALOGUE.md`); showing them in the window remains.

## What it does not prove

Every indicator has its own line, and the lens as a whole says: "These signs describe how this
post's engagement looks in what your page loaded. They do not say who paid, whether the product is
good, or that any one account is fake. Real people also write stock bios, join in waves and reshare
launches."
