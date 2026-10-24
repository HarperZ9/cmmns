<!-- writing-profile: research -->
# Media toolkit and ad blocking (3.6.0)

Daylight Commons 3.6.0 keeps the media people need to revisit: for an investigation, for reference, or for a design moodboard. It saves what a page loaded, converts and compresses it on the device, and records a hash chain from every copy back to the original. Ad and tracker blocking is a separate switch. Machine results of the browser check are in `project-docs/evidence/qa-3.6.0/`.

## Save

- **Where it starts.** The toolbar menu's **Save media from this page**, or **Save to Daylight** in the right-click menu on any image, GIF, video or audio. Either click lets the extension read the current tab once (`activeTab`). `src/ext/media-scan.js` lists the images, GIFs, video, audio and large CSS background images the page loaded, and the HLS and DASH addresses in the page's resource timing.
- **Video.** A direct file address is fetched as it is. A video the page builds in memory (a `blob:` source) is saved from the HLS or DASH manifest the page fetched: `src/core/media-hls.js` and `media-dash.js` read master and media playlists, SegmentTemplate (with `$Number$`, `$Time$`, SegmentTimeline and width tags), SegmentList and single-file BaseURL manifests, and `src/ext/media-fetch.js` fetches the segments four at a time and joins them. HLS becomes an MPEG-TS file or, with an init map, a fragmented MP4; a separate audio rendition or DASH audio set is saved as its own file. A live stream saves what it lists at that moment, and the result says so. Streams larger than 1.5 GB are refused.
- **Protected media is never touched.** The save stops, with a plain sentence, when the page plays the element through Encrypted Media Extensions (MediaKeys attached), when an HLS playlist carries any `EXT-X-KEY` or `EXT-X-SESSION-KEY` other than `METHOD=NONE` (AES-128 and SAMPLE-AES alike), when a DASH manifest has any `ContentProtection`, or when the fetched file carries MP4 encryption boxes (`encv`, `enca`, `sinf`, `tenc`, `pssh`, `senc`, read only inside `moov` and `moof`) or WebM ContentEncryption. Nothing in the settings changes that (`src/core/media-protect.js`, `tests/media-stream.test.js`).
- **Access.** The Save click asks the browser for the one host the file or manifest comes from; a stream whose segments sit on another host asks again on a second click. Files are fetched as the page fetched them, with the browser's cookies for that host.
- **Collections.** Each file is hashed (SHA-256) and kept in this browser's IndexedDB (`src/ext/media-store.js`), once per hash. A case save also adds a row to the case list with the address, page, time, hash and lineage; `daylight case add case-inbox.jsonl` captures and archives each address again on the command line. A tick box asks the Internet Archive to keep a copy of the file's address at save time (web.archive.org access asked on that click). A moodboard save takes tags and a note. The collections page shows a grid per case or moodboard, filters by kind, tag and text, and writes a JSON list with every hash and step.

## Convert and compress

Fully local, with no server and no new runtime dependency. `src/ext/convert.html`:

| From | To | How |
|---|---|---|
| PNG, JPEG, WebP, AVIF, GIF first frame | PNG, JPEG, WebP, AVIF where the browser can write it | `createImageBitmap`, OffscreenCanvas, `convertToBlob` with a quality; a browser that hands back PNG for a format it cannot write is caught and told |
| GIF | MP4 (H.264) or WebM (VP9, else VP8) | Daylight Commons' own GIF decoder (`src/core/media-gif.js`), WebCodecs `VideoEncoder`, Daylight Commons' own muxer |
| Video | WebM (VP9 and Opus) or MP4 (H.264 and AAC, else Opus) at a lower height, bitrate or frame rate | the browser plays the file muted and hands each frame to `VideoEncoder` (`requestVideoFrameCallback`); the sound is decoded at 48 kHz and re-encoded with `AudioEncoder` |
| Audio | Opus in WebM or in Ogg | `decodeAudioData` at 48 kHz, `AudioEncoder`, Daylight Commons' Ogg writer |

