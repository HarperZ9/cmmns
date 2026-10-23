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
