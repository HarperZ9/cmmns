# Save all likes

Save every post you liked on X, with its pictures and videos and the same note as a one-click save,
into the folder your other saves are in. Posts already saved are skipped, so running it again adds
only new likes. X first; Bookmarks, Reddit, YouTube and the others follow in a later change.

## Use

1. Open your likes on X (`x.com/i/history/likes`; the older `x.com/<you>/likes` works too). The bar in
   the lower left reads **Save all likes**.
2. Choose **Command line fetch** (fastest) or **Save in the browser**, and the pace (unpacked build).
3. Press **Save all likes**. The page is scrolled at the pace you chose; every liked post X sends the
   page is listed once. The bar counts found, listed (or saved), already saved and failed.
4. With Command line fetch, press **Copy fetch command** and run it in a terminal:

       cmmns likes fetch --watch

   It fetches the files as the page lists them, and stops ten minutes after the last new one.
5. **Pause** keeps everything; **Stop** writes the manifest. A reload, a closed tab or a browser restart
   keeps the record, and the bar then offers **Resume saving likes**.

**Import like.js** reads `data/like.js` from your X data archive (Settings, Your account, Download an
archive of your data) on this computer. It is the complete list of your likes, so the bar can count how
many are still missing, and `cmmns likes missing --archive like.js` lists them.

## How it works

Two halves with one contract (`src/core/likes.js`). Each stage is a small pure function with one
input and one output, in this order:

| stage | where | input to output |
|---|---|---|
| parse | page | X's GraphQL JSON to posts (`parseLikes`, over `tweetsIn`) |
| pick | page | a media entry to one file: pictures at `name=orig`, videos at the highest-bitrate MP4 (`pickLikeFile`, one pass) |
| dedupe | both | post id to known or new: one `Set` lookup before any request (`admit`, `isKnown`) |
| name | page | post and file to the file name, the post id at the end (`fileName`, `sidecarName`) |
| fetch | CLI or page | address to bytes on disk |
| hash | CLI | bytes to SHA-256, compared only with saved files of the same size |
| sidecar | CLI or page | post and file names to the `daylight.sidecar/1` note, `from: "x-likes"` |

**Discovery** runs in the page and reads only what X already sent it: sniff.js passes on the GraphQL
responses X's own app requested, and nothing else is requested. Each new post becomes one manifest line,
written into `Downloads/CMMNS/library/x-likes/manifest-0001.jsonl` and on, 500 lines a part.

**Fetching** runs in the command line (`bin/lib/likes.mjs`, `bin/lib/likes-net.mjs`, Node's standard
library): one HTTP/2 connection per media host, reused for every file, 8 files at once (`--jobs`),
retries with backoff, a 429 waited out with its Retry-After and the width halved, and a cut-off file
resumed from its `.part` with a range. X's media hosts need no sign-in, so this half carries no cookie
and does not touch the account. **Save in the browser** does the same through the page's own saver,
four posts at a time, for the store builds and when the command line is not installed.

## Folders and duplicates

Files and notes land in `Downloads/CMMNS/x/`, the folder one-click saves of X posts already use, so
earlier saves and likes sit together. The manifest lives in `CMMNS/library/x-likes/`.

A post is skipped before any request when:
- the page: its id is in this run's record or in a library's record, or every file's address is in the
  saved list (`pb.saved.v1`);
- the command line: its id is in any file name under the CMMNS folder (every save name ends in the post
  id). A downloaded file whose size and SHA-256 match a file already there is not kept; the note names
  the earlier file. Hashes are cached in `CMMNS/.cmmns-hashes.json`.

A post whose every file failed gets no note, so the next run tries it again.

On the **Boards** page, **From my likes only** keeps notes a likes run wrote and earlier saves of posts
a likes manifest lists; **Posted from** and **to** keep a date range.

## Pace and account risk

The pace is the account's protection. X decides how many timeline pages one account may load in a
while, and each scroll near the end loads the next 20 likes. Careful (the default) waits 2.4 to 6.3 s
between steps of 1 to 1.6 screens, with a longer pause now and then; Reading and Brisk are shorter.
By the step sizes this asks X for its next page about once every 30 to 60 s at careful (inferred, not
measured on X). The scroll stops at once when X shows "Something went wrong", Retry, or a rate-limit
message, and the run is kept so it can be resumed later. Downloads never pace the account: they go to
the public media hosts.

Auto-scroll ships only in the unpacked and self-distributed builds (`src/ext/likes-scroll.js`, held back
by `scripts/zip.mjs`, checked by `tests/store-build.test.js`), the same split as the library's. The
store builds keep the collector: posts are listed as you scroll yourself.

## Privacy