The muxers are hand-written: `media-webm.js` (EBML with Cues), `media-mp4.js` and `media-mp4-boxes.js` (moov before mdat, `ctts` when needed, `co64` past 4 GB, `esds` and `dOps`), `media-ogg.js` (RFC 7845 granules and page CRCs). Their tests read every output back (`tests/media-mux*.test.js`); on CI runners with ffprobe they are also probed.

Every result shows the size before and after, both hashes and the step. A copy of a saved item is kept beside it with `lineage`: each step's operation, parameters, tool, time, sizes and the hashes it went from and to. `checkLineage` (`src/core/media-collect.js`) rejects a chain whose steps do not link, and the collections page runs it on every draw.

`daylight media convert <file> --to <format>` and `daylight media compress <file>` do the same on the command line through a system ffmpeg (`FFMPEG` names another binary), write `<new file>.lineage.json`, and never replace the original.

### Sizes on three sample files (Chrome 155, headless, 2026-10-24)

| Sample | Step | Before | After |
|---|---|---|---|
| 1920 by 1080 PNG (ffmpeg's mandelbrot pattern) | to WebP, quality 0.8 | 955 KB | 77 KB (92% smaller) |
| 480 by 270 GIF, 4 s, 60 frames (ffmpeg test card) | to MP4 (H.264), 1 Mbit/s | 333 KB | 94 KB (72% smaller) |
| 1280 by 720 MP4, 8 s, H.264 at 8 Mbit/s with AAC (ffmpeg test pattern) | to WebM, 480p, 1 Mbit/s, Opus 96 kbit/s | 7.6 MB | 858 KB (89% smaller) |

Two more ran in the same check: the same MP4 to MP4 at 720p and 2 Mbit/s (7.6 MB to 2.2 MB) and a 10 s WAV to Opus in Ogg at 64 kbit/s (1.8 MB to 80 KB). ffmpeg 7.1 decoded every output with no errors. The samples are synthetic patterns; real photographs and footage compress differently, so these figures show the pipeline works and do not predict a ratio for your files.

## Ad blocking

`declarativeNetRequest` static rulesets compiled from EasyList and EasyPrivacy by `scripts/adblock-build.mjs` (12,900 rules from list versions 202610240032 and 202610240036; `data/adblock-lock.json` pins each list's SHA-256 and every skip reason). Cosmetic filters, regular expressions and options the engine cannot express are skipped and counted. Host filters that share options are merged into `requestDomains` rules, so no filter was dropped for the 30,000-rule budget. No rule blocks a page the user opened (`main_frame`).

Both rulesets ship disabled. The **Block ads and trackers** switch (toolbar menu and Options) turns them on; it is separate from every reading feature. **Allow ads on this site** adds one `allowAllRequests` rule for that site and its subdomains, above every list rule. Pausing Daylight Commons turns the rulesets off too. The browser does the matching; the extension holds no `declarativeNetRequestFeedback` permission and never sees which requests were blocked. In the browser check, two ad scripts loaded with blocking off, both were blocked with it on, and both loaded again once the site was allowed.

## Limits

- Pages that build video from sources other than HLS or DASH manifests (for example YouTube's own streaming) cannot be saved; the card says the page builds the media in memory.
- `http:` media cannot be saved from the extension in normal use: the optional host permission covers `https:` only.
- Video conversion runs at playback speed and needs `requestVideoFrameCallback` and WebCodecs: Chrome and Edge, and, from their documentation, Firefox 132 and later (not tested in Firefox here). Chrome on this machine writes PNG, JPEG and WebP but not AVIF, and says so.
- Ad blocking is network blocking only: no element hiding, no scriptlets.
- The collections live in one browser profile. Clearing site data for the extension, or **Delete all saved media**, removes them.
