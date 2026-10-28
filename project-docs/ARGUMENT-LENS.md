<!-- writing-profile: research -->
# The argument lens and the claim markers

Four readings of a post's argument, under the discourse checks: the argument's structure, the kind of
claim each sentence makes (F7), where the post goes beyond what it states (F9), and whether it
rearranges the facts of the sources beneath it. All run on the device. The lens has its own switch,
**Argument lens**, off by default, and roles that have not passed their gate show as plain segments
unless **Every argument role** is on.

| Reading | Sign family | Code |
|---|---|---|
| Structure: segments, roles, movements | `argument-structure` | `src/core/discourse/argument.js`, `argument-cues.js` |
| Claim type | `claim-type` | `src/core/discourse/claimtype.js` |
| Inference gap | `inference-gap` | `src/core/discourse/claimtype.js` |
| Reframing (isomer) | `reframing` | `src/core/discourse/isomer.js` |

Every result is also a layer of the `refdb.parts/1` tree saved beside a study item ("argument
structure", "claims").

## Structure, after Aliocha's method

The method comes from the reference library's study of Aliocha's notes on the Summa (2026-10-25):
split each argument into premises and conclusions, mark the connectives that reverse or continue a
movement, and group arguments into chains, lists and turns.

- **Connectives** in English, Portuguese, Spanish, French and Latin, each with every role it can take
  (conclusion, continuation, reversal, concession, cause, condition, minor, example). Forms that are
  usually something else elsewhere count only at a clause start (Portuguese "se", English "so" and
  "now"); Latin postpositive particles ("autem", "enim") open the clause they sit second in.
- **Segments** end at a full stop, a semicolon, a question or an exclamation, never inside quotation
  marks, a URL or an abbreviation. A comma does not cut.
- **Roles by position.** A unit is one argument: it opens at the start or at a continuation
  ("Praeterea", "Moreover") and a conclusion closes it. A segment with a conclusion connective is a
  conclusion. One opened by a minor-capable connective ("sed", "but", "now", "ora", "or", "ahora bien")
  after a premise and before the conclusion is the minor premise; a second is a supporting premise.
  One opened by a reversal with no conclusion after it is a turn. A conditional opening is an
  assumption. The rest are premises.
- **Movements:** a list (opened by a continuation), a turn, a chain (its first premise takes up two or
  more words of the previous conclusion) or a single argument.
- **Regression.** Summa I q.2 a.2, objections 1 to 3, in Latin: all 7 of the breaks Aliocha marked,
  the 2 objection starts, no other break, the 3 "sed" as minor premises, three conclusions, and the
  movements argument, list, list (`tests/discourse.argument.test.js`).

### The gate, and what it needs

A role shows by default only when its held-out precision is at least 0.8 from at least 3 hits, and the
lens's boundaries in a language need precision 0.8 and recall 0.7, all against the agreement of two
people's annotations.

- **The gold set is fixed:** 60 public-domain passages, 12 per language, 6 of each held out by hash
  (`data/argument/passages.json`, picked by `scripts/argument-gold.mjs` before any annotation). Latin
  and English are the same 12 objections of the Summa (Leonine text; the 1920 English Dominican
  translation). French is Descartes' Discours de la méthode, Spanish Balmes' El Criterio, Portuguese
  Antero de Quental's Bom-senso e bom-gosto. In those three, half the passages are the paragraphs
  with the most connectives and half are drawn by hash, so the set is not only the passages the lens
  is built for.
- **The annotation page** is `docs/annotate/argument.html`: click the space before a word to break,
  name each part, save a file. It shows no output of the lens, and sends nothing.
- **The scorer** is `node scripts/eval-argument-gold.mjs --annotations DIR --write`: agreement between
  the two annotators, boundary precision and recall per language, precision per role on the held-out
  passages, and it rewrites the gate (`src/core/discourse/argument-measured.js`).
- **Status: no annotations yet,** so no role and no language has passed and every role reads as
  "segment" by default. Two people need roughly an hour each for the 60 passages; one should read
  Latin.

## Claim types (F7) and inference gaps (F9)

F7 types each sentence from wording cues, in this order: question, quotation, definition, sourced
statement, classification (a person, group or idea put in a category, such as "is a socialist" or "are
extremists"), inference, opinion or value; otherwise a factual claim with or without a link, or a
plain statement. F9 marks claims about another person's mind ("knows", "secretly wants", "a
calculated lie", "on purpose", "it's all about the money") and conclusions that bring in at least 60%
of their meaning words fresh (at least four words).

`node scripts/eval-argument.mjs` scores both. The labels are model labels, a pilot and not the human
gold the gate asks for.

### The label marker

A private study of 2026-10-28 ran the classification rule over 18,658 words of two TV news episodes.
It fired once. The rule read only the shape "is a ...-ist", so it missed a party word and an epithet set
before a name, and a demonstrative phrase with "is a" and an epithet. No broadcast text is in this
repository; the examples here are invented. `src/core/discourse/labels.js` now finds an epithet applied to a person or group, with its
span, in four shapes:

| Shape | Example (invented names) |
|---|---|
| Before a name, with or without a descriptor | "Democrat, communist Jane Talbot", "deranged traitor Bea Quill" |
| After a name | "Pat Doe, a known liar," |
| Predicate on a pronoun, a demonstrative phrase or a name | "This woman is a liar", "they are traitors", "Tamsin Rook is a grifter" |
| Naming frame | "I call him a fraud" |

A label can be a compound: "radical-left lunatic", "a lying, corrupt crook". Its severity is the number
of epithet words in it: the head and each pejorative modifier. Intensifiers ("total", "known") and other
adjectives ("shameless") may sit inside a label without counting. Before a name the rule asks for a
first and last name, so "Nazi Germany" is not a person; an epithet followed by an institution word
("Communist Party", "Socialist Party candidate") is a proper noun and gives no hit.

The words come from `data/discourse/labels.json`: 56 heads and 20 modifiers, each with its dictionary
entry and the reason it is listed. 36 heads are non-political insults (liar, crook, traitor, fraud,
thug, extremist and others). The rest are political pejoratives, 10 usually aimed at the left and 10 at
the right, and every one names its mirror on the other side (communist and fascist, Marxist and Nazi,
libtard and Rethuglican, snowflake and deplorable). The modifiers pair the same way (far-left and
far-right, woke and MAGA). "Socialist" is listed because it is used as an epithet; the rule cannot tell
the epithet from the plain description, and the proper-noun guard handles only the party name.
"Racist" and "bigot" are left out: they name conduct a post can show, and the shape rule still types
"is a racist" as a classification. `node scripts/labels-data.mjs` writes the words, and only the words,
into `src/core/discourse/labels-data.js`, so the rule never sees which side an entry is aimed at.

Every hit carries a status. Only a hit the post applies itself counts, makes its sentence a
classification and shows on the claim card.

| Status | When | Why it does not count |
|---|---|---|
| `label` | The post applies the epithet, including "I think she is a crook" and "we call them traitors" | It counts |
| `negated` | "she is not a liar", "he isn't a crook", "is no communist", "has never been a fraud" | The sentence denies the label |
| `self` | "I am a proud socialist", "as a Marxist, I", "call me a snowflake" | Self-description is not name-calling |
| `quoted` | The hit sits inside quotation marks | The post shows the words; it may not use them |
| `reported` | "critics said she is a crook", "she called him a fraud", "accused of being", "denied being" | Someone else applied it; the post reports that |

"He denied being a liar" is a mention of a label, so it is kept as a `reported` hit with its span and
not dropped: the word is in the post, and a reader may want to see where. It does not count, because
the post's own claim is about the denial. A post can launder a label through "people are saying", and
the marker will mark that as reported; the status is shown so a reader can judge.

`node scripts/eval-labels.mjs` scores hits on two sets (`project-docs/evidence/labels-eval.json`):

| Set | Precision | Recall |
|---|---|---|
| Planted, 33 positives in every shape and 30 controls in every class, written with the rule | 33 of 33 | 33 of 33 |
| Round 1, 40 positives and 40 controls written blind by a separate model session from a spec, scored once before any fix | 37 of 37 | 37 of 43 |
| Round 1 after the fixes (now development data) | 42 of 42 | 42 of 43 |

The first round-1 score missed adjectives outside the lexicon between the article and the head
("a spineless coward") and a hyphenated surname; both are fixed. It still misses two subjects that
share one predicate ("Weston Pryor and Delia Mott are crooks" gives one hit, not two). No human
labels exist yet, and no real thread has been scored.

The shuffled-lexicon control moves epithet status to words drawn at random, with the same number of
heads and modifiers, from the 681 words of both sets and the lexicon. Over 20 seeds the planted recall
falls from 1.0 to a mean of 0.14 and the round-1 recall from 0.98 to 0.16, so the rule's hits come from
the lexicon and not from the sentence shapes alone.

| Set | Labels | Types right | Gap precision | Gap recall |
|---|---|---|---|---|
| Development (20) | Claude Opus 5.5 | 19 of 20 | 5 of 5 | 5 of 5 |
| Held out, round 1 (20), scored once before fixes | two blind model labellers, agreeing on 20 of 20 | 17 of 20 | 2 of 2 | 2 of 4 |
| Held out, round 2 (20), scored once after the fixes | two blind model labellers, agreeing on types for 16 and gaps for 20 | 15 of 16 | 4 of 5 | 4 of 4 |

Round 1 was looked at to fix the rules (sentences cut inside quotation marks and URLs, subjects such
as "the minister" in the mind rule, longer classification phrases), so it now counts as development
data; its first score is kept in `project-docs/evidence/argument-eval-round1.json`. Round 2 was
written after the fixes and scored once. Its misses: "The inspector general found ..." typed as a
plain statement, and "Wages rose faster than prices. Therefore real wages went up." marked as a leap
although the step is sound.

## Reframing

A post names the same people and things as the sources beneath it but puts them in an act none of
those sources states, or states only to deny (a negation within 80 characters before the word). On the
worked example of 2026-10-26 the claim shares "Jared Kushner", "Jamal Khashoggi" and "MBS" with the
correction beneath it, and its "hired" and "hitman" appear there only after "no credible evidence".

## Neutrality

`tests/discourse.argument.test.js` swaps political, national and group terms in fixture posts (left
and right, socialist and nationalist, communist and fascist, party names, named figures, countries)
and requires the same claim types, gaps, roles and reframing reading. The classification rule reads a
word's shape (-ist, -ism, extremist, terrorist), not which category it is. No rule names a side.

`tests/discourse.labels.symmetry.test.js` builds 134 mirrored pairs from the lexicon's own mirror field,
with party words traded too (Democrat and Republican, Labour and Tory, liberal and conservative), in
eleven shapes for heads and four for modifiers: applied, negated, self, reported and proper-noun. Each
pair must give the same hits, statuses and severity, and the totals must match. The test also requires
equal aimed entries on each side with a mirror for each, a shipped word list with no side field, and
no party, ideology or sided word in `labels.js` or `claimtype.js`. The rule's only option is a word
list. The older check that no discourse module names a side had a backspace where its word boundary
should be and matched nothing; it is fixed, and it skips `labels-data.js`, whose balance this test
checks.

## What these readings do not prove

- A connective is what the author says links two claims; the lens shows that the author marks a part
  as following, not that it follows.
- A claim type is read from cues; irony and quotation can mislead it. It is not a truth verdict.
- An inference gap can sit on a sound step, and a claim about intent can be right.
- A reframing shows only that the post goes past its sources; sources can be incomplete.
- The F7 and F9 figures are on 60 short sentences with model labels.
- A label says how a post names someone, not whether the word fits. The label figures are on synthetic
  sentences; the one blind round was written by a model, and only its first score was held out.
