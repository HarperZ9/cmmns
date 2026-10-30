<!-- writing-profile: research -->
# Source protection, Share clean and the self-audit: checklist for an independent review

Status: **not yet independently reviewed.** Every surface that offers source-protection mode says
so. This file is for the reviewer: what each feature claims, where the code is, how the claim is
tested today, and what we want an outside reviewer to try to break. Findings go to the project's
security contact (SECURITY.md); the coordinated-disclosure terms there apply.

## What is claimed

| Feature | Claim | Code | Tested by |
|---|---|---|---|
| Wayback opt-in | `case add` and `case run` make no Wayback save request unless `--archive` or the case's archive setting asks; `case watch` asks the Archive's availability API only with the setting on | `src/investigate/add.js`, `stages-gather.js`, `watch.js`, `bin/lib/case.mjs` | `tests/protection.test.js` records every request |
| Protection, command line | With `cmmns protect on`, `DAYLIGHT_PROTECT=1` or `case settings protection on`, no case command makes a request: `case add <url>`, `--archive` and `case watch` are refused, `case run` blocks every capture, and a remote model endpoint is refused | `src/investigate/protection.js`, `bin/lib/case-protect.mjs`, `case-run.mjs` | the same test: the injected fetch is never called |
| Protection, exports | Exports are Share clean, signed with a one-time key (carrier-safe), keep the day of every time only, pseudonymise every account unless `--keep-name`, and record the investigator as "investigator" in git with the day only | `src/investigate/export.js`, `export-clean.js`, `bin/lib/case-env.mjs` | `tests/protection.test.js` |
| Protection, extension | While on, the extension makes no request of its own: no About lookups (worker window or the in-page request), no Reddit account reads, no evidence lookups, no Other coverage, no Archive copy, no download from a host (save page, one-click Download, the right-click Download menu). It also writes no seen-post log entry (engagement series, Part 3), whatever that switch says | `src/core/settings.js` (`PROTECTION_FORCES`), `src/core/engagement-series.js` (`planSightings`), `src/ext/background.js`, `auto.js`, `reddit.js`, `media-fetch.js`, `quick-save-bg.js`, `save.js` | `scripts/qa/protect_check.py`: network capture during a save in protection mode |
| Share clean | The copy carries none of the file's own metadata in JPEG, PNG, GIF, WebP, MP4/MOV/M4A, WebM/MKV, PDF, OOXML and ODF; pixels, frames and samples are byte-identical; a second pass finds nothing; a file it cannot read is refused | `src/core/clean*.js` | `tests/clean.test.js` (byte scan of planted markers, structural identity), `scripts/qa/clean_check.py` (decoded frames with Pillow and ffmpeg) |
| Self-audit | Runs only on the user's own account: the page's own signed-in markers or the user's own export; no handle can be entered | `src/core/self-audit.js`, `src/ext/selfaudit*.js`, `bin/lib/protect.mjs` | `tests/self-audit.test.js` |

## What we want a reviewer to try

1. **A request in protection mode.** Find any path that reaches the network while the mode is on:
   a content script, a background listener, a page, a CLI command. Include prefetching by the browser
   that CMMNS triggers (for example an `<img>` or `<video>` it builds with a remote address).
2. **Metadata that survives Share clean.** Formats and placements we may have missed: JPEG APP
   segments after the first scan, MPF secondary images, HEIC/AVIF (not supported: they should be
   refused, check that), PNG chunks after IDAT, fragmented MP4 (`moof` with `meta`), QuickTime
   `©xyz` in odd places, Matroska attachments with unknown size, PDF incremental updates with an
   Info dictionary in an object stream (we refuse it; check the refusal holds), PDF annotations
   (`/T` author fields are not removed and we say so), OOXML comments and tracked-change authors
   (not removed; we say so), ICC profiles with text in tags we do not list.
3. **Clean copies that link back.** Anything in the clean file that ties it to the original: the
   neutral file name, zip timestamps, the lineage record (it must never be inside the shared file).
4. **Carrier-safe exports that identify.** The one-time key, the day-only times, the tool version
   (major only), and whether two exports from one case can still be linked by their content.
5. **The self-audit as a profiling tool.** Any way to run it on someone else: spoofed page markers
   on x.com, the localhost test harness (`data-pb-fixture="own-profile"` is honoured only on
   localhost and 127.0.0.1), a crafted export file.
6. **False confidence.** Whether the limits screen is shown where it matters (first switch-on, every
   protected export) and whether the wording promises more than the code does.

## Known limits, stated to users

- No Tor or network anonymity is built in; users are pointed to Tor Browser.
- The device, the platforms' own logs, screenshots, faces, voices and writing style are out of reach.
- A user's own browsing still loads each site's pages; protection covers what CMMNS itself sends.
- PDF annotation authors, OOXML comment and tracked-change authors, and printer tracking dots are
  not removed by Share clean.
- Turning protection off leaves the switched-off features off until the user turns each back on.
- Protection mode deletes nothing by itself. Seen-post log entries written before it was turned on
  stay on the device until the user deletes them; the protection page shows how many and offers a
  two-step delete (decision of 2026-10-29: the mode is one click and reversible, a delete is not).

## Does not prove

The tests above show the code does what it claims on the fixtures and fakes they use. They do not
show that no path was missed, that the fixtures cover real files from every camera, phone and
editor, or that the mode protects a person facing a capable adversary. That is what this review is for.
