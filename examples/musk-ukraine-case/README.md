# Case: Musk, Ukraine and the Democrats

Opened 2026-10-23. Made with `daylight case` (Daylight Commons 3.4.0, now CMMNS; `cmmns case` runs the same
commands).

## Files

- `sources.jsonl`: one row per source. URL, access time, read mode, Wayback result, sha256 of the capture.
- `captures/`: the captured bytes and their extracted text. Names start with the source id.
- `claims.jsonl`: the claim inventory. Each claim has a source and a rung:
  documented, inference, unproven or contradicted.
- `events.jsonl`: dated events for the timeline.
- `edges.jsonl`: who quoted, replied to or reposted whom, each with a source.
- `leads.jsonl`: open leads, the record that would settle each one, and who holds it.
- `absent.jsonl`: deleted, edited, sealed and missing records, with their custodians.
- `actors.jsonl`: accounts and people named in the case. Only those marked public-figure keep
  their handle in newsroom and legal exports.
- `labels.jsonl`: blind labels of claim rungs by more than one labeller.
- `exports/`: signed exports. Each one checks offline.

## Commands

    cmmns case add <url|file>
    cmmns case claim "<text>" --source S01 --rung documented
    cmmns case trace C01
    cmmns case timeline
    cmmns case export --profile newsroom

Every command except `add <url>` works offline. `add <url>` fetches that page and asks the
Wayback Machine to save it, unless you pass --no-archive.

## How this example was made

This case was first worked by hand on 2026-10-23 and then moved into the case format with
`node scripts/case-example-musk.mjs <old-case-folder>`. The script imports the old sources and
timeline, then records the claims, edges, leads, absences, actors and blind labels from the old
write-up with the same commands a person would type. The old folder was only read.

Capture files are not included: they are other publishers' pages and posts. Each source keeps the
sha256 recorded when it was captured, so a copy obtained later can be checked against it.

One correction was made in moving it. The old write-up described the Vanity Fair excerpt as "a UAE
bank account that had received about $750M from a bank in Azerbaijan". The excerpt keeps two
accounts apart, so the example records them as two claims, C15 and C17, and C17 carries the note.

Try it:

    node bin/radar.mjs case trace C02 --case examples/musk-ukraine-case
    node bin/radar.mjs case trace C16 --case examples/musk-ukraine-case
    node bin/radar.mjs case leads --case examples/musk-ukraine-case
    node bin/radar.mjs case labels --case examples/musk-ukraine-case
    node bin/radar.mjs case verify-export examples/musk-ukraine-case/exports/newsroom/v001
