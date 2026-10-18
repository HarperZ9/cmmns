# CLAUDE.md: Radar

A browser extension that adds evidence badges to social media replies. It shows where an
account says or is labelled to be based, signs of coordination, and a per-thread report on
whether the most extreme replies come mostly from flagged accounts. X first.

## Rules
- Evidence, not verdicts. No badge or report ever calls anyone a bot, propagandist or extremist.
  Every badge links to where its data came from and what it does not prove.
- Political side is never an input. Rhetoric markers are stance-neutral and must pass the
  symmetry test in `tests/rhetoric.symmetry.test.js`.
- Extremity alone never flags a person. It is used only in the thread-level comparison.
- Nothing leaves the user's machine: no server, no telemetry, no analytics. Read only what
  the platform shows the viewer. Account lookups are user-initiated and rate-limited.
- No IP addresses or other data the platform does not disclose.
- Raw thread captures contain other people's posts. They stay in
  `project-docs/evidence/raw/` (git-ignored); only aggregate results are committed.

## Layout
- `src/core/` pure modules (no DOM): similarity, mismatch, flags, rhetoric, report. Tested in node.
- `src/ext/` the Manifest V3 extension: content script, styles, popover.
- `tests/` `node --test`.
- `project-docs/` design, evaluation and evidence.

## Commands
- `npm test` runs every test.
- Load `src/ext/` as an unpacked extension in Chrome (chrome://extensions, Developer mode).

## Quality gates
No file over 300 lines, no function over 50. Commit on a branch, never on main. Push nothing
without the author's go.
