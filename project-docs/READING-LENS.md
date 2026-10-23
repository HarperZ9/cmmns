<!-- writing-profile: research -->
# Reading lens

The reading lens names the techniques a post uses, at the span. It then weighs each span by its context and counts how often a thread or a feed uses the same frame. Code: `src/core/reading.js`, `reading-cues.js`, `reading-inflection.js`, `reading-lists.js`. Window: `src/ext/signals.js` (span, name, two factors), `src/ext/panel.js` (frames in this thread), `src/ext/dashboard.js` (frames across your feed), `src/ext/lens-inline.js` (spans marked in the post with the CSS Custom Highlight API).

## Techniques
Seventeen techniques in twelve families: nation denial, dehumanising metaphor, punitive annexation or elimination, strongman appeal, question insinuation, true item carries a leap, case to group, essentialism, coded term, replacement or blood libel, secret coercion, election theft, and five literary devices (metaphor, hyperbole, irony, allusion, dog-whistle). Each has a one-line definition in `reading-cues.js`.

## Inflection
Every cue match gets a weight from 0 to 1. The factors are: stance (quotes or reports, mocks, rebuts, names a coded term to criticise it), irony cue, question, target class, intensity, thread echo by other authors, the opening post using the same technique, genre (news or excerpt, joke), the author's own repeat in the thread, the author rebutting elsewhere, and a very short post. One logistic weight vector covers every technique. It is fitted on dev sets only, by `node scripts/eval-reading.mjs --split dev --fit` (L2, full-batch gradient descent from zero, deterministic). The use/mention weight is fixed at -3 from that distinction, since the dev sets hold one example. A match shows at weight 0.5 or more. The window shows the two factors that moved the weight most.

Target enters only as one class: every listed people, nation, party, state, agency, firm and leader counts as one neutral word. `tests/reading.symmetry.test.js` runs each targeted template over every list entry, in lower and title case, and expects one answer.

## Ship rule
A technique shows by default when its held-out precision is 80% or more from at least 3 hits, with inflection, against the consensus of two blind labellers. Options has "Every reading technique" (off by default), which shows all seventeen.

Ground truth per technique: a labeller supports a technique when it marks a mapped family "yes" or names a matching technique (`scripts/eval/reading-data.mjs`, TRUTH). Consensus means both labellers support it.

## Data and rounds
Feed tests 1 to 11 stay on the author's machine; only counts and SHA-256 hashes are committed. Labellers: A is Claude Opus 5.5, B is Claude Sonnet 5.5, blind to each other and to the detector. Sets 10 and 11 were labelled for this release (labels-A and labels-B in each set folder).

