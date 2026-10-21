# Labelled corpora used for the rhetoric evaluation

Downloaded on 2026-10-21 (UTC) to a data directory outside the repository. No corpus text is
committed; only counts, rates and hashes are. `scripts/eval.mjs` records the SHA-256 of each file
in `project-docs/evidence/eval-results.json`.

| Corpus | File | Source URL | Licence | Size | SHA-256 |
|---|---|---|---|---|---|
| Measuring Hate Speech (Kennedy et al. 2020, Sachdeva et al. 2022; UC Berkeley D-Lab) | `mhs/measuring-hate-speech.parquet` | https://huggingface.co/datasets/ucberkeley-dlab/measuring-hate-speech | CC BY 4.0 | 39,565 comments, 135,556 annotations | `0d65ce8c...f87e976` |
| HateXplain (Mathew et al. 2021) | `hatexplain/dataset.json` | https://github.com/punyajoy/HateXplain (Data/dataset.json) | MIT | 20,148 posts | `63bb3340...84967fb` |
| Civil Comments, test split (Jigsaw / Conversation AI; the corpus behind Jigsaw Unintended Bias) | `civil/test.parquet` | https://huggingface.co/datasets/google/civil_comments | CC0 1.0 | 97,320 comments | `410f803f...0d75aa08` |
| MLMA, French part (Ousidhoum et al. 2019) | `mlma/hate_speech_mlma.zip` (`fr_dataset.csv`) | https://github.com/HKUST-KnowComp/MLMA_hate_speech | MIT | 4,014 tweets | `56db7efb...4331956dc43` |

Full hashes are in `eval-results.json`.

Organic baselines for the coordination signs (downloaded 2026-10-21 to `<data dir>/pheme/`; see
`scripts/baselines.mjs`):

| Corpus | File | Source URL | Licence | Size | SHA-256 |
|---|---|---|---|---|---|
| PHEME rumour and non-rumour threads (Zubiaga et al. 2016; Kochkina et al. 2018) | `pheme/PHEME_veracity.tar.bz2` (a gzip tar) | https://doi.org/10.6084/m9.figshare.6392078.v1 | CC BY 4.0 | 6,425 Twitter threads, 96,337 replies with an author and a time | `079f6ffd...a9bc58dd` |

Persuasion techniques (downloaded 2026-10-21 to `<data dir>/ptc/`):

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

## Arabic, Russian, Ukrainian, Chinese and Hindi (downloaded 2026-10-21)

Downloaded to `D:/radar-data/{textdetox,cold,mhc}/`, outside the repository, and flattened by
`scripts/eval/prep-langs.py`. No corpus text is committed. `scripts/eval-langs.mjs` records the
SHA-256 of each file in `project-docs/evidence/lang-results.json`.

| Corpus | Files | Source URL | Licence | Size | SHA-256 |
|---|---|---|---|---|---|
| MLMA, Arabic part (Ousidhoum et al. 2019) | `mlma/hate_speech_mlma.zip` (`ar_dataset.csv`) | https://github.com/HKUST-KnowComp/MLMA_hate_speech | MIT | 3,353 tweets | `56db7efb...1956dc43` |
| TextDetox 2024 multilingual toxicity (Dementieva et al. 2024), splits ar, ru, uk, hi | `textdetox/{ar,ru,uk,hi}.parquet` | https://huggingface.co/datasets/textdetox/multilingual_toxicity_dataset | OpenRAIL++ (the compilation); see below | 5,000 per language, 2,500 toxic | ar `2e3a3e0b...7709ded9`, ru `6466a13f...7fb3d311`, uk `5eb28962...e10cd798`, hi `36800d82...edc70402` |
| COLD, test split (Deng et al., EMNLP 2022) | `cold/test.csv` | https://github.com/thu-coai/COLDataset | Apache-2.0 | 5,323 comments | `b06d3148...7fbe78ed` |
| Multilingual HateCheck (Röttger et al., WOAH 2022), Arabic, Hindi, Mandarin | `mhc/{arabic,hindi,mandarin}.csv` | https://huggingface.co/datasets/Paul/hatecheck-arabic (and -hindi, -mandarin) | CC BY 4.0 | 3,570 / 3,565 / 3,378 cases | `134d39c3...0ece1bee`, `ffebc31d...e5d8bd40`, `d094336d...4a147414` |

**TextDetox licence chain.** The compilers release the compilation under OpenRAIL++, a licence with
use restrictions and no bar on evaluation. Each split is drawn from earlier corpora with their own
terms: Russian from two Kaggle datasets (Russian Language Toxic Comments; Toxic Russian Comments),
Ukrainian from the compilers' own ukr-toxicity-dataset (OpenRAIL), Arabic from OSACT4, Hindi from
the CONSTRAINT 2021 hostility data and HASOC 2019. HASOC was distributed by registration with its
organisers. Radar uses the public compilation for counts only and commits no text; whether that
use sits well with each original's terms is an author item (below). The Chinese split names no
source on its card, so it is not used.

