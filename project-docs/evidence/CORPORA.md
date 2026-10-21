# Labelled corpora used for the rhetoric evaluation

Downloaded on 2026-10-21 (UTC) to `D:/radar-data/`, outside the repository. No corpus text is
committed; only counts, rates and hashes are. `scripts/eval.mjs` records the SHA-256 of each file
in `project-docs/evidence/eval-results.json`.

| Corpus | File | Source URL | Licence | Size | SHA-256 |
|---|---|---|---|---|---|
| Measuring Hate Speech (Kennedy et al. 2020, Sachdeva et al. 2022; UC Berkeley D-Lab) | `mhs/measuring-hate-speech.parquet` | https://huggingface.co/datasets/ucberkeley-dlab/measuring-hate-speech | CC BY 4.0 | 39,565 comments, 135,556 annotations | `0d65ce8c...f87e976` |
| HateXplain (Mathew et al. 2021) | `hatexplain/dataset.json` | https://github.com/punyajoy/HateXplain (Data/dataset.json) | MIT | 20,148 posts | `63bb3340...84967fb` |
| Civil Comments, test split (Jigsaw / Conversation AI; the corpus behind Jigsaw Unintended Bias) | `civil/test.parquet` | https://huggingface.co/datasets/google/civil_comments | CC0 1.0 | 97,320 comments | `410f803f...0d75aa08` |
| MLMA, French part (Ousidhoum et al. 2019) | `mlma/hate_speech_mlma.zip` (`fr_dataset.csv`) | https://github.com/HKUST-KnowComp/MLMA_hate_speech | MIT | 4,014 tweets | `56db7efb...4331956dc43` |

Full hashes are in `eval-results.json`.

Persuasion techniques (downloaded 2026-10-21 to `D:/radar-data/ptc/`):

| Corpus | File | Source URL | Licence | Size | SHA-256 |
|---|---|---|---|---|---|
| Propaganda Techniques Corpus v2 (Da San Martino et al. 2019; SemEval-2020 Task 11) | `ptc/datasets-v2.tgz` | https://zenodo.org/records/3952415 | CC BY 4.0 | 371 labelled training articles (6,129 technique spans), 75 unlabelled dev articles | `fd2d2c35...8a8516bb` |

Only the training articles carry gold labels in this release. Radar splits them by article with the
seed below (`scripts/eval/ptc.mjs`). The shared task's own dev and test articles have no public gold
labels and are not used.

Not used:
- SemEval-2023 Task 3 (persuasion techniques in nine languages, French among them). Access needs a
  registration form and an organiser-issued passcode. Its terms say the data "may only be used in
  the context of this shared task, and only for scientific research purposes" and may not be
  redistributed. Registering and accepting those terms is the author's call, and tuning a shipped
  product falls outside that use, so it was not requested.
- The Kaggle release of Jigsaw Unintended Bias (with identity columns) needs a Kaggle account and
  acceptance of competition rules. Accepting terms is the author's call, so the CC0 Civil
  Comments release (same comments, no identity columns) stands in for it.
- CONAN: its hate side was written by NGO operators as seeds for counter-speech, not collected
  from users, and its licence terms need checking. MLMA is the French source.

## Label mapping
Every decision below lives in code in `scripts/eval/corpora.mjs`.

**Measuring Hate Speech.** Each comment has several annotators. The survey items run 0 to 4, with
4 the most hateful. A family counts as present when the median annotator is at "agree" (3) or
above.
- `dehumanise`: the `dehumanize` item.
- `violence`: the `violence` item or the `genocide` item.
- `stereotype`: the `status` item ("the comment says the group is inferior"). This is the closest
  item; it is broader than Radar's "<group> are <trait>" grammar.
- `hostile` (the broad label): IRT `hate_speech_score` above 0.5 (the authors' reading of "hate
  speech"), or a median of 3 or more on any of insult, humiliate, status, dehumanize, violence,
  genocide.
- `severe` (for "extreme"): `hate_speech_score` above 0.5.
- Target groups: a target counts when more than half of a comment's annotators chose it. The
  `*_other` targets are dropped.

**HateXplain.** Three annotators per post, each choosing hatespeech, offensive or normal.
- `hostile`: at most one annotator chose normal.
- `severe`: at least two chose hatespeech.
- Targets: a target counts when two of three annotators chose it; "None" and "Other" are dropped.
- No family-specific labels.

**Civil Comments.** Each label is the share of raters who chose it; Jigsaw's threshold is 0.5.
- `hostile`: toxicity, identity_attack or threat at 0.5 or above.
- `violence`: threat at 0.5 or above.
- `severe`: none. severe_toxicity almost never reaches 0.5 here.
- No target groups in this release.

**MLMA French.** One label set per tweet (abusive, hateful, offensive, disrespectful, fearful,
normal).
- `hostile`: any label other than normal alone.
- `severe`: "hateful" among the labels.
- Targets: the `group` field; "other" and "individual" are dropped.
- 79% of the tweets are hostile, so precision there says little; it is reported for completeness.

## Sides
"Groups the right is often hostile to" (right-targets): Black, Latinx, Middle Eastern and Native
American people, Muslims, atheists, immigrants, migrant workers, undocumented people, women,
non-binary and trans people, gay, lesbian and bisexual people, and leftists, liberals, Democrats,
communists, socialists and Greens. HateXplain: African, Islam, Arab, Refugee, Hispanic,
Homosexual, Women, Indigenous, Minority, Nonreligious, Bisexual, Asexual. MLMA: african_descent,
arabs, immigrants, muslims, refugees, left_wing_people, hispanics, gay, women.

"Groups the left is often hostile to" (left-targets): white people, Christians, Mormons, men,
straight people, conservatives, Republicans, the alt-right and libertarians. HateXplain:
Caucasian, Christian, Men, Heterosexual, Economic. MLMA: christian.

"Both" (left out of the side comparison, reported per group): Jewish people (hostility comes
from both directions), Asian people, Hindus, Buddhists, disability, age and nationality targets.

These assignments are a judgment about where hostility usually comes from in Western online
discourse. They are not a claim about any person. Moving women or Jewish people to another
column changes the side totals, and the per-group table in `eval-results.json` lets a reader
check that.

## Split
Each item's split is the low bit of FNV-1a over `radar-eval-2026-10-21|<corpus>|<id>`: fixed,
about 50/50, and independent of the labels. Threshold and lexicon changes were tuned on `dev`;
`test` was read once, after tuning, for the committed numbers.
