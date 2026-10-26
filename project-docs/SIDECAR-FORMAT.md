# Sidecar format: daylight.sidecar/1

Every download saves a Markdown file beside the media, with the same name and `.md`. It is the
contract between Daylight Commons and any library that reads saved media: the reference library, a
search index, a notes app. The format is versioned. A change that removes or renames a field, or
changes a field's meaning, raises the number; new optional fields may be added within version 1.

Written by `sidecarMarkdown` and `sidecarJson` in `src/core/media-meta.js`; tested in
`tests/media-meta.test.js`.

## Where files go

`Downloads/<save folder>/<site>/` (the save folder is a setting, `Daylight` by default; left empty
it goes back to `Daylight`). Study saves go to `<save folder>/study/<site>/`. The switch "Save
straight into Downloads" puts files in Downloads itself (Study in `study/<site>/`). `<site>` is `x`, `reddit`, or the host name of the page.

File names are `<handle>_<date>_<first words of the text>[-n].<ext>` for posts with an author, for
example `nasa_2026-10-23_ahh-blue-lagoon-this-deep-blue-sea-of-gas-and.jpg`. The date is the post's
date (UTC). `-n` numbers the files of one post. Other pages give `<page title>-<file name>.<ext>`.

A post saved with the Download button gets one sidecar for all its files, named after the post (the
first file's name without `-1`). A single file gets its own.

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
| `analysis` | study saves from the discourse checks (a `<name>.parts.json` parts tree is saved beside the note) | the sign families whose analysis follows as `## Analysis: <label>` sections, such as `["quote-source", "doc-claim", "correction-replies"]` |

Fields added within version 1 are optional and only ever added. Readers should ignore fields they do
not know. Sections after the front matter may include `## Poll`, `## Link cards`, `## Chapters` and
`## Transcript (as the page showed it)`.

After the front matter, for people: a heading with the author, the post's text exactly as written
(as a quote, line breaks kept), the author's own continuation of the thread where the page had
loaded it, the alt text, the quoted or parent post with its address, then a list of the same facts
and the links in the text.

## The JSON file

Off by default (setting "Also save a .json file for tools"). One object:

`format`, `site`, `title`, `text`, `author: { name, handle }`, `postUrl`, `mediaUrl`, `pageUrl`,
`postedAt`, `savedAt`, `alt`, `hashtags[]`, `links[]`, `quoted: { text, url, author } | null`,
`parent: { text, url, author } | null`, `thread[]`, `subreddit`, `item: { index, total } | null`,
`files[]`. Unknown values are `null`.

## Inside the file

The same description, as one paragraph, is written into the file without re-encoding it: XMP
`dc:description`, `dc:creator` and `dc:source` in JPEG, PNG and WebP; `©cmt`, `desc` and `©ART` in
MP4; a comment block in GIF. A file that already carries its own XMP or MP4 metadata is left as it is.

**Share clean removes it.** A copy made with Share clean (Collections, the save page, `daylight
clean <file>`, `case export --clean`) has this description removed along with every other piece of
file metadata. The `.md` sidecar stays on your disk unless you choose to send it, and the evidence
copy keeps the description. `tests/clean.test.js` embeds a description in each of the five formats
and checks that none of it survives cleaning.

## What it never holds

Only what the page showed: nothing is fetched to fill a sidecar, and nothing about the person saving
(no account, no browser, no location).
