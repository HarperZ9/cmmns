<!-- writing-profile: research -->
# Investigate: case folders for open-source investigation

`cmmns case` keeps an investigation in one folder: every source captured and hashed, every
claim on a rung with its source, the chain from each retelling back to its origin, a timeline, an
amplification network, ranked leads and a log of missing records. `cmmns case run` builds all
of that from screenshots, URLs or a claim with nobody at the keyboard, and exports a dossier that
anyone can check offline. The extension adds one button, "Add to case", which keeps the address of
the page you are on for a later `case add`.

Five commands (`npm link` once makes `cmmns` (and the older `daylight`) the same as `node bin/radar.mjs`; inside a case
folder `--case` can be left out):

    cmmns case init "Harbour sale"
    cmmns case add https://example.org/council-minutes --case harbour-sale
    cmmns case claim "The council voted 7-2 to sell" --source S01 --rung documented --case harbour-sale
    cmmns case trace C01 --case harbour-sale
    cmmns case export --profile newsroom --case harbour-sale

The rest of this file covers the record format, the pipeline, the safety defaults, how the tool
compares with what journalists use now, the targets that follow, and a test against a case built
by hand.

## Where it comes from

Fourteen cases were worked by hand on 2026-10-23 (the Shirley, Musk and Ukraine, Kushner and Cole,
voting machines, Graham, DHS playbook, Land network, ritual abuse and Bukele and Ecuador cases, and
the feed-test claim and timeline checks). Four were read closely to extract the workflow: Musk and
Ukraine, Shirley, Land network, and feed tests 4 and 11. Each one did the same things by hand:

