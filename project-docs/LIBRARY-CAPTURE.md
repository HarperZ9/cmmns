# Library capture

Save a whole page's posts as one library: an X profile, list or search, or a Reddit user or
subreddit. Each post is saved once, with its media and the same sidecar note as a one-click save
(`daylight.sidecar/1`, SIDECAR-FORMAT.md), into one folder with an index of every file's hash. The
folder can be read as a study set, fed to other tools, or added to a case.

## Use

1. Open a library page. The bar in the lower left reads **Save page as library**.
2. Click it. From then on every post the page loads is saved, once each, as you scroll. The bar counts
   what is saved, skipped, already in the library and waiting.
3. Click **Stop**. index.jsonl and LIBRARY.md are written.

Opening the same page again later and clicking the button continues the same library: posts already
in it are counted, not saved again.

In the unpacked build and the self-distributed Firefox build the bar also offers **Scroll to the end**
with a cap (500 posts by default). It scrolls at a reading pace with jitter and stops at the end of the
feed, at the cap, or on Stop. The Chrome Web Store and Firefox Add-ons packages leave this out
(`src/ext/library-scroll.js`, held back by `scripts/zip.mjs` and checked by `tests/store-build.test.js`,
the same way as the YouTube command line hand-off): store policy and the sites' terms on automated
access would put the whole extension at risk. Collecting while you scroll ships in every build.

The bar is hidden with the in-post Download buttons (the same setting), so it is also hidden in
source-protection mode; turning protection on stops a running library.

## Pages

| Page | Library folder |
|---|---|
| `x.com/<handle>` and its Media, Replies and Highlights tabs | `x-<handle>` |
| `x.com/i/lists/<id>` | `x-list-<id>` |
| `x.com/search?q=<words>` | `x-search-<words>` |
| `x.com/hashtag/<tag>` | `x-hashtag-<tag>` |
| `reddit.com/r/<name>` (any sort) | `reddit-r-<name>` |
| `reddit.com/user/<name>` (Overview, Posts) | `reddit-u-<name>` |

The folder is `<save folder>/library/<library>/` inside Downloads (`Daylight/library/x-<handle>/` by
default). `src/core/library.js` `libraryOf` decides; `tests/library.test.js` lists what is and is not a
library page.

## What is kept and what is skipped

An account's library keeps everything the account put on its page, each item marked with its kind:
its own posts (`kind: "post"`), its reposts of other accounts' posts (`kind: "repost"`, with the
original's author, id and address under `original` and the reposting account under `repost_by`), and
on a Reddit user page its comments (`kind: "comment"`, with the parent post's id under `parent_post`
and the subreddit). Filtering on `kind` gives the account's own posts alone. Other accounts' posts that
the feed shows only for context (the post a reply answers), adverts, and posts drawn without an id are
skipped and counted in LIBRARY.md by reason. A list, search or subreddit keeps every author's posts; a
subreddit page collects no comments. Media that cannot be saved (protected by DRM, or refused by the
host) is left out; the item's note is still saved, and index.jsonl says why under `missing`.

## What each post keeps

Everything the page delivers in the clear about the post. The words in full (X's long-post text when
the page loaded it), every picture at the largest size the host serves and every video with its sound,
alt text, the quoted post and the post it answers, the author's proved thread, link cards and polls,
each link's target as well as its short link, and the engagement counts with the time they were read.
From X's own post data also the language, the posting app, the number of earlier versions, a Community
Note, X's paid-partnership mark, the original of a repost and the view count (`fields` in index.jsonl,
and the labels under their own headings in the note). From Reddit the title, flair, a link post's target,
the post type and domain, and the NSFW and spoiler marks. These are the site's records about the post,
kept as the site gave them. Nothing is fetched that the page did not already offer the viewer, and no
access control is worked around.

## Files

- `<handle>_<date>_<words>[-n]_<post id>.<ext>`: each picture or video, named like a one-click save with
  the post id added so two posts never share a name.
- `<handle>_<date>_<words>_<post id>.md`: the post's sidecar note, listing its files.
- `index.jsonl`: one line per saved post, in the order saved:
  `{"id", "url", "handle", "posted", "saved", "kind": "post"|"repost"|"comment", "content": "media"|"text", "files": [{"name", "sha256"}], "repost_by"?, "original"?, "parent_post"?, "subreddit"?, "missing"?, "fields"?}`.
  For a repost `handle` is the original's author.
  The sidecar is the last file. `sha256` is of the bytes written; it is null, with a `note`, for a file
  the host did not let the page read, which the browser saved as sent.
- `LIBRARY.md`: front matter (`format: "daylight.library/1"`, library, site, kind, author, posts,
  own_posts, reposts, comments, created), the source page addresses, each session's start and stop times and why it stopped, the
  skipped counts, and the scope note below.

The browser cannot add to a file, so index.jsonl and LIBRARY.md are written whole every 10 posts and
on Stop. The library's record is kept in this browser (`chrome.storage.local`, key
`pb.library.v1.<library>`); a tab closed before Stop loses nothing, and the next Stop writes it.

## Hand-off to a case

    daylight case add-library ~/Downloads/Daylight/library/x-<handle> --case <case folder> [--copy-media]

Every post becomes a source (`kind: "library-post"`) with its date, author and address, so `timeline`,
`claim`, `trace` and `read` run over it. The sidecar note is the capture. Each file's hash on disk is
checked against index.jsonl: `match`, `differs` (changed since it was saved), `missing`, or
`hashed-now` (saved unhashed). Media stays in the library folder unless `--copy-media`. Running it again
after the library grows adds only the new posts.

## Scope: evidence only

When the subject is a person, the tools show only what can be measured, with its method and
denominator, or quoted from the public posts, each linked to the post it came from. They never label a
person's character, disposition, beliefs not stated, honesty or intent, never predict what a person
will do, and never rank people on any of these. Two quotes on the same subject from different dates are
shown side by side, and a person reads them and judges. This note is in every LIBRARY.md and in
`daylight case add-library --help` (`LIBRARY_SCOPE` in `src/core/library.js`).

This release captures and imports. The measures over a library (cadence, topics, language, sources,
interaction counts, claim pairs over time, each with shuffled-date and shuffled-author controls) are
specified separately and are not built here.

## Verified, and not

- `tests/library.test.js`: library pages, the skip rules, the folder, index.jsonl and LIBRARY.md,
  resuming, the auto-scroll pace and stop rules, and `case add-library` with matching, changed, missing
  and unhashed files.
- `tests/library.browser.test.js`: the page scripts in headless Chrome on a fixture page served at
  `x.com`, with `chrome.*` recorded: the bar, one save per post, a repost kept as `repost` with its
  original, a context post skipped, a post loaded later saved, X's post data (an edit, a Community Note,
  a link target) in the index and the note, index.jsonl and LIBRARY.md on Stop with hashes that match
  the bytes, a reload continuing, and two overlapping saves (a library's and a study note) each landing
  in its own folder. That last test fails on the code before this change, which kept the folder in
  shared state.
- `tests/library.reddit.browser.test.js`: a Reddit user page (posts and comments in one index, each
  comment with its parent post and subreddit, a link post's target) and a subreddit page (every author,
  no comments).
- Not yet checked on live X or Reddit pages, signed in or out. The fixtures use the markup
  quick-sites.js reads; the Reddit comment element (`shreddit-profile-comment`) and its attributes are
  read defensively but have not been checked against Reddit's live markup.
  The fixture uses the markup quick-sites.js already reads; X and Reddit change theirs.
