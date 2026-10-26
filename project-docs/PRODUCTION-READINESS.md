<!-- writing-profile: research -->
# Production readiness: Daylight Commons 3.5.0

Date: 2026-10-23. Checked on the release branch built from `main` at 3.4.0 (`4b8b743`), with every fix
below applied. Each row is a check with how it was run, the result on 3.4.0 where it differs, and the
result on 3.5.0. Machine results are in `project-docs/evidence/qa-3.5.0/`; they hold synthetic stage
data, counts and public organisation URLs only.

How it was run:
- **Chrome.** Google Chrome 155, headless, a fresh profile per run, the packaged zip loaded unpacked
  through the DevTools protocol (`scripts/demo/browser.py`). x.com answered by the synthetic stage
  (`scripts/demo/stage.mjs`), so no request reached X. Production checks: `scripts/qa/prod_check.py`.
- **Live sites.** The same package in a fresh, signed-out profile on one public page per site
  (`scripts/qa/live_sites.py`). It reads what a signed-out visitor sees and clicks nothing.
- **Firefox.** Firefox 154, headless, fresh profile, the self-distribution xpi installed over
  WebDriver BiDi (`scripts/demo/firefox.mjs`).
- **Node.** `npm test` on Windows; CI runs the same on Ubuntu, Windows and, from 3.5.0, macOS.

## Results