- **Round 1** (commit dac81a7, 0a80e52 before a rebase): cues from sets 1 to 5, weights fitted on 1 to 5, frozen, then scored once on 6 to 11. Results: `project-docs/evidence/reading-results-round1.json`. Before writing cues, I read REPORT-6-9.md and HELDOUT-322.md, which quote a few set 6 to 9 phrases (the Graham thread forms, the z004 "JQ" post). The coercion and coded-term cues for sets 6 to 9 are not clean held-out for that reason.
- **Round 2**: I read the round 1 misses in sets 6 to 9, so those sets joined dev. Cues were extended, weights refit on 1 to 9, frozen (3feb39e), and scored once on 10 and 11. Round 2b (after the symmetry tests found that a target's length moved two factors): one neutral target class, weights refit on 1 to 9, frozen, and scored again on 10 and 11 with the same result. Results: `project-docs/evidence/reading-results.json`.

### Round 1, held out, sets 6 to 11 (207 posts)
| Technique | P with inflection | P without | R with | R without |
|---|---|---|---|---|
| nation-denial | no hits | no hits | 0% (0/6, 0 to 39) | 0% (0/6, 0 to 39) |
| dehumanising | no hits | no hits | 0% (0/1, 0 to 79) | 0% (0/1, 0 to 79) |
| punitive-annexation | 100% (1/1, 21 to 100) | 100% (1/1, 21 to 100) | 20% (1/5, 4 to 62) | 20% (1/5, 4 to 62) |
| strongman | no hits | no hits | no positives | no positives |
| question-insinuation | 0% (0/1, 0 to 79) | 50% (1/2, 9 to 91) | 0% (0/42, 0 to 8) | 2% (1/42, 0 to 12) |
| true-leap | no hits | no hits | 0% (0/36, 0 to 10) | 0% (0/36, 0 to 10) |
| case-to-group | 33% (1/3, 6 to 79) | 33% (1/3, 6 to 79) | 3% (1/30, 1 to 17) | 3% (1/30, 1 to 17) |
| essentialism | no hits | no hits | 0% (0/20, 0 to 16) | 0% (0/20, 0 to 16) |
| coded-term | no hits | 100% (1/1, 21 to 100) | 0% (0/1, 0 to 79) | 100% (1/1, 21 to 100) |
| replacement | no hits | no hits | 0% (0/40, 0 to 9) | 0% (0/40, 0 to 9) |
| secret-coercion | no hits | 100% (5/5, 57 to 100) | 0% (0/26, 0 to 13) | 19% (5/26, 9 to 38) |
| election-theft | no hits | 100% (1/1, 21 to 100) | 0% (0/25, 0 to 13) | 4% (1/25, 1 to 20) |
| metaphor | no hits | no hits | 0% (0/6, 0 to 39) | 0% (0/6, 0 to 39) |
| hyperbole | no hits | no hits | 0% (0/7, 0 to 35) | 0% (0/7, 0 to 35) |
| irony | no hits | no hits | 0% (0/12, 0 to 24) | 0% (0/12, 0 to 24) |
| allusion | no hits | 50% (1/2, 9 to 91) | 0% (0/5, 0 to 43) | 20% (1/5, 4 to 62) |
| dog-whistle | 0% (0/2, 0 to 66) | 0% (0/2, 0 to 66) | 0% (0/3, 0 to 56) | 0% (0/3, 0 to 56) |
| any finding on a harm-family post | | | 8% (3/38, 3 to 21) | 26% (10/38, 15 to 42) |

### Round 2b, held out, sets 10 and 11 (98 posts)
| Technique | P with inflection | P without | R with | R without |
|---|---|---|---|---|
| nation-denial | no hits | no hits | 0% (0/1, 0 to 79) | 0% (0/1, 0 to 79) |
| dehumanising | no hits | no hits | 0% (0/1, 0 to 79) | 0% (0/1, 0 to 79) |
| punitive-annexation | no hits | no hits | 0% (0/1, 0 to 79) | 0% (0/1, 0 to 79) |
| strongman | no hits | no hits | no positives | no positives |
| question-insinuation | 75% (3/4, 30 to 95) | 75% (3/4, 30 to 95) | 14% (3/21, 5 to 35) | 14% (3/21, 5 to 35) |
| true-leap | 0% (0/1, 0 to 79) | 0% (0/1, 0 to 79) | 0% (0/12, 0 to 24) | 0% (0/12, 0 to 24) |
| case-to-group | 100% (1/1, 21 to 100) | 100% (1/1, 21 to 100) | 8% (1/12, 1 to 35) | 8% (1/12, 1 to 35) |
| essentialism | no hits | no hits | 0% (0/11, 0 to 26) | 0% (0/11, 0 to 26) |
| coded-term | no hits | no hits | no positives | no positives |
| replacement | no hits | no hits | 0% (0/15, 0 to 20) | 0% (0/15, 0 to 20) |
| secret-coercion | no hits | no hits | 0% (0/11, 0 to 26) | 0% (0/11, 0 to 26) |
| election-theft | no hits | no hits | 0% (0/11, 0 to 26) | 0% (0/11, 0 to 26) |
| metaphor | no hits | no hits | 0% (0/5, 0 to 43) | 0% (0/5, 0 to 43) |
| hyperbole | no hits | no hits | 0% (0/2, 0 to 66) | 0% (0/2, 0 to 66) |
| irony | no hits | no hits | 0% (0/10, 0 to 28) | 0% (0/10, 0 to 28) |
| allusion | 0% (0/1, 0 to 79) | 0% (0/1, 0 to 79) | 0% (0/4, 0 to 49) | 0% (0/4, 0 to 49) |
| dog-whistle | no hits | no hits | no positives | no positives |
| any finding on a harm-family post | | | 13% (2/16, 3 to 36) | 13% (2/16, 3 to 36) |

No technique clears the ship rule, so none shows by default in 3.3.0. Recall is the binding limit: the held-out posts carry their frames in wording the cue lists do not cover. Precision on the few hits is close to the bar for question insinuation (3 of 4).

## Inflection effect
On the dev sets (1 to 9, 240 posts), inflection raised precision for true item carries a leap (78% to 88%) and election theft (67% to 80%) and cost one coded-term true positive (the use/mention rule). On held-out 10 and 11 it changed nothing: the few hits all sit above the threshold.

## The Haiti case
The brief quotes two posts: "take Haiti and convert it into a penal colony" and the reply "Haiti isn't a country, not really, it's a no man's land". 3.2.2 shows nothing on either. 3.3.0 with "Every reading technique" on shows:
- Root: Punitive annexation or elimination on "take Haiti and convert it into" and on "penal colony", weight 0.721, moved by target: a named people, nation or power (raises).
- Reply: Nation denial on "Haiti isn't a country" and on "no man's land", weight 0.721, same factor.
With the default setting, 3.3.0 shows nothing on either post, because both techniques have no held-out hits yet.

## Other checks
- `node scripts/eval.mjs --data D:/radar-data --split test --no-write` reproduces the committed strong-family precision exactly: 4,167 of 4,597 (90.6%, 89.8 to 91.5). The reading lens adds no rhetoric markers and changes no flag.
- z004 ("bent into a pretzel by the JQ"): the use/mention factor takes it to weight 0.06, so it does not show. Both labellers named "coded term" on it, so the truth map counts that as a miss.

## Reproduce
    node scripts/eval-reading.mjs --split dev            # dev table, sets 1 to 9
    node scripts/eval-reading.mjs --split dev --fit      # refit the weights
    node scripts/eval-reading.mjs                        # held-out 10 and 11; writes the results and reading-measured.js
