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

## Results (test split, 2026-10-21, with the Spanish, German, Portuguese and Italian grammars merged)
"P(hostile)" is the share of marker hits on text the annotators judged hostile to a group. The
pooled figure combines Measuring Hate Speech (MHS), HateXplain and Civil Comments. The range runs
from the lowest to the highest corpus with at least 20 hits. "P(item)" and "R(item)" use MHS's own
survey item for that family. Intervals are Wilson 95%.

| Family | P(hostile), pooled | Range across corpora | P(item), MHS | R(item), MHS |
|---|---|---|---|---|
| dehumanise | 92.3% (36/39; 79.7 to 97.3) | under 20 hits in each corpus | 57.9% (11/19; 36.3 to 76.9) | 0.2% (11/5,046; 0.1 to 0.4) |
| violence | 87.5% (77/88; 79.0 to 92.9) | MHS 96.7% (59/61); Civil 3/9 | 63.9% (39/61; 51.4 to 74.8) | 2.1% (39/1,819; 1.6 to 2.9) |
| vigilante | 2 of 3 hits | not measured (3 hits) | no item | no item |
| slur | 91.8% (3,682/4,009; 91.0 to 92.7) | Civil 35.5% (11/31) to MHS 96.0% | no item | not measured |
| stereotype | 83.3% (80/96; 74.6 to 89.5) | MHS 91.7% (66/72); Civil 3/9 | 70.8% (51/72; 59.5 to 80.1) | 0.6% (51/8,368; 0.5 to 0.8) |
| any strong family | 91.5% (3,839/4,197; 90.6 to 92.3) | Civil 34.6% (18/52) to MHS 95.6% | | |
| slurSoft (weak) | 66.6% (908/1,363; 64.1 to 69.1) | Civil 20.6% to MHS 91.9% | | |
| contempt (weak, new) | 92.0% (92/100; 85.0 to 95.9) | HateXplain 93.1%, MHS 91.4% | | |
| motive (weak) | 72.5% (29/40; 57.2 to 83.9) | MHS 81.8% (18/22) | | |
| essentialise (weak) | 57.8% (59/102; 48.1 to 67.0) | Civil 25.8% to HateXplain 75.0% | | |
| absolutist (weak) | 50.7% (137/270; 44.8 to 56.7) | Civil 32.9% to HateXplain 84.2% | | |
| conspiracy (weak) | 28.8% (34/118; 21.4 to 37.6) | Civil 3.6% (3/84) | | |

Strong families (dehumanise, violence, vigilante, slur, stereotype) label the post. Weak ones only
count toward "extreme".

**Report "extreme"** (`EXTREME_AT` = 2). Against MHS `hate_speech_score > 0.5`: precision 72.6%
(794/1,093; 69.9 to 75.2), recall 15.2% (794/5,224; 14.3 to 16.2). Against HateXplain's majority
"hatespeech": precision 61.9% (1,897/3,063; 60.2 to 63.6), recall 62.9% (1,897/3,016; 61.2 to 64.6).
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
  Comments, where 8% of comments are hostile, about a third of strong labels fell on text the raters
  called toxic. Real reply threads sit somewhere between. Some Civil "false positives" are quoted or
  ironic uses that raters scored below 0.5, so 35% is a floor more than a point estimate.
- **Recall.** Radar is a hand-built lexicon and grammar. It finds a small share of hostile text: MHS
  item recall is under 3% for every family. A thread with no markers is not a clean thread.
- **Weak families.** Conspiracy, absolutist and essentialise describe framing, which these corpora
  do not label. Their figures against hostility labels are context, not error rates.
- **Extreme.** The thread report is only as good as "extreme". At 15% recall on MHS, most severe
  replies do not count as extreme.
- **Synthetic.** The duplicate and mismatch figures come from cases written alongside the rules. No
  person other than the rules' author, and no model, labelled them.

## Side comparison: an open defect
Strong-family recall and precision on hostile text aimed at each side's usual targets (test split;
group lists in `evidence/CORPORA.md`):

| Corpus | Right-targets recall | Left-targets recall | Right-targets precision | Left-targets precision |
|---|---|---|---|---|
| MHS | 9.3% (702/7,584; 8.6 to 9.9) | 4.3% (107/2,499; 3.6 to 5.1) | 96.2% (702/730; 94.5 to 97.3) | 93.9% (107/114; 87.9 to 97.0) |
| HateXplain | 43.2% (1,814/4,197; 41.7 to 44.7) | 18.3% (46/251; 14.0 to 23.6) | 98.1% (1,814/1,849; 97.4 to 98.6) | 100% (46/46; 92.3 to 100) |

Precision agrees across sides within the intervals. **Recall does not.** Radar finds hostility aimed
at white people, men, Christians and conservatives at about half the rate of hostility aimed at the
right's usual targets. The thread report will undercount extreme replies in a thread hostile to the
first group.

The slur family causes it. Without slurs, the grammar families find 0.9% (65/7,584) of right-target
hostility against 1.9% (47/2,499) of left-target hostility on MHS. That is a smaller gap in the other
direction, and it is also a defect. On HateXplain they find 0.6% against 0% (0/251). Hostility aimed
at minorities uses established slurs more often, and the lexicon holds more of them. Per-group
recall is in `evidence/eval-results.json` (for example MHS race_black 11.8%, race_white 5.9%,
sexuality_gay 29.6%, religion_christian 1.9%, religion_muslim 2.8%).

Changes made on dev to address it: group terms from both sides; a declared-contempt grammar ("I hate
X", "fuck all the X") as a weak family, the same for every target; death-wish and genocide calls;
"cracka" and "white devil" added. On test the gap did not close: MHS left-targets recall moved from
4.4% to 4.3%, and HateXplain stayed at 18.3%. The defect stays open until a change closes it on dev
and the test split confirms it. The likely next step is a human-reviewed list of slurs and coded
insults aimed at the left's usual targets, and a check that the grammar gap on MHS is not an
artefact of the side lists.

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
