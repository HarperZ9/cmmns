# Integrating CMMNS

CMMNS' evidence is available outside the browser extension. A newsroom tool, a research pipeline
or a moderation dashboard can call the same rules the extension runs, get the same evidence with
the same wording, and check a colleague's findings offline. Nothing here needs a server, an
account, a network connection or a third-party package.

There are four parts:

- **radar-core**, one ES module (`src/core/api.js`) with five functions.
- **A JSON Schema** for everything radar-core returns (`schema/evidence.v2.json`; version 1 documents check against `schema/evidence.v1.json`).
- **A command line tool**, `bin/radar.mjs`, that reads local files only.
- **Signed evidence bundles**, files anyone can verify offline.

The extension adds an **Analyse a file** page (toolbar popup, then Analyse a file) that runs the
same code on a file you choose.

## Quick start

```
node bin/radar.mjs analyze saved-thread.html            # a readable report
node bin/radar.mjs analyze tweets.js --json             # JSON that fits the schema
node bin/radar.mjs analyze thread.json --bundle out.json
node bin/radar.mjs verify out.json
node bin/radar.mjs site example.com
node bin/radar.mjs media photo.jpg
```

From JavaScript (Node 20 or later, or any modern browser):

```js
import { analyzeThread, useData } from "./src/core/api.js";

const result = analyzeThread({
  site: "X",
  root: { id: "1", text: "The post replied to" },
  replies: [{ id: "2", author: "a", text: "A reply", posted: "2026-10-01T12:00:00Z" }],
});
for (const e of result.evidence) console.log(e.label, e.shows, e.context);
```

The package exports the same entry as `radar/core` (`package.json` `exports`). CMMNS is not
published to npm; use it from a clone or a release archive.

## The API

| Function | Input | Returns |
|---|---|---|
| `analyzeThread(input, { now })` | `{ site, root, replies }` | envelope, kind `thread` |
| `analyzeText(text, { id, links })` | a string | envelope, kind `text` |
| `checkMedia(bytes)` | the whole file as `Uint8Array` or `ArrayBuffer` | a promise of an envelope, kind `media` |
| `siteInfo(domain)` | `"example.com"` or a URL | envelope, kind `site`, or `null` |
| `useData(tables)` | `{ sites, owners, state, claims, claimParts }` | row counts loaded |

Quoted posts are read too: a top-level `quoted` list in the thread input, or a `quoted` post
inside the root or a reply. Their words get the same post evidence as any post, listed by id in
`posts.quoted`. They are not replies, so the thread report, bursts and the other thread comparisons
leave them out.

A post is `{ id, author, text, posted, links, flags, account }`. Only `text` is needed. `author`
is used to tell accounts apart for the thread comparisons and never appears in the output.
`flags` is a list of flag ids (or `{ id, evidence }` objects) when you have already read the
account; `account` gives the details a platform discloses (`joinDate`, `postsCount`,
`followersCount`, `basedIn` and the rest of `src/core/flags.js`) and CMMNS works out the flags.
With neither, the account counts as not read, as in the extension.

### Time precision

`timePrecision` says how precise the `posted` times are: `exact`, `second`, `minute`, `hour` or
`day`. Give it on the thread input for every post, or on a post to override the thread. Times
copied from a screen often come from rounded ages ("14h", "1d") and are good only to the hour or
the day, yet they look like any other timestamp. Several replies then share one second by
rounding, and before 3.2.1 the burst test read that as a burst (p < 0.000001).

When `timePrecision` is missing, CMMNS infers it:

- from the input format: X (GraphQL, archive, saved page), Reddit and Mastodon give seconds,
  Bluesky gives milliseconds;
- for a thread typed or assembled in CMMNS' own shape, from the times themselves. If at
  least half the distinct times, and at least three, fall on the same point of the day, hour or
  minute, the times are taken as rounded to that unit. Fewer than three distinct times give
  unknown. Typed times are never taken as second-precise without that evidence.

A post's own precision wins over the thread's, and the thread is as coarse as its coarsest timed
post. Each timing signal needs a resolution:

