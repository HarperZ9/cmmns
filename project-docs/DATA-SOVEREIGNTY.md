# Data sovereignty: pinned inputs, offline builds and signed packs

Radar's tables come from outside sources: Wikidata, the Data Commons fact-check feed, the Unicode
confusables table and the PHEME corpus. Any of them can change, or be changed by one editor, between
two builds. The goal here is narrow. No outside party's change can alter what Radar tells a user
unless the change is visible, reviewed and reversible. Radar does not judge whether a source is
honest; it pins what it took in and makes every change show up as a diff.

Four parts do this:

1. A lockfile, `data/LOCK.json`, that pins every dataset the build reads.
2. An offline build, `npm run build:offline`, that rebuilds from those snapshots with the network
   blocked and fails on any hash mismatch.
3. An upstream-change guard, `scripts/upstream-guard.mjs`, that diffs a fresh fetch against the
   locked table and flags suspicious changes.
4. Signed data packs: Radar's own data ships signed by the project key, and a user can import packs
   from keys they choose. Nothing is downloaded; a pack is a file the user picks.

## What is pinned

`data/LOCK.json` has three parts.

`datasets`: one entry per input, with the source URL, the retrieval date, the licence, the row count
and the SHA-256 and size of each raw snapshot file.

| Dataset | Snapshot | In the repository? |
|---|---|---|
| `unicode-confusables` | `data/snapshots/unicode-confusables.txt` (UTS #39 18.0.0) | yes; the Unicode License v3 allows it, and its hash equals the one recorded in `src/core/confusables-data.js` |
| `ops-sources` | `data/ops-sources/*.json` | yes; hand-kept, every record cites its own documents |
| `state-reports` | `data/state-reports.json`, `data/state-designations*.json` | yes; hand-kept |
| `datacommons-factcheck` | `$RADAR_DATA/feed/data.json` | no: 207 MB, and it names the people each fact-checker says made a claim; Radar drops those names and does not republish them |
| `wikidata-site-facts` | `$RADAR_DATA/wd-facts.json` | no: 24 MB |
| `pheme-veracity`, `pheme-prepared` | `$RADAR_DATA/pheme/...` | no: other people's posts |
| `wikidata-owners`, `wikidata-state` | none | the raw answers behind the current tables were not kept; see below |

`builds`: each build step, the script and arguments it runs, the date it writes into its table, the
datasets it reads and the tables it writes.

`outputs`: the SHA-256 of every table the build writes (`src/ext/*.json`, the generated
`src/core/*-data.js` files and the baseline results). `tests/datalock.test.js` fails when any of them
differs from the lock, so a table cannot change in a commit without the lock changing with it, in
the same diff, for a reviewer to see.

External snapshots live under `RADAR_DATA` (default `../radar-data` beside the repository). Each
entry says why it is not committed and how to fetch it again; the hash says whether the copy you
fetched is the one Radar was built from.

Honest gap: the Wikidata part of the owner table (`src/ext/owners.json`) and the state table (`src/ext/state.json`) were
built before this lockfile existed, and their raw Wikidata answers were not kept. Both tables are
pinned by hash, and the guard can diff any new build against them, but neither can be rebuilt
offline yet. `node scripts/owners-build.mjs --save-raw $RADAR_DATA/wikidata-owners.json` keeps the raw
answers from the next fetch, and `--in` rebuilds from them with no network.

## How to rebuild offline

```
npm run build:offline              # rebuild what this machine has snapshots for, check the rest
npm run build:offline -- --strict  # also fail when a snapshot is missing
RADAR_DATA=/path/to/radar-data npm run build:offline
```

Every step runs under `scripts/offline-guard.mjs`, loaded with `node --import`, which replaces
`fetch`, `WebSocket`, `http`, `https`, `http2`, `net`, `tls`, `dns` and `dgram` with functions that
throw. A step that tries to reach the network fails the build. The build stops before running
anything when a snapshot differs from the lock, and fails after the steps when a rebuilt table
differs from its locked hash. With every snapshot present, all seven rebuildable steps (eleven files) come out
byte for byte as committed (checked on 2026-10-21). With none of the external snapshots, the
confusables and operations tables are still rebuilt, and the rest are checked against the lock.

Running `npm run build:offline` on the snapshots this lock pins rebuilt the fact-check table with 8
more rows than the copy that shipped in 2.1.0 (19,387, against 19,379: 39 reviews in, 31 out, all at
the size cap's edge). The earlier copy could not be rebuilt from any snapshot on hand, so the
rebuilt one ships, and from here the table is the one its pinned snapshot produces.

## Updating a dataset

1. Fetch the new snapshot into `RADAR_DATA` (for owners, with `--save-raw`).
2. Run the builder. The table in the working tree changes.
3. Run the guard on each changed table:
   `node scripts/upstream-guard.mjs --new src/ext/owners.json` (the old side defaults to the
   committed copy; `--old <file>` picks another; `--json` prints everything).
4. Read every flag. The guard exits 1 while any flag is high.
5. When the changes are understood, `node scripts/data-lock.mjs refresh <dataset ids>` writes the
   new hashes, `node scripts/pack.mjs bundled` re-signs Radar's own data, and both go into the same
   commit as the tables.

## What the guard flags

The guard compares what users see, not raw bytes: owner, parent or publisher per domain; state label
and basis; site facts; each claim's rating; each operation indicator. Reordered rows and owners
listed in a different order raise nothing.

| Flag | Level | When |
|---|---|---|
| mass removal | high | at least 20 keys and 2% of the table gone at once |
| bulk edit | high | at least 50 keys and 5% of the table changed at once |
| high-reach label flip | high | owner, via, state, basis, country, owner type or Wikidata item changed for a site in `data/high-reach.json` |
| high-reach removal | high | a site in `data/high-reach.json` dropped |
| fact-checker vanished | high | a fact-checker with at least 20 rows has none after |
| state label added, changed or removed | medium | any state label, at any reach |

`data/high-reach.json` is a review priority list of 97 widely read news sites and platforms across
countries, languages, ownership types and political leanings. Being on it means a silent change
there would reach many users. It says nothing about the site.

Run against the owner table that shipped before 2026-10-20, the guard flagged 7 high-reach changes
on 6 sites that had reached users before the guard existed. Each was checked against a primary
source on 2026-10-21. All 6 rows were wrong or misleading, and each now has a correction (below).

## Owner corrections

`data/owner-corrections.json` is a hand-kept list of rows where Wikidata is wrong. Each row gives
the domain, the corrected owner, a primary source (the outlet's own site, a statute or a company
filing; Wikipedia and Wikidata are pointers only), what that source says, the date checked and why
the upstream row is wrong. `factsWrong` marks a domain whose Wikidata site facts describe another
item; the site card then hides them.

`scripts/owner-corrections.mjs` applies the corrections to `src/ext/owners.json`, and
`owners-build.mjs` applies them after every fetch. A corrected row keeps what Wikidata said
(`correction.upstream`), and the window credits "Radar correction, checked <date>" with its source
instead of Wikidata. The step is idempotent and runs in the offline build. The guard reports
"correction can be retired" when Wikidata comes to say the same, and "upstream changed under a
correction" when Wikidata changes again. `owner-corrections.mjs --check` exits 1 in either case or
when a corrected domain has gone.

| Site | Wikidata said | Correction | Source |
|---|---|---|---|
| asahi.com | published by Asahi Shimbun Company | owned by Asahi Shimbun Company | the site's title and copyright line |
| bloomberg.com | Bank of America; Michael Bloomberg (from the Bloomberg Television item) | Bloomberg L.P. | Merrill Lynch 10-K for 2008 (stake sold to Bloomberg Inc. on 2008-07-17); bloomberg.com terms |
| dw.com | ARD | Deutsche Welle, a public-law broadcaster under German federal law | Deutsche-Welle-Gesetz §§ 1 and 45 |
| france24.com | France 24 | France Médias Monde | France Médias Monde's own site |
| redeglobo.globo.com | O Diário de Mogi (from the TV Diário affiliate item) | Globo Comunicação e Participações S.A. | the site's copyright line |
| xinhuanet.com | parent China Xinhua News Network Corporation (from the CNC World item) | Xinhuanet Co., Ltd., run by Xinhua News Agency | the site's footer |

Does not prove: a correction is right as of the date checked, from the source it cites. Ownership
changes, and a correction can go stale like any other row; the guard only notices when Wikidata
moves.

## How packs work

A pack is one JSON file:

```json
{
  "format": "radar-pack/1",
  "manifest": {
    "name": "…", "version": "…", "description": "…",
    "author": { "keyId": "<32 hex>", "name": "what the signer calls itself" },
    "created": "YYYY-MM-DD",
    "hashes": { "claims": "<sha256>", "ops": "<sha256>", "siteNotes": "<sha256>" },
    "counts": { "claims": 1 }
  },
  "content": { "claims": [], "ops": [], "siteNotes": [] },
  "publicKey": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" },
  "signature": "<base64url ECDSA P-256 SHA-256 signature over the canonical manifest>"
}
```

Canonical JSON sorts keys at every level, so the signer and the verifier hash the same bytes. The
key id is the first 32 hex characters of the SHA-256 of the canonical public key. Each content part
is hashed the same way, and the hashes sit inside the signed manifest. Verification
(`src/core/packs.js`) uses WebCrypto only, so the same code runs in Chrome, Firefox and node.

Content rules (`src/core/packs-content.js`): every claim cites an https review URL; every operation
indicator names a lower-case domain or a handle, an indicator kind and an operator type from the
same lists as `src/core/ops-schema.js`, and a dated https source; every site note cites an https
source. Limits: 50,000 claims, 5,000 indicators and 5,000 notes. Pack rows stay apart from Radar's
own. A pack claim shows its checker as "Checker (pack: Pack name)"; a pack operation gets the id
`pack:<key id>:<id>`, never merges into Radar's operations and never counts in the trend view; a
site note shows its pack's name and the line "From a data pack you imported and trust. Radar did not
write or check it."

In the options page, under Data packs, the user picks a file. Radar shows the pack's name, the key
that signed it (key id, and the name the signer gave, labelled as such), what it adds and every
problem it found. A pack with any problem cannot be added. A pack from an untrusted key can be added
only with "Trust this key and add the pack". Trusted keys and packs are kept in this browser
profile (`pb.packkeys.v1`, `pb.packs.v1`), survive "Clear all Radar data", and can be turned off,
removed or distrusted; distrusting a key turns its packs off. The background worker verifies every
enabled pack again each time it loads them, and leaves out any that fail.

Radar's own data ships as a file pack, `src/ext/radar-data.pack.json`: the SHA-256 of each bundled
table, signed by the project key, whose public half is in `src/core/pack-keys.js` (key id
`0e5e 1984 0565 840c 977e 0f03 6c9a c021`). "Check Radar's own data" in the options page checks the
installed tables against it. `tests/packs-bundled.test.js` fails when a table changes without being
signed again.

The six bundled tables have one identity across Radar. `data/LOCK.json` pins their SHA-256 (hashed
with LF line ends), the project key signs the same hashes in `radar-data.pack.json`, and the
`dataLock` an evidence bundle carries (project-docs/INTEGRATION.md) is the SHA-256 of those hashes
listed as `<sha256>  <file>` lines. `tests/datalock.bundle.test.js` checks that all three agree.
Canonical JSON, SHA-256, base64url and ECDSA P-256 live once, in `src/core/sig.js`, shared by
sealed evidence cards, evidence bundles and data packs.

The CLI, `scripts/pack.mjs`:

```
node scripts/pack.mjs keygen <dir outside the repository> <name>
node scripts/pack.mjs sign --key <name.private.jwk> --content content.json --name N --version V --out pack.json
node scripts/pack.mjs verify pack.json [--trust name.public.jwk]
node scripts/pack.mjs bundled [--key <project private key>]
```

`keygen` refuses a directory inside the repository. The project private key is kept outside it;
`.gitignore` excludes `*.private.jwk`, `*.pem`, `*.key`, `*.p12` and `radar-keys/`, and
`tests/no-private-keys.test.js` fails when any tracked or addable file holds a PEM private key, a
JWK with a private part or a key file name.

## Threat model

**A hostile upstream editor** changes Wikidata or the fact-check feed: flips an outlet's owner, adds
or removes a state label, or deletes a fact-checker's reviews.
Defence: the lock pins the snapshot and the tables; the build is offline; the guard shows every
change and flags the ones above; nothing ships until the lock is refreshed in a reviewed commit.
Does not prove: that the pinned snapshot was right when it was taken. A bad edit made before the
snapshot is pinned with it. Changes below the thresholds, on sites outside the high-reach list, are
listed but not flagged, and a reviewer can still miss them. The guard cannot say which side of a
change is true; it says only that something changed.

**A hostile pack author** signs false claims, invented operations or misleading notes.
Defence: no pack loads without the user's explicit choice to trust its key; every pack row cites a
source and carries the pack's name; pack operations never enter Radar's trend counts; a pack can be
turned off or removed, and its key distrusted.
Does not prove: anything about the content. A valid signature shows which key signed and that
nothing changed since. It does not show the content is right, or who holds the key. The name in a
pack is whatever the signer wrote.

**A tampered download**: a modified copy of Radar or of a pack.
Defence: a pack with any changed byte in its manifest or content fails its signature or a hash; a
changed bundled table fails "Check Radar's own data" and the bundled-pack test; the packaging script
writes SHA-256 sums for each release archive.
Does not prove: that an installed copy is genuine. A tampered install can carry a different project
key and a pack signed by it; the in-browser check runs code from the same install. Compare the key id
with the one published in Radar's repository, and verify a downloaded release with
`node scripts/pack.mjs verify src/ext/radar-data.pack.json --trust <published public key>`.

**Key loss or theft.** The project key has one copy, outside the repository. If it is lost, the
bundled data cannot be re-signed under the same key id; a new key needs a new `src/core/pack-keys.js`
in a reviewed release. If it is stolen, the thief can sign data that passes the check until the key
is replaced. There is no revocation list.