| # | Area | Check | How | 3.4.0 | 3.5.0 |
|---|---|---|---|---|---|
| 1 | Install | Chrome zip loads in a fresh profile; first-run page opens on install | Chrome 155, `prod_check.py` | pass | pass |
| 2 | Install | Firefox self xpi installs in a fresh profile; first run, Options, Analyse a file, privacy page; an evidence chain checks; a reply's window opens on the stage | Firefox 154, BiDi, `firefox.mjs` | pass | pass |
| 3 | Install | `web-ext lint` on the Firefox package | web-ext 8.10.0 | 0 errors, 0 warnings (2026-10-21) | 0 errors, 0 warnings, 0 notices |
| 4 | First run | Welcome to the first useful sign in under 60 s | one click on Start, open a thread, rest the pointer on a reply until its window shows a sign | 4.2 s | 4.2 s (4.2 to 9.3 s over five runs; the slow run shared the machine with a second browser) |
| 5 | First run | No console errors from Daylight Commons on X, YouTube, Reddit, Bluesky, Mastodon, Threads, Facebook, Instagram, TikTok | live check, errors and exceptions counted in the extension's own script context | not measured | 0 errors on the 8 sites that loaded; see row 6 |
| 6 | First run | Each site's reader finds posts | live check, signed out, 3.5.0 package | not measured | YouTube 3 of 3 comments loaded (20 of 20 on an earlier run), Bluesky 49 of 49, Mastodon 60 of 60, Threads 15 of 15. X refused the signed-out headless visit (HTTP failure); Reddit served a bot check; Facebook, Instagram and TikTok showed a sign-in wall (Facebook's reader read 1 of the 2 items behind it). Those five are **not tested** on real posts here |
| 7 | Robustness | A changed page cannot break the site or stop Daylight Commons silently | code review of every content script entry point | **fail**: the message listeners and `site.read()` ran unguarded; one throw ended the whole refresh; errors went to `console.error` | fixed: `guard.js` wraps readers and listeners, logs one `[daylight-commons]` warning per kind per minute, keeps the last 50 for the self-test, and pauses a page after five failed passes |
| 8 | Robustness | Timeouts on every request a content script makes | code review | **fail**: Reddit account reads and X About requests had none | fixed: 10 s and 15 s `AbortSignal.timeout`; background lookups and feeds already had theirs |
| 9 | Robustness | Memory bounded on a long scroll | 3,000-post scroll soak, heap after garbage collection, page keeps 60 posts like X | **fail** in principle: post, author and pattern caches were unbounded; 600 posts grew the heap 0.12 MB per 100 posts | fixed: caches capped. Heap 13.1 MB at 40 posts, 15.2 MB at 1,000, 15.8 MB at 3,000 (levels off); DOM nodes flat at 804; with Daylight Commons off, 2.4 to 2.8 MB |
| 10 | Performance | Script cost per post in the browser | soak: script time with Daylight Commons on minus off, per post scrolled | 0.23 ms | 0.22 ms |
| 11 | Performance | Text work per post, first thread pass and each refresh, 500 replies | `scripts/qa/bench.mjs`, bundle in Node, three runs | 0.25 ms; 60 ms; 60 ms | 0.26 ms; 59 ms; 48 to 49 ms |
| 12 | Performance | Budgets enforced in CI | `tests/budget.test.js` | **fail**: none | per post 4 ms, thread pass 1,500 ms, refresh 1,500 ms (about three times what a Windows CI runner took), and a linear-growth check |
| 13 | Performance | Window open time | hover to first section heading, page clock, six replies | 474 ms median | 472 ms median, of which 450 ms is the deliberate hover delay (`pop.js` `OPEN_MS`), so about 22 ms of work |
| 14 | Security | MV3 permissions are the minimum | manifest against every API call | pass: `storage`, `scripting`, `activeTab`, the nine site hosts; any other host is optional and asked one at a time | pass, unchanged; each has a justification in `docs/store/LISTING.md` |
| 15 | Security | Extension page CSP | manifest | pass: `script-src 'self' 'wasm-unsafe-eval'`; WebAssembly is used by the image-text reader (`src/ocr/gemm-wasm.js`) | pass |
| 16 | Security | No remote code | search for remote scripts, `eval`, `new Function`, remote `import` | pass | pass |
| 17 | Security | Dependency audit | `package.json` | pass: no dependencies, nothing to audit | pass |
| 18 | Security | Post text cannot become markup | extension: no `innerHTML` anywhere; window, panel and spans built with `textContent` and the Highlight API. Case HTML: escaped | pass in the extension; case HTML escaped but scripts were allowed | pass; dossier and network pages also carry `default-src 'none'`; `tests/hardening.test.js` checks both and bans string-built markup in the extension |
| 19 | Security | Case imports and exports stay inside their folder | crafted `../` and absolute names | **fail**: a case row could name `../../x` for reading and for writing a transcript; `case import --with-captures` copied a file from outside the old folder; `verify-export` hashed files outside the export | fixed: `src/investigate/paths.js` refuses any name outside the folder; tests |
| 20 | Accessibility | axe on options, dashboard, welcome, popup, analyse, history, sites, learn, light and dark | axe-core 4.10.3 | popup: 2 moderate (no page heading; text outside a landmark) | 0 violations on every page in both themes |
| 21 | Accessibility | axe on the window and the thread panel | axe-core on the stage | 0 | 0 |
| 22 | Accessibility | axe on case dossier and network pages, light and dark | axe-core | 2 moderate (no main landmark) | 0 |
| 23 | Accessibility | Keyboard path | focus a reply, Alt+R into the window, Tab stays inside, focus visible, Esc closes | pass | pass |
| 24 | Accessibility | Contrast in light and dark | axe colour-contrast rule on every page above | pass | pass |
| 25 | Workbench | `daylight case` end to end on Windows, Linux and macOS | `tests/investigate.*.test.js` in CI on all three | Windows and Linux only | all three |
| 25b | Workbench | The command line runs when its path goes through a link | macOS CI: macOS temporary folders sit behind `/var` -> `/private/var` | **fail**: `bin/radar.mjs` exited 0 without running, so `verify` on an edited chain looked like a pass | fixed: the entry check compares real paths; found by the new macOS job |
| 26 | Workbench | Errors tell the user what to do | missing file, not a case folder, unknown command | **fail**: raw `ENOENT`, "Run case init" without the program name | fixed: "No such file or folder ... Check the path", the help command to run next; tests |
| 27 | Workbench | `--help` for every command | every case command and every top-level command | **fail**: one usage list only | fixed: what it does, usage and an example for each; `tests/cli.help.test.js` |
| 28 | Updates | Head-state rollback | `tests/head.test.js` | pass | pass |
| 29 | Updates | A same-version, different-head refusal says what to do | the published v3.4.0 release against a copy of this machine's `~/.radar/head-state.json` | **fail**: one sentence, no cause and no fix | fixed: what it means, both hashes, three steps; the state file is never changed. The real file was only read |
| 30 | Updates | Update channels | Chrome: unpacked copies do not update; Firefox: `updates.json` waits for a Mozilla-signed build | pass, as documented in INSTALL.md | pass, unchanged |
| 31 | Docs | INSTALL, a quick start per feature, troubleshooting, FAQ | `INSTALL.md`, `docs/guide/` | INSTALL only | all four; linked from the README |
| 32 | Store | Listing copy, privacy answers, permission justifications, 5 screenshots at 1280x800, promo tile 440x280, AMO source package | `docs/store/` | copy and synthetic screenshots | all, with real-post screenshots and a source package that remakes both generated files byte for byte (checked) |

