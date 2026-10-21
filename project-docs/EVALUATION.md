# Evaluation plan and results

## What is measured
| Detector | Measure | Data |
|---|---|---|
| Rhetoric markers | precision and recall per family, per side, per target group | four public human-labelled corpora (`evidence/CORPORA.md`) |
| Persuasion techniques | span precision per technique, with recall and a chance baseline | the Propaganda Techniques Corpus (PTC, SemEval-2020 Task 11) |
| Report "extreme" | precision against human severity labels | the same corpora |
| Duplicates | pair precision and recall | SYNTHETIC cases (`scripts/eval/synthetic.mjs`) |
| Mismatch | precision and recall of "speaks as local, labelled elsewhere" | SYNTHETIC cases |
| All four | the same, on live threads | three hand-labelled X threads: pending the author's labelling |

Precision comes first: a badge on a real person's honest reply is the main harm.

## How to reproduce
1. Download the four corpora listed in `evidence/CORPORA.md` to a data directory outside the repository, `../radar-data/` by default (or set
   `RADAR_DATA`). Python with pyarrow flattens them on the first run (`scripts/eval/prep.py`).
2. `node scripts/eval.mjs` prints every number below for the test split and rewrites
   `evidence/eval-results.json` and `src/core/measured.js`. `--split dev` prints the tuning split
   and writes nothing.
3. The results file records the SHA-256 of every raw and prepared input.
4. Persuasion techniques: download `datasets-v2.tgz` (`evidence/CORPORA.md`) to
   `<data dir>/ptc/` and extract it into `<data dir>/ptc/x/`. `npm run eval:persuasion`
   prints the test split and rewrites `evidence/persuasion-results.json` and the persuasion block
   of `src/core/measured.js`. `--split dev --cues` prints per-cue figures for tuning.

The split is fixed (seed `radar-eval-2026-10-21`, about 50/50 per corpus). Every lexicon and
grammar change was tuned on dev. Test was read once, after tuning.

## Results (test split, 2026-10-21, with the Spanish, German, Portuguese and Italian grammars and the side-recall terms merged)
"P(hostile)" is the share of marker hits on text the annotators judged hostile to a group. The
pooled figure combines Measuring Hate Speech (MHS), HateXplain and Civil Comments. The range runs
from the lowest to the highest corpus with at least 20 hits. "P(item)" and "R(item)" use MHS's own
survey item for that family. Intervals are Wilson 95%.

| Family | P(hostile), pooled | Range across corpora | P(item), MHS | R(item), MHS |
|---|---|---|---|---|
| dehumanise | 92.3% (36/39; 79.7 to 97.3) | under 20 hits in each corpus | 57.9% (11/19; 36.3 to 76.9) | 0.2% (11/5,046; 0.1 to 0.4) |
| violence | 87.5% (77/88; 79.0 to 92.9) | MHS 96.7% (59/61); Civil 3/9 | 63.9% (39/61; 51.4 to 74.8) | 2.1% (39/1,819; 1.6 to 2.9) |
| vigilante | 2 of 3 hits | not measured (3 hits) | no item | no item |
| slur | 91.0% (3,995/4,392; 90.1 to 91.8) | Civil 34.0% (16/47) to MHS 95.3% | no item | not measured |
| stereotype | 83.3% (80/96; 74.6 to 89.5) | MHS 91.7% (66/72); Civil 3/9 | 70.8% (51/72; 59.5 to 80.1) | 0.6% (51/8,368; 0.5 to 0.8) |
| any strong family | 90.7% (4,150/4,578; 89.8 to 91.5) | Civil 33.8% (23/68) to MHS 95.0% | | |
| slurSoft (weak) | 65.5% (837/1,278; 62.8 to 68.0) | Civil 20.3% to MHS 91.7% | | |
| contempt (weak, new) | 92.0% (92/100; 85.0 to 95.9) | HateXplain 93.1%, MHS 91.4% | | |
| motive (weak) | 72.5% (29/40; 57.2 to 83.9) | MHS 81.8% (18/22) | | |
| essentialise (weak) | 57.8% (59/102; 48.1 to 67.0) | Civil 25.8% to HateXplain 75.0% | | |
| absolutist (weak) | 50.7% (137/270; 44.8 to 56.7) | Civil 32.9% to HateXplain 84.2% | | |
| conspiracy (weak) | 28.8% (34/118; 21.4 to 37.6) | Civil 3.6% (3/84) | | |

