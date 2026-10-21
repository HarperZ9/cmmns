# Evaluation plan and results

## What is measured
| Detector | Measure | Data |
|---|---|---|
| Rhetoric markers | precision and recall per family, per side, per target group | four public human-labelled corpora (`evidence/CORPORA.md`) |
| Report "extreme" | precision against human severity labels | the same corpora |
| Duplicates | pair precision and recall | SYNTHETIC cases (`scripts/eval/synthetic.mjs`) |
| Mismatch | precision and recall of "speaks as local, labelled elsewhere" | SYNTHETIC cases |
| All four | the same, on live threads | three hand-labelled X threads: pending the author's labelling |

Precision comes first: a badge on a real person's honest reply is the main harm.

## How to reproduce
1. Download the four corpora listed in `evidence/CORPORA.md` to `D:/radar-data/` (or set
   `RADAR_DATA`). Python with pyarrow flattens them on the first run (`scripts/eval/prep.py`).
2. `node scripts/eval.mjs` prints every number below for the test split and rewrites
   `evidence/eval-results.json` and `src/core/measured.js`. `--split dev` prints the tuning split
   and writes nothing.
3. The results file records the SHA-256 of every raw and prepared input.

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

## Threads
At least one event with threads from opposing sides (for example a protest covered by outlets on
the left and the right), reported per side. Not run yet: it needs the author's labels.

## Privacy
Raw captures hold other people's posts and handles. They stay in `project-docs/evidence/raw/`,
which git ignores. The corpora stay in `D:/radar-data/`. Only counts, rates and hashes are committed.

## Other checks
| Check | Result |
|---|---|
| Unit tests | `npm test` passes |
| Symmetry test | the same sentences score identically for every target; coded slogan pairs score alike |
| Bundle freshness test | fails when `src/core` changes without a rebuild |
| Live X threads | see LIVE-CHECKS.md |