## 3.6.0 additions

Checked 2026-10-24 on the 3.6.0 branch. Browser rows ran in Google Chrome 155, headless, fresh profile, with
`scripts/qa/media_check.py` on a local fixture site (synthetic image, GIF, video, sound, an HLS
stream, an AES-128 HLS stream and a video with ClearKey MediaKeys) and `scripts/qa/pressure_shot.py`
on the demo stage. Results and screenshots: `project-docs/evidence/qa-3.6.0/`. The budgets above are
unchanged and still enforced by `tests/budget.test.js`.

| # | Area | Check | How | 3.6.0 |
|---|---|---|---|---|
| 33 | Save | Save media from a page into a case and a moodboard | `media_check.py`: 7 items found; image, GIF, direct MP4, WAV and an HLS stream (4 segments joined into MPEG-TS) saved with their SHA-256 | pass |
| 34 | Save | Protected media is refused, never fetched | element with MediaKeys: card disabled with the reason; AES-128 HLS: "Not saved", no segment kept; `tests/media-stream.test.js` for SAMPLE-AES, session keys, DASH ContentProtection, MP4 `encv` and WebM ContentEncryption | pass |
| 35 | Convert | Local conversion, output decodes | PNG to WebP, GIF to MP4, MP4 to WebM 480p, MP4 to MP4 720p (H.264 and AAC), WAV to Ogg Opus; every output decoded by ffmpeg 7.1 with no errors | pass; sizes in `project-docs/MEDIA-TOOLKIT.md` |
| 36 | Convert | Hash lineage | `checkLineage` over every saved item after the conversions: 0 problems; `tests/media-collect.test.js` rejects forged and broken chains | pass |
| 37 | Convert | Command line | `daylight media convert` and `compress` on the same samples through ffmpeg; `tests/media-cli.test.js` runs a real conversion where ffmpeg is installed | pass |
| 38 | Ad blocking | Off by default, blocks when on, per-site allow | two ad scripts on the fixture: loaded (off), blocked (on), loaded (on, site allowed); both rulesets ship disabled | pass |
| 39 | Ad blocking | Rules match their pinned lists and stay in budget | `node scripts/adblock-build.mjs --check` (CI stage, skipped without the cached lists); 12,900 rules of a 30,000 budget; `tests/adblock.test.js` | pass |
| 40 | Pressure lens | Off by default; held-out score reproduced | `tests/pressure.test.js`; precision 89% (8/9), recall 17% (8/47), 0 of 41 ordinary messages marked | pass for the check; recall is low, see READING-LENS.md |
| 41 | Pressure lens | Window shows each move with its definition and limit, spans marked in the post | stage thread, screenshot `13-pressure-window.png` | pass |
| 42 | Performance | Text work per post, first pass and refresh, 500 replies | `scripts/qa/bench.mjs` | 0.32 ms; 75 ms; 64 ms (3.5.0: 0.26; 59; 48), inside the 4 ms and 1,500 ms budgets |
| 43 | Security | New permissions justified | `contextMenus`, `downloads`, `clipboardWrite`, `declarativeNetRequest` rows in `docs/store/LISTING.md`; `tests/store-listing.test.js` | pass |
| 44 | Security | No new dependency, no remote code, no markup from strings | `package.json`, `tests/hardening.test.js` | pass |
| 45 | Download | One click saves the file to Downloads with its real type and a readable name | `scripts/qa/quick_save_check.py`, 24 cases, Chrome 155 on Windows 11, signed out; each file reopened (Pillow for pictures, Chrome for video with sound decoded); `project-docs/evidence/qa-3.6.0/quick-save-check.json` | pass on 23 of 24; Imgur: see below |
| 46 | Download | X: pictures at original size, video and GIF posts with sound, Download as GIF | real public posts: JPEG 1041 by 941 from `name=orig`; a 60 s video put together from HLS as one 1920 by 1080 MP4 with sound; a GIF post as its MP4 and as a 76-frame GIF | pass |
| 47 | Download | Reddit: DASH video and sound rewrapped into one MP4; packaged MP4; whole gallery with one sidecar | Reddit's markup replicated on a local server mapped to Reddit's hosts (Reddit asks automated browsers to prove they are human): 10 s MP4 with sound; 3 gallery files and one `.md` | pass on the replica; not checked on reddit.com |
| 48 | Download | Overlays, srcset, canvas, frames, real HLS and DASH | a WebP behind a clear layer and a `.jpg` address saved as `.webp`; Wikipedia's largest srcset; canvas as PNG; a cross-origin frame; Angel One over hls.js (fMP4, separate sound) and shaka (DASH) as one MP4 each, 60 s with sound; Mux's test stream as MPEG-TS (479 MB) | pass |
| 49 | Download | Protected media refused, nothing saved | ClearKey MediaKeys on the element: "Protected, can't be saved", no download; `tests/media-quicksave.test.js`, `tests/media-demux.test.js` (encrypted HLS and Widevine DASH stop before any segment) | pass |
| 50 | Download | The post's words travel with the file | `.md` sidecar per save, `daylight.sidecar/1` (`project-docs/SIDECAR-FORMAT.md`); description inside JPEG, PNG, WebP, GIF and MP4 read back after download; `tests/media-meta.test.js` round trips with every sample unchanged | pass |
| 51 | Download | No duplicates; one folder tree | a second save of the same video: "Already saved as ..." with Save again; files under `Downloads/Daylight/<site>/` | pass |
| 52 | Copy | Copy, Copy link, Copy with caption | Wikipedia picture: clipboard holds `image/png`; Copy link holds the file's address | pass for Copy and Copy link; Copy with caption by unit test only |

