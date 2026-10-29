<!-- writing-profile: research -->
# Discourse checks

Five checks for ordinary posts, built from the X discourse study of 2026-10-25 (16 posts and 11
saves; the study sits outside this repository). Most of what could be checked in that set was a
quotation or a source, not a false event: a list of sayings pinned on famous names, a viral story
with added detail, an inference about a legal letter that the letter does not support. These checks
make that work a click instead of an afternoon.

All five sit behind one switch in the options, **Discourse checks**, off by default. Everything runs
on the device: the data ships inside the extension and nothing is sent anywhere. Every sign is info
level and says what it does not prove. Each finished analysis can be saved with its post as a study
item (below).

| Check | Sign family | Code | Data |
|---|---|---|---|
| Where a quote comes from | `quote-source`, `quote-list` | `src/core/discourse/quotes.js` | `src/ext/discourse/quotes.json` |
| Accounts named after someone who died | `persona` | `src/core/discourse/persona.js` | `src/ext/discourse/persons.json` |
| A count and its sample size | `sample-size` | `src/core/discourse/stats.js` | none |
| A post's words against the pages it shows | `doc-claim` | `src/core/discourse/docclaim.js` | the text recogniser (`src/ocr/`) |
| Replies that bring a source | `correction-replies` | `src/core/discourse/corrections.js` | none |

`src/core/discourse/cards.js` turns results into window signs. The modules build into
`src/ext/discourse.bundle.js` (global `PBD`). `src/ext/discourse-bg.js` holds the data in the
background worker, checks it against its signature on first use and drops it after five minutes
idle. `src/ext/discourse.js` asks for quotes and names, reads counts and replies on the page, and
adds the signs to the window through `src/ext/signals.js`.

## Quote finder

A line in quotation marks of five words or more, or a post that is one line with a name on it, is
looked up in three places, in this order:

1. **Misattributions** (`data/discourse/misattributions.json`): 12 quotes commonly credited to
   someone who, by a cited investigation, did not say them. Each entry names its source (Quote
   Investigator, PolitiFact, the Los Angeles Review of Books).
2. **Attested quotes** (`data/discourse/attested.json`): quotes from works the index does not hold,
   attested by a cited source. One entry so far: Dostoevsky's letter of 22 December 1849. The 1914
   English edition in the index abridges that letter and leaves the line out.
3. **The index** (`src/ext/discourse/quotes.json`, 3.5 MB): 8,681 passages from 11 public-domain
   works. Matching folds older English ("thyself", "doth") into modern words, strips light suffixes
   and weighs each word by how rare it is in the index. **Found** means the words, or nearly all of
   them in order, are in the passage. **Close paraphrase** means at least 60% of the quote's
   meaning, weighted by rarity, and at least three of its rarer words with some word pairs in order.
   Anything less is **not found**, which says where it looked and that this proves nothing.

A list of three or more "Name: words" lines is counted instead: lines, names CMMNS knows,
lines with any source, and lines too short to look up. The study's "What is life?" list reads "13
lines credited to names, 0 sourced".

**The works.** Marcus Aurelius in George Long's translation (1862) and Meric Casaubon's (1634);
Schopenhauer's Wisdom of Life, Counsels and Maxims and Studies in Pessimism (T. Bailey Saunders);
Nietzsche's Thus Spake Zarathustra (Thomas Common) and Beyond Good and Evil (Helen Zimmern); Plato's
Apology (Benjamin Jowett); Dostoevsky's Notes from the Underground (Constance Garnett) and letters
(Ethel Colburn Mayne, 1914; machine-read by the Internet Archive, so a word can be misread); Epictetus
(George Long). Every translator died before 1956 and every translation was published before 1931,
so each is in the public domain in the United States and under a term of life plus 70 years.
`tests/discourse.data.test.js` holds both rules. Only the work's own text is indexed: translators'
prefaces and notes by other hands are cut by begin and end markers in `data/discourse/texts.json`.

**Left out on purpose.** Mein Kampf in James Murphy's translation is public domain in some countries
and not in others, so it is not indexed. The study's quote from it (Volume I, Chapter IV) was checked
by hand against a copy outside the repository. Translations made after 1930, such as most modern
Meditations, are not indexed either, so their wordings find Long's or Casaubon's passage only when
the meaning words overlap.

### Measured

