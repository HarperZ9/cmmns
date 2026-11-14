# Sidecar format: daylight.sidecar/1

Every download saves a Markdown file beside the media, with the same name and `.md`. It is the
contract between CMMNS and any library that reads saved media: the reference library, a
search index, a notes app. The format is versioned. A change that removes or renames a field, or
changes a field's meaning, raises the number; new optional fields may be added within version 1.

Written by `sidecarMarkdown` and `sidecarJson` in `src/core/media-meta.js`; tested in
`tests/media-meta.test.js`.

## Where files go

`Downloads/<save folder>/<site>/` (the save folder is a setting, `CMMNS` by default; left empty
it goes back to `CMMNS`). Study saves go to `<save folder>/study/<site>/`. The switch "Save
straight into Downloads" puts files in Downloads itself (Study in `study/<site>/`). `<site>` is `x`, `reddit`, or the host name of the page.

File names are `<handle>_<date>_<first words of the text>[-n]_<post id>.<ext>` for posts with an
author, for example `nasa_2026-10-23_ahh-blue-lagoon-this-deep-blue-sea-of-gas-and_1981234567890123456.jpg`.
The date is the post's date (UTC). `-n` numbers the files of one post. The post id comes from the
post's address (an X or Mastodon status number, a Reddit, Bluesky, YouTube, Instagram or TikTok id);
when the address has none, it is an 8-character hash (FNV-1a) of the post, media or page address.
The id keeps two posts with the same first words, or with no text (`post`), from asking for one
name, so the browser does not add ` (1)` and a note always names its own post's files. Names
from earlier releases have no id; nothing reads the id back out of a name, since the note's
`files` list is what ties it to its files, so old and new folders read the same. Other pages give
`<page title>-<file name>.<ext>`.