How the browser check stands in for the right-click menu: a script cannot open Chrome's own menu, so
each case right-clicks the page for real and then runs the menu's handler with what Chrome passes on
a click. The test copy of the extension also holds `<all_urls>`, standing in for the one-tab access a
real menu click grants (`activeTab`). The menu items themselves, and Imgur's `.gifv` pages (the check
reached only a tag page and saved an animated WebP thumbnail from it), were not checked by hand.

Not tested for 3.6.0: the media toolkit, downloads and ad blocking in Firefox; the download path on
reddit.com itself and on signed-in X; a real right-click menu by hand.

## Protection additions (unreleased)

Checked 2026-10-25 on `feat/protect`. Browser rows: Google Chrome 155 on Windows 11 with the
unpacked extension, `scripts/qa/protect_check.py` against a local server that logs every request it
receives, beside the browser's own network events. Results and screenshots:
`project-docs/evidence/qa-protect/`.

| # | Area | Check | How | Result |
|---|---|---|---|---|
| 53 | Wayback | `case add` makes no Wayback request by default; `--archive` and `case settings archive on` make one; `--no-archive` still works | `tests/protection.test.js`, every request recorded by an injected fetch | pass |
| 54 | Protection, CLI | With protection on, `case add <url>`, `--archive`, `case watch` and a remote model are refused, and a whole `case run` on two URL seeds calls the fetch zero times | `tests/protection.test.js` | pass |
| 55 | Protection, CLI | Exports: Share clean, carrier-safe bundle that verifies, day-only times, no public-figure handle, lineage outside the export | `tests/protection.test.js` | pass |
| 56 | Protection, browser | Control first: with protection off a save downloads the photo again (1 request at the server). With it on, the same save, the right-click Download and an evidence lookup send nothing | `protect_check.py`: 1 request off; 0 at the server and 0 in the browser's network events on; the menu shows its refusal; lookup answers "off" | pass |
| 57 | Protection, browser | Indicator | toolbar badge reads P; popup line and the protection page say it is on | pass |
| 58 | Share clean | Every planted value gone from JPEG, PNG, GIF, WebP, MP4, MOV, WebM, PDF, DOCX, ODT; a second pass finds nothing; the caller's bytes unchanged | `tests/clean.test.js`, byte scan of DLSECRET markers including UTF-16 and inside zip parts | pass, 10 formats |
| 59 | Share clean | Nothing re-encoded | `tests/clean.test.js` (JPEG tables and scan, PNG scanlines, GIF frames, WebP VP8L, MP4 samples, WebM blocks); `scripts/qa/clean_check.py` decoded with Pillow and ffmpeg 7.1 framemd5 | identical in every format: 32 units each for MP4 and MOV, 54 for WebM, every image frame |
| 60 | Share clean | From the case UI | `protect_check.py`: Collections, Share clean one file and Share clean all (zip); no marker in either; the saved file gains its lineage record | pass |
| 61 | Self-audit | Refuses a signed-out page and someone else's profile; runs on your own signed-in profile; makes no request | `protect_check.py` on X-like fixtures: 0 signals, 0 signals, 8 signals; 0 requests during each | pass |
| 62 | Self-audit | No handle can be typed or passed | `tests/self-audit.test.js` (only file inputs in the page; the CLI refuses `@name` and URLs) | pass |
| 63 | Boundaries | No face recognition names in the code, no requests from the protection modules, no account linking, GPS read only by Share clean and never reported | `tests/protect.boundaries.test.js` | pass |