| Signal | Needs | Below that |
|---|---|---|
| `timing-burst` | second | not run; a `timing-not-observable` item says so |
| `swarming` | minute | not run; a `timing-not-observable` item says so |
| fast replier (extension) | second | the thread's reply delays are left out |
| active hours, posts around the clock (extension) | hour | the thread's or account's hours are left out |
| quote bunching (campaign lens) | minute | no bunching row |

A thread envelope reports what was used in `posts.timePrecision`: `{ value, basis }`, where
`value` is a precision or `null` for unknown and `basis` is `declared`, `inferred`, `declared and
inferred` or `unknown` (API 1.1.0 on).

`useData` loads CMMNS' tables: the site facts and records (`src/ext/sites.json`), ownership
(`owners.json`), state links (`state.json`) and the fact-check table (`claims.json` and the parts
it names). Without them, evidence that needs a table is left out, never guessed. The CLI loads them
from disk; the extension from its own package.

### The envelope

```json
{
  "schema": "urn:radar:evidence:v2",
  "api": "2.0.0",
  "kind": "thread",
  "site": "X",
  "posts": { "n": 15, "accounts": 14, "ids": ["1", "100", "..."], "timePrecision": { "value": "second", "basis": "declared" } },
  "evidence": [ ],
  "limits": ["This covers the posts in the input as given, ..."]
}
```

`limits` gives the context for the whole result. A `media` envelope adds
`media: { state, ai, format }`; a `site` envelope carries `site`, the rows CMMNS' tables hold.

### An evidence item

```json
{
  "id": "e10",
  "kind": "timing-burst",
  "scope": "thread",
  "level": "flag",
  "label": "timing burst, 5 accounts",
  "shows": "5 accounts replied within 8 s at 12:10 UTC. Chance at this thread's pace: p < 0.000001. In ordinary threads with 5 to 19 replies, ...",
  "source": "The posts in the input, as given, read by CMMNS on this device.",
  "context": "Replies that arrived within the same seconds, as they also do after a viral post or a mass notification. ...",
  "posts": ["100", "101", "102", "103", "104"],
  "spans": [],
  "data": { "from": "2026-10-01T12:10:00.000Z", "to": "2026-10-01T12:10:08.000Z", "accounts": 5, "p": 1.2e-9, "timePrecision": "second" }
}
```

| Field | Meaning |
|---|---|
| `kind` | A stable machine name; the table below lists them |
| `scope` | `post`, `thread`, `file` or `site` |
| `level` | `warn` is worth a look on its own; `flag` means more alongside others; `info` is context |
| `label`, `shows` | The words the extension's window uses |
| `source` | Where the data came from: the input, a named table with its licence, a cited report |
| `context` | How far the sign reaches, in the same words as the window's "What it shows" row. Version 1 called this field `doesNotProve` |
| `posts` | The post ids the item concerns. No item names an account |
| `spans` | `{ post, start, end, text }` for the words that matched; `start` and `end` are `null` when the match was found after folding look-alike letters |
| `data` | Figures particular to the kind |

| Kind | Scope | What it shows |
|---|---|---|
| `thread-report` | thread | The flagged share among the most extreme replies against the rest, with 95% intervals |
| `account-flag` | post | One flag on the account behind a post, with its evidence |
| `same-text` | thread | Near-identical replies from different accounts, with the baseline rate in ordinary threads |
| `timing-burst` | thread | Several accounts replying within seconds, tighter than the thread's pace explains. Runs only on times given to the second |
| `timing-not-observable` | thread | The post times are too coarse for a timing signal, which did not run. `data.signals` names them, `data.timePrecision` gives the precision and `data.needs` what each signal needs (API 1.1.0 on) |
| `swarming` | thread | Many new or flagged accounts converging on one post within minutes; counts only |
| `strong-language` | post | Slurs, dehumanising language, calls for violence or vigilantes, group stereotypes |
| `names-theory` | post | A documented conspiracy theory named, with what the record shows |
| `persuasion` | post | A persuasion technique that passed CMMNS' measurement bar |
| `leaked-ai`, `machine-writing` | post | Chatbot text posted unedited; several independent machine-writing signs |
| `spam-pattern` | post | Giveaway, crypto and contact-bait patterns |
| `fact-check` | post | A fact-checker reviewed a similar claim; the rating is theirs |
| `lookalike-domain` | post or site | An address that imitates a listed outlet |
| `state-link` | post or site | A cited source ties the site to a state |
| `site-owner`, `site-record` | post or site | The owner on Wikidata; the site's fact-check record |
| `content-credentials`, `credentials-ai`, `credentials-changed`, `ai-metadata`, `no-credentials`, `remote-credentials` | file | What the file's Content Credentials and metadata say |
| `case-file` | file | One file of a `cmmns case` export: its path, sha256 and size (project-docs/INVESTIGATE.md) |

