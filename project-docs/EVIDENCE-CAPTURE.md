# Evidence capture mode (3.7.0)

Status: the first part is built in 3.7.0; "What 3.7.0 builds" below says which parts. The rest of
this page is the design it follows. It builds on the one-click save (3.6.x), the sidecar
format (`project-docs/SIDECAR-FORMAT.md`) and the case workbench (`cmmns case`, `src/investigate/`).

## What 3.7.0 builds

- **Capture as evidence**, a right-click item on a picture, video or sound. It saves the file and its
  note as a normal save, then adds `<name>.capture.png` (the visible part of the page) and
  `<name>.capture.json` (the record, `daylight.capture/1`) beside them in `<save folder>/<site>/`.
  The right-click grants the page picture (activeTab); the hover and in-post buttons do not, so they
  do not capture.
- **Hashes before words.** Each file's SHA-256 is taken on the bytes the page served, before the
  description is written into the file; the saved copy's own hash is kept beside it.
- **The transparency record**: for every part of the capture, what survived, as a clarity from 0 to
  1 where it can be measured (the file 1; engagement as the share of the six counts the page showed;
  the account as display name and handle out of 2; the page picture as visible height over page
  height) and null where the loss is known but not its size (a text the page cut off, a thread that
  could not be proved, a GIF made in the page). Parts not taken in this release say so with 0: the
  page snapshot and trusted time.
- **Custody chain**: one line per capture, kept in this browser, each naming the SHA-256 of the line
  before; the record's own hash is in its line. `cmmns capture verify <folder>` re-hashes every
  file, picture and record, checks every line and link, and names lines saved elsewhere as gaps.
- **Not built yet:** the stitched full-page picture, the MHTML or WARC snapshot (it needs the
  `pageCapture` permission), the signed log (the case key lives with `cmmns case`; the browser has
  no key yet), RFC 3161 and OpenTimestamps time, the Internet Archive request, and filing captures
  into a case. Without a signature, someone who rewrites the last line and its hash is not caught;
  every earlier change is.

## The claim view: a claim over its sources

The evidence board (`cmmns board make --layout evidence --case ...`) draws each claim as a sheet
over the plates of the sources it cites, printed by the one sheet engine CMMNS has
(`src/core/discourse/sheets.js`). Two readouts, paired: the sheet's ink coverage is the source's
reach (the views the page showed, as a share of the widest), and the provenance line's opacity is how far the
source is corroborated by the claim's other sources from other origins (another site or another
account; 0.25 alone, full at three). The line also says it in words, so neither readout depends on
seeing opacity.

## Two checks on the sourcing (src/core/claim-checks.js)

- **Same headline, different sourcing** (`headlineMetamer`): two items whose headlines read the same
  but rest on different sources. The matching readout hides the difference; listing the shared and
  unshared sources splits it.
- **A quote clipped from its source** (`clippedQuote`): the quoted words appear in the source, but a
  negation or qualifier within six words either side (not, never, but, unless, allegedly, ...) was
  left out. The same words in a different arrangement can carry the opposite meaning.

Both are tested on constructed examples (`tests/capture.test.js`). Neither is wired into a view yet;
they flag, and the person reads the source.

- **Origin collapse** (`originCollapse`, built and tested): many items that each cite one and the same
  upstream source count as one upstream. Five outlets relaying one wire story read as 5 items, 1
  upstream. Corroboration on the claim sheet already counts origins, not copies.

## Claim language as readouts (design notes)

Language indicators are readouts, each with its measured rates, never verdicts. They apply to every
actor, country and side on the same terms, and they describe posts, never the people who wrote them.

| Indicator | State in 3.7.0 | Ground |
|---|---|---|
| Dehumanising terms | built (the reading lens) | precision 92.5% (37/40; 80.1 to 97.4) and a 0.2% false-positive rate (12/5,046) in project-docs/EVALUATION.md |
| Coordinated phrasing | built (the campaign lens) as indicators | not measured: project-docs/CAMPAIGN-LENS.md claims no precision or recall yet |
| Loaded framing | built as weak families (conspiracy, absolutist, essentialise); weak families never label a post alone | shown as context only: the corpora label hostility, not framing (project-docs/EVALUATION.md) |
| Emergency language | design only | no detector and no measured rate yet; it ships only with a rate on known cases |
| Paraphrase metamer (one claim in different words across posts) | design only | needs a meaning readout (an entailment check), with a control that splits a real paraphrase from a near one; word overlap is a bag-of-words readout and cannot tell them apart, so it is not used |

Any risk reading that combines indicators must state its base rate and its record on past cases
(hits, misses, false alarms) before it is shown. Without that it stays a design note.

## The problem