`node scripts/eval-discourse.mjs` scores the labelled sets in `tests/fixtures/discourse/`. Precision
comes first: a wrong "found" sends a reader to the wrong source.

| Set | Claimed found or close, right | Should be found, found | Not in the index, wrongly found | Curated lists |
|---|---|---|---|---|
| Development (36 cases; the rules were tuned on it) | 14 of 14 (95% interval 79 to 100%) | 14 of 15 | 0 of 12 | 9 of 9 |
| Held out (16 cases, labelled after the rules froze, scored once) | 8 of 8 (68 to 100%) | 8 of 11 | 0 of 5 | none |

Results: `project-docs/evidence/discourse-eval.json` and `discourse-eval-heldout.json`; a test fails
if they drift from a fresh run. The misses are modern paraphrases that share few words with the old
translation ("Waste no more time arguing about what a good man should be", "Very little is needed to
make a happy life"). Sixteen held-out cases is small: the interval on precision runs from 68% to
100%.

## Persona marker

An account's display name is matched against the names and aliases of 2,608 people with at least 70
Wikimedia site links who have died (Wikidata, CC0, `data/discourse/persons.sparql`, run on the QLever
endpoint on 2026-10-25). It shows only with a second cue: the handle carries the name (one letter of
slack for six letters or more, so "LeoTollstoy" counts), or the display name adds a word that says
what the account is ("Quotes", "Daily", "Literature", "Fan", "Parody"). On X it adds what the
checkmark means since 2023: a paid subscription, not identity.

**It never marks a living person.** The build drops any name that another person in Wikidata
shares, as a label or an alias, when that person was born in 1900 or later or lacks a birth or death
date; and any name two listed people share. That drops 6,588 names. It costs some real cases:
"Marcus Aurelius" is dropped because Wikidata holds another person of that name with no dates, and
"Socrates" and "Isaac Newton" because living people share them. `tests/discourse.persona.test.js`
checks that living people from the study and common names are neither on the list nor marked, and
that a display name alone never marks anyone.

## Counts and their sample size

"45/50", "8 of 47", "62% of 1,200" and "n = 40" get a Wilson 95% interval, the same interval CMMNS
prints for its own figures. Two counts with the same denominator are read as two arms and
compared. A count under 30 says one more or one fewer moves the figure a lot. Fractions that look
like dates or scores are left alone unless a count word follows ("replies", "people", "patients").
Counts in an image are read too once the user has had CMMNS read that image.

## Document pages against the post

On a post that shows images and talks about a letter, a filing or a report, the window offers to
read every image (with "Read text in images" on) and compare. The post's key terms are its quoted
phrases, names, amounts, two-word phrases of longer words and its longer words. Each is reported as
on the pages shown, with the image number and the line around it, or not on them. Phrases must
appear whole; a long word may be one letter off, for the recogniser's slips. Images over 2,400 pixels
a side are scaled down to read, as before.

On the study's demand letter (six pages in four images), CMMNS's recogniser read each image at a
confidence between 0.987 and 0.994. "Classified information", "security clearances", "illegal
access" and "admitting" are on none of them; the name in the post is on images 1 and 3
(`project-docs/evidence/discourse-letter-check.json`). The single word
"classified" is on one page, in "would certainly not be classified as a defender", which is why the
check shows the line around every single word it finds. This is the check's main limit: it compares
words, and a word can appear in another sense or an idea in other words.

## Correction replies

Among the replies the page loaded, a reply is raised when it links a primary record or a reference
work and shares a word with the post, quotes a passage of 40 characters or more and shares two words
with the post, or names an error ("not true", "misattributed", "in fact", "according to") and shares
two words with the post. Raised replies are ranked by the kind of source (primary record, reference
work, other page; social posts count for nothing), then by how specifically they answer the post,
then by page order. The poster's own replies are left out. Likes and followers are never read.

**Stance-neutral.** No word list names a party, an ideology or a side, and a test fails if one does.
`tests/discourse.symmetry.test.js` swaps the sides of fixture threads (left and right, party names,
ideologies, named figures) and requires the same ranking and scores. The first version failed it:
a minimum word length of five letters treated "left" and "right" differently. It is four now.

## Study items

Each discourse sign carries a **Study** row: "Save the post with this analysis for study". It saves
the post as a study note (`daylight.sidecar/1`, `study: true`, in `Downloads/<save folder>/study/`)
through the same path as the Study button, with every finished analysis on the post as its own
`## Analysis: <label>` section and an `analysis` field listing the sign families
(`project-docs/SIDECAR-FORMAT.md`). The reference library reads study items first.

## The parts tree

A study save also writes `<name>.parts.json` beside the note: the same results as a parts tree in the
reference library's study format (`refdb.parts/1`: concept, layer, part, property, each property
labelled observed, measured or inferred, with its method). `src/core/discourse/parts.js` builds it.
Layers are quotes, document pages, counts, correction replies and account. A claim study is then the
same kind of object as an art study and joins the same concept layers. The library's shared schema
document was still being written on 2026-10-26; this follows the format its studies already use, and
will follow the schema when it lands.

