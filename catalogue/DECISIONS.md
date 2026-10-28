<!-- writing-profile: docs -->
# Challenge decisions

Every challenge filed against a catalogue entry, a badge or a finding gets a decision here, with the
reasoning, in public. Anyone can file one, including an organisation a badge names. Use the
[challenge template](https://github.com/HarperZ9/cmmns/issues/new?template=challenge.yml)
for an entry, and the
[finding template](https://github.com/HarperZ9/cmmns/issues/new?template=dispute-finding.yml)
for a badge or a finding on a page.

`scripts/decisions-check.mjs` reads this file in CI. It fails when a decision is malformed, when it
names an entry or version the catalogue never had, when a closed challenge has no final decision, or
when an open challenge has waited 14 days with no line here.

## How a decision is written

Each decision is a level-three heading, then three lines:

```
### #<issue> <YYYY-MM-DD> <accepted | rejected | partly accepted | withdrawn | under review>
- Target: entry <id>@<version> | badge <signal-id> | finding <short description> | missing <jurisdiction or definition>
- Reasoning: <why, citing the official source or the evidence>
- Change: <the catalogue/CHANGELOG.md line and the new version, or none>
```

An issue can have more than one decision; the latest date stands. "Under review" says what is being
checked and is never final. An accepted challenge changes the entry's version, and the changelog line
links back to the issue.

## Decisions

No challenges filed yet (checked 2026-10-23).