A journalist or researcher who saves a post needs more than the file. They need to show later what
the page displayed, when, to whom, and that nothing changed since. Today that takes a screenshot tool,
an archiver, a hash tool and a notes file, done by hand and in a hurry. Evidence capture makes it one
click on the same Download, Study or hover control.

## How it starts

- A setting, "Capture as evidence", that makes every save an evidence capture, or
- Shift and click on Download (hover control, X and Reddit button), or the right-click item
  "Capture as evidence".
- The capture goes into a case: the last case used, or one the user picks once per session.

## What one capture holds

| Part | Source | Notes |
|---|---|---|
| The artifact | the same bytes the quick save writes | SHA-256 of the exact bytes, before any description is written into the file; the embedded copy gets its own hash |
| The words | the `daylight.sidecar/1` note | text, author, times, quoted and parent posts, thread, links, poll |
| Engagement at capture | the numbers the page shows on the post | replies, reposts, quotes, likes, views, bookmarks, each as text with its label; null when not shown |
| The account as shown | the post and any profile card on the page | display name, handle, join date if shown, verified mark if shown, follower count if shown |
| Thread position | the page | parent and quoted post addresses and texts, the replies already loaded (addresses and authors) |
| Full-page screenshot | `chrome.tabs.captureVisibleTab`, scrolled and stitched | PNG, hashed; the scroll offsets are recorded |
| Page snapshot | `chrome.pageCapture.saveAsMHTML` where the browser has it (Chrome); a WARC built from the files the capture fetched where it does not | needs the `pageCapture` permission, asked when the user turns capture on |
| Local time | the computer's clock, UTC and the offset | always |
| Trusted time | an RFC 3161 timestamp from a TSA the user names, or an OpenTimestamps proof | opt-in; sends only the SHA-256 of the capture's manifest |
| Archive request | Internet Archive "save page now" | opt-in; sends the page address |

The two opt-ins say in the settings and on first use what they send and to whom, as the existing
evidence lookups do (`project-docs/EVIDENCE-LAYER.md`).

## Chain of custody

- Each case keeps an append-only log, one JSON line per event: who (the user's case key id, not a
  name), what (capture, export, note, correction), when, from where (page address, browser and
  version, CMMNS version), and the hashes involved. Each line names the hash of the line
  before it, so a removed or edited line breaks the chain.
- The log is signed with the user's case key (`bin/lib/keys.mjs`), the same key `cmmns case`
  already uses for signed bundles. The key stays on the computer.
- Exports reuse the existing legal, newsroom and research profiles (`bin/lib/export.mjs`): every file is listed in the manifest with its SHA-256, and the
  manifest is signed.
- "Share clean" (built separately with the source-protection work) strips the context that could
  expose a source, such as the capturing account, local paths and loaded replies, from a copy meant
  for sharing. The original capture is kept as it was.

## Berkeley Protocol alignment

The Berkeley Protocol on Digital Open Source Investigations (OHCHR and UC Berkeley, 2022) asks for
online inquiries to be documented so others can follow and test them. The capture maps onto its
preservation and verification guidance:

| Protocol element | Capture |
|---|---|
| Collect the item and its context | artifact, words, engagement, account, thread position, page snapshot |
| Record how and when it was collected | local time, tool and version, browser, method in the log |
| Preserve integrity | SHA-256 at capture, hash-chained log, signed manifest |
| Keep a chain of custody | the append-only signed log, exports with hashed manifests |
| Protect the investigator and sources | no data leaves the machine unless an opt-in is on; Share clean |

This is an alignment note, not a certification. No body has reviewed CMMNS against the
Protocol.

## Does not prove

A capture shows what the page displayed to this browser at that time. It does not show that the
content is true, that the account is who it claims to be, or that the platform did not alter the
content before it reached the browser. A trusted timestamp shows the capture existed by that time;
it says nothing about when the content was made.

## Privacy

Nothing leaves the machine unless the user turns on an opt-in, and each opt-in names what it sends.
The capture records nothing about the person saving beyond the key id they chose and the software
versions. Screenshots can include the capturing account's own name in the page chrome; the capture
crops to the page content, and Share clean removes the rest.

## Build plan (the design's original order; items 1, 3 (in part), 5 (verify) and 6 are built)

1. `src/core/capture.js`: the capture record and the log line, pure, with tests for the hash chain.
2. Page side: engagement and account readers per site (X, Reddit, Bluesky first), from what is shown.
3. Worker side: stitched screenshot, MHTML, case write through the existing case store.
4. Opt-ins: RFC 3161 client and OpenTimestamps client, both sending only a hash.
5. `cmmns case` reads captures, verifies the chain and exports with the existing profiles.
6. Browser check on real public posts; a tamper test that edits one byte and one log line.
