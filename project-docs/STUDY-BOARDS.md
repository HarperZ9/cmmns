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

A board is a list of plates with a title, a lane and keywords.

| Field | Meaning |
|---|---|
| `format` | `"daylight.board/1"` |
| `title` | the board's name, the running head on left pages |
| `lane` | the topic or medium: design, research, journalism, sound, or any name, such as a concept sheet from the reference library |
| `keywords` | up to eight words, the line at the foot of every page |
| `layout` | `book`, `grid`, `timeline` or `evidence` |
| `plates` | in order; each has `n` (its number), `kind` (`image`, `video`, `gif`, `audio`, `text`), the file names, the sidecar it came from, a caption, an optional note, and the file's SHA-256 |
| `created` | when the board was made |

A plate's caption comes from its sidecar (`daylight.sidecar/1`): the author and handle, the site, the
posted date and the first line of the text. Its source line is the post or page address. The note is
the person's own line for that plate. A study save's "what draws you to this" is the starting note.

Plates come from any saved item that has a sidecar: media, text notes, selections, studies, YouTube
references, evidence captures (3.7.0) and quote checks. A text note becomes a typeset text plate, never
a picture of text. A video or GIF plate shows its first frame in print and plays on the web page.

## Layouts

- **Book.** Pages in spreads. Running head: the title on left pages, the lane on right pages, in
  Accession Stencil capitals with wide tracking. One plate per page, centred in a generous margin,
  never cropped. Under it the number as `( 11 )` and the caption in Hanken Grotesk. Keywords at the
  foot in capitals, spaced across the measure. Folio at the outer corner. The single hot mark is the
  running head's lane on right pages. Nothing else carries colour.
- **Grid.** Plates in a regular grid with their numbers and captions; the way to see a whole board
  at once.
- **Timeline.** Plates in posted order down one axis, each with its date and time. A gap much longer
  than the board's usual spacing (three times the median gap and at least a day) is drawn as a break
  with its length, so silences and bursts show. For journalism: the order things were posted, not
  saved.
- **Evidence.** With a case (`daylight case`): each plate matched to the case's source by address,
  the claims that cite it listed with their rung (documented, inference, unproven, contradicted), and
  the claim-to-source links drawn between plates. Every plate shows its SHA-256.

## Exports

- **Web page.** One `index.html` with the plates in `plates/`, the type in `fonts/` and the board in
  `board.json`. It opens from disk with no network and no script needed to read it.
- **PDF.** The book layout prints as single pages at A4 (or Letter), spreads facing. The extension
  prints through the browser's own print to PDF; the command line runs a local Chrome or Edge in
  headless mode when one is installed, and says so when none is.
- **Portable folder.** The web page plus every sidecar beside its plate, and `MANIFEST.sha256` over
  every file.
- **Share clean.** The exported plates are Share clean copies (the protection work's cleaner), with
  their lineage kept out of the folder. The sidecars stay unless the person leaves them out.
- **Evidence version.** Keeps each original file's hash, the case's custody log and a signed manifest,
  through the case export's existing legal profile.

## Where it runs

- **Extension:** a Boards page. Pick the Daylight folder (the browser's folder picker; Firefox
  reads a chosen folder), filter by lane, site, study or date, tick the plates, set title, lane and
  keywords, choose a layout, and export. Moodboards from 3.6.0 open as boards.
- **Command line:** `daylight board make <folder> --title ... --lane ... --keywords ... --layout
  book|grid|timeline|evidence [--case <folder>] [--clean] [--pdf] --out <folder>`.
- **Library:** `boardFrom`, `parseSidecar`, the layout planners and `boardHtml` in `src/core`, with
  no extension calls, so the reference library's ingest can make a board from a study or a concept
  crossing.

## Limits and does not prove

A board shows what was saved and what the notes say about it. It does not check that a caption is
true, that an item is still online, or that the plates are complete for a topic. The evidence layout
shows links the case recorded, not links the board found. Fonts: Accession Stencil is the house face
for running heads (licence SIL OFL 1.1, recorded in `src/ext/fonts/FONTS.md`); Hanken Grotesk and
JetBrains Mono carry the text and numbers.