**Label mapping** (code: `scripts/eval/lang-corpora.mjs`).
- MLMA Arabic: as the French part. `hostile` unless "normal" is the only label; `severe` when
  "hateful" is among them.
- TextDetox: `hostile` is the binary `toxic` label. The splits are balanced 50/50, so precision on
  them reads higher than it would at a natural base rate, and most toxic items are insults at one
  person, not at a group, so recall against them says little.
- COLD: `hostile` is label 1 (offensive). `groupAttack` is fine-grained label 2, "attack group".
- Multilingual HateCheck: `hostile` is `label_gold` "hateful". `dehumanise` is the functionality
  `derog_dehum_h`, `violence` is `threat_dir_h` or `threat_norm_h`, `slur` is `slur_h`; each is
  false on non-hateful cases and unlabelled on other hateful cases. The cases are built from
  templates and validated by annotators, so they test grammar, not real replies. The dev and test
  halves share templates, so tuning on dev carries over to test more than it would on real text.

**Not used.**
- HASOC (Hindi, FIRE 2019 to 2021) and OSACT5 (Arabic fine-grained hate, 2022) direct downloads:
  both are distributed through the organisers with a registration step. Registering is the
  author's call.
- ToxiCN (Chinese, ACL 2023): CC BY-NC-ND 4.0 and "prohibited from commercial use".
- RuToxic and the Kaggle Russian sets directly: they need a Kaggle account; the TextDetox
  compilation carries the same comments.
- No human-labelled Ukrainian hate-speech corpus aimed at groups was found with a usable licence;
  TextDetox Ukrainian is general toxicity.

**Author items.** (1) Decide whether to register for HASOC and OSACT5, which would give Hindi and
Arabic group-level labels. (2) Decide whether evaluation-only use of the TextDetox compilation is
acceptable given its sources' original terms (Kaggle, OSACT4, HASOC 2019).

## Hebrew, Turkish, Korean, Japanese, Persian, Indonesian, Hindi (downloaded 2026-10-21)

These corpora feed the derived word lists. `scripts/derive-lexicon.mjs` picks every term from
their dev split; nobody types the lists. Downloaded to `D:/radar-data/<dir>/`, outside the
repository, and flattened by `scripts/eval/prep-derived.py`. No corpus text is committed.
`project-docs/evidence/derived-lexicon.json` records the SHA-256 of each prepared file.

| Corpus | Files | Source URL | Licence | Size | SHA-256 |
|---|---|---|---|---|---|
| OLaH (Litvak et al., LREC 2022; filtered release for the detoxification project), Hebrew | `olah/OLaH-dataset-filtered.xlsx` | https://github.com/NataliaVanetik/HebrewOffensiveLanguageDatasetForTheDetoxificationProject | MIT | 2,011 texts | `214b23fc...cab8ecd5` |
| OffensEval 2020 Turkish (Çöltekin, LREC 2020), Turkish | `offenseval-tr/offenseval2020-turkish.zip` | https://coltekin.github.io/offensive-turkish/ | CC BY (README; the dataset card says CC BY 2.0) | 35,284 tweets | `7977e962...0ec9c2f2` |
| TurkishHateMap (Altinok), 12 topics, Turkish | `turkishhatemap/<topic>/{train,valid,test}.jsonl` | https://huggingface.co/datasets/turkish-nlp-suite/TurkishHateMap | CC BY-SA 4.0 | 52,175 entries | all files concatenated in path order `9065246a...08e5d7c1` |
| K-MHaS (Lee et al., COLING 2022), Korean | `kmhas/kmhas_{train,valid,test}.txt` | https://github.com/adlnlp/K-MHaS (licence on https://huggingface.co/datasets/jeanlee/kmhas_korean_hate_speech) | CC BY-SA 4.0 | 109,692 comments | `ca9145af...eb0e7008`, `cb0df9e3...ae469c18`, `9eaf470e...17a2051a` |
| BEEP! Korean HateSpeech (Moon et al., SocialNLP 2020), train and dev, Korean | `beep/{train,valid}.parquet` | https://github.com/kocohub/korean-hate-speech (mirror https://huggingface.co/datasets/nayohan/korean-hate-speech) | CC BY-SA 4.0 | 8,367 comments | `28898b26...92f258a0`, `f20d00f3...55fdee07` |
| NSMC, Naver movie reviews (reference text only; the sentiment label is unused), Korean | `nsmc/ratings.txt` | https://github.com/e9t/nsmc | CC0 1.0 | 199,992 reviews | `7d1d8e66...506e1256` |
| LLM-jp Toxicity Dataset v2, Japanese | `llmjp/toxicity_dataset_v2.jsonl` | https://gitlab.llm-jp.nii.ac.jp/datasets/llm-jp-toxicity-dataset-v2 | CC BY 4.0 | 3,847 web texts | `fcbe2382...c460e574` |
| inspection-ai Japanese toxicity subset, Japanese | `inspection-ja/subset.csv` | https://github.com/inspection-ai/japanese-toxic-dataset | Apache-2.0 | 436 sentences | `9320c51c...d4736148` |
| Persian offensive language (Kebriaei et al., Machine Learning 2024), Persian | `persian-off/persian_{train,test}.xlsx` | https://github.com/EKebriaei/Persian-Offensive-Language-Dataset | CC BY 4.0 (README) | 37,868 tweets | `6e3e18df...1c78da9b`, `8ffdcfa7...fe7a0777` |
| IndoDiscourse, formerly IndoToxic2024 (Susanto et al. 2025), Indonesian | `indodiscourse/indotoxic2024_annotated_data_v2_final.jsonl` | https://huggingface.co/datasets/Exqrch/IndoDiscourse | Apache-2.0; the card adds "for research purposes only" | 28,447 texts | `94bb4354...2c7334e7` |
| IDHSD (Alfina et al., ICACSIS 2017), Indonesian | `idhsd/IDHSD_RIO_unbalanced_713_2017.txt` | https://github.com/ialfina/id-hatespeech-detection | Free use without permission; no public copies (README) | 713 tweets | `4ee1d9cc...75f1d4ed` |
| TextDetox Hindi and Multilingual HateCheck Hindi, Hindi | as in the section above | | | | |

