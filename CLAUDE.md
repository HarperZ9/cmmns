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
- Nothing leaves the user's machine unless the user turns on a named feature and clicks; each such
  feature says what it sends and to whom before the first use, and is off by default. There are two:
  Other coverage (each chosen outlet's own feed, nothing from the page sent, `src/core/coverage.js`,
  `src/core/feedfetch.js`), and evidence lookups (a post's linked repository names and domains to
  GitHub, RDAP and the Internet Archive, `src/core/evidence-fetch.js`, project-docs/EVIDENCE-LAYER.md). No aggregator, no server, no telemetry, no
  analytics. Read only what
  the platform shows the viewer. Account lookups are user-initiated and rate-limited.
- No IP addresses or other data the platform does not disclose.
- Raw thread captures contain other people's posts. They stay in
  `project-docs/evidence/raw/` (git-ignored); only aggregate results are committed.

## Layout
- `src/core/` pure modules (no DOM): similarity, mismatch, flags, rhetoric, report. Tested in node.
- `src/ext/` the Manifest V3 extension: content script, styles, popover.
- `src/core/api.js` radar-core, the public API (project-docs/INTEGRATION.md); `schema/` its JSON Schema;
  `bin/radar.mjs` the command line tool, local files only.
- `tests/` `node --test`.
- `project-docs/` design, evaluation and evidence.

## Commands
- `npm test` runs every test.
- Load `src/ext/` as an unpacked extension in Chrome (chrome://extensions, Developer mode).

## Licence
- Code: AGPL-3.0-only (`LICENSE`, also shipped as `src/ext/LICENSE.txt`; `tests/licence.test.js`
  keeps the copies identical). Data, catalogue, schemas and docs: CC BY 4.0. `REUSE.toml` maps
  every file; `THIRD-PARTY.md` lists what keeps its own terms.
- Contributions come in under the DCO (`Signed-off-by`), never a CLA. Do not add a CLA or any
  clause that lets one party relicense contributions.
- Third-party data or code keeps its licence: record it in `THIRD-PARTY.md` and `REUSE.toml`
  before committing it. Nothing under a non-commercial or no-derivatives licence ships.
- The Conso font is not under Radar's licences; never present it as reusable.

## Quality gates
No file over 300 lines, no function over 50. Commit on a branch, never on main. Push nothing
without the author's go.
