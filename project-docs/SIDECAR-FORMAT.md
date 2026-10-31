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
| `comments_captured` | with a thread file | how many comments the thread file holds |
| `comments_complete` | with a thread file | `true`, `false`, or `"unknown"` when the site gave no count |
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
`thread: { file, expected, captured, complete, capHit, cap, moreStubs, sentence }` in place of the
comment tree, which the thread file holds.

## The thread file

`<sidecar name>.thread.json`, beside the sidecar, whenever the post's comments were read (setting
"Save the post's comments with it", on by default). Written by `captureThread` in
`src/core/capture-thread.js`; the page readers are in `src/ext/capture-sites.js`.

```
{ "format": "cmmns.capture-thread/1", "site": "reddit", "post": { "url", "id" }, "savedAt", "source",
  "completeness": { "expected": 6, "captured": 6, "missing": 0, "cap": 200, "capHit": false,
                    "moreStubs": 0, "expanded": 1, "complete": true, "reason": null, "countNote": null },
  "comments": [ { "id", "parent", "depth", "author", "text", "score", "postedAt", "timeShown", "edited",
                  "permalink", "flair", "deleted", "links": [], "replyCount", "replies": [ ... ] } ] }
```

- `comments` is a tree: each comment under the one it answers. A comment whose parent was not on the
  page sits at the top with `parentMissing: true`; `siteDepth` keeps the site's own depth where it differs.
- `expected` is the site's own count, which can include deleted, removed or hidden comments; `countNote`
  says so when the capture is short of it. `complete` is `true` only when nothing is known to be
  missing, `false` when something is (the cap, an unopened "more replies", a shortfall), and `"unknown"`
  when the site gave no count.
- `expanded` counts the "more" controls opened. On the post's own page, CMMNS opens one at a time,
  1.2 to 3 s apart, up to `cap` (setting "Comments to open up to", 200 by default, 0 for none), with
  Stop on the notice. "Continue this thread" links lead to other pages and are counted in
  `moreStubs`, never followed. Source protection holds the opening off.
- Commenters are other people: each record keeps the public handle and the words exactly as the page
  showed them, and nothing else about them.

Where the comments come from, per site: Reddit, the rendered `shreddit-comment` tree; X, the posts X
sent the page, joined by what each answers; Instagram, the comments in the page's own data; YouTube,
the comment threads the watch page drew (YouTube shows relative times, kept as `timeShown`).

## Inside the file

The same description, as one paragraph, is written into the file without re-encoding it: XMP
`dc:description`, `dc:creator` and `dc:source` in JPEG, PNG and WebP; `©cmt`, `desc` and `©ART` in
MP4; a comment block in GIF. A file that already carries its own XMP or MP4 metadata is left as it is.

**Share clean removes it.** A copy made with Share clean (Collections, the save page, `cmmns
clean <file>`, `case export --clean`) has this description removed along with every other piece of
file metadata. The `.md` sidecar stays on your disk unless you choose to send it, and the evidence
copy keeps the description. `tests/clean.test.js` embeds a description in each of the five formats
and checks that none of it survives cleaning.

## What it never holds

Only what the page showed: nothing is fetched to fill a sidecar, and nothing about the person saving
(no account, no browser, no location).