A post saved with the Download button gets one sidecar for all its files, named after the post (the
first file's name without `-1`). A single file gets its own.

### Taken names

When a name is already taken, the browser saves the file as `name (1).jpg` (then `(2)`, and so on).
`files` and the File line list the names the browser wrote, read back from it after each download,
and the sidecar takes the same suffix: `name (1).md` beside `name (1).jpg`, and `name (1).md` for a
post whose first file became `name-1 (1).jpg`. Notes saved by 3.8.0 and earlier could list the name asked for
instead. `cmmns sidecar check <folder>` reports them, and `--fix` repairs a note only when a file
carries the note's post address and was written within its save's time (from a minute before
`saved` to 15 minutes after).

## The Markdown file

It opens with front matter: one field per line, each value a JSON value (string, array), so YAML
and a line-by-line reader both parse it.

```
---
format: "daylight.sidecar/1"
files: ["nasa_2026-10-23_ahh-blue-lagoon.jpg"]
site: "x"
handle: "NASA"
author: "NASA"
posted: "2026-10-23T15:34:25.296Z"
saved: "2026-10-25T22:44:52.120Z"
post: "https://x.com/NASA/status/2113655288687431819"
media: "https://pbs.twimg.com/media/HVU2SLKW0AA7q0a?format=jpg&name=orig"
hashtags: ["#space"]
---
```

| Field | Always | Meaning |
|---|---|---|
| `format` | yes | `daylight.sidecar/1` |
| `files` | yes | the saved files this sidecar describes, in order |
| `site` | yes | `x`, `reddit` or the page's host name |
| `adapter` | yes (from the release after 3.9.1) | which reader made the record: a site's own (`"x"`, `"reddit"`, `"youtube"`, `"instagram"`), or the generic one, `"article"` when the page declares an article and `"generic"` otherwise. Notes from earlier releases have no `adapter` |
| `media_file` | when recorded | `"saved"`, or `"not saved (reason)"` where the page offered no plain file for the media, or a count of both for a page save |
| `canonical` | page saves, when the page gives one | the page's canonical address |
| `lang` | page saves, when the page gives one | the page's language tag |
| `handle` | when known | `NASA` on X, `u/name` on Reddit |
| `author` | when known | the display name |
| `posted` | when known | the post's time, UTC, ISO 8601 |
| `saved` | yes | when the file was saved, UTC |
| `post` | for posts | the post's address |
| `media` | single files | the address the file came from (the playlist for a stream) |
| `page` | pages without a post | the page's address |
| `subreddit` | Reddit | `r/name` |
| `hashtags` | when any | hashtags in the text |
| `item` | a single item of a gallery | `"2 of 4"` |
| `kind` | yes (from 3.6.1) | `"media"`, or `"text"` for a post or selection saved as a note with `files: []` |
| `selection` | selections | `true` when the text is a selection from a page |
| `flair` | Reddit | the post's flair |
| `text_complete` | when false | `false` when the page showed only the start of the text and no fuller copy was loaded |
| `study` | study saves | `true`; the file and note are in `<save folder>/study/<site>/` |
| `note` | study saves with a note | the one line on what draws the person to it |
| `edited` | when the site says so | `true` when the site marks the post as edited |
| `location` | Instagram, when tagged | the place name the post carries |
| `thread_file` | when comments were read | the name of the thread file beside this sidecar (see "The thread file") |
| `comments_expected` | with a thread file, when the site counts | the site's own comment count at save |
| `comments_expected_counts` | with a thread file | what the site's count covers: `"direct"` (X, replies directly under the post) or `"all"` |
| `comments_captured` | with a thread file | how many comments the thread file holds, at every depth |
| `comments_direct`, `comments_nested` | with a thread file | of those, how many sit directly under the post and how many deeper |
| `comments_continuations` | with a thread file, when the post's author is known | of those, how many are the post author's own continuation |
| `comments_complete` | with a thread file | `true`, `false`, `"empty"` when the site counted none and none were captured, or `"unknown"` when no count can check the capture |
| `comments_cap_hit` | when true | the user's cap stopped the "load more" opening |
| `analysis` | study saves from the discourse checks (a `<name>.parts.json` parts tree is saved beside the note) | the sign families whose analysis follows as `## Analysis: <label>` sections, such as `["quote-source", "doc-claim", "correction-replies"]` |

Fields added within version 1 are optional and only ever added. Readers should ignore fields they do
not know. Sections after the front matter may include `## Media` (every file of the post as the site
listed it, at full size, each with its alt text), `## Poll`, `## Link cards`, `## Chapters`,
`## Transcript (as the page showed it)`, `## Comments` (the thread as a person reads it, nested by
reply, opening with how many of the site's count were captured) and `## Not the whole post` (a save
that could only take what a thumbnail page showed, and why).

After the front matter, for people: a heading with the author, the post's text exactly as written
(as a quote, line breaks kept), the author's own continuation of the thread where the page had
loaded it, the alt text, the quoted or parent post with its address, then a list of the same facts
and the links in the text.

## The JSON file

Off by default (setting "Also save a .json file for tools"). One object:

`format`, `site`, `title`, `text`, `author: { name, handle }`, `postUrl`, `mediaUrl`, `pageUrl`,
`postedAt`, `savedAt`, `alt`, `hashtags[]`, `links[]`, `quoted: { text, url, author } | null`,
`parent: { text, url, author } | null`, `thread[]`, `subreddit`, `item: { index, total } | null`,
`files[]`. Unknown values are `null`. Within version 1 it also carries `items[]` (`{ index, kind, url,
alt, width, height }`), `quotedMedia[]`, `edited`, `location`, and, when comments were read,
`thread: { file, expected, expectedCounts, captured, capturedDirect, capturedNested, continuations, complete, capHit, cap, moreStubs, sentence }` in place of the
comment tree, which the thread file holds.

## A page save

"Save page" works on any page, with no site reader (`src/core/page-capture.js`,
`src/ext/page-capture.js`). It writes a note with `kind: "text"` and `adapter: "article"` or
`"generic"`, and always the `.json` record beside it. The note holds:

- the title, author and date the page states, taken from its citation tags first, then JSON-LD for an
  article, then Open Graph and article tags, then plain meta tags;
- the visible text of the selection, of the block under the pointer, or of the page's article or
  main block, without navigation, asides, forms and footers;
- `## Media`: each picture, video, sound and file link inside that block, with its address and a
  `File:` line that is the saved file's name or `not saved (reason)`;
- `## Page metadata`: the canonical address, the language, and the Open Graph, article, citation and
  JSON-LD values as the page wrote them. The `.json` record holds them in full under `page`.

A file is saved only when the page offers it as a plain address: an element's own source or a
download link. A segmented stream, a player's in-memory source and protected media are never
saved by a page save; the note lists them with the reason. One page save takes at most 24 files.
"Save as note" on such a page writes the same note and asks for no file. A selection keeps the
selected words and the addresses of the media inside it.

On YouTube the reference note carries `media_file: "not saved (...)"`, the caption tracks the
page's own data lists (language, name, and whether YouTube made the track by speech recognition)
under `## Caption tracks the page lists`, and the video's date from the player's own record.

## The thread file

`<sidecar name>.thread.json`, beside the sidecar, whenever the post's comments were read (setting
"Save the post's comments with it", on by default). Written by `captureThread` in
`src/core/capture-thread.js`; the page readers are in `src/ext/capture-sites.js`.

