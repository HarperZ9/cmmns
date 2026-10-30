# Refresh starvation on pages that never stop changing (2026-10-29)

The author reported that CMMNS' window was sometimes slow to appear, or did not appear, on YouTube.
This file records the live measurement behind the scheduler change in `src/ext/guard.js`
(`PBGuard.debounced`). Counts and times only; no post text was kept.

## Cause

Every page change rescheduled the refresh pass with `clearTimeout`. While a page added elements
more often than every 250 ms, the pass was pushed back again and again and never ran, so comments
that scrolled in were never wired and their window could not open. The scheduler now runs a pass
at most `HOLD_MS` (1 s) after the first waiting change, or after the stretched wait when slow passes
stretched it past that.

## Method

Chromium 141 (Playwright build 1194) with the unpacked extension, a fresh profile, a YouTube watch
page (`dQw4w9WgXcQ`) with the video playing muted, 24 scroll steps of 380 px, 350 ms apart. A copy of
the extension, changed only to count calls, timed each pass. A watcher in the extension's own
isolated world noted, every 20 ms, when each comment first came on screen and when it was wired.
Every other step the pointer rested on the newest visible comment and the run checked whether the
window opened within 1.2 s. "Old" is 4f163fd; "new" is this branch.

The harness first measured nothing: the extension opens its welcome tab in front on install, so
the watch page was a background tab, drawing about one frame a second with the video paused. The
harness now closes that tab first.

## Results

Natural page (YouTube's own changes only), 5 runs old, 4 completed runs new:

| | comments never wired | wire time p90 | windows opened |
|---|---|---|---|
| old | 20, 0, 0, 1, 0 of about 60 | 5.2 s, 0.2 s, 0 s, 0.5 s, 0.9 s | 1/11, 10/12, 11/12, 11/12, 10/12 |
| new | 1, 0, 1, 0 of about 60 | 6.9 s, 0.3 s, 0.3 s, 0.8 s | 8/12, 10/12, 9/12, 10/12 |

One old run in five starved (passes up to 17 s apart, 20 comments never wired, 1 window in 11).
The other runs do not separate old from new: YouTube's own changes usually pause for 250 ms often
enough. One new run also had a slow tail (6.9 s at p90, with only 9 page changes counted, so the
comments arrived in one late batch); one more new run hung the harness for five minutes before its
first measurement, and its cause was not found.

Page changing every 150 ms (a span added to the page by the harness, as a live chat or a feed
does), 2 runs old, 4 runs new:

| | passes in about 60 s | comments never wired | windows opened |
|---|---|---|---|
| old | 2, 2 | 60 of 60, 42 of 62 | 0/11, 5/12 |
| new | 27, 25, 22 (median 1.04 to 1.08 s apart) | 0, 1, 1 of 60 to 61 | 10/12, 9/11, 9/11 |

The last two new runs include the change that holds to the stretched wait after slow passes; no
pass was slow enough in them to stretch it.

The window opens about 520 ms after the pointer rests (450 ms by design) in both versions when the
comment is wired.

## What this does not show

Five natural runs on one video, one machine. It shows the starvation exists and that the change
removes it under constant change; it does not measure how often real pages produce that pattern.