**Label mapping** (code: `scripts/eval/derived-corpora.mjs`). `hostile` is each corpus's broad
label. `group` is hate aimed at a group, used to derive and to clear the dev bar.
- OLaH: `hostile` is the 0/1 offensive label. No group label.
- OffensEval Turkish: `hostile` is OFF. No group label.
- TurkishHateMap: `hostile` is offensive or hate; `group` is hate; the topic is the target.
- K-MHaS: `hostile` is any class but not-hate; `group` is origin, politics, age, gender, race or
  religion. Profanity alone and physical appearance (remarks on one person's looks) are hostile only.
- BEEP!: `hostile` is offensive or hate; `group` is hate. Its test part has no public labels.
- LLM-jp: `hostile` is "toxic"; `group` is "discriminatory".
- inspection-ai: `hostile` when Toxic and Very Toxic votes outnumber Not Toxic and Hard to Say;
  `group` when more than half the annotators chose discrimination (差別).
- Persian: `hostile` is class 1 or 2; `group` is class 2, whose suffix names the target (religion,
  nationality, race and ethnicity, guild).
- IndoDiscourse: majority vote of each label list, ties unlabelled, spam dropped; `hostile` is
  toxicity, `group` is identity attack.
- IDHSD: `hostile` and `group` are both HS.
- TextDetox Hindi: `hostile` is toxic. No group label. HateCheck Hindi is measured, never derived from:
  its dev and test cases share templates.
- No corpus labels the political direction of a target, so side precision cannot be computed;
  per-target recall is reported where targets are labelled.

**Looked at, not used.**
- Hebrew: the Offensive Hebrew Corpus (Hamad et al. 2023, SinaLab) has hate, violence and target
  labels on 15,881 tweets, but is CC BY-NC-SA 4.0. The TextDetox Hebrew split is OLaH again.
  HebrewOffensiveLanguageByTaxonomy (CC0) has 450 Facebook comments with target labels in an
  annotation-tool format; small, kept as a next step. The hand-made Hebrew word lists in the OLaH
  repository are not used, since Radar's lists come from labels only.
- Turkish: Toraman et al.'s large-scale Turkish hate speech sets are CC BY-NC-SA 4.0. The
  nanelimon bullying set gives no annotation method.
- Japanese: the TextDetox Japanese split was labelled by the Perspective API, not by people.
- Persian: PHate (AAAI 2024) has targets and rationales but no licence in its repository.
  Naseza (CC0) does not describe how its labels were made. PHOND points to a data availability statement.
- Indonesian: Ibrohim and Budi's multi-label hate speech corpus has target and strength labels but
  is CC BY-NC-SA 4.0. haipradana/indonesian-twitter-hate-speech-cleaned relabels that corpus as
  Apache-2.0, which its source does not allow. The Indonesian hate speech superset is gated.
- Hindi: the CONSTRAINT 2021 hostility data asks the downloader to agree to research-only use;
  HASOC needs registration. TextDetox carries both.

**Author items.** (3) Decide on the non-commercial corpora above (Offensive Hebrew Corpus,
Toraman et al., Ibrohim and Budi), which would give Hebrew, Turkish and Indonesian group-level
labels. (4) Decide whether a derived list may ship from IndoDiscourse, whose card adds "research
purposes only" to Apache-2.0. (5) Decide whether to agree to CONSTRAINT's terms or register for
HASOC for Hindi group labels.