| Step done by hand | Command now |
|---|---|
| A claim inventory sorted into rungs (documented, strong inference, weak signal) | `case claim`, `case claims` |
| A source log: URL, access date, read mode, Wayback lookup, sha256 | `case add`, `sources.jsonl` |
| Captures with hashes, X posts from the public post-data endpoint | `case add`, `captures/` |
| Origin tracing: "ten outlets relaying one wire story count once" | `case trace` |
| Claim drift: which details each retelling added | `case trace` (word diff per hop) |
| Timeline checks with verdicts and contradictions | `case timeline` |
| Who amplifies whom, one public act per edge | `case network`, `case edge` |
| Open leads ranked by how decisive the record would be | `case lead`, `case leads` |
| "Absence is data": deleted, edited, sealed, missing records | `case absent` |
| Documented record kept apart from inference and insinuation | rungs; insinuation gets none |
| Blind dual labelling with agreement | `case label`, `case labels` (Cohen's kappa) |
| Obfuscation-aware corroboration (2026-10-22 CLAIM-DRIFT note) | self-sourced claims count zero; near-copies collapse |

## The record

A case is a folder with its own git repository. Every command that changes it makes a commit, so
the handling log is the history.

| File | One row per | Key fields |
|---|---|---|
| `sources.jsonl` | captured source | `url`, `accessed`, `read_mode`, `capture.sha256`, `archive`, `origin`, `post` |
| `claims.jsonl` | claim | `text`, `source`, `rung`, `retells` or `corroborates`, `self_sourced`, `status`, `spans` |
| `events.jsonl` | dated event | `date`, `text`, `source`, `key` |
| `edges.jsonl` | public act | `from`, `to`, `type` (quote, reply, repost, mention, link), `source` |
| `leads.jsonl` | open question | `record`, `holder`, `access`, `decisive` (1 to 5), `claims`, `check_url` |
| `absent.jsonl` | missing record | `status` (deleted, edited, sealed, withheld, missing), `custodian` |
| `actors.jsonl` | account | `handle`, `public_figure` |
| `labels.jsonl` | blind label | `claim`, `labeller`, `rung` |
| `proposals.jsonl` | machine proposal | `kind`, `status`, `proposed_by` |

Rungs: **documented** (the record shows it; a person's own words prove that they said them),
**inference** (stated as inference, with its evidence), **unproven** (investigation open; never
written as clearance), **contradicted** (the record contradicts it). Insinuation gets no rung.

### Origins and drift

`case trace C05` walks from a claim back through its retellings to the root, shows a word-level
diff for each hop, and names what changed: numbers, names, certainty words added, hedges dropped,
quotation marks added. Independent origins are the root plus every claim that corroborates it,
counted after three collapses:

- claims whose sources share an origin (`--origin Reuters` on `case add`) count once;
- near-copies of one press line (word 3-shingle similarity of 0.6 or more) count once;
- self-sourced claims (the subject's own word, `--self-sourced`) count for nothing.

### Timeline flags

`gap` (more than `--gap` days without an event inside the case window), `date-conflict` (two events
with one key and different dates), `after-source` (an event dated after the source that reports
it), `rung-conflict` (one key, one documented claim and one contradicted).

### Exports

`case export --profile newsroom|legal|research|all` writes a new numbered version under
`exports/<profile>/` when the case has changed, with `CHANGES.md` against the previous version.

- **newsroom**: `DOSSIER.md` and `.html`, claims first with their evidence inline, then timeline,
  network (`network.html`, an inline SVG that works offline), leads, absences and the reading.
- **legal**: a chain-of-custody bundle in the manner of the Berkeley Protocol: for each item the
  address, collection time and method, hash at collection and at export, archive copy and the
  handling log; the captures themselves, except those by accounts not marked public figures.
- **research**: JSON Lines tables, W3C PROV-O provenance (`prov.jsonld`) and MLCommons Croissant
  1.0 metadata (`croissant.json`) with a sha256 per file. Capture text is left out.

Every export carries `SHA256SUMS` and `case.evidence-bundle.json`, a signed CMMNS
evidence bundle whose items are the content address of every file. It checks offline in
`docs/verify-offline.html` or with `radar verify`; `case verify-export <folder>` also rehashes each
file. The signature shows the export is unchanged since the holder of the key signed it. It does
not show who holds the key or that any source told the truth.

## The pipeline: `case run`

    cmmns case run screenshots/ urls.txt "a claim to check"

Seeds: a folder (screenshots, URL lists, saved X records, the extension's `case-inbox.jsonl`), a
URL (an X post brings its reply and quote chain), or a claim in quotes. Twelve stages run in order:
ingest, capture, archive, claims, primary, trace, timeline, network, leads, absences, read, export.
Stages that add sources (primary records found through links) cause the earlier stages to run again
on the new sources before the export.

- **Idempotent.** Each item is checkpointed in `.run/state.json` when it finishes and skipped next
  time. Every row an item writes carries the item's tag; an interrupted item is purged and run again,
  so a crash leaves no duplicates. `tests/investigate.run.test.js` kills a run in the claims stage,
  resumes it, and checks every table and export file against a clean run.
- **Watchdog.** Each item runs under a two-minute limit and is recorded as an error when it runs
  over. A lock with a heartbeat keeps two runs off one case; a stale lock (dead process, or ten
  minutes without a heartbeat) is taken over and the run says so.
- **Screenshots.** A transcription file beside the image (`shot.png.txt`) is used first. A PNG
  without one is read by the built-in OCR. Anything else waits in the review queue. The header line
  gives the author, the footer gives the day, and both are blanked from the text claims come from.
- **Model steps are optional.** Claim extraction, record queries and the dossier summary can use a
  local model through any command (Flywheel's relay, a llama.cpp wrapper), an OpenAI-compatible
  endpoint the user configures in `case.json` (`models`), or none. With none, claims come from rules
  and the rest waits for review. Hashing, capture, diffs, origin counts, timelines and exports never
  use a model.
- **Review.** Everything a machine proposed lands as `proposed` with its source span. `case review`
  shows each item with the text around its span; one key accepts or rejects it. The dossier lists
  proposed claims apart from reviewed ones and names who accepted each item.
- **Watch.** `case watch` re-reads every captured URL and every open lead's public search address.
  It flags edited pages (with a word diff), deleted posts, new archive copies, and changed search
  results that may settle a lead, and writes them to `CHANGELOG.md` under the date. `--export`
  regenerates the dossiers when anything changed. `case watch --schedule` prints a cron line and a
  Windows `schtasks` line; the tool never stays resident.

`DAYLIGHT_CASE_REPLAY=<map.json>` serves every request from saved files, so a run can be repeated
offline from its captures. `DAYLIGHT_CASE_NOW` fixes the clock.

## Safety defaults

- **Private accounts are pseudonyms in every export.** Handles, profile addresses and recorded names
  become salted `acct-` ids unless `case actor @handle --public-figure` marks the account. The salt
  is per case, so two cases cannot be joined on pseudonyms.
- **No login-gated content.** Requests carry no cookies and no credentials. A 401, a redirect to a
  sign-in address, or a page that is little more than a sign-in form is refused and logged as
  withheld. A sign-in box in a long article's header does not count.
- **Nothing leaves the machine unless asked.** `case add <url>`, `case run` and `case watch` fetch
  the addresses given (and, for X posts, the public post-data endpoint). They ask the Wayback Machine
  to save a page only with `--archive`, or when `case settings archive on` is set for the case: a
  save request tells the page's server and the Internet Archive who is looking and when, and the
  copy is public. `--no-archive` still works and wins over the setting. `case watch` asks the
  Archive whether it holds a copy only when the archive setting is on. A configured model endpoint
  receives source text. Every other command works offline.
- **Source-protection mode** (`case settings protection on`, or `cmmns protect on` for every
  case) refuses every request: add pages you saved in your browser as files. Exports are Share clean
  (`lineage/clean.jsonl` in the case keeps each original-to-clean hash pair, outside the export),
  carrier-safe (a one-time key, the day only), every account is a pseudonym unless marked
  `--keep-name`, and the case's own history names the investigator only as "investigator" with the
  day. `cmmns protect limits` lists what it cannot protect against. Not yet independently
  reviewed: project-docs/SECURITY-REVIEW.md. The extension's "Add to case" keeps addresses in the browser
  and sends nothing.

## What journalists use now

Checked 2026-10-23 against each project's own site or repository; licences from the GitHub API.

| Tool | What it does well | Where CMMNS can lead |
|---|---|---|
| Hunchly | Captures every page visited automatically, with URL, time and hash; tagging, search and reports with an audit trail; local storage with a cloud option. Commercial, paid. | Free and AGPL; claim, rung, drift and origin records that Hunchly does not model; exports that verify offline with no account. |
| Bellingcat Auto Archiver (MIT) | Archives posts and pages in volume (over 150,000 items by Aug 2025), video through yt-dlp, Wayback backup, chain of custody and perceptual hashing since its 2025 update. | Analysis on top of capture: claims, origins, drift, timeline, leads; a dossier per profile. Its capture breadth (video, many platforms) is ahead of ours. |
| Maltego | Link analysis graphs fed by a large catalogue of data transforms. Commercial, with a limited free edition. | Every edge carries its source and a does-not-prove line; offline, free. Maltego's data integrations are far ahead. |
| OCCRP Aleph / OpenAleph (MIT) | Search across very large leaked and public datasets, entity cross-referencing. OCCRP ended open-source maintenance after December 2025 for the hosted Aleph Pro; the OpenAleph fork continues. | A case-sized, offline record that needs no server. Aleph's scale and dataset cross-referencing are not our target. |
| ICIJ Datashare (AGPL-3.0) | Local search over document troves, named-entity extraction, runs offline, collaborative server mode. | Claim and source records, origin counting and drift for the web and social posts Datashare does not capture. |
| DocumentCloud (AGPL-3.0) | Upload, OCR, annotate, and publish documents with embeds. | Capture of live pages and posts with hashes; offline verification. Its annotation and publishing are ahead. |
| InVID / WeVerify plugin (MIT) | Video keyframes, reverse image search, metadata and forensic filters in the browser. | Case records around what the plugin finds. Media forensics is its ground; ours stops at Content Credentials. |
| Meedan Check (MIT) | Collaborative fact-checking with tiplines on messaging apps, claim clustering, review workflows. | Single-investigator offline work, origin counting, signed exports. Its team workflow and tiplines are ahead. |
| Bellingcat toolkit | A curated, maintained list of investigation tools by task. | Not a tool; a source for what to integrate next. |
| Wayback Machine, archive.today | Third-party archive copies others can cite. | Each capture records the Wayback request and its result; archive.today has no public API, so it is not called. |
| Berkeley Protocol (UN OHCHR and UC Berkeley, 2022) | The standard for digital open-source investigations: inquiry, assessment, collection, preservation, verification, analysis. | The legal export follows its preservation and verification steps; it is a guideline, not a certification. |

## Targets, feature by feature

Each line names the best competitor for the feature today, where CMMNS stands, and the target.
"Ahead" and "behind" are about the feature, measured on our own fixtures; none of these is a claim
about a competitor's internals.

| Feature | Best now | CMMNS 3.4.0 | Target |
|---|---|---|---|
| Automatic page capture while browsing | Hunchly | one-click "Add to case", capture later | capture with hash on the click, still nothing sent |
| Platform breadth (video, Telegram, TikTok) | Auto Archiver | web pages, X posts, local files | the extension's own platform readers as capture sources |
| Chain of custody | Auto Archiver, Hunchly | hash at collection and export, git handling log, signed bundle | RFC 3161 timestamp option; second-party witness of the bundle hash |
| Claim inventory with rungs | none found | yes | blind labels on every claim before export, kappa in the dossier |
| Origin counting and drift | none found as a tool | word diff per hop, three collapses | cross-language retellings; paraphrase linking measured on a labelled set |
| Contradiction detection | Meedan Check (clustering, by hand) | dates and rungs by key | number and date conflicts across differently worded claims |
| Link analysis | Maltego | sourced edges, offline SVG | layouts that stay readable past 200 nodes |
| Document search | Datashare, Aleph | none | read Datashare and Aleph exports as sources |
| Media forensics | InVID / WeVerify | Content Credentials only | import the plugin's findings as sourced records |
| Collaboration | Check, Datashare server | git (one folder, many clones) | merge two investigators' cases with conflicts shown |
| Leads ranked by decisiveness | none found | yes, with public search re-checks | court docket and filing feeds read by `case watch` |
| Offline verifiable export | none found with a signed bundle | yes, all three profiles | the same check inside the extension |

## Test against a case built by hand

The Musk and Ukraine case was built by hand on 2026-10-23 (46 sources, a CASE.md with short
answers, a timeline, contradictions, a coordination hypothesis and eight leads). Two tests:

1. **Migration.** `scripts/case-example-musk.mjs` moved it into the format (`examples/musk-ukraine-case`):
   47 sources with their hashes, 26 timeline events from the old tables, 19 claims, 4 edges, 8
   leads, 5 absences, 12 blind labels (agreement 0.833, kappa 0.769). "Who decided" counts 2
   independent press origins (Telegraph, WSJ); Musk's own line is self-sourced and not counted.
   The old folder was only read.
2. **`case run` from the URLs alone.** The 44 source URLs and the author's sentence were run
   through the pipeline with rules only, served from the hand case's own captures through a replay,
   with no archive requests (the original brief asked for none). 27 URLs had a raw capture to
   replay; the rest (paywalled pages read in a browser, Truth Social posts read through an API,
   USAspending queries) had none, so those sources are missing from the run.

What the run found that the hand case also found: the speed cap at 161 km/h, the Shahed interceptor
effect, Zelensky's EU road test and "planned operation", Rubio's "categorically false", Musk's
"ultimately POTUS" line, the Hegseth denial, the Vanity Fair account figures and the NOS report, each
as a proposed claim with its span.

What it missed: every finding that needs reasoning across sources. It did not attribute the three
press origins (Reuters, Telegraph, WSJ) or count them; it did not see that the official accounts
contradict each other; it did not test "denying aid" or "threatening Democrats" against definitions;
it did not authenticate the Trump letter (no Truth Social capture path); it did not write the
coordination hypothesis; its 61 leads are generic where the hand case's 8 were specific. It
proposed 245 claims, most of which a reviewer would reject.

What it found that the hand case did not:

- **A conflation in the hand case.** The hand case says the Vanity Fair excerpt describes "a UAE
  bank account that had received about $750M from a bank in Azerbaijan". Extracted sentences from
  the excerpt keep two accounts apart: account "Alpha" at First Abu Dhabi Bank received "roughly
  $750 million" from the Saudis and Emiratis, and a separate Dubai account held money that "had come
  from a bank in Azerbaijan". NOS gives the $750 million the Saudi and UAE origin too. The migrated
  example records both claims and notes the correction; the old CASE.md is unchanged.
- **Amplification edges** the hand case did not map: Musk quoting @marsrepublica and @KanekoaTheGreat
  and replying to @WesternLensman, each from the captured post records.
- **Repeated paragraphs** across Ukrainska Pravda articles, linked as copies so they count once.
- **A dated mention after its source**: the SpaceX 10-Q names 2026-10-27, after its own filing date,
  flagged for a look (a scheduled event, on reading).

**Does not prove.** That the pipeline replaces the hand work. On this case it is a fast first pass
over captured text and a check on the hand-made record; the findings that mattered most still came
from a person reasoning across sources.
