# Study boards (design for 3.7.0)

Status: design, then build in the same release as evidence capture (`project-docs/EVIDENCE-CAPTURE.md`).

## The problem

People save pictures, posts and selections to study them later: a designer gathering references for
a brand, a researcher collecting sources on a topic, a journalist building a timeline. Today the saves
sit in `Daylight/<site>/` as files and notes. Putting them in front of someone, or in print, means
rebuilding by hand what the notes already hold: who made each item, where, when, and why it was kept.

A study board turns a set of saves into a document that keeps every item's source. It grows the
3.6.0 moodboards into one board type that serves design, research, journalism and any other topic.

## The reference

A brand identity reference book (saved as `0xcharlota_2026-10-25_moodboards-and-visual-references-
for-the-brand`). Its spreads carry a running head (the book's name on the left page, the section on
the right), one plate per page with a numbered caption set as `( 11 )`, a line of keywords at the
foot (CONTEXTUAL, INTUITIVE, INTELLIGENT, DISCIPLINED, HUMAN), folios and generous margins. The
board's book layout takes that structure apart and rebuilds it from the canon: the parts are kept,
the look is ours.

## The board

One format serves Daylight, the command line and the site: the reference library's `refdb board`
spec, `refdb.board/1`. Daylight writes it and draws it, and draws one made by `refdb board`.

| Field | Meaning |
|---|---|
| `format` | `"refdb.board/1"` |
| `kind`, `key` | what the board gathers: `saves`, `moodboard` (with its id), or a reference-library kind such as a concept |
| `running_head` | `{ left, right }`: the title on left pages, the lane in capitals on right pages |
| `lane` | the topic or medium: design, research, journalism, sound, or any name |
| `keyword_line` | up to eight words, the line at the foot of every page |
| `plates` | in order; each has `n`, `unit` (the sidecar or record it came from), `item_ids`, `media` (`[{ id, kind, path }]`, kind `still`, `motion`, `audio` or `text`), `caption`, `medium` and `concepts` |
| `also_in`, `sources` | the reference library's cross-references and measured summary; Daylight writes its own provenance under `sources.daylight` (`{ from: "saves" }` or `{ from: "moodboard", id }`) so it never collides with the library's keys |
| `layout`, `head`, `created` | Daylight's additions: the layout to draw, the face for running heads and titles (`grotesk`, `accession` or `mono`), and when the board was made |

Daylight's plates add `source`: the sidecar's facts (site, handle, author, posted, saved, post
address, media address, title, quoted text, alt text, item "2 of 4", study flag, note, SHA-256, and
reach, the views the page showed at save time). A reader that knows only `refdb.board/1` ignores it
and still draws the board from `caption` and `media`. A plate may also carry `parts` (the library's
parts tree) and, from 3.7.0 evidence captures, `evidence`: `{ artifact, context, custody }` as
project-docs/EVIDENCE-CAPTURE.md defines them. Both are optional; a renderer that does not know them
skips them.

A plate's caption comes from its sidecar (`daylight.sidecar/1`): the author and handle, the site, the
posted date and the first line of the text. Its source line is the post or page address. The note is
the person's own line for that plate. A study save's "what draws you to this" is the starting note.

Plates come from any saved item that has a sidecar: media, text notes, selections, studies, YouTube
references, evidence captures (3.7.0) and quote checks. A text note becomes a typeset text plate, never
a picture of text. A video or GIF plate shows its first frame in print and plays on the web page.

**Moodboards.** A 3.6.0 moodboard is a board of kind `moodboard`: its saved records become plates
in the order they were saved, addressed by SHA-256, with the page, title, alt text, note and tags
they already carry. Opening one as a study board rewrites nothing in its items; the lane, keywords and
layout chosen on the Boards page are kept on the moodboard record, so it opens the same way next time.
Moodboards keep working on the collections page as before.

## Layouts

- **Book.** Pages in spreads. Running head: the title on left pages, the lane on right pages, in
  Accession Stencil capitals with wide tracking. One plate per page, centred in a generous margin,
  never cropped. Under it the number as `( 11 )` and the caption in Hanken Grotesk. Keywords at the
  foot in capitals, spaced across the measure. Folio at the outer corner. The single hot mark is the
  running head's lane on right pages. Nothing else carries colour.
