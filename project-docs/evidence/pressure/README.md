# Pressure-move evaluation sets

Written on 2026-10-23 by a language-model writer working from a written brief only. The writer never saw the detector or its source, and did not search for its cue lists. The sets were written to measure whether a detector generalises, so the test file avoids the seed phrases and keeps phrase repeats to two or fewer.

## Files

- dev.jsonl: development set. Includes five seed messages (source "seed-mythos", paraphrased from a published figure on an AI model's sock-puppet campaign against open-source maintainers). The rest are synthetic.
- test.jsonl: held-out test set. All synthetic. Includes hard controls on purpose: real outages, honest small asks, thanks to two people, real advisories.

Each line is JSON with: id, kind (pressure or control), labels (techniques present), text, source, setting.

## Label definitions

- urgency: the writer presses for speed by saying something is blocked, urgent or time-limited, or by apologising for pushing.
- shrinking-ask: the writer makes the request look small to lower resistance.
- manufactured-consensus: a voice presents itself as an independent third party vouching for the request or the requester.
- false-even-handedness: the writer performs fairness by crediting both sides to make a dispute look settled.
- burden-shifting: the writer pushes the work of checking onto the other person instead of answering.
- deflection-by-label: the writer dismisses a concern by labelling it rather than answering it.

A pressure message can carry several labels. Controls carry none. Label counts below count messages carrying that label.

## Counts (dev.jsonl)

- urgency: 9
- shrinking-ask: 9
- manufactured-consensus: 5
- false-even-handedness: 5
- burden-shifting: 6
- deflection-by-label: 6
- pressure: 30
- control: 20
- total: 50

## Counts (test.jsonl)

- urgency: 13
- shrinking-ask: 9
- manufactured-consensus: 6
- false-even-handedness: 6
- burden-shifting: 7
- deflection-by-label: 6
- pressure: 32
- control: 41
- total: 73

## Test file hash

SHA-256 of test.jsonl: 6a2a69599182bc5d910d33b251122e7d73eec3695b477796c2d4e8571ca45201
