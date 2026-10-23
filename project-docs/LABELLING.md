<!-- writing-profile: procedure -->
# Labelling guide: the campaign lens

This guide is for the two people who label launch posts for the campaign lens. The protocol of record is
`project-docs/EVALUATION.md`, section "Launch campaigns: hand-labelling protocol and fairness audit".
This guide turns it into steps. Where the two differ, the protocol wins; report the difference.

The run itself (who to recruit, how long it takes) is `docs/LABELLING-RUN.md`.

## What you label

A case is one launch post on X as you see it in your own browser, signed in to your own account:
the post's counts, the repost list, the quote list and the replies the page loads. You read only
what the platform shows you. Do not use tools that scrape, and do not open more than the page offers.

For each case you record:

1. **Campaign.** One of four.
   - `paid-disclosed`: the post or its quotes carry X's Paid partnership label.
   - `paid-undisclosed`: the coordinator gives you evidence from outside Daylight Commons that the
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
   - The same amplifiers on other launches you were given.
3. **Strata.** These describe the post and its audience. They are never an input to the lens.
   - Platform.
   - Audience: the author's follower count band (under 10k, 10k to 100k, 100k to 1m, 1m and up).
   - Topic community: tech, crypto, entertainment, politics, sport, other.
   - Language: the post's main language as an ISO 639 code (`en`, `es`, `ar`).
   - Region: the region the post addresses when the post says so, as an ISO 3166 code (`US`, `IN`),
     or `unstated`. Do not guess from names or profile pictures.

## The hard rule on evidence

Your own impression from the same signs Daylight Commons reads is not evidence for
`paid-undisclosed`. Using it would grade the lens against itself. In that case, choose `unsure`.

## How to label

1. Open `scripts/label/label.html` in a browser profile that does **not** have Daylight Commons
   installed. You must not see the lens on these posts.
2. Enter the labeller id the coordinator gave you (`L1` or `L2`). Do not use your name.
3. Load the case list file from the coordinator. Your order is shuffled from your id.
4. For each case, click "Open the post in your browser", read the page, fill in the form, then
   click "Save and next". Answers are saved in this browser as you go. You can stop and come back.
5. When every case is saved, click "Export labels file" and send `labels-L1.jsonl` (or `L2`) to
   the coordinator. Delete nothing until the coordinator confirms receipt.

Do not talk about cases with the other labeller until both files are in. Disagreements are kept and
counted; they are not resolved by discussion.

## What the file holds

The export is `dc-label/1` (`scripts/label/format.mjs`): one JSON line per case with an opaque case
id, your labeller id, the labels and the strata codes. It holds no handle, display name, bio, link,
post text or screenshot. The reader refuses a file with any other field. Labels stay outside the
repository; only the results file is committed.

## Computing the results

The coordinator joins both files and the lens file, then runs:

```
node scripts/label/results.mjs all-labels.jsonl --out results.json
```

The results file reports Cohen's kappa on the campaign label with a seeded bootstrap 95% interval
and the large-sample interval beside it; the consensus counts (disagreements become `unsure`);
precision and recall of the lens's `strong` status with 95% Wilson intervals; the false-positive rate
on `organic` cases; and that rate per language and per region stratum. A stratum with fewer than 30
organic cases reads "insufficient cases" and shows no rate. The fairness bound reads `fails` when
two reported strata differ by more than 5 points in either direction, `holds` when they do not, and
`not readable` with fewer than two reported strata.

## Does not prove

Two labellers agreeing is not ground truth, and kappa measures agreement, not accuracy. A held
fairness bound covers only the strata with 30 or more organic cases.