- **Grid.** Plates in a regular grid with their numbers and captions; the way to see a whole board
  at once.
- **Timeline.** Plates in posted order down one axis, each with its date and time (the saved time,
  marked as such, for moodboard items, which carry no post time). A gap much longer
  than the board's usual spacing (three times the median gap and at least a day) is drawn as a break
  with its length, so silences and bursts show. For journalism: the order things were posted, not
  saved.
- **Evidence.** With a case (`daylight case`): each plate matched to the case's source by address.
  The layout uses the sheet model shared with the analysis view and the site: each claim is drawn
  over the plates of the sources it cites, as stacked sheets, and each sheet's opacity comes from that
  source's reach on a log scale (`0.25 + 0.75 × log(1 + reach) / log(1 + widest reach)`; unknown reach
  is faint at 0.25). A widely seen post covers a little-seen correction the way it does in the feed;
  hovering or focusing a sheet lifts it to full. Every plate shows its SHA-256, and plates no claim
  cites are listed after the sheets.

## Exports

- **Web page.** One `index.html` with the plates in `plates/`, the type in `fonts/` and the board in
  `board.json`. It opens from disk with no network and no script needed to read it.
- **PDF.** The book layout prints as single pages at A4 (or Letter), spreads facing. The extension
  prints through the browser's own print to PDF; the command line runs a local Chrome or Edge in
  headless mode when one is installed, and says so when none is.
- **Portable folder.** The web page plus every plate's sidecar in `sidecars/`, and `MANIFEST.sha256`
  over every file.
- **Share clean.** The exported plates are Share clean copies (the protection work's cleaner), with
  their lineage kept out of the folder. The sidecars stay unless the person leaves them out.
- **Evidence version.** `--case` copies the case's tables (`case.json`, sources, claims, edges) into
  `case/`, and the manifest covers them with the plates' original hashes. Signing the manifest and
  carrying the custody log through the case export's legal profile is not built yet.

## Where it runs

- **Extension:** a Study boards page, opened from the collections page ("Study board"). Plates come
  from a moodboard, or from a folder of saves the person picks (Chrome and Edge's folder picker;
  Firefox has none, so it points to the command line). Filter by site and study, set title, lane and
  keywords, choose book, grid or timeline, then print or save as PDF through the browser, save one
  self-contained web page (plates and type inside it) into `<save folder>/boards/`, or, for a picked
  folder, write the portable folder into `boards/<title>/` beside the saves.
- **Command line:** `daylight board make <folder> --title ... --lane ... --keywords ... --layout
  book|grid|timeline|evidence [--site ...] [--study] [--since ...] [--until ...] [--case <folder>]
  [--clean] [--pdf] --out <folder>`, and `daylight board render <board.json>` to draw a
  `refdb.board/1` spec made by the reference library, copying each plate's media beside the page and
  naming any it could not find.
- **Library:** `boardFrom`, `parseSidecar`, the layout planners and `boardHtml` in `src/core`, with
  no extension calls, so the reference library's ingest can make a board from a study or a concept
  crossing.

## Limits and does not prove

Built in this round: the format, the four layouts, the command line (`board make`, `board render`)
and the extension page with book, grid and timeline. The evidence layout, Share clean plates and
the PDF run from the command line only; the extension's portable folder has no manifest yet.

A board shows what was saved and what the notes say about it. It does not check that a caption is
true, that an item is still online, or that the plates are complete for a topic. The evidence layout
shows links the case recorded, not links the board found.

Type: the running heads and titles take whichever face the person picks: Hanken Grotesk (the
default), Accession Stencil or JetBrains Mono. Accession is one available face, never a fixed house
look. The author licensed Accession under the SIL Open Font License 1.1 on 2026-10-26; it ships in
the extension with its licence text, and a board's page loads it only when the board uses it. Hanken
Grotesk and JetBrains Mono carry the text and numbers.
