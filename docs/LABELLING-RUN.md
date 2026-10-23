<!-- writing-profile: procedure -->
# Labelling run: steps for the coordinator

Package W2-B in `docs/WAVES.md`. The kit is in `scripts/label/`; the labelling guide is
`project-docs/LABELLING.md`. Nothing has been labelled yet.

The author decided the method on 2026-10-23: Claude labels, through the author's own browser, and an
independent open-weight model of a different family cross-checks. The labels are facts about posts,
not a grade on Claude's work. The one risk left is correlated error, because Claude helped write the
detector rules. Two guards handle it: Claude labels blind and the labels are hashed before the
detector output is joined, and labeller B labels the same cases blind.

Results are stated in one form only: "Labelled by Claude, cross-checked by an independent
open-weight model (kappa = x), n cases." The kit builds that sentence and cannot write
"human-labelled".

## Before you start

- Make a run folder outside this repository and run `git init` in it. Everything below lives
  there. Page captures hold other people's posts, so they never enter this repository.
- In the author's Chrome, turn Daylight Commons off for the run. It stays off until step 7.
- Check that the local model answers. In the Flywheel checkout:
  `python -m harness.local_agent_cli --health`. Pull a model from a different family from Claude,
  for example `ollama pull qwen3:8b` (Qwen, Alibaba) or `olmo2:7b` (OLMo, Ai2).

## 1. Collect the cases

Claude opens public X posts in the author's Chrome, through the computer-use and Chrome tools, at
human pace. Rules:
- Read only what a signed-in reader sees. No scraping, no API, no extra accounts.
- Skip private accounts. Never write a private account's name anywhere.
- Aim for about 35 organic and 35 paid launch posts, to end with 30 of each after labelling.

For each case:
1. Request an archive copy (`https://web.archive.org/save/<post URL>`) and note the copy's URL.
2. Save the page text, as the reader sees it, to `captures/<case>.txt`. If the coordinator has
   outside evidence of payment for this post, append it to the same file now.
3. Add one row to `cases.jsonl`: `format` `dc-label/2`, `kind` `case`, an opaque `case` id
   (`c001`), `url`, `archive`, `capture` (the SHA-256 of the capture file) and `strata` (platform,
   audience, topic, language, region; see the guide).

## 2. Fix the case set

```
node scripts/label/ledger.mjs record ledger.jsonl cases cases.jsonl
git add cases.jsonl ledger.jsonl && git commit -m "fix the case set"
```

No case may be added or changed after this. A changed set needs a new run.

## 3. Labeller A: Claude, blind

Claude labels every case from its capture and the live post, following the guide. Claude does not
see any detector output. It writes `labels-A.jsonl` by hand or with `scripts/label/label.html`
(labeller `A`, model id `claude-opus-5-5` or the model in use). Then:

```
node scripts/label/ledger.mjs record ledger.jsonl labels-A labels-A.jsonl
git add labels-A.jsonl ledger.jsonl && git commit -m "labeller A"
```

## 4. Labeller B: the open-weight model, blind, through Flywheel's local lane

The kit calls Flywheel's local agent CLI, `python -m harness.local_agent_cli` (Flywheel
`harness/local_agent_cli.py`; usage in Flywheel's `docs/LOCAL-SERVING-PROFILES.md`), once per case,
with the Ollama backend, temperature 0, seed 0, the capture attached with `--file` and a fixed
instruction (`SYSTEM` in `scripts/label/labeller-b.mjs`):

```
node scripts/label/labeller-b.mjs --cases cases.jsonl --captures captures \
  --flywheel <Flywheel checkout> --model qwen3:8b --out labels-B.jsonl
node scripts/label/ledger.mjs record ledger.jsonl labels-B labels-B.jsonl
git add labels-B.jsonl ledger.jsonl && git commit -m "labeller B"
```

A capture whose hash differs from the case file stops the run. A reply with no valid label is
recorded as `unsure` and counted in the command's output.

## 5. Resolve the disagreements

For each case where A and B differ, Claude rereads the capture and writes one row to
`resolution.jsonl`: `kind` `resolution`, `case`, `final` (the label after review) and `reason`
(at least 20 characters, Claude's own words, no handle or link). Scoring refuses a disagreement
without a resolution and a resolution without a reason. An empty file is fine when A and B agree
on every case.

```
node scripts/label/ledger.mjs record ledger.jsonl resolution resolution.jsonl
git add resolution.jsonl ledger.jsonl && git commit -m "resolutions"
```

## 6. Push the run folder

Push the run folder to a private remote. The push time is an outside witness that the labels were
fixed before the detector ran.

## 7. Join the detector output

Turn Daylight Commons on. Open each post and write its campaign status to `lens.jsonl`: `kind`
`lens`, `case`, `lens` (`strong`, `one`, `thin`, `coordinated`, `none` or `undefined`).

```
node scripts/label/ledger.mjs record ledger.jsonl lens lens.jsonl
git add lens.jsonl ledger.jsonl && git commit -m "detector output" && git push
```

## 8. Score

```
node scripts/label/results.mjs --ledger ledger.jsonl --cases cases.jsonl \
  --a labels-A.jsonl --b labels-B.jsonl --resolution resolution.jsonl --lens lens.jsonl \
  --out results.json
```

Scoring checks every file against the hash the ledger recorded, in order, and stops on any change.
Copy `results.json` to `project-docs/evidence/campaign-labels-results.json` in this repository.
Update rows M2 and M3 in `docs/COMPLETION.md`.

## 9. Optional: the author's spot-check

The author may check any sample at any time. It is not a gate. To report one, write
`spot-check.json`, `{"done": true, "checked": 12, "agreed": 11}`, and add
`--spot-check spot-check.json` to step 8. Without it, the results say no spot-check was done.

## The fairness bound needs more cases

The bound compares strata with at least 30 organic cases each. A run with 30 organic cases reads at
most one stratum, so the bound reads `not readable`. To read it, collect at least 60 organic cases
split across two languages or two regions in a second round.

## How long it takes

My estimates; nothing has been timed. Time the first five cases and revise.

| Step | Estimate |
|---|---|
| Collection, 70 cases at human pace, 3 to 5 minutes each | 4 to 6 hours |
| Outside evidence for each paid-undisclosed case, 30 to 60 minutes each | 5 to 10 hours for 10 cases |
| Labeller A, 70 cases at 2 to 4 minutes each | 2 to 5 hours |
| Labeller B on an 8B model, under a minute each | about 1 hour, unattended |
| Resolutions, detector output, scoring | 2 hours |

## Does not prove

Agreement between two models shows consistency, not truth. Claude helped write the detector rules,
so a blind spot shared by the rules and labeller A can inflate the measured accuracy. Only a human
audit is ground truth, and a spot-check covers a sample.
