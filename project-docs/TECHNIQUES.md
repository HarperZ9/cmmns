# Technique map: disinformation by behaviour and structure

Daylight Commons reads how material moves and how accounts post. It does not take words at face value:
the same sentence can inform, joke or mislead, and a campaign can say true things. So each
technique below is mapped to something Daylight Commons can observe in the structure of a thread or the
behaviour of accounts, never to a verdict about a claim or a person. Checked 2026-10-21.

## Sources

- **Rauch.** Jonathan Rauch, *The Constitution of Knowledge* (Brookings, 2021), chapter 1 and the
  2018 National Affairs essay "The Constitution of Knowledge". His two rules are "no final say" and
  "no personal authority". He describes disinformation as an attempt to make people disbelieve
  everything, and trolling as decentralised, swarm-based: attack real news and its sources, spread
  fakes, "make artificial copies of themselves", pile on until a crowd forms. He defines epistemic
  warfare as organising the media environment "to dominate, divide, disorient and demoralize"
  (Brookings webinar, 22 June 2021, paraphrase). Chapters 2 to 8 were not read for this map.
- **RAND.** Christopher Paul and Miriam Matthews, *The Russian "Firehose of Falsehood" Propaganda
  Model: Why It Might Work and Options to Counter It*, RAND Perspective PE-198, 2016. It names four
  features: high-volume and multichannel; rapid, continuous and repetitive; no commitment to
  objective reality; no commitment to consistency. The feature wording here is from secondary
  quotation; rand.org refused the fetch on 2026-10-21, so the primary PDF is unchecked.
- **DISARM.** The DISARM framework, github.com/DISARMFoundation/DISARMframeworks. LICENSE.md is
  CC BY-SA 4.0 (the README says CC BY 4.0; the licence file governs). Daylight Commons cites technique ids
  and names only and copies no framework text, so no share-alike obligation attaches to Daylight Commons'
  code. Ids below were read from the repository on 2026-10-21; it has no release tag.

The model is the same whoever runs a campaign. Rauch places trolling mostly on the right and
cancel campaigns mostly on the left; that is his reading, and Daylight Commons does not inherit it. Every
signal below takes no input about side, party or identity, and every new signal has a symmetry
test.

## What Daylight Commons can see, and what it cannot

Daylight Commons sees what the site loads for the viewer: posts, their times, links and media ids, the site's
language code, an account's post count and join date, and Daylight Commons' own local log of threads the
user opened. It cannot see who runs an account, who paid, what a linked site cites, or any thread
the user did not open. Rauch's two features "no commitment to objective reality" and "no
commitment to consistency" concern truth and contradiction across time. Daylight Commons does not judge
truth; it shows fact-checks and Community Notes the platform or a fact-checker published.

## The techniques

Status words: **measured** (a rate on labelled or organic data, with interval), **organic rate
only** (how often it fires on ordinary threads; no labelled campaigns, so no precision), **not
measured**.

### 1. Flooding (volume, speed, many channels)
RAND features 1 and 2 (Paul and Matthews 2016); Rauch, "flood the zone". DISARM T0049 Flood Information Space, with
T0049.003 Bots Amplify via Automated Forwarding and Reposting and T0049.008 Generate Information
Pollution.
- **Signal.** In one thread: three or more accounts posting 100 or more times a day carry at least
  a quarter of the replies whose account rate is known (volume), or a timing burst holds two or
  more such accounts (speed). Accounts replying five or more times are shown as context only.
- **Daylight Commons measures.** `src/core/flooding.js`, new. Timing bursts (`timing.js`) and the per-account
  "very high post rate" flag existed before.
- **Status.** Organic rate only: 0.6% of ordinary threads with 5 to 19 replies, 1.8% at 20 to 49,
  2.2% at 50 to 99, 3.3% at 100 or more (PHEME, EVALUATION.md). Repeat posting fired on 23% of
  ordinary threads at five replies, which is why it never fires the sign.
- **Missing.** Many channels at once: Daylight Commons sees one site per tab and keeps no cross-site log by
  design. No labelled set of flooded threads, so no precision.
- **Precision target.** Organic rate at or under 2% for threads under 50 replies (met) and under 5%
  above; precision of 0.7 or more against a labelled set of flooded threads once one exists.

### 2. Laundering a claim through intermediaries
Rauch, "artificial copies" and the attack on sources; DISARM T0128.004 Launder Information Assets,
T0100 Co-Opt Trusted Sources, T0084.003 Deceptively Labelled or Translated.
- **Signal.** The laundering chain: post, then the accounts and linked sites its material passed
  through, then the earliest origin Daylight Commons saw, from quotes, reposts, "media from", the same upload
  and the same link seen earlier. The sign shows when the post does not point at the origin itself
  and at least one step lies between.
- **Daylight Commons measures.** `src/core/chain.js`, new, on the source trail and first-seen log of
  `trail.js`.