## The schema

`schema/evidence.v2.json` (JSON Schema 2020-12, `$id` `urn:radar:evidence:v2`) covers the envelope,
the item and the bundle. `schema/evidence.v1.json` (`urn:radar:evidence:v1`) stays in the repository
for version 1 documents. Any validator works. The CLI and the tests use a short checker
(`bin/lib/jsonschema.mjs`) so CMMNS needs no package; it reads `type`, `const`, `enum`,
`pattern`, `minLength`, `minimum`, `required`, `properties`, `additionalProperties`, `items`,
`minItems`, `anyOf`, `oneOf` and local `$ref`. The tests check real outputs against the schema
and check that the checker rejects missing limits, unknown kinds, an account field and bad spans.

## Stability promise

The API follows semantic versioning through `API_VERSION`, separately from the extension's
version.

- **Patch** (2.0.x): wording fixes in `label`, `shows`, `source` or `context`; bug fixes in
  what is found. Do not match on the wording.
- **Minor** (2.x.0): new evidence kinds, new keys inside `data`, new optional envelope fields, new
  import formats. The schema's `kind` list grows in the same release. Treat a kind you do not know
  as context.
- **Major** (3.0.0): removing or renaming a field or kind, changing a field's type or meaning, or
  changing how a bundle is signed. The schema id changes to `urn:radar:evidence:v3`, and CMMNS
  keeps verifying earlier bundles.

API 2.0.0 (2026-10-23) is the first major release. It renames the item field `doesNotProve` to
`context`, moves the schema id to `urn:radar:evidence:v2` and writes bundles as version 2. The old
field stays readable:

- `verifyBundle` and `radar verify` accept bundle versions 1 and 2. The CLI checks each bundle
  against the schema its `schema` field names.
- `readEvidence(doc)` (exported from `src/core/evidence-bundle.js` and `src/core/bundle-verify.js`)
  returns a copy of an envelope or bundle with each version 1 `doesNotProve` as `context`. The
  signed original stays as it was, so its signature still checks.
- `tests/evidence-v1.test.js` keeps a signed version 1 bundle verifying.

Fields that will not change in version 2: every item has `kind`, `scope`, `level`, `label`,
`shows`, `source`, `context`, `posts`, `spans` and `data`, and no item names an account.

## The command line tool

`node bin/radar.mjs <command>` reads local files and prints a report, or JSON with `--json`.
Nothing is fetched. Exit code 0 on success, 1 when a file cannot be read or a bundle fails a
check, 2 for a usage error.

| Command | What it does |
|---|---|
| `analyze <file>` | Reads any supported file (below) and prints the evidence. `--no-claims` skips the fact-check table (faster). `--bundle out.json` also writes a signed bundle; `--include-text` puts full post text in it; `--key path` chooses the key file; `--carrier-safe` signs with a one-time key that is never saved, keeps the day only and leaves the page address out unless `--page <address>` gives one |
| `verify <bundle>` | Checks the signature, the key id (`--key-id`), the bundle's own consistency and the schema |
| `site <domain>` | What CMMNS' tables hold about a site |
| `media <file>` | Content Credentials and AI-generation metadata |

### Files CMMNS reads

| File | Where it comes from | Read as |
|---|---|---|
| Saved page (`.html`) | Save page as, on an X thread or a new Reddit thread | The thread: root post and replies |
| Any other saved page | Save page as | One text, with its links |
| Thread JSON | X's TweetDetail response, Bluesky's `app.bsky.feed.getPostThread`, a Mastodon status context, or `{ site, root, replies }` | The thread |
| `tweets.js` | The X archive you request from X | Your posts; reposts left out |
| `comments.csv`, `posts.csv` | The Reddit data export | Your posts; the `ip` column is dropped and never shown |
| `outbox.json` | The Mastodon archive | Your posts; boosts left out |
| `.car` | Bluesky's Export my data | Your posts, named by record key |
| Images and video | Any | Content Credentials and metadata |

