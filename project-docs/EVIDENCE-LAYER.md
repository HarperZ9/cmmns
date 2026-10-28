# Evidence layer: receipts, lookups and the chain of evidence

Status: built and unit-tested on fixtures. Not live-checked in the extension. Phase 2 of
`project-docs/VISION.md`. It builds on the launch campaign lens (`CAMPAIGN-LENS.md`).

## The problem

The campaign lens reads the page. Some facts that bear on a launch sit outside the page. When was
the repository made? When did its stars arrive? When was the domain registered, and when did the
Internet Archive first see it? Did the advertiser file ads? And how did the post's own counts move
between the user's visits? Each fact must survive a hostile check after the post is deleted or
disputed. So each one comes back as a receipt, sealed in a log the user can export and anyone can
verify offline.

## What runs, and when

All lookups are user-initiated, for the post being viewed, and off until the user allows them. The
first click on "Look up evidence" shows what is sent and to whom. "Allow and look up" turns on the
`evidence` setting, which can be switched off in Options. Bulk crawling and rate-limit evasion are
out. The limits:

| Source | What CMMNS sends | Login | Limits |
|---|---|---|---|
| GitHub REST, repository endpoint | `owner/repo` from the post's links | none (checked 2026-10-22: 200) | 2 repositories per click |
| GitHub REST, stargazers with timestamps | the same, plus the user's own token | required (checked 2026-10-22: 401 "Requires authentication" without one) | 10 pages per repository: the first 5 and the last 5, the rest reported as not read |
| RDAP via rdap.org | the registrable domain of each linked host | none (302 to the registry, both with `Access-Control-Allow-Origin: *`) | 3 domains per click |
| Internet Archive Wayback CDX | the same domain | none | one request per domain |
| Ad libraries (Meta, Google, TikTok, LinkedIn, X) | nothing: CMMNS builds a search link the user opens | the APIs need keys or approval, or do not exist | links only |
| Internet Archive Save Page Now | nothing from CMMNS: the user opens the save page | none | one click per post |

A 403 or 429 stops that source for the click and is reported. CMMNS never retries around a limit.
Lookups run one at a time. Credentials are omitted. The user's GitHub token is set in Options and
kept in `chrome.storage.local` (`pb.evidence.github`), and it is sent only to `api.github.com`; a
test checks that no other request carries it. "Clear all CMMNS data" removes the token too.

Each API's terms: CMMNS uses the GitHub REST API within its documented rate limits. RDAP is a public
protocol (RFC 9083) for this purpose. The Internet Archive asks for moderate request rates, which
one request per domain per click keeps. CMMNS does not query the ad libraries. Their terms limit
automated access, and their APIs need the user's own approved key, which this phase does not take.
What each would need is listed in `src/core/evidence-ads.js`.

## Receipts (capture)

`src/core/receipt.js`, format `radar-receipt/1`. Every receipt has:
- `kind`, `subject` and `observed`: the extracted fields;
- `source` and `url`: where the fact came from;
- `at`: when it was read;
- `capture`: `{ method, adapter, rawHash }`. The method is a fetch, a page read or a user-opened page. `adapter` is the code version. `rawHash` is the SHA-256 of the raw response fragment, which is not kept;
- `dnp`: what the fact does not prove (required);
- `hash`: SHA-256 over the canonical JSON of all of the above.

Optional fields:
- `witness`: an archive lookup address;
- `cites`: the receipt hashes a finding rests on;
- `catalogue`: the catalogue version of a definition it uses;
- `subjectKind`, `labeller` and `stratum`: see the export data model below.

## Seal, verify, export (chain of evidence)

`src/core/evidence-seal.js`:
- **Seal.** An append-only, hash-chained log (`pb.seal.v1`). Each entry is `{ seq, prev, link,
  receipt }`, where `link = SHA-256(canonical({ seq, prev, hash }))`. At 2,000 entries the log
  stops taking new receipts and tells the user to export and clear. Nothing is dropped quietly.
- **Merkle root and inclusion proofs.** RFC 6962 / RFC 9162 with domain separation, the same
  construction as Flywheel's `harness/merkle.py`. A pinned test vector matches the Python
  implementation's root byte for byte, so one verifier reads both.
- **Verify.** `verifySeal` checks every receipt hash and every link. `verifyExport` also checks
  the head, the root and every inclusion proof. Controls in `tests/evidence.layer.test.js` must
  reject five tamperings: an edited receipt, a valid receipt swapped in, a removed entry,
  reordered entries and a replaced root.
- **Witness.** "Save this post to the Internet Archive" opens Save Page Now in a tab. A
  `witness-request` receipt keeps the lookup address. CMMNS does not check that the save worked:
  X pages often archive as a login wall, and the receipt says so.
