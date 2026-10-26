# Evidence capture mode (design for 3.7.0)

Status: design. Nothing here is built yet. It builds on the one-click save (3.6.x), the sidecar
format (`project-docs/SIDECAR-FORMAT.md`) and the case workbench (`daylight case`, `src/investigate/`).

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
  version, Daylight Commons version), and the hashes involved. Each line names the hash of the line
  before it, so a removed or edited line breaks the chain.
- The log is signed with the user's case key (`bin/lib/keys.mjs`), the same key `daylight case`
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

This is an alignment note, not a certification. No body has reviewed Daylight Commons against the
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

## Build plan (after 3.6.1 ships)

1. `src/core/capture.js`: the capture record and the log line, pure, with tests for the hash chain.
2. Page side: engagement and account readers per site (X, Reddit, Bluesky first), from what is shown.
3. Worker side: stitched screenshot, MHTML, case write through the existing case store.
4. Opt-ins: RFC 3161 client and OpenTimestamps client, both sending only a hash.
5. `daylight case` reads captures, verifies the chain and exports with the existing profiles.
6. Browser check on real public posts; a tamper test that edits one byte and one log line.