- **Status.** Not measured. It is a view of recorded pointers, so it is correct where the pointers
  are; how often a chain shown means laundering has no labelled data.
- **Missing.** What a linked site cites, and anything before the first upload Daylight Commons saw. Rewritten
  text (the same claim in new words) is invisible by design: Daylight Commons never infers a source from
  wording.
- **Precision target.** Chain correctness 1.0 against platform pointers (tested); laundering
  precision not set until a labelled set exists.

### 3. Cloned or imitation outlets
Rauch, fake news; DISARM T0098 Establish Inauthentic News Sites, T0098.001 Create Inauthentic News
Sites, T0097.202 News Outlet Persona, T0143.003 Impersonated Persona, T0146.005 Lookalike Account ID.
- **Signal.** A linked domain that imitates a known outlet (a look-alike name or a known outlet's
  name on a new domain), a site with no owner record, or an account name folded to the same letters
  as another.
- **Daylight Commons measures.** Site cards (owner, founding year, state links, fact-check record) and
  look-alike letter folding (`confusables.js`). Sites without records show as "not covered".
- **Status.** The look-alike address sign (`lookalike.js`) catches 147 of 1,174 report-named
  domains and matches none of 52,598 real outlet domains (in-sample controls). Cloned-outlet
  framing (`src/core/cloned.js`, new): when the post's own words name the copied outlet, the sign
  says so and points at "Named in a published report" when a report named the address. Not
  measured on posts.
- **Missing.** A labelled set of posts that cite clones, and clones of outlets not in the list.
- **Precision target.** 0.9 on a hand-labelled list of documented clone domains (for example from
  public takedown reports) against an equal number of ordinary new domains.

### 4. Coordinated amplification
Rauch, "pile on to produce hive-mind coordination"; DISARM T0118 Amplify Existing Narrative,
T0116.001 Post Inauthentic Social Media Comment, T0049.001 Trolls Amplify and Manipulate.
- **Signal.** Near-identical replies from different accounts, timing bursts, pairs seen together
  across threads, the same upload from many accounts, links pushed by several accounts.
- **Daylight Commons measures.** `similarity.js`, `timing.js`, `network.js`, `trail.js`, all with organic
  baselines (EVALUATION.md).
- **Status.** Organic rate only: same text 0.5% to 6.7% of threads by size, bursts 1.1% to 3.3%.
- **Missing.** A labelled set of coordinated threads, so no recall or precision.
- **Precision target.** Organic rate under 2% at 20 to 49 replies for each sign; 0.7 precision on
  labelled campaigns.

### 5. Repetition across languages
RAND feature 1 (multichannel); DISARM T0084.003 Deceptively Labelled or Translated.
- **Signal.** One link, one upload or one fact-checked claim carried by replies in two or more
  languages from different single-language accounts. The root post's own link and media are set
  aside. Across threads, the trail log's language per post gives the same check. Language comes
  from the site's code; without one, a distinct writing system.
- **Daylight Commons measures.** `src/core/crosslang.js`, new.
- **Status.** Organic rate only, within one thread: 0.03% of threads with 5 to 19 replies, 0.14% at
  20 to 49, 1.1% at 50 to 99, 0% of 60 at 100 or more. Across threads: not measured. Before the
  root post's material was set aside it fired on 2.3% to 3.4%; 167 of 177 groups were replies
  carrying the post they answered.
- **Missing.** A translated claim with no shared link, upload or fact-check: Daylight Commons does not
  translate and does not match meaning across languages.
- **Precision target.** Organic rate under 0.5% below 50 replies (met) and under 2% above; 0.7
  precision on labelled multilingual campaigns.

### 6. "Just asking questions" and Demoralisation ("nothing is true")
Rauch: disinformation aims to make people disbelieve everything; "demoralize" in his definition of
epistemic warfare. RAND feature 3. DISARM T0049.008 Generate Information Pollution.
- **Signal.** Insinuating questions and doubt cast on all sources: the persuasion cues for doubt,
  whataboutism and thought-terminating cliches in `persuasion.js`, and the conspiracy marker in
  the rhetoric families.