## Truth as sheets

The correction sign offers "Open the post and what lies under it as sheets" (`src/ext/sheets.html`).
The post is the top sheet, the replies that bring a source lie beneath it, and the primary documents
they link are the ground. Each sheet's ink band is as wide as its reach, the views the site showed,
as a share of the most-seen sheet, so a claim seen 230,300 times covers a correction seen 627 times
(0.27% inked). "Lift to see under it" moves the sheets above out of the way. The reach figure is
written beside every band, so the reading never depends on the ink.

- **One compositing engine.** The colour at each depth comes from the workspace medium's sheet engine
  (`composite`, copied unchanged into `src/core/discourse/sheets.js`): each sheet carries its own law,
  and every sheet here uses the same one, weber (Albers XX-1, a = 29.75). With `SUPERFRAME_SHEETS`
  pointing at the medium's module, `tests/discourse.sheets.test.js` checks both give the same colours
  under all four laws; the copy matched to nine decimal places on 2026-10-26.
- **Ink by sourcing only.** A post that links a primary record or a reference work prints in the
  canon's verified ink, one that does not in drift, whoever wrote it and whatever it says. A document
  prints no ink: it has no reach figure, so it is the ground.
- **Many outlets, one origin.** Replies that cite the same source are one sheet, labelled with how
  many replies carry it: one witness, however many voices repeat it. The page states the count of
  replies against the count of independent sources. This is the metamer of independence: different
  posts, one origin, the same readout.
- **Reach never ranks.** Views decide only how wide a band is drawn. The correction ranking reads no
  likes, views or followers.

## Browser check

`scripts/qa/discourse_shot.py` runs the packaged extension in Chrome on the demo stage's discourse
thread (`scripts/demo/stage.mjs`, every account invented): persona on the root, quote found in
Counsels and Maxims, the Meditations paraphrase placed at Book VIII, 36, the correction raised, the
counts with intervals, the list counted, the misattribution named, and a study save written. All nine
passed on 2026-10-25 against the 3.6.1 base. On 2026-10-26 the check added the sheets page (drawn, a
sheet lifts) and a thread shaped like the author's worked example (a 230,300-view claim, a 627-view
correction linking the declassified assessment): see the readiness rows for the result.

## Rebuilding the data

```
node scripts/discourse-data.mjs fetch    # download the texts; each checked against its pinned SHA-256
node scripts/discourse-data.mjs query    # run the Wikidata queries
node scripts/discourse-data.mjs texts    # src/ext/discourse/quotes.json
node scripts/discourse-data.mjs persons  # src/ext/discourse/persons.json
node scripts/discourse-data.mjs sign     # the project key signs both (key outside the repository)
node scripts/discourse-data.mjs check    # in CI: a fresh build matches (skipped without the cache)
```

The cache (`.cache/discourse`, or `DAYLIGHT_DISCOURSE_CACHE`) is never committed. Wikidata changes
daily, so a later query gives a different list; the date of the run is in
`data/discourse/persons-meta.json`.

## What the checks do not prove

- A found quote is in the passage cited, in one translation. It does not show the person meant what
  the post says.
- Not found proves nothing: the index holds 11 works.
- A persona name shows only that the name belongs to someone who died. Fan pages and tributes use
  such names openly.
- An interval says nothing about how a sample was chosen.
- A word missing from the pages shown does not mean the document never says it.
- A raised reply can be wrong. The ranking is by the kind of source, not by who is right.
- A sheet's width is reach, not truth: a wide sheet was seen more, nothing else.
- None of the five has been measured on real threads. The quote finder's figures are on labelled
  sets of 36 and 16 quotes.
