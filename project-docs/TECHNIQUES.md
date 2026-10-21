# Technique map: disinformation by behaviour and structure

Radar reads how material moves and how accounts post. It does not take words at face value:
the same sentence can inform, joke or mislead, and a campaign can say true things. So each
technique below is mapped to something Radar can observe in the structure of a thread or the
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
  CC BY-SA 4.0 (the README says CC BY 4.0; the licence file governs). Radar cites technique ids
  and names only and copies no framework text, so no share-alike obligation attaches to Radar's
  code. Ids below were read from the repository on 2026-10-21; it has no release tag.

The model is the same whoever runs a campaign. Rauch places trolling mostly on the right and
cancel campaigns mostly on the left; that is his reading, and Radar does not inherit it. Every
signal below takes no input about side, party or identity, and every new signal has a symmetry
test.

## What Radar can see, and what it cannot

Radar sees what the site loads for the viewer: posts, their times, links and media ids, the site's
language code, an account's post count and join date, and Radar's own local log of threads the
user opened. It cannot see who runs an account, who paid, what a linked site cites, or any thread
the user did not open. Rauch's two features "no commitment to objective reality" and "no
commitment to consistency" concern truth and contradiction across time. Radar does not judge
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
- **Radar measures.** `src/core/flooding.js`, new. Timing bursts (`timing.js`) and the per-account
  "very high post rate" flag existed before.
- **Status.** Organic rate only: 0.6% of ordinary threads with 5 to 19 replies, 1.8% at 20 to 49,
  2.2% at 50 to 99, 3.3% at 100 or more (PHEME, EVALUATION.md). Repeat posting fired on 23% of
  ordinary threads at five replies, which is why it never fires the sign.
- **Missing.** Many channels at once: Radar sees one site per tab and keeps no cross-site log by
  design. No labelled set of flooded threads, so no precision.
- **Precision target.** Organic rate at or under 2% for threads under 50 replies (met) and under 5%
  above; precision of 0.7 or more against a labelled set of flooded threads once one exists.

### 2. Laundering a claim through intermediaries
Rauch, "artificial copies" and the attack on sources; DISARM T0128.004 Launder Information Assets,
T0100 Co-Opt Trusted Sources, T0084.003 Deceptively Labelled or Translated.
- **Signal.** The laundering chain: post, then the accounts and linked sites its material passed
  through, then the earliest origin Radar saw, from quotes, reposts, "media from", the same upload
  and the same link seen earlier. The sign shows when the post does not point at the origin itself
  and at least one step lies between.
- **Radar measures.** `src/core/chain.js`, new, on the source trail and first-seen log of
  `trail.js`.
- **Status.** Not measured. It is a view of recorded pointers, so it is correct where the pointers
  are; how often a chain shown means laundering has no labelled data.
- **Missing.** What a linked site cites, and anything before the first upload Radar saw. Rewritten
  text (the same claim in new words) is invisible by design: Radar never infers a source from
  wording.
- **Precision target.** Chain correctness 1.0 against platform pointers (tested); laundering
  precision not set until a labelled set exists.

### 3. Cloned or imitation outlets
Rauch, fake news; DISARM T0098 Establish Inauthentic News Sites, T0098.001 Create Inauthentic News
Sites, T0097.202 News Outlet Persona, T0143.003 Impersonated Persona, T0146.005 Lookalike Account ID.
- **Signal.** A linked domain that imitates a known outlet (a look-alike name or a known outlet's
  name on a new domain), a site with no owner record, or an account name folded to the same letters
  as another.
- **Radar measures.** Site cards (owner, founding year, state links, fact-check record) and
  look-alike letter folding (`confusables.js`). Sites without records show as "not covered".
- **Status.** Not measured as a technique sign.
- **Missing.** A look-alike-domain check against the owner table (edit distance and confusables on
  the registered name). Next stream.
- **Precision target.** 0.9 on a hand-labelled list of documented clone domains (for example from
  public takedown reports) against an equal number of ordinary new domains.

### 4. Coordinated amplification
Rauch, "pile on to produce hive-mind coordination"; DISARM T0118 Amplify Existing Narrative,
T0116.001 Post Inauthentic Social Media Comment, T0049.001 Trolls Amplify and Manipulate.
- **Signal.** Near-identical replies from different accounts, timing bursts, pairs seen together
  across threads, the same upload from many accounts, links pushed by several accounts.
- **Radar measures.** `similarity.js`, `timing.js`, `network.js`, `trail.js`, all with organic
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
- **Radar measures.** `src/core/crosslang.js`, new.
- **Status.** Organic rate only, within one thread: 0.03% of threads with 5 to 19 replies, 0.14% at
  20 to 49, 1.1% at 50 to 99, 0% of 60 at 100 or more. Across threads: not measured. Before the
  root post's material was set aside it fired on 2.3% to 3.4%; 167 of 177 groups were replies
  carrying the post they answered.
- **Missing.** A translated claim with no shared link, upload or fact-check: Radar does not
  translate and does not match meaning across languages.
- **Precision target.** Organic rate under 0.5% below 50 replies (met) and under 2% above; 0.7
  precision on labelled multilingual campaigns.

### 6. "Just asking questions" and Demoralisation ("nothing is true")
Rauch: disinformation aims to make people disbelieve everything; "demoralize" in his definition of
epistemic warfare. RAND feature 3. DISARM T0049.008 Generate Information Pollution.
- **Signal.** Insinuating questions and doubt cast on all sources: the persuasion cues for doubt,
  whataboutism and thought-terminating cliches in `persuasion.js`, and the conspiracy marker in
  the rhetoric families.
- **Radar measures.** Persuasion techniques (SemEval taxonomy) and the conspiracy marker.
- **Status.** Measured and not shipped: no persuasion technique cleared the precision bar on the
  PTC test split (EVALUATION.md), so none is shown in the window.
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
- **Radar measures.** Bursts, join bursts, returning groups and the thread report. A "mobilising to
  punish speech" sign was tested and not shipped (EVALUATION.md).
- **Status.** Not measured as a technique sign.
- **Missing.** Account-directed reply volume against the target's own baseline. Radar must not
  become a pile-on engine of its own (DESIGN-MAP R12), so this stays a thread-level description and
  is never exported as a list of accounts.
- **Precision target.** 0.7 on a labelled harassment corpus; organic rate under 1%.

## Lines that hold

- A sign describes content or behaviour, never a person's identity or side.
- Every sign carries its organic rate or "not measured", and its does-not-prove line.
- No sign takes a language, a country, a party or a group as an input. The cross-language sign
  treats every language pair alike (`tests/crosslang.test.js`); the flooding sign ignores names
  and order (`tests/flooding.test.js`); the chain is the same for any accounts (`tests/chain.test.js`).