Strong families (dehumanise, violence, vigilante, slur, stereotype) label the post. Weak ones only
count toward "extreme".

**Report "extreme"** (`EXTREME_AT` = 2). Against MHS `hate_speech_score > 0.5`: precision 70.3%
(896/1,275; 67.7 to 72.7), recall 17.2% (896/5,224; 16.2 to 18.2). Against HateXplain's majority
"hatespeech": precision 60.1% (1,950/3,246; 58.4 to 61.7), recall 64.7% (1,950/3,016; 62.9 to 66.3).
Civil Comments has no usable severity label.

**French (MLMA).** 9 strong hits in the test split, 8 of them hostile. The French grammar is not
measured: too few hits, and 79% of the corpus is hostile, so precision there sits near the base rate.

**Synthetic pilots.** Duplicates: pair precision 97.7% (85/87; 92.0 to 99.4), recall 100% (85/85;
95.7 to 100), on 61 replies built from 12 base texts with copy-paste edits and stock-phrase
negatives. Mismatch: precision 100% (14/14; 78.5 to 100), recall 100% (14/14), on 32 hand-written
reply and label pairs. The evaluating agent wrote both sets, and each label comes from how the case
was built. They show that the detectors follow their rules. They are not error rates on real replies.

### What the numbers do not prove
- **Precision.** The corpora come from Reddit, Twitter, Gab, YouTube and news comments, several
  years old. Two of them were sampled to be rich in hate speech (about 61% hostile). On Civil
  Comments, where 8% of comments are hostile, about a third of strong labels (23 of 68) fell on text the raters
  called toxic. Real reply threads sit somewhere between. Some Civil "false positives" are quoted or
  ironic uses that raters scored below 0.5, so 34% is a floor more than a point estimate.
- **Recall.** Radar is a hand-built lexicon and grammar. It finds a small share of hostile text: MHS
  item recall is under 3% for every family. A thread with no markers is not a clean thread.
- **Weak families.** Conspiracy, absolutist and essentialise describe framing, which these corpora
  do not label. Their figures against hostility labels are context, not error rates.
- **Extreme.** The thread report is only as good as "extreme". At 17% recall on MHS, most severe
  replies do not count as extreme.
- **Synthetic.** The duplicate and mismatch figures come from cases written alongside the rules. No
  person other than the rules' author, and no model, labelled them.

## Arabic, Russian, Ukrainian, Chinese and Hindi (test split, 2026-10-21)