Nothing is sent anywhere by discovery; the manifest is a file in your Downloads. The bar is hidden with
the in-post Download buttons, so it is hidden in source-protection mode. Save in the browser refuses to
start in source-protection mode and stops when it is turned on. `cmmns likes fetch` refuses while the
command line's protection mode is on (`cmmns protect status`). No private X API is called from outside
the page, no credential is read, and no limit is worked around.

## Measured (2026-10-30)

Real Chromium 141.0.7390.37 (Playwright build 1194) with the unpacked extension loaded, a local server answering
for x.com, pbs.twimg.com and video.twimg.com with a 60 ms first-byte delay, one Windows machine. R&D
harnesses: `scripts/eval/save-timing.mjs` and `scripts/eval/likes-timing.mjs`.

Single saves, median of 3 runs, until every file is complete on disk:

| case | before | after |
|---|---:|---:|
| 1 picture (1.5 MB) | 352 ms | 275 ms |
| 4 files (3 pictures and a 12 MB video) | 481 ms | 370 ms |
| 20 posts as a library (mixed, 82 MB) | 5096 ms | 2084 ms |

200 liked posts (180 files, 288 MB), one run each, scrolling driven as fast as the page loads:

| path | seconds | likes a minute | MB/s |
|---|---:|---:|---:|
| before: library capture, one post at a time | 41.1 | 292 | 7.0 |
| after: library capture, four at a time | 18.1 | 663 | 15.9 |
| Save all likes, in the browser | 17.1 | 701 | 16.8 |
| Save all likes, command line (discovery 9.1 s, fetch 2.4 s) | 11.5 | 1043 | 25.1 |

Stage costs per item, command line run: dedupe 0.001 ms, fetch 95.6 ms (8 at once), hash 8.7 ms,
sidecar 0.3 ms. In the browser run: parse 0.04 ms, dedupe 0.06 ms, fetch 366 ms and sidecar 240 ms
(both four at a time, through the browser's download manager).

Where the time goes:
- In the browser the download manager is the ceiling: six posts at once was no faster than four
  (19.1 s), and each note costs a browser download of its own.
- On the command line the fetch of 288 MB took 2.4 s here; on the real CDN it is bounded by the
  connection.
- On the real site the paced scroll is the bottleneck by a wide margin: at careful, discovery is tens
  of likes a minute, against a thousand a minute for fetching. Faster discovery means a faster pace,
  which is the account-risk tradeoff above. The archive's like.js lists every id but no media
  addresses, so it is a checklist, never a source of files.

Not measured: a run on the real x.com with a signed-in account; the CDN's own limits.

## The delays found in the save path, and what changed

- Every picture was asked for twice: a 64 KB range to read its type, then the whole file. Now one
  request, read on when the words go inside the file (`src/ext/quick-fetch.js`).
- A library saved one post at a time, and each post's files one after another. Now four posts at once,
  index.jsonl still in the page's order (`src/ext/library.js`).
- A library wrote its whole record to storage after every post, a write that grew with the library.
  Now every 10 posts, two seconds after the last post, and on Stop.
- The saved list was read and written whole for every file saved (up to 20,000 entries each time). Now
  one write takes every entry noted while the last one was on its way (`src/ext/quick-saved.js`).
- Kept on purpose: the profile queue's gap in background.js (rate limit for account lookups, not saves);
  the scroll pace above; the wait for the browser to name each download, which is how a download the
  browser refused is reported instead of counted as saved.

## Follow-ups

X Bookmarks; Reddit upvoted and saved; YouTube Liked videos and Watch later (Save reference in every
build, the video only through `cmmns media fetch`); Bluesky and the fediverse where an adapter exists;
the official exports as checklists (Reddit's saved_posts.csv and post_votes.csv, Google Takeout); save
on like (a toggle, off by default); X's public oEmbed as a polite fallback for the text of archive
likes the page never showed.

## Verified

- `tests/likes.test.js`: the route by address and by structure, parse and pick, names, 200 simulated
  likes with duplicates and earlier saves, like.js, the record across a reload, the manifest, the stage
  clock, the Boards filters, the pace.
- `tests/likes-fetch.test.js`: the command line over a local HTTP/2 host: 200 likes, 30 earlier saves
  skipped before any request, 10 same-bytes files not kept, a 404, a 429, a resumed `.part`, a second
  run requesting only the failed post, the archive's missing list, and protection mode refusing.
- `tests/likes.browser.test.js`: headless Chrome on the simulated likes page: 200 entries counted once
  each across a reload, 30 earlier saves skipped, 160 listed, the archive checklist, X's error state
  stopping the scroll.
- `tests/store-build.test.js`: the store packages carry the collector and not the auto-scroll.