```
{ "format": "cmmns.capture-thread/2", "site": "reddit", "post": { "url", "id", "author" }, "savedAt", "source",
  "completeness": { "expected": 6, "expectedCounts": "all", "captured": 6, "capturedDirect": 2,
                    "capturedNested": 4, "continuations": 0, "missing": 0, "cap": 200, "capHit": false,
                    "moreStubs": 0, "expanded": 1, "complete": true, "reason": null, "countNote": null },
  "comments": [ { "id", "parent", "depth", "author", "text", "score", "postedAt", "timeShown", "edited",
                  "permalink", "flair", "deleted", "continuation", "links": [], "replyCount", "replies": [ ... ] } ] }
```

- `comments` is a tree: each comment under the one it answers. A comment whose parent was not on the
  page sits at the top with `parentMissing: true`; `siteDepth` keeps the site's own depth where it differs.
- `expected` is the site's own count, which can include deleted, removed or hidden comments; `countNote`
  says so when the capture is short of it. `expectedCounts` says what it covers. X counts the replies
  directly under the post, the author's own included, so `expected` and `missing` compare with
  `capturedDirect` there (`"direct"`). Other sites compare with `captured`, the whole tree (`"all"`).
  `capturedDirect` and `capturedNested` add up to `captured`.
- `complete` is `true` only when the capture reached a count above zero with nothing left to open,
  `false` when something is known to be missing (the cap, an unopened "more replies", a shortfall),
  `"empty"` when the site counted none, none were captured and nothing is left to open, and `"unknown"`
  when no count can check the capture: the site gave none, or it said zero against comments that exist.
  An empty thread has no `reason`, since there are no comments to go and find.
- `continuation: true` marks the post author's own continuation: their replies to the post and to those
  replies, unbroken. `continuations` counts them, and is `null` when the post's author is not known. The
  author answering someone else is a comment, and so is someone else answering the chain.
- The first format, `cmmns.capture-thread/1`, kept one `captured` total, no `post.author` and no
  `continuation`. `readCaptureThread` reads it as the current format, working the counts out again from
  its tree, and sets `upgradedFrom`. A file's bytes are never rewritten.
- `expanded` counts the "more" controls opened. On the post's own page, CMMNS opens one at a time,
  1.2 to 3 s apart, up to `cap` (setting "Comments to open up to", 200 by default, 0 for none), with
  Stop on the notice. "Continue this thread" links lead to other pages and are counted in
  `moreStubs`, never followed. Source protection holds the opening off.
- Commenters are other people: each record keeps the public handle and the words exactly as the page
  showed them, and nothing else about them.

Where the comments come from, per site: Reddit, the rendered `shreddit-comment` tree; X, the posts X
sent the page, joined by what each answers; Instagram, the comments in the page's own data; YouTube,
the comment threads the watch page drew, joined with the comments in the page's own data (likes and
reply counts as the page showed them; a reply's id is `<parent id>.<reply id>`, so it stays under the
comment it answers). YouTube shows relative times, kept as `timeShown`.

## A video saved in full

"Save video in full" (the hover control on YouTube) and `cmmns media fetch <url> --full` write one
bundle per video. The sidecar format stays `daylight.sidecar/1`; the bundle adds files beside it, so a
reader that knows only the note and thread file reads a bundle as before.