Reproduce: download the corpora in `evidence/CORPORA.md` ("Arabic, Russian, Ukrainian, Chinese and
Hindi"), then `node scripts/eval-langs.mjs`. It prints the test split, writes
`evidence/lang-results.json` and the language rows in `src/core/measured-langs.js`, which the window
shows beside a marker a language grammar found. `--split dev --show N` prints dev hits on
non-hostile items for tuning, to the console only. Same seed and split rule as above; dev was read
for tuning, test once.

Strong families (slur, dehumanise, violence, stereotype, vigilante), precision against each
corpus's broad hostile or toxic label:

| Language | Corpus | Hits | Precision (95% interval) | Recall | Family-specific |
|---|---|---|---|---|---|
| Arabic | MLMA | 26 | 96.2% (81.1 to 99.3) | 2.1% | vs "hateful": 73.1% (19/26) |
| Arabic | TextDetox (OSACT4) | 3 | 3 of 3 | 0.2% | none |
| Arabic | HateCheck (templates) | 77 | 96.1% (89.2 to 98.7) | 5.9% | dehumanise P 25/25, R 35.7%; violence 3/3, R 2.1%; slur R 0 of 45 |
| Russian | TextDetox | 95 | 100% (96.1 to 100) | 7.6% | none; all 95 are slurs |
| Ukrainian | TextDetox | 15 | 15 of 15 | 1.2% | none |
| Chinese | COLD | 29 | 75.9% (57.9 to 87.8) | 2.1% | vs "attack group": 75.9% (22/29) |
| Chinese | HateCheck (templates) | 61 | 95.1% (86.5 to 98.3) | 5.1% | dehumanise 10/10; violence 83.3% (15/18); slur 19/19, R 25.3% |
| Hindi | TextDetox | 5 | 5 of 5 | 0.4% | none |
| Hindi | HateCheck (templates, Latin spelling) | 13 | 13 of 13 | 1.0% | dehumanise 10/10, R 14.3%; violence R 0 of 139 |

What the window says: Arabic and Chinese show a measured line (pooled natural text: Arabic 96.6%,
28/29, interval 82.8 to 99.4; Chinese 75.9%, 22/29, 57.9 to 87.8). Russian shows 100% (95/95, 96.1 to
100), all from slurs. Ukrainian (15 signs) and Hindi (5) show "not measured", since fewer than 20
signs were checked. The French, Spanish, German, Portuguese and Italian grammars show "not
measured" too.

Ukrainian: no human-labelled corpus of group-directed hate with a usable licence was found, so
the Ukrainian dehumanise, violence and stereotype grammar is **not measured**; only its slurs were
hit. Hindi violence and Arabic slurs: **not measured** (no hits on natural text).

### What these numbers do not prove
- TextDetox is balanced 50/50 toxic, so its precision sits above what a natural feed would give.
  Its toxic items are mostly insults at one person, so its recall says almost nothing about group
  rhetoric.
- HateCheck cases are templates. Its dev and test halves share templates, and group names were
  added after reading dev misses, so its test recall is optimistic. It shows that the grammar and
  its negation and counter-speech rules work; it is not an error rate on real replies.
- Chinese COLD precision (75.9%) is the lowest: seven hits on text annotators called safe, several
  of them anti-bias speech that quotes a slur or a stereotype to reject it. Reported speech in
  Chinese is only partly caught (`src/core/rhetoric-mention.js`).
- Recall is low everywhere (1% to 8%). These grammars catch explicit forms only. A reply in these
  languages with no badge has not been checked for subtler rhetoric.
- The English results above are unchanged by these grammars: `scripts/eval.mjs --split test`
  gives the same counts on all four English and French corpora.
- No side comparison was run: none of these corpora labels targets by political direction. The
  symmetry suites (`tests/rhetoric.{ar,ru,uk,zh,hi}.test.js`) hold every template to the same
  result across 19 to 26 targets from every direction, including each camp's coinages for the other.

## Side comparison: closed on HateXplain, open on MHS
Strong-family recall and precision on hostile text aimed at each side's usual targets (test split;
group lists in `evidence/CORPORA.md`). "Before" is the release with the four language grammars;
"after" adds the side-recall terms below. Intervals are Wilson 95%.