- **Daylight Commons measures.** Persuasion techniques (SemEval taxonomy) and the conspiracy marker. New: a
  "just asking questions" technique for question-form insinuation ("I'm just asking", "is it a
  coincidence?", "makes you wonder", "I'm not saying ..., but").
- **Status.** Measured and not shipped: no persuasion technique cleared the precision bar on the
  PTC test split (EVALUATION.md), so none is shown in the window. Just asking: 0 of 2 test spans
  against PTC "Doubt" (a proxy label); 0.04% of PHEME replies.
- **Missing.** A structural cue: the share of a thread's replies that question every source at
  once, against an organic baseline. Wording alone misreads honest questions, so this needs a
  behavioural partner (repetition by the same accounts across threads) before it ships.
- **Precision target.** 0.6 on the PTC "Doubt" label before any badge ships.

### 7. Swarming and punishment campaigns aimed at a person
Rauch: cancel culture as "enforced conformity" and trolling's pile-on, both information warfare;
DISARM T0048 Harass, T0048.001 Boycott/"Cancel" Opponents, T0048.002 Harass People Based on
Identities, T0048.004 Dox, T0049.005 Conduct Swarming.
- **Signal.** Many accounts replying to one person within a short window, with accounts new to
  that person's threads, a timing burst, and hostile markers aimed at the person rather than an
  idea. Shown at thread level only.
- **Daylight Commons measures.** `src/core/swarming.js`, new: within ten minutes, at least 6 of at least 8
  accounts Daylight Commons read are new or flagged, and at least half of those read. Counts only, never
  handles. Bursts, join bursts, returning groups and the thread report existed before. A
  "mobilising to punish speech" sign was tested and not shipped (EVALUATION.md).
- **Status.** Organic rate only: 0.04% of PHEME threads (2 of 4,712; test half 1 of 2,278, 95%
  interval 0.01 to 0.25%). No labelled harassment corpus, so no precision.
- **Missing.** Account-directed reply volume against the target's own baseline, and hostile
  markers aimed at the person. Daylight Commons must not
  become a pile-on engine of its own (DESIGN-MAP R12), so this stays a thread-level description and
  is never exported as a list of accounts.
- **Precision target.** 0.7 on a labelled harassment corpus; organic rate under 1%.

### 8. Episodic framing: one person's story in place of the issue
Iyengar, *Is Anyone Responsible?* (1991): episodic coverage tells an issue through one person or
event and leads viewers to blame the individual; thematic coverage places it in context and leads
them to hold society or government responsible. Coding follows the narrative-frame part of the
Mendelsohn, Budak and Jurgens (NAACL 2021) codebook. DISARM has no matching technique id.
- **Signal.** A post of 12 words or more with person-story cues (an age, "my neighbour", "this
  mother who", "she was evicted") and no structural cue (a percentage, a rate, a year range, data,
  policy, law, funding). Thematic counterpart: structural cues and no person-story cue. The feed
  page gives the balance of the two with intervals.
- **Daylight Commons measures.** `src/core/framing.js`, new; the feed log keeps each post's frame.
- **Status.** Not measured; held. No labelled corpus with a usable licence (EVALUATION.md). Context:
  0.90% of PHEME replies read as person-stories, 1.67% as structural, unlabelled.
- **Missing.** A labelled episodic and thematic corpus Daylight Commons may use; languages other than English.
- **Precision target.** A Wilson lower bound of 0.7 from at least 20 held-out hits before the sign
  or the feed balance shows.

### 9. Hidden motive
Rauch's "no personal authority" rule asks that claims be checked, not their speakers' minds read.
No DISARM id is claimed for this cue.
- **Signal.** A persuasion cue that asserts a hidden aim: "masked as", "under the guise of", "the
  real reason", "secret agenda", "secretly want", "textbook move", "it was never about".
- **Daylight Commons measures.** A persuasion technique, `motive-attribution`, new.
- **Status.** Measured on a proxy and held: 0 of 4 test spans against PTC "Doubt"; 0.02% of PHEME
  replies.
- **Missing.** Evidence checks: a motive backed by a linked document is a finding, and the cue
  cannot tell the two apart.
- **Precision target.** The persuasion bar: 80% point precision and a lower bound of 0.7 from 20
  hits.

### 10. A borrowed voice: funding hidden behind a personality
Rauch's "no personal authority" rule: a claim stands on its evidence, and a campaign that hides its
money borrows a speaker who seems independent to skip the checking. DISARM T0100 Co-Opt Trusted
Sources.
- **Signal.** Not a detector. "Backing on record" (`src/core/backing.js`) matches a post's author
  against a table of documented backing (`data/personalities.README.md`). Two documented campaigns
  carry this technique: the Tenet Media indictment (SDNY, September 2024; the Justice Department's
  words "co-opted online commentators"), and Vippi Media's FARA filings for the Chinese consulate in
  New York (2022; the filing says Viral Nation sourced the influencers and created the content).
- **Status.** A table lookup: the source is the evidence, so there is no precision to measure. The
  table's coverage is the limit, and its balance is reported in the README.
- **Missing.** Undisclosed funding that no record or two independent outlets document. Daylight Commons never
  infers backing from association, wording or who someone follows.

## Lines that hold

- A sign describes content or behaviour, never a person's identity or side.
- Every sign carries its organic rate or "not measured", and its does-not-prove line.
- No sign takes a language, a country, a party or a group as an input. The cross-language sign
  treats every language pair alike (`tests/crosslang.test.js`); the flooding sign ignores names
  and order (`tests/flooding.test.js`); the chain is the same for any accounts (`tests/chain.test.js`).