| File | What it holds |
| --- | --- |
| `<stem>.md` | the note, as above, with the chapters and the comments |
| `<stem>.thread.json` | every comment the page loaded or yt-dlp read, with replies under their parents and like counts |
| `<stem>.transcript.txt` | one line per caption segment: `[HH:MM:SS] words` |
| `<stem>.transcript.plain.txt` | the words alone, as paragraphs (a new one after a pause of 3 s or about 120 words) |
| `<stem>.video.json` | `cmmns.video/1`: id, address, title, channel, date, duration, counts, description, chapters, where the captions came from, and the media file's name when there is one |
| `<stem>.<lang>.vtt` | the caption tracks yt-dlp wrote (command line only) |
| `<stem>.mp4` | the media file, only when the user chose it for this save. Without ffmpeg on the command line, a file holding both video and audio when the site offers one, else the best video and the best audio as two files, `<id>.<format>.<ext>` |
| `SOURCE.txt` | where the bundle came from, how it was read, the media choice, and its files (`<stem>.SOURCE.txt` from the extension, which saves into the shared site folder) |
| `SHA256SUMS` | `sha256sum` lines for the files (`<stem>.SHA256SUMS` from the extension, which can hash only the files it made in the page; a file the browser downloaded straight from its address is listed in SOURCE.txt and not hashed) |

The command line writes the bundle into its own folder, `<save root>/<site>/<handle>_<date>_<words>_<id>/`,
and names the folder after the video's title and the files by its id. yt-dlp's raw info file is deleted unless `--keep-info` is given:
it holds signed stream addresses that carry the viewer's IP address.

**The media file is a local research copy.** CMMNS never uploads, shares or publishes it. In the
extension it is a choice on every save: builds that carry the command line hand-off copy
`cmmns media fetch "<url>" --name "<stem>"`, which saves the file beside the bundle in the default save
folder; store builds do not save YouTube video files.

**The transcript** comes from the transcript data the page received, else the transcript panel the page
drew. When neither is there, the page's own "Show transcript" control is pressed once, as a person
would; source protection holds that off.

## Inside the file

The same description, as one paragraph, is written into the file without re-encoding it: XMP
`dc:description`, `dc:creator` and `dc:source` in JPEG, PNG and WebP; `©cmt`, `desc` and `©ART` in
MP4; a comment block in GIF. A file that already carries its own XMP or MP4 metadata is left as it is.

**Share clean removes it.** A copy made with Share clean (Collections, the save page, `cmmns
clean <file>`, `case export --clean`) has this description removed along with every other piece of
file metadata. The `.md` sidecar stays on your disk unless you choose to send it, and the evidence
copy keeps the description. `tests/clean.test.js` embeds a description in each of the five formats
and checks that none of it survives cleaning.

## Addresses without share tracking

Before a sidecar stores an address, `stripTracking` in `src/core/url-clean.js` takes out share and
campaign parameters, which can name the person who shared a link or the campaign that sent it. It
applies to `post`, `page`, `links`, the link cards, and the quoted and parent post addresses, and to a
video bundle's `url` and SOURCE.txt line.

- On every host: `utm_*`, `fbclid`, `gclid`, `msclkid` and the other click ids, `igsh`, `ref_src`.
- Only on the host whose share links use them: YouTube `si`, `pp` and `feature`; X `s` and `t`;
  Instagram `igsh`; Reddit `share_id`; TikTok, LinkedIn, Facebook, Threads and Spotify share tags.
- Never changed: the post's text (kept exactly as written, links included), the `media` address
  (the file's origin; on redd.it its `s=` is the signature that makes it work), a YouTube `t=` time,
  and any address with nothing to take out, which is stored byte for byte.

A YouTube thumbnail saved from a page other than a watch page (the home page, a channel, search) has
no post address of its own. Its `post` is the watch address named in the thumbnail's address,
`https://i.ytimg.com/vi/<id>/...` giving `https://www.youtube.com/watch?v=<id>`.

Notes saved before this change keep the addresses they were written with.

## What it never holds

Only what the page showed: nothing is fetched to fill a sidecar, and nothing about the person saving
(no account, no browser, no location).