## Signed evidence bundles

A bundle is a JSON file holding what CMMNS found on one thread or export:

- the post ids, and each evidence item with its matched words;
- the CMMNS version and the API version;
- `dataLock`: a SHA-256 over the data tables used (lines `<sha256>  <file>` sorted by name, each
  file hashed with LF line ends so Windows and Linux checkouts agree). The per-file hashes are the
  ones `data/LOCK.json` pins for those tables and the project key signs in
  `src/ext/radar-data.pack.json`, so the same value follows from the lockfile, from the signed pack
  or from a release's files (`tests/datalock.bundle.test.js`); see project-docs/DATA-SOVEREIGNTY.md;
- the time it was saved;
- `signer`: the algorithm, the public key as a JWK and its key id (the first 16 hex characters of
  the SHA-256 of the canonical JWK);
- `signature`: ECDSA P-256 with SHA-256 over the canonical JSON of the bundle without the
  signature field (sorted keys, no spaces), base64url, IEEE P1363 form as WebCrypto produces it.

**Privacy.** Full post text stays out unless you tick "Include the posts' full text" (or pass
`--include-text`): the replies are other people's words. Without it, the bundle keeps only the
matched words each item needs. A thread bundle names no account and needs at least five reply
accounts, the same rule as a thread card, so it cannot be about one person. A bundle from your
own data export is not held to that rule.

**Keys.** The extension makes one key pair per install the first time you save a bundle, and keeps
it in its own IndexedDB as a non-extractable key: it can sign, and cannot be read or exported. The
CLI keeps its key in `~/.radar/bundle-key.jwk`, readable only by you where the system allows. Never
commit a key file. Share your key id with people by another route, so they can check that a bundle
came from you.

**Carrier-safe profile.** One key per install means any two of your bundles share a key id, and an
ordinary bundle records the exact save time and the page address. For a bundle that leaves your
hands, tick Carrier-safe on the card page, pass `--carrier-safe` to `analyze` (with `--page
<address>` only if you want the address in it), or call `makeBundle(result, { profile:
"carrier-safe", typedPage })` and then `signCarrierSafe(bundle)`. The bundle then carries
`"profile": "carrier-safe"`; a key made for it alone, never stored or written to a file;
`savedAt` as the day only (`YYYY-MM-DD`, which `schema/evidence.v1.json` accepts from 3.2.0); every
time of day inside it blanked to spaces of the same length, so span offsets still hold; no page
address unless one was typed; and the tool's major version only. `verify` adds a `profile` check
that says: carrier-safe, the signature proves the bundle is unchanged and says nothing about who
made it. Verifiers before 3.2.0 refuse a day-only `savedAt` at the schema step. The profile cannot
hide two bundles sent from one connection, and it strips nothing from your own files.

**Verifying.** `node bin/radar.mjs verify bundle.json`, or Check a bundle on the Analyse a file
page, or the offline kit's `verify-offline.html`. All check that the key id matches the key, that the signature matches the content, that
every item's posts are listed, and, when text is included, that every span is the text at that
place. The CLI also checks the schema.

What a valid bundle does not prove: that the holder of the key is who they say, that the posts
said what the spans say when text is left out, or that the evidence is right. It shows the bundle
has not changed since that key signed it.

## What this does not prove, and what is not done

- The evidence describes posts as given. CMMNS cannot tell whether a saved page or an export was
  edited before it reached it. A signature covers the bundle, not the input.
- Every item's limit applies here as it does in the extension: a sign is something to look at,
  never a finding about a person.
- The saved-page readers are tested on synthetic pages built to match X's and Reddit's current
  markup, not on a corpus of real saved pages. Old Reddit, Mastodon and Bluesky saved pages read as
  one text. A site redesign can break a reader until CMMNS is updated.
- The Bluesky `.car` reader is tested on a synthetic repository built in the test, not on a real
  export.
- Media bundles are not offered: a media result names no posts.
- CMMNS is not on npm. The API is versioned and the schema is published in this repository.
