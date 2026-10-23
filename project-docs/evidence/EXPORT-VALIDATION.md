<!-- writing-profile: research -->
# Export validation with outside validators

Run on 2026-10-23 against the demonstration chain `docs/demo/demo-evidence-chain.json` (two
receipts). The validators were installed for this check only, in a throwaway Python 3.12
environment, and are not dependencies of Daylight Commons.

## Technical profile: W3C PROV-JSON

Commands: `radar export docs/demo/demo-evidence-chain.json --profile technical --out <dir>`, then
`provenance.json` checked two ways.

| Check | Before the fix | After |
|---|---|---|
| W3C PROV-JSON schema (member submission, draft-04), `jsonschema` 4.26.0 | 2 errors: `dc:catalogue` was `null` on both receipts | 0 errors |
| `prov` 3.2.3 parse | 12 records, with a warning that version 3.3.0 will reject the null values | 12 records, no warning |
| `prov` 3.2.3 to PROV-N and PROV-O Turtle, then a JSON round trip | written; round trip equal | written; round trip equal |

Fix: an absent attribute is now left out of the record (`src/core/export-prov.js`); PROV-JSON has no null.

## Research profile: Croissant 1.0

Commands: `radar export ... --profile research --out <dir>`, then `mlcroissant validate --jsonld
croissant.json` with `mlcroissant` 1.1.1, and the records read back with `mlcroissant.Dataset`.

| Check | Before the fix | After |
|---|---|---|
| `mlcroissant validate` | crashed: `KeyError: '@language'`, the short context lacked the standard terms | passes, no warnings |
| Records read back | not reached | 2 records, all 10 fields |

Fix: the export writes the standard Croissant 1.0 context, a `citeAs` line and a `version`
(`src/core/export-research.js`). `tests/export-profiles.test.js` now fails on a null PROV value or a
context without `@language` and the `cr:` terms.

## Does not prove

Both validators check form. They do not show the exported facts are true, and a two-receipt chain
does not exercise every receipt kind.