Found and fixed while checking: Share clean edited a Node Buffer's bytes in place (a Buffer's
`slice` is a view), so `daylight clean` wrote a lineage record whose original hash was the clean
hash. The cleaner now works on a private copy, and a test holds it. Case exports carried private
handles in `export.json` (row in CHANGELOG, Fixed).

Not tested here: protection mode in Firefox; real camera and phone files beyond the fixtures;
`exiftool -all=` as a reference (not installed on the check machine); an independent security
review (project-docs/SECURITY-REVIEW.md).

### Every path that fetches or archives for the user

| Path | What it sends, to whom | Default | In source protection |
|---|---|---|---|
| `case add <url>`, `case run` capture | the page, from the user's connection; X posts' public post-data endpoint | on the user's command | refused; add saved files |
| `case add --archive`, `case run --archive`, the archive stage | the address to web.archive.org/save | **off** (was on up to 3.6) | refused |
| `case watch` | each source again; open leads' search addresses | on the user's command | refused |
| `case watch` archive lookup | each source address to archive.org/wayback/available | off unless the case's archive setting is on | refused |
| `case run` with a model endpoint | source text to the configured endpoint | `models.provider: none` | refused unless on localhost |
| Extension: X About reads (in page and in the worker window) | X's own request for each account | automatic reads on | off |
| Extension: Reddit account reads | `/user/<name>/about.json` on reddit.com | on | off |
| Extension: evidence lookups | repo names and domains to GitHub, rdap.org, web.archive.org | off | off |
| Extension: Other coverage | the chosen outlets' feeds | off | off |
| Extension: Save to Daylight | the file from its host | on the user's click | refused except what the page holds in memory |
| Extension: "Ask the Internet Archive" on a case save | the file's address to web.archive.org | off (unticked) | disabled |
| Extension: Download, Download as GIF, Copy, the post Download button | the file from its host | on the user's click; buttons on | buttons off; menu items refused with a message |