- **Export.** "Save evidence chain" downloads `radar-evidence-chain/1`: the seal, its head, the
  Merkle root and a proof per receipt, with the seal's "does not prove" note.

Does not prove: the seal shows that these are the receipts this browser recorded, in this order,
unchanged. It does not show that a source told the truth, and whoever holds the device could
start a new log. An independent witness (the archive) and a signature over the export
(`src/core/evidence-bundle.js` already signs bundles) narrow that gap. Signing the chain export
is listed under what remains.

## The local engagement ledger

`src/core/evidence-ledger.js`, `pb.ledger.v1`. Each time the user opens a launch post, its public
counts are written down with the time. A point within 10 minutes of the last one replaces it.
Retention is 48 points per post, 30 days and 500 posts. No account and no text is kept. The
evidence block shows each count's first and last value and its largest step between two visits.

## Export profiles (built in the command line tool; not in the extension yet)

`VISION.md` plans four export profiles from one store: legal, technical, journalistic, and research
and ML. `radar export <chain> --profile <name>` builds each one from a saved evidence chain
(`src/core/export-profiles.js`, with `export-writeup.js`, `export-prov.js` and
`export-research.js`; tests in `tests/export-profiles.test.js`):
- **legal:** `DOSSIER.md`, numbered exhibits, a chain-of-custody table, each cited catalogue entry
  with its elements, the method, the limits and the verifier steps. PDF/A is not built.
- **technical:** `provenance.json` in W3C PROV-JSON (an entity, a capture activity and an adapter
  agent per receipt; `cites` as `wasDerivedFrom`; the chain as a collection), `observations.jsonl`
  and `REPRODUCE.md`.
- **journalistic:** `WRITE-UP.md`, a sourcing note on every line, the right-of-reply log and the
  corrections the user supplies.
- **research:** `rows.jsonl` with lineage per row (chain position, link, root, inclusion proof),
  train, dev and test splits fixed by SHA-256 of seed and receipt hash, `splits.json` with a hash
  per split, Croissant 1.0 metadata pointing at the rows by SHA-256, and `DATASHEET.md`.

Every profile refuses a chain that fails `chainChecks`, a receipt whose content is not
`features`, a receipt that observed post text or a handle, and a private account without its
pseudonym; each ships the chain unchanged. The extension has no export button yet.

The receipt carries what the profiles need:
- **Provenance per row:** the capture block, the source, the URL, the time and the chain position.
- **Labeller and stratum:** set on hand-labelled observations, using the strata in `EVALUATION.md`.
- **Catalogue version:** on any finding that applies a definition.
- **Subject kinds:** `artefact` (a repository, a domain, a post), `organisation` (disclosed by the
  platform) or `private-pseudonym`. A private account appears only as `pseudonymFor(salt, handle)`,
  which is salted per export so two exports cannot be joined.
- **Content mode:** every receipt is `content: "features"`. It holds identifiers, hashes and
  extracted features, never redistributed post text. Platform terms often allow sharing post ids
  for re-fetching but not full text, and posts are their authors' copyright. A full-content mode
  will only be added where a licence or the law allows it, after checking each platform's current
  terms.

## Jurisdiction and the open catalogue (designed, not built)

The author, verbatim, 2026-10-22: "We will walk every line confidently and highlight every action by
it's definition in the jurisdiction of where it occurs. The catalog remains always neutral, and
always readily visible and challengeable."

- Each catalogue definition (planned set in `CAMPAIGN-LENS.md`, "Definition matching") carries its
  jurisdiction, source URL, version and retrieval date. No definition text ships before it has been
  checked against the official source.
- Every jurisdiction that applies is shown: the actor's, the platform's and the audience's. CMMNS
  never shows only the harshest one. When the actor's location is not public, the window says so
  and shows the audience's jurisdiction as the user's own.
- The catalogue is public data in this repository, versioned with a changelog. Every badge names
  the exact entry and version it used (`catalogue` on the receipt).
- Challenges: an issue template for entries and badges, with public reasoning for every decision
  and dated corrections. Organisations named by a badge get the same route.
- Neutral by test: the campaign suite has a symmetry test (`tests/campaign.test.js`). The same
  campaign structure gives the same finding whether the post argues for lower taxes, for higher
  wages, or sells a running shoe.

## What remains

- A live check in the extension: the consent flow, a real lookup and a chain download. This needs
  the author's go-ahead.
- Signing the chain export with the bundle key.
- The catalogue data file, the verified definitions and the element table.
- The export profiles (legal, technical, journalistic, research and ML).
- An issue template for challenges.
- Reading the ad library APIs with a user's own key, if the author wants that.
