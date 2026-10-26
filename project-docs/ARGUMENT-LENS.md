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

## What these readings do not prove

- A connective is what the author says links two claims; the lens shows that the author marks a part
  as following, not that it follows.
- A claim type is read from cues; irony and quotation can mislead it. It is not a truth verdict.
- An inference gap can sit on a sound step, and a claim about intent can be right.
- A reframing shows only that the post goes past its sources; sources can be incomplete.
- The F7 and F9 figures are on 60 short sentences with model labels.
