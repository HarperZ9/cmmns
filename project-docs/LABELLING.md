<!-- writing-profile: procedure -->
# Labelling guide: the campaign lens

This guide is for the two labellers of launch posts for the campaign lens: labeller A, Claude, and
labeller B, an open-weight model of a different family run through Flywheel's local lane. The
protocol of record is `project-docs/EVALUATION.md`, section "Launch campaigns: hand-labelling
protocol and fairness audit", as changed by the author's decision of 2026-10-23: Claude labels, and
an independent model cross-checks. The coordinator's steps are `docs/LABELLING-RUN.md`.

## What a case is

A case is one public launch post on X, as a signed-in reader sees it in the author's browser: the
post's counts, the repost list, the quote list and the replies the page loads. Each case has an
archive copy and a page-text capture whose hash the case file fixes before labelling starts.

## What you label

1. **Campaign.** One of four.
   - `paid-disclosed`: the post or its quotes carry X's Paid partnership label.
   - `paid-undisclosed`: the capture includes evidence from outside CMMNS that the
     promotion was bought without labels. Accepted kinds: an agency's own case study, a platform
     enforcement notice, a court or regulator record, the company's own statement. Pick the kind.
   - `organic`: nothing suggests the attention was bought.
   - `unsure`: anything else, including a hunch from the signs on the page.
2. **Signs you can see**, one answer each: yes, no or cannot tell.
   - Engagement shape unusual for an account this size.
   - Repeated bio templates or stock personas among the accounts that reposted or quoted.
   - Many amplifiers who joined in the same window.
   - Amplifiers whose usual topics do not match the post.
   - Unlabelled quotes that share a template with labelled ones.
   - The same amplifiers on other launches in the case set.

Strata (platform, audience band, topic, language, region) are recorded once, in the case file, at
collection. They describe the post and its audience and are never an input to the lens. Region is
the region the post addresses when it says so, or `unstated`; never guess from names or pictures.

## The hard rule on evidence

An impression from the same signs CMMNS reads is not evidence for `paid-undisclosed`.
Using it would grade the lens against itself. In that case, choose `unsure`.

## Blind, then hashed

- Neither labeller sees the detector's output. The browser runs without CMMNS until the
  labels, the resolutions and their hashes are recorded.
- Labeller B never sees labeller A's labels. It reads only the capture.
- Each file is recorded in the ledger (`scripts/label/ledger.mjs`) in a fixed order: the case set,
  labeller A, labeller B, the resolutions, then the detector output. Scoring refuses a file whose
  hash differs from the ledger or one recorded out of order.

## Disagreements

Where A and B differ, Claude rereads the capture and writes a resolution with a final label and a
reason: at least 20 characters, its own words, no handle or link. The final label set is A's labels
with these resolutions applied. Scoring refuses a disagreement with no resolution.

## What the files hold

The formats are `dc-label/2` (`scripts/label/format.mjs`). Label, resolution and detector rows hold
an opaque case id and closed label sets. The case file adds the post URL, the archive URL, the
capture hash and the strata. Every reader refuses a row with any other field, so post text, a
handle or a name cannot travel in these files. The captures stay outside the repository.

## What the results report

`node scripts/label/results.mjs` reports:
- the method sentence, "Labelled by Claude, cross-checked by an independent open-weight model
  (kappa = x), n cases.";
- Cohen's kappa between A and B with a seeded bootstrap 95% interval, and the standard textbook
  interval beside it;
- precision and recall of the lens's `strong` status against the final labels, with 95% Wilson
  intervals;
- the false-positive rate on `organic` cases, overall and per language and region stratum. A
  stratum with fewer than 30 organic cases reads "insufficient cases". The fairness bound reads
  `fails` when two reported strata differ by more than 5 points in either direction;
- whether the author spot-checked, and if so on how many cases and with what agreement. The
  spot-check is optional and never blocks the results.

## Does not prove

Agreement between two models shows consistency, not truth. Claude helped write the detector rules,
so a blind spot shared by the rules and labeller A can inflate the measured accuracy. Only a human
audit is ground truth, and a spot-check covers a sample.