| Corpus | | Right-targets recall | Left-targets recall | Right-targets precision | Left-targets precision |
|---|---|---|---|---|---|
| MHS | before | 9.3% (702/7,584; 8.6 to 9.9) | 4.3% (107/2,499; 3.6 to 5.1) | 96.2% (702/730; 94.5 to 97.3) | 93.9% (107/114; 87.9 to 97.0) |
| MHS | after | 10.1% (765/7,584; 9.4 to 10.8) | 7.9% (198/2,499; 6.9 to 9.0) | 95.6% (765/800; 94.0 to 96.8) | 93.8% (198/211; 89.7 to 96.4) |
| HateXplain | before | 43.2% (1,814/4,197; 41.7 to 44.7) | 18.3% (46/251; 14.0 to 23.6) | 98.1% (1,814/1,849; 97.4 to 98.6) | 100% (46/46; 92.3 to 100) |
| HateXplain | after | 45.2% (1,895/4,197; 43.7 to 46.7) | 43.4% (109/251; 37.4 to 49.6) | 98.0% (1,895/1,933; 97.3 to 98.6) | 97.3% (109/112; 92.4 to 99.1) |

The rule for "closed": the side intervals overlap and the point estimates sit within a factor of
1.25. **HateXplain: closed.** Recall is 45.2% against 43.4% (ratio 1.04), and the intervals overlap.
**MHS: not closed.** Left-target recall nearly doubled, from 4.3% to 7.9%, but right-target recall is
still 1.28 times higher, and the intervals (9.4 to 10.8 against 6.9 to 9.0) do not touch. Precision
agrees across sides within the intervals, before and after.

What still drives the MHS gap: two slurs, aimed at gay and Black people, account for most strong
hits on right-target text (MHS dev before this change: sexuality_gay recall 31.5%, race_black 10.7%, gender_women 1.9%). Hostility at the
left's usual targets in MHS is mostly profanity and personal insult beside a group word, with no
slur and no group grammar (read on dev; no corpus text is quoted here), and the documented vocabulary aimed
at Christians, straight people and conservatives is thin and rare in these corpora. Without slurs,
the grammar families find 0.9% of right-target and 1.9% of left-target hostility on MHS, so the
grammar runs the other way. The thread report will still undercount extreme replies in an MHS-like
thread hostile to white people, men, Christians or conservatives, by about a fifth relative to the
other side.

### What was added (tuned on dev, read on test once)
Sources for every term: `evidence/LEXICON-SOURCES.md`, section "English terms added for side recall".
- Slurs: white trash (moved up from the weak list), trailer trash, wigger, whigger, mudshark, cuck,
  cuckservative, soyboy, soy boy, Bible thumper, fundie, Christofascist, papist, Christard.