## 3.6.1 additions

Checked 2026-10-25 in Google Chrome 155 on Windows 11, window off screen, fresh profile, signed out
everywhere, with `scripts/qa/hover_check.py` (real pointer moves and clicks on the drawn control, no
simulated menu), `scripts/qa/x_thread_check.py` (x.com mapped to a local fixture) and axe-core 4.10.2.
Summary: `project-docs/evidence/qa-3.6.1/hover-check.json`.

| # | Area | Check | How | 3.6.1 |
|---|---|---|---|---|
| 64 | Hover control | Shows on media, saves on click, page does not move | 15 sites: scroll height, width, scroll position and the media's box equal before and after the control shows; the saved file reopened | pass on Wikipedia, NASA, TikTok, Instagram, Pinterest, Tumblr, Bluesky, Vimeo, Imgur, YouTube (reference), a page that blocks right-click; Facebook drew the control but its sign-in wall blocked the click |
| 65 | Hover control | Never doubles the X and Reddit button | X post with the button: no control drawn | pass |
| 66 | Hover control | Accessible | axe on the control and its open menu: no violations in the control; every button 28 by 28 px or wider; visible focus ring; no animation; Escape and arrow keys in the menu | pass |
| 67 | Keyboard | Alt+Shift+D saves the media under the pointer | the command handler run with the tab Chrome passes (a script cannot press a browser shortcut) | pass (the file was already saved, so the duplicate note showed) |
| 68 | Text | X text post, selection, text card | a real X text post saved as a note with `files: []`; a Wikipedia selection saved from the control; a card PNG with the rendering line, checked by eye | pass |
| 69 | Thread defect | No continuation from adjacency | profile page with four unrelated posts by one author: no continuation; status page with X-shaped data: the two self-replies in order, `thread_complete: true`, another account's reply left out; `tests/media-thread.test.js` | pass |
| 70 | Side panel | Window moves to the panel and back | the panel shows the post window, its button runs in the page, no window over the page while it is open, the page's state resets when it closes | pass |
| 71 | YouTube | Reference only in store builds | a reference saved from a real video (thumbnail and note with the whole description); `tests/store-build.test.js` fails if either store package carries the command line hand-off | pass |
| 72 | CLI | `daylight media fetch`, `daylight sidecar check` | unit tests for the fetch plan and the sidecar built from yt-dlp's record; the check run on the author's own notes flagged the 17 saved by 3.6.0 with an unproved continuation | pass |

Not tested for 3.6.1: Firefox; signed-in sites; the shortcut pressed by hand; the control on
Facebook past its sign-in wall.

## What could not be tested here

- **X, Facebook, Instagram and TikTok on real pages.** They show posts only to a signed-in viewer,
  and this check never signs in. The X adapter is tested on the synthetic stage and by
  `tests/x-live-shapes.test.js`; the others by their fixture tests. A signed-in pass in the author's
  own browser is the remaining check.
- **Reddit on a real thread.** Reddit served its bot check to the headless browser.
- **Chrome Web Store and Firefox Add-ons installs.** Neither listing exists yet.
- **A signed Firefox build.** Mozilla has not signed one, so release Firefox keeps the add-on for one
  session only.
- **macOS by hand.** macOS is covered by CI only.
- **Memory over hours.** The soak covers 3,000 posts in about a minute; a session of hours on a real
  site was not run.

## Does not prove

These checks show the package installs, stays within its time and memory budgets on the pages tested,
logs instead of failing, and meets automated accessibility rules. They do not measure how often a sign
is right on real threads (project-docs/EVALUATION.md and READING-LENS.md do), and they are not a
security audit by an independent party.
