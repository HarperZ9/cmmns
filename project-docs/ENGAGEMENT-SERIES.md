# Engagement over time for saved posts

Status: built, unit-tested on fixtures (`tests/engagement-series.test.js`, the plan's seven
acceptance tests plus wiring and sighting checks) and checked live on YouTube (see Limits). Approved by the author on 2026-10-29 after the plan of that date.

## The problem

The tastemaker lead-time study (F26) could not be tested. The archive held one engagement reading
per post, taken at save time, so "spread" could only mean "the author saved more of it". A spread
measure needs the same posts read again over weeks, at known ages, and ideally the posts of accounts
the author never saved.

## What it does

Three parts, each behind its own switch in the options page ("Engagement over time"). None of them
makes a request. Every reading comes from data the platform's own page already loaded for the user.

| Part | Switch | Default | What it keeps |
|---|---|---|---|
| 1. Re-read saved posts | `trackSeries` | on | Each saved post's id, handle, post and save time; a reading each time the page's data carries it, at most one per post per 6 hours |
| 2. Reading schedule | `trackRemind` | off | Nothing more. A daily alarm counts the due readings and shows the count on the toolbar badge; the collections page lists them |
| 3. Seen-post log | `seenLog` | off | Every post the page loads: id, handle, times, counts, hashtags, link domains and the SHA-256 of each media address. No post text, no pictures. Kept `seenDays` days (90 by default, 1 to 365) |

Part 2 is off by default because a badge that asks for a visit spends the user's time; the user
turns it on when they run a study. Part 1 is on because it is passive and local.

### Part 1: passive re-reading

- A save (one-click Download, a text note, a library capture) calls `PBTrack.saved(meta)` in
  `src/ext/track.js`, which sends the post's address, author, times and save-time counts to the
  worker. `trackEntry` keeps X posts by their numeric id, Reddit posts by their `t3_` id and YouTube
  videos by their video id. A Reddit comment, a page or any other site is not tracked.
- The save-time counts become the first reading (`source: "save"`) when they are whole numbers.
- `track.js` reads X's post data (the responses `sniff.js` already passes on, including the
  replay of responses that arrived before it started), YouTube's player data (`videoDetails`,
  `microformat.publishDate`, passed on by `ytsniff.js`) and the attributes of Reddit's
  `shreddit-post` elements (`score`, `comment-count`, `created-timestamp`). `sniff.js` and
  `ytsniff.js` needed no change: they already post everything this reads.
- The worker (`src/ext/track-bg.js`) keeps a reading only for tracked posts, at most one per post
  per 6 hours (`SERIES_GAP_MS`), with the post's age in hours. Readings happen when the user browses
  near those posts, so they are irregular. The analysis models growth against post age, never
  against reading order.

### Part 2: the reading schedule

- Target ages: 1, 3, 7, 14, 30 and 90 days after posting. Each age has a window from the target to
  a quarter of the target later, at least one day: day 1 is days 1 to 2, day 30 is days 30 to 37.5.
- A reading inside a window marks it done. A window still open with no reading is due. A window
  that closed with no reading is missed, and the miss is written into the post's record (`missed`)
  and never filled in. A window that closed before the post was saved is "before tracking", not
  missed.
- `chrome.alarms` runs once a day: it records misses, prunes the seen log to its retention and,
  with the reminder on, sets the badge to the due count ("99+" above 99) and the button's title to
  "CMMNS: N readings due". Source-protection mode keeps its "P" badge; the count waits.
- The collections page lists the due posts (up to 50) with "Next", which opens the first one in the
  same tab. The user drives every page load; the alarm itself opens nothing and fetches nothing.

### Part 3: the seen-post log

F26's strongest test needs the spread of accounts the author never saved. With the switch on,
every post in the page's data is logged at most once per 6 hours. These are public posts the page
showed the user; handles appear only as authors of those posts. The log stays in this browser.
"Delete seen log" in the options removes it, and entries older than the retention go daily.

## Storage

IndexedDB database `cmmns-track` under the extension's origin (`src/ext/track-store.js`):
`tracked` (key `"<platform>:<id>"`), `readings` (indexed by post), `seen` (indexed by time) and
`seenLast`. At most 20,000 tracked posts: past that, posts whose schedule has finished go first,
oldest save first, then the oldest saves, each with its readings. At most 240 readings per post:
past that, the reading closest to the one before it goes, and the first and last always stay.
"Clear all CMMNS data" deletes the database's contents too.

## Export

"Export engagement series" in the options writes, through the downloads permission, into
`<save folder>/engagement/`:

- `engagement-series-<date>.jsonl`, one reading per line, sorted by time;
- `seen-log-<date>.jsonl`, when the seen log holds anything;
- `engagement-series-<date>.manifest.json`: format `cmmns.engagement-series/1`, counts, the target
  ages, the throttle, the tracked posts with their missed ages, and each file's line count and
  SHA-256 over its exact bytes.

The studyrun stage reads these files. Nothing is sent anywhere.

## Code

- `src/core/engagement-series.js`: pure. Building a reading from parsed page data, the throttle,
  the schedule and due list, the caps, JSONL and the manifest.
- `src/ext/track-store.js`: the store, over a small backend (IndexedDB in the extension, an
  in-memory copy in `tests/fixtures/track-memory.js`).
- `src/ext/track.js`: the page side. `src/ext/track-bg.js`: the worker side and the alarm.
- `src/ext/options-series.js`, `src/ext/collections-series.js`: the switches, export, deletes and
  the due list.

## Limits

- What it does not prove: a reading is what the platform's data said when the user happened to load
  the post. Platforms round, delay and recount. A missed age stays missed, so a series has gaps.
- Posts with no known post time are scheduled from their save time. X gives the time in its data
  (and in the post id); YouTube gives a publish date; Reddit gives `created-timestamp`.
- The seen log grows with browsing. At heavy use it can hold hundreds of thousands of entries in 90
  days; the daily check and the export read whole stores. Not yet measured at that size (unknown).
- X's terms on automated access were not re-checked for this build, because the feature makes no
  automated access: there is no timer that loads posts.
- Live check, 2026-10-29, Chromium with the unpacked extension, on YouTube only (X and Reddit were
  not checked live; their readings are tested on fixtures). A save through the hook tracked the
  video; with the reminder on, the badge read "1" and the collections page listed "day 1"; Next
  opened the video in the same tab and the page's player data gave one reading (views, age 25 hours),
  after which the badge cleared. With the seen log on, a reload logged the video and one other video
  whose player data the page loaded. The only request from an extension page was the user's Next
  navigation. The check found a player response with a two-letter "video id"; sightings now need an
  11-character id.