- Grammar: an identity word fused with a gendered slur ("white bitch", "black hoes", "christian
  whores"), the same fifteen identity words for every direction.
- Group names: incels, and political coinages from both directions (trumptards, trumpanzees,
  rethuglicans, repugnicans, demonrats), so "X are vermin" reads alike whatever X is. Political
  coinages stay group names, not slurs: on Civil dev "libtard" sat on toxic text 4 times in 21 and
  "trumptard" 2 in 6, under the 75% upper-bound rule below. Both directions are treated the same.
- Each new term passed the demotion rule on dev, pooled across MHS, HateXplain and Civil: the upper
  95% bound of its precision is at or above 75%. "white trash" pooled 76/93; "trailer trash" 18/29,
  the closest to the line.
- Considered and left out: redneck and hillbilly (Civil dev 1/10 and 3/12; both are also
  self-names), cracker (food), honky (already demoted), beta male (no derogatory label in the
  dictionary checked), "X are idiots" as a stereotype trait (3 more hits on dev, Civil 2/3).

Precision on Civil, where 8% of comments are hostile: strong-family precision went from 34.6%
(18/52) to 33.8% (23/68), within the interval. The new terms added 16 strong labels on Civil test,
5 of them on toxic text.

### Considered and not shipped: mobilising to punish speech
A stance-neutral family for calls to get someone fired, dox them, find where they work or
mass-report an account ("get him fired", "everyone report this account"). None of the four corpora
labels it. On dev, the narrow phrases matched 4 items in 78,575, one of them a request to report an
account that threatens rape, which is the control case such a family must not flag. "Should be
fired" matched 21 Civil comments, almost all about officials, coaches and police doing their jobs,
which is accountability, not punishment for speech. There is no evidence for its precision, so it is
not in the extension. Status: not measured.

## Changes tuned on dev (2026-10-21)
- Reported speech ("he called X vermin", "compared X to rats") and quoted words are mentions, not
  markers.
- Dehumanise needs grammar now ("X are (filthy) rats", "commie filth", "an infestation of X"). A
  marker word a few words from a group ("women with cancer", "police dogs") no longer counts.
- The echo counts only around a name ("(((them)))"), so ":)))" is not a slur.
- "death to" counts only when it opens a clause. "helicopter rides" counts only as "free helicopter
  rides" or "helicopter rides for X".
- Two slurs whose dev precision had an upper bound under 75% became context-dependent (weight 1):
  "honky" (4/10) and "dindu nuffin" (2/10), one aimed at each side.
- Effect on test, before and after: strong precision MHS 94.0% to 95.6%, HateXplain 90.0% to 91.0%,
  Civil 34.4% to 34.6%. Strong recall MHS 8.8% to 8.4%, HateXplain 46.5% to 45.0%.

## Persuasion techniques (PTC test split, 2026-10-21): none ship
Radar looks for eleven techniques from the SemEval-2020 Task 11 and SemEval-2023 Task 3 taxonomy.
Each is a list of lexical and grammatical cues that name no group, person, party or side
(`src/core/persuasion-cues.js`). The rule, set before measuring: a technique shows in the window
only when its held-out span precision has a 95% Wilson lower bound of at least 0.7 from at least 20
hits. On 2026-10-21 the bar was raised: the point precision must also be at least 80%
(`SHIP_PRECISION`), and whataboutism never shows on one reply (`CONTEXT_ONLY`). **No technique met
the old bar or the new one, so none is shown.**

Why 80% on precision. Published systems score these techniques at F1 of about 30 to 44: LLMs on
SemEval-2023 Task 3 reach 41.0 in Bulgarian, 44.4 in Croatian, 41.9 in Polish, 29.3 in Russian and
29.9 in Slovene, rank below an XLM-R baseline on binary detection, and score near zero on straw man,
whataboutism and red herring, which need context across paragraphs (Jose and Greenstadt, SlavicNLP
2025). At that level a confident label on a stranger's post is wrong more often than right. A
lower bound of 0.7 alone allowed a technique right only 75 times in 100 to show; the point bar of 80%
closes that, and the lower bound keeps a small lucky sample out. Whataboutism needs what the other
side did and said, which one reply does not carry, so no reply-level measurement can clear it. The code, the French cues, the window entries and
the report line are built and tested. They switch on by themselves when a row in `measured.js`
clears the bar. `node scripts/eval-persuasion.mjs` reproduces every number here and records the
SHA-256 of the corpus archive in `evidence/persuasion-results.json`.

How it is measured. PTC's public release labels only its 371 training articles, so those were split
by article with the fixed seed (189 dev, 182 test). A Radar span is correct when it overlaps a gold
span of the same technique. PTC merges some labels: bandwagon is scored against "Bandwagon,
Reductio ad hitlerum" and whataboutism against "Whataboutism, Straw men, Red herring". Cues were
pruned on dev in two rounds. Dev precision of the kept cues was 80.3% for loaded language, 72.2%
for name calling and 65.5% for flag-waving. Test was read once, after that. "Chance" is the share of
word tokens inside a gold span of the technique.

| Technique | Test precision (Wilson 95%) | Recall | Chance | Status |
|---|---|---|---|---|
| loaded language | 60.3% (82/136; 51.9 to 68.1) | 7.9% | 2.3% | held back: lower bound under 0.7 |
| name calling | 48.8% (21/43; 34.6 to 63.2) | 4.4% | 1.1% | held back: lower bound under 0.7 |
| flag-waving | 40.7% (11/27; 24.5 to 59.3) | 12.8% | 0.5% | held back: lower bound under 0.7 |
| exaggeration | 10.0% (1/10; 1.8 to 40.4) | 0.5% | 1.0% | held back: 10 hits |
| bandwagon | 0/3 | 0% | 0.3% | held back: 3 hits |
| doubt | 1/3 | 0.4% | 3.1% | held back: 3 hits |
| appeal to fear | 0/2 | 0% | 1.3% | held back: 2 hits |
| appeal to authority | 0/2 | 0% | 1.2% | held back: 2 hits |
| thought-terminating cliche | 0/1 | 0% | 0.2% | held back: 1 hit |
| whataboutism | 0/1 | 0% | 0.6% | held back: 1 hit |
| black-and-white fallacy | no hits | 0% | 0.5% | held back: no hits |

Reading the table:
- Loaded language, name calling and flag-waving sit 25 to 80 times above chance. The cues find
  the technique. They do not find it with few enough mistakes to label a stranger's post.
- Dev overstated precision by about 20 points for each of the three. Cues kept for doing well on a
  few dev hits did worse on test. A larger tuning set would help more than more cues.
- Post hoc, and not used to ship anything: 80.1% (72.7 to 86.0) of loaded-language spans overlap a
  gold span of some technique. The cues land on persuasive text more often than on the exact label.
- Most techniques almost never appear as fixed phrases in news prose. Bandwagon, fear, cliches,
  whataboutism and black-and-white framing may be more phrase-bound in replies than in articles.
  No labelled reply corpus that Radar may use exists to check that.

Skipped, because a lexical detector cannot find them without world knowledge: slogans (what counts
as a slogan depends on who coined it, so a slogan list would be a list of sides), causal
oversimplification (needs the real causes), straw man (needs the opponent's real position), red
herring (needs to know what is relevant), and repetition (a document-level count, not a span cue).
Ideology labels such as "fascist" or "communist" are not name-calling cues. Whether such a label is
accurate is world knowledge, and the same words are targets in the symmetry test.

French has cues for all eleven techniques and no measurement, because the SemEval-2023 Task 3
French data may be used only inside that shared task (`evidence/CORPORA.md`). A French entry would
show only for a technique that ships, with "not measured in French" beside it.

Symmetry (`tests/persuasion.symmetry.test.js`): 14 English templates across 26 targets and 11
French templates across 24 targets, from every political direction, find the same techniques for
every target. Each target alone finds none. All pass.

Thread report: once a technique ships, the report adds one separate line. It gives the share of
looked-up replies using a shown technique among flagged and among unflagged accounts, each with its
Wilson interval. It never changes "flagged", the extreme comparison or the verdict
(`tests/report.test.js`).

### What the persuasion numbers do not prove
- PTC is news articles from 48 outlets, mostly 2017 to 2019. Replies are shorter and blunter, and
  precision there is not measured. It could be higher or lower.
- PTC's labels are not exhaustive. A true use the annotators did not mark counts as a miss, so
  precision leans low.
- A technique describes how a post argues. It does not say the post is false, or anything about
  who wrote it.

## Organic baselines for the coordination signs (2026-10-21)
Every coordination sign now carries what normal looks like: how often the same sign fired in
ordinary threads, beside the count observed. The window says the baseline's source in the same row.
`node scripts/baselines.mjs` reproduces every number here from the PHEME corpus prepared by
`scripts/eval/prep-pheme.py`, and writes `evidence/baseline-results.json` and
`src/core/baselines-data.js`.

Data. PHEME (Zubiaga et al.), 6,425 Twitter threads from nine 2014 and 2015 news events (Charlie
Hebdo, the Sydney siege, Ferguson, the Ottawa shooting, Germanwings and four smaller ones), CC BY 4.0,
figshare 10.6084/m9.figshare.6392078, archive SHA-256 `079f6ffd...a9bc58dd` (full hash in the results
file). No text from it is committed. Two null models of independent posting run beside it
(`scripts/baselines/nulls.mjs`): reply times drawn on their own at the thread's own pace (a smoothed
bootstrap of its delays), and accounts placed in threads at random with each account's thread count
and each thread's size kept.

| Sign, thread size | Ordinary threads (95% interval) | Independent-posting null |
|---|---|---|
| Same text, 5 to 19 replies | 0.5% (14 of 3,087; 0.3 to 0.8) | |
| Same text, 20 to 49 | 1.4% (20 of 1,384; 0.9 to 2.2) | |
| Same text, 50 to 99 | 3.3% (6 of 181; 1.5 to 7.0) | |
| Same text, 100 or more | 6.7% (4 of 60; 2.6 to 15.9) | |
| Burst, 5 to 19 replies | 1.3% (39 of 3,087; 0.9 to 1.7) | 2.8% |
| Burst, 20 to 49 | 2.2% (31 of 1,384; 1.6 to 3.2) | 3.6% |
| Burst, 50 to 99 | 1.1% (2 of 181; 0.3 to 3.9) | 5.3% |
| Burst, 100 or more | 3.3% (2 of 60; 0.9 to 11.4) | 12.2% |
| Seen together, about 10 threads viewed | 0% (0 of 1,600; 0 to 0.2) | 0% |
| Seen together, about 30 | 0% (0 of 4,800; 0 to 0.1) | 0% |
| Seen together, about 100 | 0.2% (32 of 14,000; 0.2 to 0.3) | 0% |
| Same words in another thread, about 100 viewed | 0.8% of replies of 8 words or more | |

"Seen together" draws 20 random samples of W threads from each event with at least 2W threads. Pairs in
three or more of the same threads, as the feed page lists them: a median of 0 at every W, real and null.

What the baselines changed. Both signs fired far too often on ordinary threads, and both were fixed
before these figures were taken:
- Same text fired on 33.2% to 46.7% of threads by size. Almost every group was replies that copied the
  post they quoted ("RT @outlet: ..." or a quote in curly quotes) or repeated the root post's headline,
  the pattern Luceri et al. (arXiv 2505.10867) found on TikTok. The sign now sets aside quoted text
  (`ownWords` in `src/core/similarity.js`) and shingles shared with the root post. The synthetic cases
  keep 85 of 87 precision and 85 of 85 recall.
- Bursts fired on 11.6% of threads overall and 39% of threads with 50 or more replies. The test
  compared each 20-second window with the thread's average rate, and replies rush in after a post.
  It now compares with the higher of the average and the local pace in the 120 seconds around the
  window (`LOCAL_SEC` in `src/core/timing.js`): 1.6% of threads overall.

What the baselines do not prove:
- PHEME is Twitter in 2014 and 2015, when quoting meant pasting text; it is not a sample of today's X.
- PHEME's threads were not checked for coordination. A baseline is "ordinary as collected", and some
  of its bursts and copies may themselves be coordinated, which would make normal look busier.
- The burst rate on ordinary threads is still above the test's nominal 0.1%, and the independent
  null fires more often than the real threads. A burst is a sign to look at beside its baseline, not
  a finding.
- No labelled set of coordinated threads was used here, so no recall for any coordination sign is
  measured on real data.

## Look-alike letters (2026-10-21)
Text is folded to the Unicode confusables table (UTS #39, version 18.0.0) before the duplicates sign,
the cross-thread fingerprint, claim matching and the rhetoric word lists (`src/core/confusables.js`).
Only words that mix Latin, Cyrillic, Greek, Armenian or Cherokee letters fold, toward the text's main
script when every letter can be read in it, else toward the word's own majority; styled letters
(fullwidth, mathematical, circled) read as plain ones, and invisible splitters are removed.

- Seeded set: 100 copies of generated replies with one letter swapped for a Cyrillic or Greek
  look-alike (`tests/confusables.test.js`). The duplicates sign found 75 of 100 before folding and 100
  of 100 after; the cross-thread fingerprint matches all 100.
- Controls: 17 sentences in Russian, Ukrainian, Serbian, Greek, Arabic, Hindi, Chinese, Armenian,
  Cherokee, Hebrew, Japanese and accented Latin, and mixed English with Russian names, are unchanged.
- Ordinary text: 6 of 96,337 PHEME replies change at all, by fullwidth digits and letters read as
  plain ones and one mixed-script word. The synthetic duplicate cases keep their precision.
- Limit: a lone Russian word quoted inside English text, whose every letter has a Latin look-alike
  ("сор"), folds to Latin. Folding applies only to the copy Radar matches, never to what it shows.

## Named conspiracy theories (2026-10-21): not measured
`src/core/theories.js` extends the conspiracy family with twelve documented theories (QAnon slogans,
adrenochrome, satanic ritual abuse, chemtrails, "Great Reset" plot framing, stolen and rigged
elections, machine and satellite vote-flipping, staged shootings, 9/11 inside job, 5G and COVID-19,
vaccine harm, hidden cures), each with dated sources and its own does-not-prove line. Election and
staged-event claims match both directions; `tests/theories.symmetry.test.js` pairs each right-coded
claim with its left-coded twin (Dominion and Starlink, 2020 and 2016, Sandy Hook and Butler).

No corpus was usable for a precision figure, so the family reads "not measured yet", carries weight
0 and never counts toward "extreme":
- LOCO (Miani, Hills and Bangerter 2021, 96,743 documents, osf.io/snpcg): the OSF project states no
  licence (checked 2026-10-21 through the OSF API: `node_license` is null), so Radar may not use it.
  Asking the authors for a licence is the author's call.
- COCO (Langguth et al. 2023, 3,495 tweets with stance labels over 12 COVID-19 conspiracy topics):
  the release holds tweet IDs only. The text needs hydration through X's API, which Radar does not
  use, and no licence is stated for the labels.
- MM-COVID: labels fake and real news, not conspiracy theories. Its Hugging Face mirror says
  Apache-2.0; the original authors' terms were not confirmed.
No corpus was downloaded for this check.

Context, not a measurement: on the CC0 Civil Comments test split already on disk, the family fired on
10 of 97,320 comments after the debunk, mockery and reported-claim guards (22 before them). The
building agent read those hits and many of them mock or report a theory; no person labelled them.

## Brand look-alike accounts (2026-10-21): not measured
`src/core/brands.js` flags a name that borrows one of 42 platform and outlet brands (each with its
Wikidata item and the X usernames that item lists, queried 2026-10-21) with a word that makes it read
as the brand's own voice. X's affiliation badge, an organisation or government check, and X's parody,
commentary or fan label clear the flag. `tests/brands.test.js` holds synthetic accounts only: 10
look-alikes and 18 controls, among them sub-accounts that carry the affiliation badge. Weak tier:
alone it never counts toward "flagged". No labelled set of impersonation accounts was used, so it
reads "not measured yet". Wikidata lists only some of each outlet's accounts, so a real sub-account
without the badge or a check can trip it.

## Threads
At least one event with threads from opposing sides (for example a protest covered by outlets on
the left and the right), reported per side. Not run yet: it needs the author's labels.

## Privacy
Raw captures hold other people's posts and handles. They stay in `project-docs/evidence/raw/`,
which git ignores. The corpora stay in the data directory, outside the repository. Only counts, rates and hashes are committed.

## Other checks
| Check | Result |
|---|---|
| Unit tests | `npm test` passes |
| Symmetry test | the same sentences score identically for every target; coded slogan pairs score alike |
| Bundle freshness test | fails when `src/core` changes without a rebuild |
| Live X threads | see LIVE-CHECKS.md |
