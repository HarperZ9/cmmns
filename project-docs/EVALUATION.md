# Evaluation plan and results

## What is measured
| Detector | Measure | Data |
|---|---|---|
| Mismatch | precision and recall of "speaks as local, labelled elsewhere" | three hand-labelled X threads, about 300 replies |
| Duplicates | precision and recall of same-text clusters | the same threads |
| Rhetoric markers | precision and recall per family; equal scores across sides | the same threads, plus a public labelled hate-speech or toxicity corpus |
| Report | does the verdict agree with a hand count? | the same threads |

Precision comes first: a badge on a real person's honest reply is the main harm.

## Threads
At least one event with threads from opposing sides (for example a protest covered by outlets on
the left and the right). Results are reported per side.

## Privacy
Raw captures hold other people's posts and handles. They stay in `project-docs/evidence/raw/`,
which git ignores. Only counts, rates and anonymised error examples are committed.

## Results so far
| Check | Result |
|---|---|
| Unit tests | 41 of 41 pass (`npm test`) |
| Symmetry test | the same 11 sentences score identically for all 25 targets; 5 coded slogan pairs score alike |
| Bundle freshness test | fails when `src/core` changes without a rebuild (checked by editing report.js) |
| Fixture run | badges, popovers, lookups and the report render on `tests/fixtures/thread.html` |
| Live X threads | not run: needs a signed-in session (LIVE-CHECKS.md) |
| Labelled corpus | not run: downloading one needs the author's approval |

No precision or recall figure exists yet. Until one does, the tool is a prototype.
