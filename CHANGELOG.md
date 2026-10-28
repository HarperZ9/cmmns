# Changelog

All notable changes to CMMNS, named Radar before 2026-10-22 and Daylight Commons before 2026-10-28. Dates are UTC. Versions before 1.0.0 were development builds and
were not published to a store.

## Unreleased

Nothing yet.

## 3.9.0 (2026-10-28)

Daylight Commons is now CMMNS, spoken "commons". Everything you saved, every case and every signed
bundle from earlier versions still reads and verifies, and an existing install keeps its save folder.

### Changed
- **Daylight Commons is now CMMNS**, spoken "commons" (2026-10-28). The extension name, toolbar title,
  pages, docs, store listing and command line say CMMNS. The repository moved to
  `github.com/HarperZ9/cmmns` (GitHub redirects the old address) and the project pages to
  `harperz9.github.io/cmmns/`; the old `/daylight-commons/` pages redirect. Nothing a saved file, an
  installed extension or a signature depends on changed: the format ids (`daylight.sidecar/1`,
  `daylight-case/1` and the rest), the `urn:daylight:` and `urn:radar:` ids, storage keys, the Firefox
  add-on id `radar@harperz9.github.io`, `~/.radar`, the icon files and the data pack names stay, so
  every sidecar, case, capture and signed bundle from 3.8.0 and earlier still verifies (tests in
  `tests/rename-compat.test.js`).
- The command line answers to `cmmns`; `daylight`, `daylight-commons` and `radar` run the same tool.
  Environment variables read `CMMNS_*` first and `DAYLIGHT_*` after it (`CMMNS_PROTECT`,
  `CMMNS_HOME`, `CMMNS_CASE_NOW`, `CMMNS_CASE_REPLAY`, `CMMNS_CASE_CRASH_AT`,
  `CMMNS_DISCOURSE_CACHE`). `RADAR_*` variables are unchanged.
- New installs save into `Downloads/CMMNS/<site>/`. A browser that had the extension before this
  release keeps `Downloads/Daylight/<site>/`: the update stores that folder as its setting. `cmmns
  media fetch` saves into `Downloads/CMMNS` unless only `Downloads/Daylight` exists. Every reader
  (`capture verify`, `sidecar check`, `board make`) takes either folder.
- Release files are named `cmmns-chrome-<version>.zip`, `cmmns-firefox-<version>.xpi`,
  `cmmns-firefox-self-<version>.xpi`, `cmmns-cli-<version>.zip` and `cmmns-<version>.bundle`.
  `verify-release` reads names from the signed list, so `radar-*` releases still verify. The project
  key is labelled "CMMNS project key"; the key, its id and thumbprint are unchanged.
- The self-distributed Firefox build checks `https://harperz9.github.io/ext/firefox/updates.json`,
  one permanent address with no product name in it. No released build read an update address before.

### Fixed
- **A note now names the files its own save wrote** (project-docs/SIDECAR-FORMAT.md, "Taken names").
  When a file name was taken, the browser saved the file as `name (1).jpg`, but the note beside it
  still listed `name.jpg`, a file of another save and sometimes of another post. Galleries saved
  twice and single images saved from a saved gallery listed the first save's files the same way.
  The worker now reads back the name the browser wrote (`downloads.search`, and the filename change
  Chrome reports) and the note lists that name and takes the same suffix (`name (1).md`). A stream
  saved as separate video and audio files now lists both. Planted tests run the page script and the
  worker over a simulated `chrome.downloads` in Chrome's and Firefox's manner; the saver from before
  the fix fails the six collision tests and passes the two no-collision tests.
- `daylight sidecar check <folder>` also reports notes that name a missing file or one from another
  save, and `--fix` repairs a note only when the replacement file carries the note's post address
  and was written in the note's save window; anything less is reported and left as it is.
- **The label marker catches name-calling it used to miss** (project-docs/ARGUMENT-LENS.md, "The label
  marker"). A private study of two TV news episodes found that the classification rule fired once in
  18,658 words: it read only "is a ...-ist". `src/core/discourse/labels.js` now finds, with spans, an
  epithet before a name (with or without a party or role word and a comma), after a name ("Pat Doe, a
  known liar"), as a predicate on a pronoun, a demonstrative phrase or a name ("this woman is a liar",
  "they are traitors"), in a naming frame ("I call him a fraud"), and in compounds ("radical-left
  lunatic"). Severity is the number of epithet words. A label the post applies makes its sentence a
  classification and shows on the claim card; negated, self-described, quoted and reported ones are
  kept with their status and do not count.
- The check that no discourse module names a side had a backspace where its word boundary should be
  and matched nothing. It now matches, and reads "left" and "right" only in their sided forms.

### Added
- The epithet lexicon, `data/discourse/labels.json`: 36 non-political insults and 20 political
  pejoratives, 10 aimed at each side with a named mirror, plus 20 modifiers, each with a dictionary
  source and a reason. `scripts/labels-data.mjs` ships the words only, never the side.
- Planted tests for every shape and every control class, a blind round written by a separate model
  session (first score 37 of 37 precision, 37 of 43 recall; 42 of 43 after the fixes), 134 mirrored
  pairs that must read the same, a lexicon balance test, and a shuffled-lexicon control that drops
  recall to a mean of 0.14 to 0.16 (`node scripts/eval-labels.mjs`).

## 3.8.0 (2026-10-26)

Read how a post argues: its premises and conclusions, the kind of claim each sentence makes, where it goes beyond what it states, and when it rearranges its sources.

### Added
- **Argument lens** (options, under Discourse checks, off by default; project-docs/ARGUMENT-LENS.md).
  Splits a post into premises, minor premises, supporting premises, assumptions, conclusions and turns
  at its connectives, in English, Portuguese, Spanish, French and Latin, and groups arguments into
  lists, chains and turns, after Aliocha's reading method. Regression: all 7 breaks she marked in
  Summa I q.2 a.2 and the 3 "sed" as minor premises. Roles show only once they pass a held-out gate
  against two people's annotations; the 60 gold passages are fixed and the annotation page is
  `docs/annotate/argument.html`. No annotations yet, so no role has passed.
  - The claim-type marker: question, quotation, definition, sourced statement, classification,
    inference, opinion, factual claim with or without a source. Held out (model labels): 15 of 16.
  - The inference-gap marker: claims about someone else's mind, and conclusions whose words their
    premises lack. Held out: 4 of 5 marks right, 4 of 4 found.
  - The reframing marker: a post that names its sources' people and things in an act none of them
    states, or states only to deny.
  - All four in the study parts tree, and a side-swap symmetry test over each.
- **Calibration study** (project-docs/CALIBRATION-STUDY.md): four cases preregistered with their
  outcome sources and corpora; not run, and why.

## 3.7.0 (2026-10-26)

Capture a post as evidence, turn saves into study boards, and check where a quote comes from.

### Added
- **Capture as evidence.** Right-click a picture, video or sound and choose "Capture as evidence".
  The file and its note are saved as usual, with a picture of the visible page and a capture record
  beside them. The record keeps the file's SHA-256 taken before any words were written into it, the
  counts and account the page showed, the local time, and a list of what the capture kept and what
  it lost, part by part. Every capture adds a line to a chain kept in your browser, each line naming
  the one before. `daylight capture verify <folder>` checks every file, picture, record and line, and
  says which changed. Nothing is sent anywhere. Not yet: a full-page picture, a page snapshot, a
  signed log and trusted time.
- An evidence board prints each claim over its sources with the same sheet engine as the discourse
  sheets: each source's ink band is its share of the widest reach. Each source's provenance line is
  as opaque as the source is backed by the claim's other sources from other sites or accounts, and
  says how many.
- **Study boards.** Saved items become numbered plates in a board you can print, save as one web
  page or keep as a folder: a book with running heads, numbered plates, captions and a keyword line;
  a grid; or a timeline in posted order with long silences drawn as breaks. Open one from the
  collections page ("Study board") for any moodboard, or pick a folder of saves. Every plate keeps
  its source, author, time and link. Moodboards from 3.6.0 open as boards, and the lane, keywords and
  layout you choose stay with the moodboard.
- `daylight board make <folder>` makes the same board from the command line, with an evidence
  layout for a case (each claim drawn over its sources, more widely seen sources drawn more opaque),
  Share clean plates, a PDF and a SHA-256 manifest. `daylight board render <board.json>` draws a
  board made by the reference library. One format, `refdb.board/1`, for both.
- A board's running heads and titles take the face you pick: Hanken Grotesk, Accession Stencil or
  JetBrains Mono. Accession Stencil now ships with Daylight Commons under the SIL Open Font License
  1.1.
- **Discourse checks** (options, off by default), all on this device; project-docs/DISCOURSE.md.
  - Where a quote comes from: a signed index of 11 public-domain works (8,681 passages), 12 sourced
    misattributions and one attested quote. Held out: 8 of 8 placed quotes right, 8 of 11 found,
    0 of 5 absent quotes wrongly found.
  - Accounts named after someone who died, from Wikidata, needing a second cue; names a possibly
    living person shares are dropped.
  - Counts with their Wilson 95% interval and a small-sample note.
  - The post's words against the document images it shows.
  - Replies that bring a source or name an error, ranked without likes, with a side-swap test.
  - Save the post with its analysis as a study item: `analysis` field and `## Analysis` sections
    in `daylight.sidecar/1`, and the results as a `refdb.parts/1` parts tree beside the note.
  - Truth as sheets: the post over the replies that bring a source over the documents they link,
    each sheet inked by its reach, liftable; replies that share a source are one sheet.
- Six lessons for the new signs. A discourse thread on the demo stage and `scripts/qa/discourse_shot.py`.

## 3.6.2 (2026-10-26)

Saves land in their folder again after an update.

### Fixed
- **After updating to 3.6.1, saves from pages that were already open landed in the Downloads folder
  itself instead of `Daylight/<site>/`.** Those pages kept the old script, which could no longer
  reach the extension and fell back to a plain download link. That fallback is gone: a save goes
  through the browser's downloads into its folder, or says it could not. After an install or update,
  the download parts are loaded into open pages again, so their buttons work without a reload; an
  old page that still cannot reach the extension says "Daylight Commons was updated. Reload this
  page, then save again."
- An empty folder name in the settings now means the default, `Daylight`. Saving straight into
  Downloads is its own switch, "Save straight into Downloads", off by default.

## 3.6.1 (2026-10-25)

Save from any site, save text too, and keep things for study. Protection for the people who use Daylight Commons and their sources: the case workbench stops
telling the Internet Archive and the target's server who is investigating, a clean copy of any file
to share, one switch for source protection, and a look at what Daylight's own signals show about
your account. Plans for the next two: project-docs/REDACTION-PLAN.md and
project-docs/PROVENANCE-TRACING-PLAN.md.

### Added
- **Share clean.** A copy of a file with everything it says about itself removed: EXIF with GPS,
  XMP, IPTC, colour-profile text, PNG text chunks, GIF comments, MP4 user data and creation times,
  WebM tags, PDF document information and XMP, Word, Excel, PowerPoint and OpenDocument authors,
  and the description Daylight writes into saved files. Nothing is re-encoded: pictures, frames and
  samples stay the same bytes. A file it cannot read is refused, never passed as clean. In
  Collections (one file, or the whole collection as a zip), on the save page's result, with
  `daylight clean <file>`, and with `daylight case export --clean`. Each clean copy's lineage
  (original hash to clean hash) stays with the evidence copy and never goes in the shared file.
- **Source protection.** One switch (toolbar menu, Source protection; `daylight protect on`, or
  `daylight case settings protection on` for one case). While on, Daylight makes no request of its
  own: no About or Reddit account reads, evidence lookups, Other coverage, Archive copies or
  downloads from a host; the toolbar button shows a P. Exports are Share clean and carrier-safe,
  the case's history names the investigator only as "investigator" with the day, and every account
  in an export is a pseudonym unless marked `--keep-name`. Its page lists what it cannot protect
  against and points to Tor Browser, SecureDrop and the Access Now Digital Security Helpline. Not
  yet independently reviewed: project-docs/SECURITY-REVIEW.md is the reviewer's checklist.
- **What Daylight shows about you.** Daylight's account signals (place label, app store country,
  renames, account age, posting clock, posting apps, volume, repeated wording) on your own account
  only, each with what it reveals and how to reduce it. Your own signed-in profile on X, or your own
  data export (`daylight self-audit tweets.js account.js`). There is no field to type an account.
- **A Download control on any picture, GIF or video.** Rest the pointer on one for a moment and a
  small Download button shows in its corner, even where the site blocks right-click or lays a clear
  layer over its pictures. Its second button offers Study, Download as GIF, Copy, Copy link, Copy with
  caption and Save to Daylight. It never moves the page or takes its clicks. It shows on the sites
  Daylight Commons reads; "Show it on every site" in the settings asks your browser once to allow all
  sites. "Never on this site" and a switch turn it off. **Alt+Shift+D** saves the picture or video
  under the pointer, or the focused one, on any site.
- **Study.** Beside Download everywhere: the same save, into `Daylight/study/<site>/`, marked
  `study: true`, with an optional line on what draws you to it. A study library can pick these up
  first.
- **Text is saved too.** X and Reddit text posts get the button: one note with the whole text, the
  author, address and time, the quoted or parent post, the author's thread, link cards, hashtags, a
  poll as shown, and on Reddit the title, subreddit and flair. Select text on any page and "Save
  selection" keeps it with the page's title, address and author. **Save as card** renders the words
  as a picture in the house type, marked as a Daylight Commons rendering, never as a screenshot.
- **YouTube references.** The control on a YouTube video saves a reference: the thumbnail and a note
  with the title, channel, the link at the current time, the whole description, chapters and any
  transcript the page shows. Copy link at this time copies the address at the current second. The
  store versions never download YouTube video. The unpacked build adds a command to copy for the new
  `daylight media fetch <address>`, which uses your own yt-dlp and writes the same note.
- **The side panel.** "Show windows in the side panel" in the toolbar menu moves the window for a post
  to the browser's side panel, where it stays while you switch tabs. Close the panel and the window
  returns to the page.
- **Threads.** On a post's own page, the X button saves the author's whole thread below it: every
  picture and video, or one note with every part in order, where X's own data shows the parts belong
  together.
- Notes keep the engagement the page showed at save time (replies, reposts, likes, views, bookmarks;
  score and comments on Reddit), under `engagement`, with the time it was read.
- `daylight sidecar check <folder>` lists the notes whose thread continuation was not proved.

### Changed
- **`daylight case add` and `case run` no longer ask the Wayback Machine for a copy by default.**
  A save request tells the page's server and the Internet Archive who is looking and when, and the
  copy is public. Ask for one with `--archive`, or for a whole case with
  `daylight case settings archive on`. `case watch` asks the Archive whether it holds a copy only
  with that setting on.
  **Migration:** scripts that relied on the old default add `--archive`. `--no-archive` still works
  and wins over the case setting. Cases made before this release have no `archive` key in
  `case.json` and read as off; set it to `true` to keep the old behaviour.
- In source-protection mode the Download control, Study, the X and Reddit buttons, YouTube
  references, picture Copy and `daylight media fetch` make no request to any host and say why. Notes
  of text and text cards still save, since they use only what the page shows.

### Fixed
- **Case exports named private accounts in `export.json`.** The export's snapshot (and
  `CHANGES.md` from the second version on) carried claim text with private handles unredacted.
  Both now use the same pseudonyms as the export's files.
- **Notes saved with 3.6.0 from a profile or timeline page could list unrelated posts by the same
  author as "Continued by the author".** A continuation is now joined only where X's own data shows each
  part answering the one before; otherwise the note holds none and, where a thread may exist, says
  `thread_complete: "unknown"`. Run `daylight sidecar check <your Daylight folder>` to list the 3.6.0
  notes to check against the post.
- Long X posts are no longer cut short in the note. When the page showed only the start of a post and
  no fuller copy was loaded, the note says `text_complete: false` and a line under the text says so.

## 3.6.0 (2026-10-25)

A media toolkit for keeping and checking what you read, a pressure lens, and optional ad blocking.
Details and measurements: project-docs/MEDIA-TOOLKIT.md and the pressure section of
project-docs/READING-LENS.md.

### Added
- **Download in one click.** Right-click any picture, GIF, video or audio and choose **Download**: the
  file goes straight to your Downloads folder, with no new tab and no second click. It is named from
  the page or post and gets its real type from its own first bytes, so a WebP is never saved as
  `.jpg`. **Download media here** finds the picture or video under the pointer when a site covers it
  with a clear layer, and works inside frames, on `<picture>` and `srcset` (the largest version), CSS
  background images and canvas drawings (saved as PNG).
- **A Download button on X and Reddit posts.** One click saves every picture and video in the post,
  at full size: X videos and GIFs as their best MP4, Reddit videos with their sound joined into one
  MP4, and every picture of a Reddit gallery. X keeps its own right-click menu on videos, so the
  button (or Shift and right-click, which reaches the browser's menu) is the way there. The button can
  be turned off in the settings.
- **Download as GIF.** Sites send most "GIFs" as MP4 or WebM. This makes a real GIF on your device
  (12 frames a second, up to 480 pixels wide and 20 seconds), or saves the site's own GIF when it has
  one.
- **Streams as one file.** A video the page plays in pieces (HLS or DASH) is put together as one MP4
  with its sound. Protected (DRM or encrypted) media is still refused, with a plain sentence.
- **The post's words come with the file.** Each download gets a `.md` file with the same name: the
  post's text exactly as written, the author, the post and file addresses, when it was posted and
  saved, the alt text, hashtags and links, the quoted or parent post, the author's own follow-up
  posts the page already loaded, and for a gallery, which item it is. On Reddit it also has the title
  and subreddit. The same description is written into JPEG, PNG, WebP, GIF and MP4 files without
  re-encoding them, so it survives if the `.md` file is lost. Files are named
  `<handle>_<date>_<first words>` so a folder sorts by person and day. A `.json` copy for tools is
  a setting, off by default. Nothing is fetched for any of this.
- **Copy and Copy link.** Copy puts a picture on the clipboard. Browsers let pages copy pictures but
  not video or GIF files, so for those Copy gives the file's address. Copy link gives the file's own
  address, or the post's for a video that streams in pieces. **Copy with caption** gives the post's
  words with the link, for sharing.
- **A short note in the corner** says what was saved and its size, or why nothing was. An optional
  setting, "Always ask where to save", brings back the save dialog.
- **The media library** behind all of this is one import for other tools: `daylight-commons/media`
  (project-docs/MEDIA-LIBRARY.md).
- **Save to Daylight.** Right-click any image, GIF, video or audio, or use "Save media from this
  page" in the toolbar menu. Direct files are saved as they are; a video the page streams is
  assembled from its unencrypted HLS or DASH segments. Each file keeps its SHA-256, address, page and
  time, in an investigation case (with the case list and an optional Internet Archive request) or a
  moodboard with tags and notes. A collections page shows each as a grid.
- **Protected media is refused.** Encrypted Media Extensions on the element, an HLS key other than
  NONE, a DASH ContentProtection element or MP4 and WebM encryption markers stop the save with a
  plain sentence. Nothing in the settings changes that.
- **Convert and compress on the device.** Images among PNG, JPEG, WebP and AVIF (where the browser
  writes it); GIF to MP4 or WebM; video to WebM or MP4 at a lower size, bitrate or frame rate; audio
  to Opus in WebM or Ogg. WebCodecs encodes; Daylight Commons' own GIF decoder and WebM, MP4 and Ogg
  writers do the rest, with no new dependency. Each result shows the size before and after and keeps
  a hash chain back to the original.
- `daylight media convert <file> --to <format>` and `daylight media compress <file>`, through a
  system ffmpeg, with a lineage file beside the result.
- **Ad and tracker blocking**, off by default and separate from every reading feature: EasyList and
  EasyPrivacy compiled into the browser's own blocking engine (12,900 rules), with "Allow ads on
  this site" in the toolbar menu.
- **Pressure lens**, off by default: urgency, shrinking the ask, manufactured consensus, false
  even-handedness, burden shifting and deflection by label, in messages from anyone. Held out on 73
  synthetic messages written blind: right on 8 of its 9 marks, found 8 of 47 moves, and marked none
  of 41 ordinary messages.

### Changed
- The window beside a post has **Pin** and **Close**, and stays where it was when you switch tabs and
  come back. Its media section has **Download** and **Copy link** for each picture or video.
- New permissions: `contextMenus` (the right-click items), `downloads` (Download saves to your
  Downloads folder), `clipboardWrite` (Copy and Copy link) and `declarativeNetRequest` (ad
  blocking). Firefox's data declaration adds optional "browsing activity" for the Internet Archive
  request on a case save. The store listing justifies each one.
- The Firefox source package for reviewers is now `docs/store/amo-source-3.6.0.zip`.

## 3.5.0 (2026-10-23)

Production hardening, plain help for every command, and the store kit. The audit behind it, with a
pass or fail for each check, is in project-docs/PRODUCTION-READINESS.md.

### Added
- Every command has its own help with an example: `daylight analyze --help`,
  `daylight case add --help`, `daylight case help trace`. Errors say what happened and what to do
  next ("No such file or folder ... Check the path").
- Quick start for each feature, a troubleshooting page and questions and answers in `docs/guide/`.
- Store kit in `docs/store/`: five 1280x800 screenshots of the extension on real public posts with
  every private person blurred, captions, the Firefox reviewer source package
  (`amo-source-3.5.0.zip`, which remakes both generated files byte for byte) and an index.
- Performance budgets in CI (`tests/budget.test.js`): text work per post, the first pass over a
  500-reply thread and each later refresh, plus a check that the thread pass grows about linearly.
- CI runs on macOS as well as Ubuntu and Windows.
- `scripts/qa/`: the production checks (first run, window open time, keyboard path, axe in light and
  dark, a 3,000-post scroll soak with the heap after garbage collection), a signed-out smoke check on
  nine sites, and the store screenshots.

### Changed
- Content scripts fail quietly: each page reader and message listener is guarded, a failure is logged
  once a minute as a `[daylight-commons]` warning instead of an error, and five failed passes in a row
  stop Daylight Commons on that page until you leave it. The site keeps working.
- Memory is bounded on long sessions: the in-page caches keep at most 5,000 posts, 5,000 YouTube
  authors and 2,000 posting patterns. On a 3,000-post soak the heap levels off at about 16 MB.
- Requests from content scripts give up after 10 s (Reddit) or 15 s (X About pages).
- Coordination clusters reuse each reply's signature between refreshes: a later refresh of a
  500-reply thread takes about a fifth less script time (60 to 49 ms).
- Reading lens: set 12 joined the dev sets, cues were added from the misses in sets 1 to 12, and the
  weights were refit. Sets 13 and 14, labelled blind by two labellers, were the held-out round. No
  technique reached the ship rule (80% precision from at least 3 hits): question insinuation was right
  on both of its 2 held-out hits. Every technique stays off by default.
- `verify-release` explains a same-version, different-head refusal in plain words: what it means,
  both hashes, and the steps to fix it. It never changes the state file itself.
- The popup has a page heading and keeps all its content in its main region (axe clean in light and
  dark). Case dossiers and network pages have a main landmark.

### Fixed
- "Starshield systems are owned and controlled by the US government" no longer reads as secret
  coercion. Who owns a system, firm or place is a fact; the cue now skips "owned and controlled",
  "wholly owned" and a thing as the subject.
- A case's tables can no longer name a file outside the case folder, and `verify-export` never reads
  outside the export folder. `case import` skips a capture that points outside the old folder.
- Dossier and network pages carry a policy that lets no script run in them.

## 3.4.0 (2026-10-23)

Case folders for investigation: `daylight case` (also `radar case`). A case is a folder with its own
git history. Each source is captured with its sha256, access time, read mode and Wayback request;
each claim sits on a rung (documented, inference, unproven, contradicted) with its source; and each
export verifies offline (project-docs/INVESTIGATE.md).

Read these limits before relying on it:
- Claims from `case run` without a model come from sentence rules. On the Musk and Ukraine case they
  found the documented facts the hand-built case found and missed every finding that needed reasoning
  across sources; most of the 245 proposals would be rejected in review.
- Retellings are linked by shared content words. Paraphrase in other words or another language is
  not linked, and two claims that disagree on a number or date in different wording are not flagged.
- Capture reads web pages and X posts. Video, Telegram, TikTok and Truth Social posts are not
  captured yet.
- `case read` runs the 3.3.0 Reading lens with every technique on, so it names techniques that are
  below their precision bar and off in the extension. On the Musk and Ukraine sources it read "owned
  and controlled by the US government" as secret coercion. Each finding is marked as below or above
  the bar.

### Added
- `case init`, `add`, `claim`, `claims --blind`, `label`, `labels`, `trace`, `event`, `timeline`,
  `edge`, `network`, `lead`, `leads`, `absent`, `actor`, `read`, `import`, `export`, `verify-export`
  (`src/investigate/`, `bin/lib/case*.mjs`).
- `case run <seed>`: twelve resumable stages from screenshots, URLs or a claim to a dossier, with
  checkpoints, a watchdog and a run lock; optional model steps through a local command or a
  configured endpoint; `case review` to accept or reject each proposal; `case watch` for scheduled
  re-checks of captures and leads.
- Exports: newsroom dossier, legal chain-of-custody bundle, research dataset with PROV-O and
  Croissant metadata. Each carries SHA256SUMS and a signed evidence bundle of `case-file` items (a new
  evidence kind in `schema/evidence.v1.json` and `evidence.v2.json`; new exports are version 2
  bundles). Private accounts are pseudonyms unless marked public
  figures.
- Extension popup: **Add to case** and **Save case list** (`src/ext/case-inbox.js`). Addresses stay in
  the browser; nothing is sent.
- `case read`: the Reading lens and the detector over every capture, with frames shared across
  sources.
- `examples/musk-ukraine-case`, the hand-built case of 2026-10-23 moved into the format.

## 3.3.0 (2026-10-23)

The reading lens. Daylight Commons now reads how a post argues, at the span: it names the technique,
marks the words in the post, and shows the two factors that moved its weight. The thread panel counts
how many posts and authors use the same frame, and the feed dashboard counts frames across your feed.
Every sign now says what it shows, in plain words.

### Added
- Reading lens (`src/core/reading.js`, `reading-cues.js`, `reading-inflection.js`, `reading-lists.js`).
  Seventeen techniques: nation denial, dehumanising metaphor, punitive annexation or elimination,
  strongman appeal, question insinuation, true item carries a leap, case to group, essentialism, coded
  term, replacement or blood libel, secret coercion, election theft, metaphor, hyperbole, irony,
  allusion and dog-whistle. Each has a plain one-line definition.
- Inflection layer: stance (quotes, mocks, rebuts, names a coded term to criticise it), irony, question,
  target class, intensity, thread echo, the opening post, genre, the author's own usage and post length.
  One deterministic weight vector, fitted on the dev feed tests only. Target enters as one class, and
  `tests/reading.symmetry.test.js` checks every nation, people, party, actor and leader in the lists.
- Spans marked in the post with the CSS Custom Highlight API (`src/ext/lens-inline.js`); the window shows
  the span, its name and its factors; the thread panel shows "Frames in this thread"; the dashboard shows
  "Frames across your feed".
- Options: "Every reading technique" shows all seventeen.
- `scripts/eval-reading.mjs`: precision and recall per technique with Wilson intervals, with and without
  inflection, against two blind labellers. Method and tables: `project-docs/READING-LENS.md`.

### Changed
- The window, panel, exports and command line show a "What it shows" row for each sign. It describes
  what the sign found and keeps a limit only where a reader would misread the sign without it.
- Technique definitions and lessons are rewritten in short, plain sentences: what the technique is
  and how to spot it.
- The definition catalogue's own notes are rewritten the same way. Every entry moves to 1.0.1; the
  quotes, elements and signals are unchanged (catalogue/CHANGELOG.md).
- radar-core API 2.0.0: the evidence item field `doesNotProve` is now `context`, the schema is
  `schema/evidence.v2.json` (`urn:radar:evidence:v2`) and new bundles are version 2. Version 1
  bundles still verify, and `readEvidence` reads their `doesNotProve` as `context`
  (project-docs/INTEGRATION.md).

### Measured
- Held-out feed tests 10 and 11 (98 posts, labelled blind for this release): no technique reaches 80%
  precision from 3 hits, so every technique is off by default. Question insinuation is closest at 3 of 4.
  Round 1 on feed tests 6 to 11 is kept in `project-docs/evidence/reading-results-round1.json`.
- The strong-family precision on `scripts/eval.mjs --split test` is unchanged: 4,167 of 4,597 (90.6%).

## 3.2.2 (2026-10-23)

A recall fix for conspiracy claims. In feed test 3 both blind labellers marked a reply that explains a
leader's conduct by saying a foreign state is blackmailing him, and 3.2.1 flagged nothing. A new named
theory, "secret coercion of a leader", reads that claim and its family, whichever state or group is
named. The held-out test split gives the same figures before and after.

Read these limits before relying on this release:
- The rule was written for one post, so its 1 of 1 is development recall, not a held-out figure. Like
  every named theory it is not measured, carries weight 0 and never counts toward "extreme".
- Conditionals, questions, allegations someone else made, documented cases and computer compromises
  are skipped, so a real claim inside such a sentence is missed.
- A bare name with "owned by" or "controlled by" is not read, because a name cannot be told from a
  place; an actor missing from the list is missed.

### Fixed
- Named theories: "secret coercion of a leader" (`src/core/theories-coercion.js`). A leader or
  congress blackmailed, compromised, owned or controlled by a state or a group, "has dirt on",
  kompromat, and "a Russian asset" or "a Kremlin puppet". One actor list holds states, leaders,
  agencies, parties, peoples, lobbies and companies from every direction, and
  `tests/theories.coercion.test.js` requires the same answer for every actor, with mirrored pairs
  (Israel and Russia, China and the US, Democrats and Republicans, Pfizer and BlackRock) and a
  control for every guard. Sources: NPR on the DOJ and FBI memo (2025-07-08) and the DOJ Inspector
  General's Crossfire Hurricane review (2019-12-09).
- Held-out precision on the test split, before and after: dehumanise 92.5% (37/40; 80.1 to 97.4),
  stereotype 84.2% (96/114; 76.4 to 89.8), any strong family 90.6% (4,167/4,597; 89.8 to 91.5),
  unchanged (`project-docs/EVALUATION.md`, "Feed test 3 fix"). On feed tests 1 to 3 the only change is
  the missed post, now flagged.

## 3.2.1 (2026-10-23)

A fix for a false alarm. The timing-burst signal reported bursts such as "6 accounts replied within
1 s ... p < 0.000001" on threads whose post times were placeholders worked out from rounded ages
shown on screen ("14h", "1d"). Rounded times put many replies on the same second, so the signal fired
on every screenshot-based run of 2026-10-23. Every timing signal now checks how precise the times
are and, below what it needs, says the signal is not observable at this time precision and never
fires. The integration API goes to 1.1.0: one new evidence kind and one new envelope field.

Read these limits before relying on this release:
- Inference from the times is a rule of thumb: at least half the distinct times, and at least
  three, on the same point of the minute, hour or day. A thread that mixes rounded and exact times
  is treated as rounded, which can hide a real burst. A thread with fewer than three distinct times
  has unknown precision and no timing signal.
- A precision the input declares is trusted as given.
- The burst baselines in `EVALUATION.md` were measured on second-precise data and are unchanged. No
  measured precision for bursts on real coordinated threads exists yet.

### Fixed
- Timing bursts on coarse times. `analyze` no longer reports a burst when the post times are given
  to the minute, hour or day. One `timing-not-observable` item names the signals that did not run,
  the precision found and what each signal needs. Five fixtures in
  `tests/fixtures/coarse-times` keep the timing of the three runs where this happened (two feed
  tests and a case study), with the text replaced and the accounts renamed; on 3.2.0 all five fired,
  and none fires now (`tests/precision.test.js`).

### Added
- `timePrecision` in the thread format, on the thread or on a post: `exact`, `second`, `minute`,
  `hour` or `day`. When it is missing, the importer sets it for platform formats (X, Reddit and
  Mastodon give seconds, Bluesky milliseconds) and Daylight Commons infers it from the times for a
  typed thread. Typed times are not taken as second-precise without evidence
  (`src/core/precision.js`, `project-docs/INTEGRATION.md`, "Time precision").
- What each timing signal needs: timing bursts and the fast-replier flag need seconds, swarming and
  quote bunching need minutes, active hours and the posts-around-the-clock flag need hours. The
  extension reads machine-readable times to the second and passes that precision explicitly, so a
  scheduler posting on the hour is not mistaken for rounded times. The connections log records each
  thread's precision; entries written before 3.2.1 were recorded from page datetime attributes and
  count as second-precise.
- `posts.timePrecision` (`{ value, basis }`) on thread envelopes, the `timing-not-observable` kind
  in `schema/evidence.v1.json`, and API 1.1.0. Bundles from 3.2.0 still verify.
- The signal registry (`catalogue/signals.json` 1.1.0) lists `timing-burst` as a context-only
  signal and states the precision it and `quote-bunching` need.

### Changed
- The timing-burst "does not prove" text now says it holds only for times given to the second.
- `tests/fixtures/integration/thread.json` declares `"timePrecision": "second"`: its hand-typed
  times fall mostly on whole minutes and would otherwise read as rounded.

## 3.2.0 (2026-10-23)

The first three resilience increments and the fixes from the 2026-10-23 feed test. A release now
carries a signed head that refuses an older release, and an offline kit that a person can check in a
browser with the network off. Evidence bundles gain a carrier-safe profile for handing to someone
else. The language detector finds more of what people flagged on a live feed. The integration API
stays at 1.0.0.

Read these limits before relying on this release:
- Recall on the 82 feed-test posts went from 1 of 21 consensus findings to 14 of 21. Those posts are
  the development set the new rules were written against, so that figure is not held out.
- Held-out precision for any strong family is 90.6% (89.8 to 91.5, 95% interval), inside its
  earlier interval.
- Verifiers older than 3.2.0 reject carrier-safe bundles at the schema step.
- No security audit has been done of the head, the offline checker or the carrier-safe profile, and
  the kit guide (`KIT-GUIDE.txt`) is a draft.

### Fixed
- Quoted posts are read. `analyzeThread` and `radar analyze` skipped a thread file's `quoted` list,
  so words in a quoted post got no evidence. They now get the same post evidence as any post and are
  listed in `posts.quoted`; the thread report and the other reply comparisons still leave them out,
  since a quoted post is not a reply. Found by the 2026-10-23 feed test (`tests/cli.test.js`).
- Dehumanising similes: "they are infecting every country like parasites", "X are spreading like
  a plague". The grammar needed a named group before the noun, and "plague" only counted straight
  after "are", so a verb of spreading or a target named as "they" or "these people" hid the marker.
  A new rule reads a group, "these people", or "they" (with verbs said of people or vermin only)
  followed by a verb of spreading and "like" a vermin or disease noun. It skips a match after a cue
  that someone else said it ("posts saying ...", "nobody should say that ..."). Tests in
  `tests/feed.dehumanise.test.js`, with near misses that must not fire.
- The antisemitic "noticing" code: "oy vey, stop noticing" was missed because only "the noticing"
  was listed. Added "noticing will continue" and "#thenoticing", and a rule for "notice" as a habit
  or an order ("stop noticing", "keep noticing") within a few words of "oy vey", "goy" or "goyim".
  "Oy vey" and "goy" alone stay unmarked. Source: Blue Square Alliance Against Hate, 2025-08-22,
  recorded in `project-docs/evidence/LEXICON-SOURCES.md`. Tests in `tests/feed.coded.test.js`.
- Group stereotypes beyond "X are <trait>" (`src/core/rhetoric-groups.js`): control put on a people
  ("a Jewish cabal", "Jewish money controls US policy", "X control the media"), a people predicted to
  attack ("the X will probably attack them"), a people as a country's ruin ("X immigrants will cause
  your downfall"), and a trait word before a people ("illiterate X"). Each rule reads every faith and
  race, and origin where a nationality cannot mean an army or a state; political and class groups
  stay out ("billionaires control the media" is an argument about power). Tests in
  `tests/feed.stereotype.test.js` run every rule over every group and add near misses.
- Named theories: a new "secret control" theory (a people, a hidden group or a foreign power secretly
  controls a country: "a Jewish cabal", "99% under the control of the CCP", "infiltrated and
  controlled by", "Deep State controlled nations"), with dated sources (ADL, The Korea Times
  2025-01-20, NPR/Ipsos 2020-12-30). Foreign powers from every direction are listed alike. The
  stolen-election theory also reads "won through a rigged election". Theories stay unmeasured at
  weight 0. Pairs in `tests/theories.symmetry.test.js`.
- Measured figures re-read once on the held-out test split after these fixes (`src/core/measured.js`,
  `project-docs/EVALUATION.md`, "Feed-test fixes"). Dehumanise 92.5% (37/40; 80.1 to 97.4),
  stereotype 84.2% (96/114; 76.4 to 89.8), any strong family 90.6% (4,167/4,597; 89.8 to 91.5): each
  inside its earlier interval, so every new rule ships. On the 82 feed-test posts the detector now
  finds 14 of 21 consensus findings with no flag outside them. Those posts are the development set the
  rules were written for, so that is not a held-out recall figure.

### Added
- Carrier-safe evidence bundles. Tick Carrier-safe on the card page, or pass `--carrier-safe` to
  `radar analyze`, for a bundle you will hand to someone else: it is signed with a one-time key
  that is never stored, keeps the day it was saved and no time of day, leaves out the page address
  unless you type one, and names the tool by its major version only. Two such bundles from one
  install share no key id, time or address. `radar verify` and the offline kit page say its
  signature proves the bundle is unchanged and says nothing about who made it. The ordinary
  profile stays the default and is unchanged.
- The offline kit page also checks one signed evidence bundle.
- The offline kit. Every release folder now carries `verify-offline.html`, one file with the
  project key, the signing code, the styles and the font inside it, so a person with a USB stick
  and a browser can check a kit with the network off. It checks the signed head, the signature over
  `SHA256SUMS` and every file, and names a changed file, a file the signature does not cover, and
  the key it found when a kit was signed by another key. `KEY-CARD.html` is a printable card with
  the key id and a QR copy of it; `KIT-GUIDE.txt` is plain guidance, still a draft awaiting a
  security partner's review. `scripts/kit.mjs` makes a kit folder from a release folder.
- `scripts/mirror-check.mjs` compares release mirrors and names each one that is unreachable,
  serves an older head, serves a different head under the same version, or serves a changed file.
- The signed head. A release now carries `HEAD.json` and `HEAD.sig`: a document of under 1 KB that
  names `SHA256SUMS` and the catalogue by hash, with a version that only goes up, the time it was
  signed and an expiry. `scripts/verify-release.mjs` and the options page check it before anything
  else and refuse an older head, a different head under a version already accepted, a head over
  4 KB, a head no trusted key signed, and a head whose catalogue or `SHA256SUMS` hash does not
  match. Each refusal names its rule in one sentence. Until now an old signed release verified
  forever (`src/core/head.js`, `scripts/head-lib.mjs`).
- How old the catalogue is, on the account card and in the toolbar popup: the catalogue date, when a
  signed head was last seen, its expiry and its signature count, as Current, Aging or Expired. An
  expired catalogue keeps every finding and says "Newer campaigns may be missing."

### Does not prove
- A valid head shows the signer chose these files at that time. It does not show the files are
  safe. Releases carry one signature, so a stolen project key can still sign a newer head. Several
  signers are designed on paper only (`project-docs/K-OF-N-SIGNING.md`). The head format has had no
  independent audit.
- The offline checker cannot show its own key is right if the kit came from an attacker; the printed
  card and a second source are the defence. It keeps no record, so it cannot refuse an older kit by
  itself. No person new to the project has yet tried the kit with the network off.
- A carrier-safe bundle cannot hide two bundles sent from one connection, and it strips nothing
  from the user's own files. Its post ids still identify the thread. A blind model review found no
  field that links two carrier-safe bundles from one install; no independent person has reviewed
  it yet.

### Changed
- `schema/evidence.v1.json` accepts a day-only `savedAt` for carrier-safe bundles. Verifiers before
  3.2.0 refuse such a bundle at the schema step.

## 3.1.0 (2026-10-23)

Wave 2 of `docs/WAVES.md`: the labelling kit, the challenge route, commons phase 1 and the element
tables in the window. The integration API stays at 1.0.0.

### Fixed
- Exports checked with outside validators: the technical profile wrote `null` for absent PROV
  attributes, which the W3C PROV-JSON schema rejects, and the research profile's Croissant context
  made `mlcroissant` fail. Both now pass (`project-docs/evidence/EXPORT-VALIDATION.md`).

### Added
- Element tables in the launch campaign window and card. For each applicable jurisdiction, every
  published definition is shown element by element as matched, not matched or not observable, with
  the signs behind each match, in a fixed order that never depends on how damning a table looks.
  When neither the actor's nor your own jurisdiction is known, every jurisdiction the catalogue
  covers is shown. Each table links to its catalogue entry at the version used, its source and the
  challenge template.
- The challenge route as a product. Every badge in the launch campaign window and card names the
  catalogue entries that cite its sign, at their versions, and links to them and to a new dispute
  template for badges and findings with the sign filled in. `catalogue/DECISIONS.md` is the public
  log of challenge decisions, each with its reasoning; `scripts/decisions-check.mjs` checks it in CI,
  where a closed challenge needs a final decision and an open one needs a line within 14 days. The
  extension carries a generated copy of the catalogue (`src/core/catalogue-data.js`), checked
  against `catalogue/` in CI.
- `radar export <evidence-chain.json> --profile legal|technical|journalistic|research`: the four
  export profiles from one saved evidence chain. A legal dossier with exhibits, a custody log and
  the cited definitions' elements; W3C PROV-JSON with the raw observations; a journalistic
  write-up with a right-of-reply log; and a research set with lineage per row, hash-fixed splits,
  Croissant metadata and a datasheet. Each refuses a chain that fails its check, post text and a
  private account without a pseudonym, and ships the chain so a reader can run `radar verify`.
  The command line release file now carries the definition catalogue.
- The campaign-lens labelling kit (`scripts/label/`), on the author's method of 2026-10-23: Claude
  labels, and an open-weight model of a different family cross-checks through Flywheel's local lane
  (`labeller-b.mjs`). The case set is fixed and hashed before labelling; each labels file is hashed
  in an ordered ledger before the detector output is joined (`ledger.mjs`), and scoring refuses a
  file that changed or came out of order. Claude resolves each disagreement with a written reason,
  and scoring refuses one without. `results.mjs` reports Cohen's kappa between the two labellers
  with a 95% interval, precision and recall with Wilson intervals, the organic false-positive rate
  per language and region stratum against the 5-point bound, and an optional author spot-check.
  The method sentence is fixed and never says "human-labelled". Files hold structure only and
  refuse post text, handles and names. Guide: `project-docs/LABELLING.md`; steps:
  `docs/LABELLING-RUN.md`. Nothing has been labelled yet.
- The definition catalogue as a public page, `docs/catalogue.html`: every entry with its
  jurisdiction, version, sources, retrieval dates and elements, and the source hashes and quoted
  text in a details section. Each entry has an anchor a badge can link to. The page is built from
  `catalogue/` by `scripts/catalogue-page.mjs`, CI fails when it is stale, and the other public
  pages link to it.
- An automatic sign-off check on every pull request (`.github/workflows/dco.yml`,
  `scripts/dco-check.mjs`): each commit needs a `Signed-off-by` line matching its author.
  `node scripts/ci.mjs dco` runs the same check locally.
- `project-docs/MIRROR.md`: the steps for a read-only Codeberg mirror, for the author to carry out.
- `docs/COMPLETION.md`, the completion ledger: every feature in the project's direction with a
  check that can fail, its status and the tool it competes with; `docs/WAVES.md`, the work plan.

## 3.0.0 (2026-10-23)

Major version: the name, the licence and the first public package of the campaign lens change
together, and the GDELT lookup and its permission are gone. Under semantic versioning a removed
feature and a new licence are breaking for anyone who redistributes or builds on the extension. The
integration API keeps its own version (1.0.0) and does not change. The full release audit, claim by
claim, is `docs/RELEASE-AUDIT.md`.

### Fixed (release audit)
- `radar verify` and the Analyse a file page check an evidence chain saved with "Save evidence
  chain": every receipt, every link, the head, the Merkle root and each inclusion proof, one line
  each. Before, only a library function could, and `radar verify` refused the file.
- Evidence lookups: the Internet Archive's capture index stopped sending a CORS header, so the
  archive lookup failed. Turning on Evidence lookups in Options now asks for access to
  web.archive.org; without it the archive is reported as not asked. A site on a hosting service
  (github.io, netlify.app and others) is looked up whole, and RDAP is not asked when the service was
  registered.
- Campaign lens: any launch with five quotes read as "looks coordinated", because five quotes always
  have a narrowest window. Only five inside an hour count now; a wider window is shown as timing.
- Firefox: evidence lookups are declared as optional `websiteContent` data collection and asked for
  from the Options switch, as Firefox 140 and later require.
- The manifest, store listing, privacy policy, first-run page, popup and page footers no longer say
  nothing leaves the browser, or that every sign has an error rate. "Clear all" is described as two
  steps, and the privacy policy lists what it keeps. The README says 319 fact-checkers, not 328.
  GOVERNANCE says the AGPL grant covers 3.0.0 and later.
- Two tests rebuilt shared files in place while other tests read them, and could fail at random;
  both now build in a temporary copy.

### Changed (campaign lens naming held)
- Until a media lawyer has reviewed the accusation ladder's wording, the lens names no company and
  leaves out "paid buzz dressed as organic". Every claim reads "this launch". The evidence, the lead
  and the unnamed inference are unchanged (`NAMING_HELD` in `src/core/campaign.js`, tested).

### Changed (fonts)
- The Conso font is removed, because its licence is not open source. JetBrains Mono 2.304 Regular
  (SIL Open Font License 1.1), the next face in the author's site's own stack, sets figures and code
  in the extension. A test keeps every licence in `REUSE.toml` free and every packaged font under
  the OFL.

### Changed (public pages)
- The install, privacy and measurement pages on the project's site now use the author's site
  design: its shared style and navigation, its light and dark grounds, the mast and the heading
  rail. The extension's own copies keep their self-contained style.

### Added (how it works and demonstration)
- A "How Daylight Commons works" page: the path a reply takes, each finding type with a still of the
  installed extension and its does-not-prove line read from the same constants the window shows,
  receipts and the offline check, and the limits.
- `docs/demo/`: stills of every finding type, the extension's pages in light and dark, a recording
  of under two minutes showing install, a reply's window, a lookup and the offline check, and a diagram. All made from the release package on
  synthetic pages (`scripts/demo/`).
- `docs/store/`: the listing text, six screenshots, the promo tile and the submission steps.
- Each release carries the command line tool as `radar-cli-<version>.zip`, signed with the rest, so
  a receipt can be checked without the repository.


### Changed (name)
- Radar is now Daylight Commons. The name follows Justice Brandeis: "Sunlight is said to be the
  best of disinfectants." The repository moved to github.com/HarperZ9/daylight-commons (the old
  address redirects) and the pages to harperz9.github.io/daylight-commons. The display name,
  docs and messages changed. Kept for compatibility: the Firefox add-on id, storage keys, the
  `urn:radar:` schema names, the `RADAR_*` environment variables, `~/.radar`, the icon and
  package file names, and the `radar` command, which `daylight-commons` now also runs.

### Changed (licence)
- Radar is now free and open source. Code: GNU AGPL v3.0 only, replacing FSL-1.1-MIT. Data, the
  definition catalogue, schemas and documentation: CC BY 4.0. `REUSE.toml` maps every file to its
  licence and `THIRD-PARTY.md` lists what keeps its own terms. Every package now ships
  `LICENSE.txt`, and the manifest links the source.
- Added CONTRIBUTING.md (Developer Certificate of Origin, no CLA), CODE_OF_CONDUCT.md
  (Contributor Covenant 2.1), SECURITY.md (private reporting through GitHub security advisories)
  and GOVERNANCE.md (purpose, permanence, funding rules and the challenge process).

### Fixed (X live check, 2026-10-22)
- X's web responses no longer carry a `legacy` block on accounts. Follower, following, post, like and
  media counts and the website are now read from `relationship_counts`, `tweet_counts`,
  `action_counts`, `website` and `profile_bio.entities`, with the older fields kept as a fallback.
  Before this, every account read from live X had no follower count, so the campaign lens could not
  place a launch in a follower stratum.
- The campaign lens reads X's Paid partnership mark from the response
  (`content_disclosure.advertising_disclosure.is_paid_promotion`) as well as from the page, and reads
  quote text from the response. X keeps only about seven posts in the page at once, so the page alone
  missed paid marks and text on quotes scrolled past (3 of 10 and 3 of 6 marks on the two threads
  checked). The mark is recorded as X's claim, never as ground truth.
- The X readers no longer depend on X's test ids. The in-page adapter falls back to semantic
  structure and the accessibility tree (`article` or `role="article"` holding a status link with a
  `<time>`, text in `div[lang][dir="auto"]`, the author from the status link). The saved-page reader
  does the same, and a test rotates class names, renames or removes test ids, obfuscates attribute
  names and swaps `article` for `role="article"`.

### Added (evidence layer)
- Under a launch campaign section, "Look up evidence" (off until you allow it; one click per post):
  a linked repository's creation date and, with your own GitHub token, its star bursts; a linked
  domain's registration date (RDAP) and first Internet Archive capture. Ad library search links to
  open yourself. Each fact is a receipt with its source, time, a hash of the answer and what it does
  not prove.
- Receipts are sealed in an append-only, hash-chained log with Merkle inclusion proofs (the same
  construction as Flywheel's); "Save evidence chain" downloads it, and the verifier rejects edited,
  swapped, removed, reordered or re-rooted chains.
- A local count ledger shows how a launch post's counts moved between your visits.
- "Save this post to the Internet Archive" opens the archive's save page and records a witness receipt.
- Design and limits: `project-docs/EVIDENCE-LAYER.md`; direction: `project-docs/VISION.md`.

### Added (definition catalogue, not in the window yet)
- `catalogue/`: 15 published definitions, each quoted word for word from its official source with
  the URL, the retrieval date and a SHA-256 of the page: the FTC Endorsement Guides (16 CFR 255.5),
  the fake social media indicators rule (16 CFR 465.8), FTC Act section 5 with the Policy Statement
  on Deception, EU UCPD Annex I points 11, 22 and 23c, DSA Articles 26 and 39 as context, UK DMCC Act
  2024 Schedule 20 paragraphs 12, 13 and 25, fraud definitions for comparison (18 U.S.C. 1343, Fraud
  Act 2006 section 2), and X's Paid Partnerships and Authenticity policies.
- Each definition is split into elements marked observable from the page, from the public record,
  or not observable. `src/core/definitions.js` builds the element table for a finding: "matches
  elements A and B of [definition]", with the evidence for each, and never a verdict word (tested).
- Every jurisdiction that applies is shown in a fixed order. A symmetry test checks the tables do
  not change with the post's topic or side. Challenges go through `.github/ISSUE_TEMPLATE/challenge.yml`.
- `npm run catalogue:refetch` re-reads every source and reports drift. Not legal advice; a media
  lawyer reviews the wording before public release.

### Added (launch campaign lens, not measured)
- On an X post and its repost and quote lists, the thread panel adds "Launch campaign": the post's
  engagement shape against the account's own posts, the reposter and replier sample (shared bio
  templates, stock-persona bios, join-date clusters, topic mismatch), the quote cluster (Paid
  partnership labels, bunching, undisclosed look-alikes) and overlap with other launches you opened.
  It leads with a named inference only when two or more independent signs agree, names only an
  account X discloses as an organisation, never names a sampled account, and gives each sign what it
  does not prove and a dispute route. Design and bounds: `project-docs/CAMPAIGN-LENS.md`.
- Banned features (language, script, place, name origin, avatar look) are checked by tests.
- No precision is claimed: `project-docs/EVALUATION.md` has the hand-labelling protocol and the
  fairness bound that must hold first.

### Added (backing on record)
- On the account of a public media personality, the window shows "Backing on record: N sources":
  who employs them, who owns their outlet, investors, licensing deals, FARA filings, court records,
  sanctions and government labels. Each record quotes its sources with the date read, gives a status
  (documented, reported or alleged) and a confidence, and says what it does not prove. On YouTube the
  panel names a channel's records. Every window links to the corrections file.
- 90 people researched, chosen by audience and topic, not by side, plus 14 named in primary records;
  162 records ship for 78 people. Every quote was checked against its page, and a record whose quote
  or underlying filing could not be confirmed is held back. `data/personalities.README.md` reports
  the method, the side balance of the dataset and of the findings, and the gaps.
- The table is local data in the signed data pack; nothing is fetched live.

### Fixed (outlet owners)
- Six outlet owner rows that were wrong in the Wikidata-built table now show a sourced correction,
  marked "Daylight Commons correction" with its date and source, instead of Wikidata's row:
  - bloomberg.com no longer lists Bank of America, whose Merrill Lynch stake was sold in 2008.
  - dw.com is no longer "owned by ARD": DW is its own public-law broadcaster under federal law.
  - france24.com shows France Médias Monde.
  - redeglobo.globo.com shows Globo, not a regional affiliate's owner.
  - xinhuanet.com shows Xinhuanet Co., Ltd., run by Xinhua News Agency.
  - asahi.com shows "Owned by" again.

  Where Wikidata's site facts came from another item, the site card hides them.
- `data/owner-corrections.json` holds these corrections by hand. Each row cites a primary source and
  says why the upstream row is wrong. The upstream guard reports when Wikidata agrees again, so a
  correction can be retired.

### Changed (independence: Other coverage without an aggregator)
- Other coverage now reads each outlet's own news feed, with no aggregator in between. Turn it on,
  then choose outlets from 33 suggested feeds across 18 countries and every owner type, or add any
  https RSS or Atom address. Each choice asks the browser for that one feed host only. On your
  click, Radar downloads the chosen feeds and matches the article's title against their headlines
  on your device. Nothing from the page is sent. Every feed asked is listed with its result,
  including the ones that failed and why. Redirects to another host are not followed.
- The GDELT lookup is removed, not kept as an option: it was an aggregator Radar could not check,
  it received the title's words, and it answered 24 of 100 test lookups. On update Radar gives back
  its permission, and consent given to it does not carry over. Firefox no longer lists
  `websiteContent` as optional data collection, since Radar no longer sends any.
- Measured: all 33 feeds answered, all in 1.2 s; of 99 lookups, 34 found at least one other outlet
  and 17 found three or more. Precision not measured.

### Added (independence: when a site changes)
- When a platform changes its page so that Radar reads nothing where it should, a notice says so
  ("Reddit changed its page; Radar cannot read replies here yet") instead of Radar showing nothing.
  A sign-in wall or a removed post is not called a change.
- "Self-test on this page" in the toolbar menu: how many boxes Radar's reader found and read here,
  with authors, text and ids, and the page's shape. Counts only.
- A generic reader for sites Radar has no reader for: the site card adds "Text on this page", with
  rhetoric, persuasion and machine-writing counts for the article body and the comments, found from
  the page's layout. Layout guesses; not measured.

### Added (independence: releases without a store or a code host)
- Signed, reproducible releases (`npm run release`): the store packages, a self-distribution
  Firefox build that updates from Radar's own site, the hash of every file inside each package, a
  git bundle of the source, `SHA256SUMS` and an ECDSA P-256 signature over it. Key id
  `0e5e 1984 0565 840c 977e 0f03 6c9a c021`, the same project key that signs data packs.
- An install page on Radar's site: how to check a download (with a checker that runs in the
  browser), rebuild it, and install it without a store, and where Chrome and Firefox still require
  their own rules. `node scripts/verify-release.mjs` checks a release offline.
- `npm run ci` runs exactly what GitHub Actions runs, so the project can check itself anywhere.
- A test fails if private key material appears anywhere in the tree.
- Details and what each measure does not prove: project-docs/INDEPENDENCE.md.

### Added (integration surface)
- radar-core: one ES module, `src/core/api.js`, with `analyzeThread`, `analyzeText`,
  `checkMedia`, `siteInfo` and `useData`. Pure functions over Radar's core: no DOM, no network,
  no dependency. Every evidence item states what it shows, its source and what it does not prove,
  in the window's own words, and points at posts by id; no item names an account. API version
  1.0.0, versioned separately from the extension.
- A JSON Schema for the output and for bundles, `schema/evidence.v1.json`, with tests that check
  real outputs against it and a stability promise in project-docs/INTEGRATION.md.
- A command line tool, `node bin/radar.mjs`: `analyze`, `verify`, `site` and `media`, reading
  local files only.
- Signed evidence bundles: post ids, the evidence with its matched words, the Radar and API
  versions, a hash of the data tables and the time, signed with a per-install ECDSA P-256 key
  (WebCrypto; non-extractable in the extension). Anyone can verify one offline with the CLI or the
  extension. Full post text goes in only when the user ticks the box. Saved from the new Analyse a
  file page and from the thread card page.
- Analyse a file, an extension page: a saved X or Reddit thread, thread JSON from X, Bluesky or
  Mastodon, an X archive's tweets.js, a Reddit export CSV (its ip column is dropped), a Mastodon
  outbox.json or a Bluesky repository .car, read on the device with nothing sent. Images and video
  get the Content Credentials check.

### Added (data sovereignty)
- A dataset lockfile, `data/LOCK.json`: every input the data build reads (Wikidata tables, the
  Data Commons fact-check feed, the Unicode confusables table, the PHEME corpus, the hand-kept
  operation and state sources) with its source, retrieval date, licence, row count and the SHA-256
  of its raw snapshot, plus the SHA-256 of every table the build writes. A table that changes
  without its lock entry fails the tests.
- `npm run build:offline`: rebuilds every table it has a pinned snapshot for with the network
  blocked, and fails when a snapshot or a rebuilt table differs from the lock. With every snapshot
  present, all seven rebuildable steps reproduce the committed tables byte for byte.
- The Unicode confusables snapshot is committed (`data/snapshots/`). Larger snapshots, and those
  holding other people's posts or names, stay outside the repository and are pinned by hash.
- An upstream-change guard, `scripts/upstream-guard.mjs`: diffs a fresh table against the locked
  one and flags mass removals, bulk edits, an owner or state label flipped or a site dropped among
  97 high-reach sites (`data/high-reach.json`), any state label change, and a fact-checker whose
  rows vanish.
- Signed data packs. A pack is a JSON file signed with ECDSA P-256 through WebCrypto, adding
  fact-checked claims, operation indicators or site notes, each citing an https source. In the
  options page, under Data packs, you pick a file; Radar shows which key signed it and what it adds,
  and uses it only after you trust that key. Packs can be turned off, removed or distrusted. Radar
  never downloads a pack. Pack rows carry their pack's name and never count in the operations trend.
- Radar's own data ships as a pack signed by the project key (`src/ext/radar-data.pack.json`);
  "Check Radar's own data" in the options page checks the installed tables against it.
  `scripts/pack.mjs` creates keys, signs and verifies packs.
- A test that fails when any file in the tree holds private key material, and `.gitignore` rules
  for key files. Method and threat model: project-docs/DATA-SOVEREIGNTY.md.

### Changed (data sovereignty)
- One copy of canonical JSON, SHA-256, base64url and ECDSA P-256, `src/core/sig.js`, now serves
  sealed evidence cards, evidence bundles and data packs. A bundle's `dataLock` hashes each table
  with LF line ends and equals the hash of the table hashes pinned in `data/LOCK.json` and signed in
  `radar-data.pack.json`.
- The fact-check table is rebuilt from its pinned feed snapshot: 19,387 claims, 8 more than 2.1.0
  shipped (39 in, 31 out, at the size cap's edge). The 2.1.0 copy could not be rebuilt from any
  snapshot on hand.
- `scripts/owners-build.mjs` can keep its raw Wikidata answers (`--save-raw`) and rebuild from them
  offline (`--in`), and lists each outlet's owners in a stable order. Data builders take the date
  they write from `RADAR_BUILT`, so a rebuild is reproducible.

### Added (text in images)
- Read text in this image. With "Read text in images" turned on in the options page (off by
  default), the window's Media area offers "Read text in this image" under each image of a post. On
  that click only, Radar reads the words in the image on your device with its own recogniser and runs
  the same theory, rhetoric, persuasion and fact-check checks on them. Each sign found that way is
  labelled "in image:", stays at info level, shows the recogniser's confidence, reads "not measured
  yet" and never counts toward the thread report. The image and its text never leave the browser.
  Latin-script text only.
- Radar's own recogniser, with no third-party code: an ink mask, line and word finding, and a small
  convolutional network read by CTC, in JavaScript with a 546-byte WebAssembly SIMD kernel (plain
  JavaScript where WebAssembly is not allowed). Weights 270 KB, trained by Radar on synthetic lines.
  It runs in the background worker, never in the page.
- Fact-check matching for image text mends one misread letter in a word when exactly one claim
  word is one edit away. Typed text is matched as before.
- A lesson, "Words inside a picture".

### Measured (text in images)
- Character error rate 1.03% (95% interval 0.56 to 1.66) on 120 synthetic screenshots rendered by
  Chrome, and 3.00% (2.13 to 4.20) on 22 screenshots of Radar's own published pages; target 5%.
  Tesseract.js, as a research baseline only: 5.76% and 4.03%.
- Median time from bytes to text 0.16 s on synthetic screenshots and 0.50 s on dense text pages on
  a desktop; 0.72 s and 2.58 s with the CPU slowed four times, where dense pages miss the 1.5 s
  target. Details and limits in project-docs/IMAGE-TEXT.md.

## 2.1.0 (2026-10-21)

Named in published reports: 98 documented influence operations from 27 countries, with the investigators' own
attribution wording. Techniques read from behaviour, not wording: flooding, cross-language repetition and
laundering chains. Named conspiracy theories, brand-borrowing accounts, and Korean and Indonesian markers
derived from labelled data.

### Added (framing, hidden motives and swarming)
- Swarming, a thread sign: many new or flagged accounts replying to one post within ten minutes.
  The window gives counts only, never the accounts, so the report cannot become a list to pile on.
  On ordinary threads (PHEME) it showed up in 0.04% of threads (2 of 4,712 threads with five or more replies;
  test half 1 of 2,278, 95% interval 0.01 to 0.25%). No labelled set of harassment threads was
  available, so it has an organic rate and no precision.
- Cloned-outlet framing: when a post names an outlet in its own words and links a look-alike of
  that outlet's address, the look-alike sign says so, and points at the "Named in a published
  report" sign when a report named the address. Post-level precision is not measured; the address
  check catches 147 of 1,174 report-named domains and matches none of 52,598 real outlet domains
  (in-sample regression controls, not a held-out error rate).
- Two persuasion techniques, held back: hidden motive ("masked as", "the real reason is",
  "secretly", "textbook move") and just asking questions ("I'm just asking", "is it a
  coincidence?"). On the PTC test split, scored against its "Doubt" label as the nearest one, they
  hit 0 of 4 and 0 of 2 spans, far under the 20-hit minimum. Each has a lesson.
- Episodic and thematic framing (Iyengar 1991), held back: Radar can read whether a post tells an
  issue only through one person's story or explains it through trends, numbers and policy, with
  symmetry tests across 20 groups and 10 issues. No labelled corpus with a usable licence exists:
  the Media Frames Corpus needs LexisNexis access and labels policy frames, the Gun Violence Frame
  Corpus labels issue frames, and the immigration tweets of Mendelsohn et al. (2021) carry no
  licence and only tweet ids. On PHEME replies the reading fires on 0.9% as person-stories and
  1.7% as structural, unlabelled. A lesson explains the frame.
- "Your feed" has a person-stories and structural explanation section. It stays held, with its
  reason and no counts, until the reading clears its measurement; the feed log keeps each post's
  frame (a label, no text) so the shares and their intervals can start at once.

### Added (derived word lists)
- Korean and Indonesian slur signs from word lists derived from human-labelled research corpora,
  not typed by hand. A script picks each term on the dev split by weighted log-odds against the
  corpora's group-hate labels, drops group, party and public names and terms that fire on other
  languages, and keeps only terms that clear a dev precision bar. Korean (54 terms, K-MHaS and
  BEEP!): 93.8% of test signs on text people labelled hostile (95% interval 93.3 to 94.3, 8,635
  checked), with terms aimed at both political camps and at both men and women. Indonesian (one
  term, IDHSD and IndoDiscourse): 85.0% (70.9 to 92.9, 40 checked).
- Held back, with their figures recorded in project-docs/EVALUATION.md: Japanese (63.0%, lower
  bound under 0.7), Hebrew and Hindi (their corpora label offensive-or-not only, so the lists hold
  insults, not group slurs), Turkish and Persian (no term cleared the dev bar). Held-back lists
  never run on a reply.
- Unicode handling for each script: Korean and Japanese as character n-grams, Korean only at a
  word start; Hebrew points and prefixes; Turkish dotted and dotless i and stems; Persian yeh,
  kaf and the zero-width non-joiner.
- Symmetry suite for all seven languages, with targets from every direction.

### Added
- Named conspiracy theories. A post that uses a documented theory by name or by its stock line
  (chemtrails, adrenochrome, QAnon slogans, satanic ritual abuse, "Great Reset" plot framing, stolen
  or rigged elections, machine or satellite vote-flipping, staged shootings, 9/11 inside job, 5G and
  COVID-19, vaccine harm, hidden cures) gets an info sign in the Language area. It names the theory,
  says what the record shows and links the dated sources. Election and staged-event claims match in
  both directions, checked by matched pairs. Posts that debunk, mock or report a theory are skipped.
  Not measured yet: no conspiracy-labelled corpus with a usable licence was found, so the sign
  never counts toward the thread report.
- Name borrows a brand. An account whose name or handle borrows a platform's or a major outlet's
  brand ("X Global", "BBC Breaking") and is not one of its accounts gets a weak account sign on X.
  X's affiliation badge, an organisation check, or X's parody, commentary or fan label clears it.
  The brand list names each outlet's Wikidata item. Alone it never counts toward "flagged". Not
  measured yet.
- A lesson for each new sign.

### Research
- project-docs/IMAGE-TEXT.md compares on-device options for reading text inside images and
  recommends a path, with targets and a privacy statement. Nothing ships yet.

### Added (techniques)
- A technique map, `project-docs/TECHNIQUES.md`: flooding, laundering, cloned outlets, coordinated
  amplification, repetition across languages, "just asking questions" and demoralisation, and
  swarming, each mapped from Rauch, RAND's "firehose of falsehood" (Paul and Matthews 2016) and
  DISARM ids to what Radar can observe, with its status, gap and precision target.
- Same link, upload or fact-checked claim in several languages: a sign on replies when accounts
  writing in different languages carry the same item, in one thread or across threads you viewed.
  The root post's own material is set aside.
- Flooding: a thread line when three or more accounts posting 100 or more times a day write a
  quarter of the replies, or a timing burst is made of such accounts. Repeat posters show as context.
- The laundering chain: the post, the accounts and sites its material passed through, and the
  earliest origin Radar saw, in the card's trail and as a Sources sign when the post does not point
  at the origin. Built only from pointers the site records.
- Lessons for the two new post signs.

### Measured (techniques)
- On ordinary threads (PHEME), flooding fires on 0.55% to 3.3% of threads by size and
  cross-language on 0% to 1.1%. Neither has a labelled campaign set, so no precision is claimed.
### Added (influence operations)
- "Named in a published report": a link in a post, an account, or a website, domain or @handle in
  an account's profile that a published report named as an influence operation's asset. The window
  names the operation, who each source says ran it in the source's own words (linked to stays linked
  to), the report and its date, and what the match does not prove. It is about the link or account,
  never the person who shared it.
- The table behind it: 98 operations from 27 attributed countries, 2017 to 2026, cited field by field
  to 176 primary documents (platform threat reports, research labs, court filings, sanctions texts and
  government reports, and reporting that names its sources), with 1,237 domains and accounts.
  `data/ops.README.md` lists what was left out and why, and the licence of each kind of source.
- "Look-alike news address", a separate weaker sign: a link that copies a major outlet's name on
  another ending, with one letter off, or with look-alike letters (washingtonpost.pm, theguaradian.com).
  It matches none of the 50,000-odd real outlet domains in Radar's owner and site tables.
- Documented operations per year and per attributed country on the dashboard and the transparency
  page, with the caveat beside the numbers: they count what investigators found and published, not
  how much activity there was.
- Two lessons, one per new sign.

### Tests (influence operations)
- One evidence rule for every country (`src/core/ops-schema.js`): a read source, an operator type a
  source states, a citation for every field. A symmetry test checks that relabelling an operation's
  country changes nothing, and that the rule code names no country.
- False-match controls: no real outlet's domain is shipped as an indicator, and no real outlet matches
  a look-alike pattern.

## 2.0.0 (2026-10-21)

Radar now answers, in one hover: where a post comes from, who is pushing it, how it argues, whether a
fact-checker has reviewed it, and whether its media carries Content Credentials. Every answer is sourced
and states its limit. Nothing leaves the browser unless you turn on Other coverage and click.

### Added (sources)
- Site cards on links. Rest the pointer on an outbound link in a post, or focus it, for the linked
  site's owner, owner type, founding year and country (Wikidata), any cited state link, and its
  fact-check record: "N reviews by M fact-checkers since <date>, ratings as the checkers wrote
  them", the three newest reviews and the full list on its own page. The post window's Sources area
  shows the same card. Redirects from X, Facebook, YouTube, Reddit and the search engines resolve to
  the real address first.
- "Site card for this page" in the toolbar menu shows the card for the news site you are reading.
  Radar runs on that page only when you press it.
- Labels under Google, Bing and DuckDuckGo results, off until you turn an engine on in the options
  page; the browser asks for that engine's access then. The labels name the owner and any state
  link; the review count stays in the card beside its limits.
- Other coverage, off by default: on a click, other outlets covering the same story from the GDELT
  Project, each labelled by owner type (state media, public broadcaster, regional govt, nonprofit,
  commercial, or not stated), never by a left or right score. It sends the four longest words of the
  article's title to api.gdeltproject.org and nothing else. The options page says so before you turn
  it on, Firefox asks for the "website content" permission then, and the first use shows the exact
  words and waits for your click. It is the only feature that sends anything.
- The fact-check table keeps, for each review, the site where the fact-checker said the claim
  appeared (domain only; null for posts on platforms, archives, transcripts and aggregators). A new
  site table holds facts for 48,341 sites and fact-check records for 2,451 (`data/sites.README.md`).
  The owner table grows from 7,374 to 19,864 domains: where Wikidata names no owner, the parent
  organisation or publisher, labelled as such.

### Measured (sources)
- On the feed of 2026-10-20, 66.8% of 87,647 reviews list where the claim appeared and 5.6% name a
  site; 74.7% of those with an appearance were on platforms only. A hand read of 40 random
  attributions found 36 correct, 2 citing a site as context, 2 malformed rows now dropped.
- Every site a shipped review names has a record (100%, tested).
- Of 500 news links sampled from Google News search feeds in 14 editions, 42.2% resolve to an owner
  row and 55.4% to any site fact (target 85%: not met).
- Other coverage on 100 headlines from Google News feeds in 10 editions (2026-10-21, one request
  every 12 s plus one retry): GDELT answered 24 and refused or dropped 76 (55 "please limit
  requests", 20 network failures, 1 title too short). 9 of 100 found at least 3 other outlets (9 of
  the 24 answered); median time 25.5 s overall, 18.6 s when answered. Targets of 70% and 3 s: not
  met. The limit is GDELT's availability from this machine, not the query.

### Added (research)
- What normal looks like, beside every coordination sign. Near-identical replies, bursts of replies,
  accounts seen together and wording seen in other threads now show how often the same sign turned
  up in ordinary threads of the same size, with its interval and source: the PHEME corpus of Twitter
  threads from 2014 and 2015 news events (CC BY 4.0), with independent-posting simulations beside it
  in `project-docs/EVALUATION.md`. In threads of 20 to 49 replies, a same-text group shows up in 1.4%
  of ordinary threads and a burst in 2.2%.
- Look-alike letters no longer hide a copy. A Cyrillic "а" or a Greek "ο" swapped into an English
  word, fullwidth or mathematical letters, and invisible splitters are folded before the duplicates
  sign, the cross-thread fingerprint, claim matching and the word lists, using the Unicode
  confusables table (UTS #39, Unicode License v3). On 100 seeded copies the duplicates sign finds 100,
  up from 75. Text written in one script, such as Russian, Greek or Arabic, is never changed.
- Community Note timing: when X loads a note, the window says when it was written, how long after
  the post and how long ago, from the note's own id. The page does not say when X began to show it.
- Content Credentials survival on the feed page: of the files you checked, per site, how many still
  carried intact credentials, how many were changed and how many had none. Radar keeps a short hash
  of each file's address, never the address (`pb.media.v1`, pruned with your history setting).
  A CI conformance test holds the count to c2patool's verdicts on the c2pa-rs test files: they agree
  on which files carry credentials for 42 of 43, and the one miss is named.

### Changed (research)
- Near-identical replies no longer count text a reply quotes ("RT @outlet: ..." or a quoted post) or
  the wording of the post it answers. Before this, the sign fired on a third of ordinary threads.
- Bursts are tested against the thread's local pace as well as its average. The rush of replies
  after a post had fired the sign on 39% of ordinary threads with 50 or more replies; it now fires
  on 1.1% to 3.3% by size.
- Persuasion techniques show only at 80% measured precision or more, with the interval starting at
  70%, from at least 20 hits; whataboutism never shows on one reply. Published systems score about
  30 to 44 F1 on these techniques. No technique clears the bar yet, so none shows, as before.

### Changed (design follow-ups)
- The transparency page leads with one figure per sign: a plain sentence, the interval drawn as a
  figure, and the counts under "How we know", as on the author's product pages. The dense tables
  sit in disclosures.
- The thread card image no longer prints its SHA-256 hash; the hash stays in the JSON file and under
  "Check a copy" on the card page.
- Keyboard hints name Conso directly and never fall below 14px.

### Changed (design)
- Every Radar surface now uses the design of the author's site: bone and void grounds, ink text,
  Hanken Grotesk for words and Conso for figures, square controls, sections that open on a
  hairline and a registration cross, and colour only for a verdict. One shared stylesheet
  (`canon.css`) carries the site's tokens for the first-run, options, feed, history, lessons,
  self-check, thread card, popup, transparency and privacy pages.
- The window and panel on social sites set their text in Hanken Grotesk and Conso, sent to the
  page as bytes so no extension file becomes web-accessible. The ground still follows X's light,
  dim and dark themes. Signs worth a look use the canon's drift colour beside their words.
- The history page is one column of ruled sections, with no blue links, orange bars or rounded
  boxes. Section labels in the window and the lessons are in mixed case.
- The icons and the first-run drawing use the site's void and bone; the reading mark is bone.
- The public pages link back to the author's site.
- `tests/canon.test.js` fails on an em dash in anything a user reads, on a page without the shared
  tokens, on a colour outside the canon and on a pill shape or an uppercase label.
  `project-docs/DESIGN-CANON-CHECK.md` lists every value and the audit.

### Fixed (design)
- "Save card" opened a page that does not exist (`card.html`); it now opens the thread card page.

### Added
- Threads, Mastodon and TikTok comments. Threads and Mastodon were read live (Mastodon 4.x and
  5.0); TikTok follows its public markup and is not checked live yet. Mastodon works on any server,
  and only on servers you choose: open the server, click Radar's button, and your browser asks you
  to allow that one server. Options lists them and takes access back. On Mastodon, Radar shows the
  account's join date and whether the account marked itself as automated, from the data the
  server already loaded. No new requests on any of the three.
- Rhetoric in Arabic, Russian, Ukrainian, Chinese and Hindi (Devanagari and Latin spelling):
  dehumanising language, calls for violence, stereotypes, slurs and conspiracy framing, with the
  names each side coins for the other and symmetry tests across 19 to 26 targets per language.
  Measured on held-out human-labelled text where a usable corpus exists: Arabic 96.6% (82.8 to
  99.4, 29 signs, MLMA and OSACT4), Russian 100% (96.1 to 100, 95 signs, all slurs), Chinese 75.9%
  (57.9 to 87.8, 29 signs, COLD). Ukrainian and Hindi show "not measured": too few signs in
  labelled text. Each sign now says which language's word list found it.
- Firefox for Android: the same package installs on Firefox 128 or later. On a touch screen each
  post gets one "Radar" button that opens the window on a tap; the window and the popup fit the
  screen. Testing steps in `project-docs/ANDROID.md`; not yet run on a phone.
- Content Credentials fail-safe: a version 1 manifest in MP4 now reads "could not fully verify
  (older manifest format)", never "has not changed since it was signed", and a CI property test
  holds Radar to never giving a more favourable verdict than c2patool on the c2pa-rs test files.
- Media checks in the window, on click only. "Check this file" reads Content Credentials (C2PA 2.x
  and 1.x manifests) from JPEG, PNG, WebP and MP4 files the page already loaded, with no library
  and no network call beyond re-reading that file. It checks the claim signature (ES256, ES384,
  ES512, PS256, PS384, PS512, Ed25519), every assertion hash and the hash that binds the claim to
  the file's bytes, and shows who signed, which tool, and what the credentials say, such as "made
  with generative AI (trainedAlgorithmicMedia)", including in earlier versions of an edited file.
  It also reads IPTC digital source type in XMP, image-generator settings in PNG text and the EXIF
  Software field. A file with none says "no Content Credentials found (platforms often strip
  them)"; Radar never calls a file authentic. Three new families: Content Credentials,
  Credentials do not match, and AI-generation metadata.
- Video frames for reverse search, as InVID does: "Take 4 frames" copies frames from the loaded
  part of the page's own video and restores playback; each frame has Google Lens, Bing, TinEye and
  Yandex buttons that copy it to the clipboard and open the service, so nothing is sent until you
  paste it.
- "First seen" for each piece of media: the earliest post Radar has seen with the same upload, and
  the "From @account" post X credits it to. Reverse search links now say that a click sends the
  image address to that service.
- Lessons: every sign and persuasion technique has a local lesson of one to two minutes, opened
  from the sign's "Learn" link in the window (52 lessons). Each says what the move is, shows
  made-up examples, explains why it works on people and how to spot it without Radar, gives the
  counter-move and what the sign does not prove, and says a post with the sign can still be true.
  Examples come evenly from left, right and centre (a test counts them), and every lesson pairs
  the sign with a fair use or an ordinary account that trips the same sign.
- Self-check: eighteen made-up posts, half leaning on a move and half giving real support, hard to
  easy, with the reason after every answer. It is scored by discernment (hits against false
  alarms, d') and only when you open "How you are doing", because replications found the Bad
  News game made players doubt true posts as much as false ones. Answers stay in this browser.
- First-week tour: three tips over the first uses (the window, the thread report, a lesson), each
  shown once, at most one an hour, none after the first week, and "No more tips" ends it for good.
  Clearing Radar's data keeps that choice.
- Research behind the lessons, read 2026-10-20 and cited with dates on the lessons page:
  Roozenbeek and van der Linden 2019; Basol et al. 2020 and 2021; Maertens et al. 2021;
  Roozenbeek et al. 2022 (Science Advances); and the replications Modirrousta-Galian and Higham
  2023, Graham et al. 2023, Seabrooke et al. 2025 and Modirrousta-Galian et al. 2026.
- "Your feed": a local page, opened from the toolbar popup, of what your feeds and threads carried
  over the last 7, 30 or 60 days. Sites linked most with their owners, the share of links to
  state-linked sites, the share of posts and replies with strong rhetoric signs, persuasion
  techniques (only those that passed their measurement; none yet), the flagged-account share,
  Community Notes and fact-check matches seen, and accounts that keep appearing together with
  links to the threads. Every share shows its count, denominator and 95% interval. It says what
  it does not show, keeps to your retention setting, and makes no network request. No streaks,
  badges or notifications.
- Coordination graph on the history page: accounts that replied in two or more of the same threads,
  as a small force layout with each link labelled by its count. Tab reaches every account; Enter
  or a click lists the threads behind each link. A table holds the same pairs and threads. 500
  accounts draw in about 0.1 s.
- Thread cards: "Save card" in the thread panel opens a card to read, then save or share as a PNG
  and a JSON with a SHA-256 hash of its content. A card carries the thread report, fact-check
  matches, linked sites, upload reuse and the Content Credentials states of any files you checked,
  its sources and what it does not prove. It names no
  account and is refused for threads with fewer than five reply accounts.
- Persuasion techniques: span-level cues for eleven techniques from the SemEval-2020 Task 11 and
  SemEval-2023 Task 3 taxonomy (loaded language, name calling, bandwagon, appeal to fear,
  flag-waving, thought-terminating cliche, whataboutism, black-and-white fallacy, doubt, appeal to
  authority, exaggeration), in English and French. No cue names a group, person, party or side. A
  symmetry test checks that across targets from every political direction in both languages.
- Measured on the held-out split of the Propaganda Techniques Corpus (CC BY 4.0). No technique
  reached the shipping bar, a precision interval starting at 70%. Loaded language came closest at
  60.3% (51.9 to 68.1), so none shows yet. The options page lists each technique with its figure
  and why it is held back. A technique that clears the bar later appears in the Language area with
  the matched words, a one-line definition, "a technique can carry a true claim; it describes how
  the post argues", and its precision. It never counts toward "flagged", and the thread report
  gives it a separate line by flagged and unflagged accounts.

### Added (trust)
- "This was right" and "This was wrong" on every sign in the window. Marks stay in your browser
  with the sign, its kind and the thread; the post text only if you tick "include the text". After
  10 marks on one kind of sign, the window shows "Your feedback: N of M right" under the measured
  figure, never in its place. The options page lists your marks, saves them to a file when you ask,
  and clears them. Nothing is sent.
- A transparency page, inside Radar (options page and popup) and on the public site: every sign
  with its measured precision, recall and interval, the data it was checked on and its licence,
  the side-balance table, what is not measured and the known limits. Generated from the evaluation
  results by `npm run pages`.
- The privacy policy as a public page, generated from PRIVACY.md, now dated and covering feedback.
- Conso for figures on Radar's own pages, beside Hanken Grotesk.
- Store listing text, permission justifications, privacy-practice answers and screenshot plan for
  the Chrome Web Store and Firefox Add-ons.

### Changed (trust)
- Firefox add-on id is now `radar@harperz9.github.io`, permanent, and the manifest declares no
  data collection.
- The fact-check table ships in two files, each under 5 MB, so Firefox's add-on checks can read it.
  The rows are unchanged.
- The manifest description leads with what Radar is: free, no account, nothing leaves your browser.

### Fixed
- The history page read the connections log under its old key, so "Accounts that keep appearing"
  could be empty or stale, and the retention setting did not prune the current log.

## 1.0.0 (2026-10-21)

First public-quality release. Every sign either carries a measured error rate from
`project-docs/EVALUATION.md` or says "not measured yet".

### Added
- Fact-checked claims: posts that closely match a claim reviewed by one of 328 fact-checkers
  (19,728 reviews, Google Data Commons ClaimReview feed, CC BY 4.0) show the checker's own rating
  and a link. Matching runs offline in the browser; Radar never rules a claim false itself.
  Community Notes show first when X loads one.
- Rhetoric markers in French, Spanish, German, Portuguese and Italian, each with symmetry tests
  across targets from every political direction.
- Facebook, Instagram and Bluesky: comments feed duplicate, rhetoric and thread reports; account
  context comes only from what the viewer opens (Page transparency, "About this account") or what
  the app already loads (Bluesky labels).
- Measured precision and recall for the rhetoric families on human-labelled public corpora
  (Measuring Hate Speech, HateXplain, Civil Comments, MLMA), test split only, reproducible with
  `node scripts/eval.mjs`.
- Slur and grammar coverage for hostility aimed at white people, men, Christians and conservatives
  (dictionary-sourced terms, and an identity-plus-gendered-slur rule that is the same for every
  identity). On the HateXplain test split the two sides' recall is now equal within the intervals;
  on Measuring Hate Speech a gap of about 1.28 to 1 remains, reported in EVALUATION.md.
- A YouTube video with no comments still shows its channel and YouTube's funding and
  paid-promotion labels; the collapsed button says "funding label" when YouTube shows one.
- CI on Linux and Windows for every change.
- First-run page on install: what Radar shows, what it never does, site switches and a one-click
  start (which also asks Firefox for site access).
- Options page: per-site switches and a pause for everything, the window's areas, feeds and
  automatic reading, retention for history and account details, "Clear all Radar data",
  reduced motion and larger text, and the measured accuracy of every sign.
- Every sign in the window shows its measured precision from the evaluation, or "not measured
  yet". Signs that repeat a site's own label, or match a cited table, say so instead.
- Icons at 16, 32, 48 and 128 px from original SVG sources, and toolbar states for reading and
  paused.
- Keyboard: focusing a post opens its window, Alt+R moves into it, arrow keys move between its
  tabs, Esc closes it and returns focus to the post. Tabs carry tab and tab-panel roles.
- X's dim theme gets its own window ground; contrast is tested in light, dim and dark.
- `npm run package`: deterministic Chrome zip and Firefox xpi with SHA256SUMS.
- PRIVACY.md, a store listing draft, this changelog, and the FSL-1.1-MIT licence.

### Changed
- An account counts as flagged on one strong sign or two different weak ones. Place and timing
  context alone (app store, typed location, a flag in the name, active hours) no longer does; on
  a live thread it had put half the repliers in the flagged group.
- Violence markers catch active calls ("we should exterminate X") and a violent fate carried
  over to a named group, not only the passive form.
- Automatic About lookups on X follow X's rate-limit headers, keep requests in reserve for the
  viewer's own use of X, and retry a rate-limited account.
- Threads are keyed by post id, so one thread reached by two paths no longer counts its own
  replies as copied from elsewhere. The connections log restarts under a new key.
- Feed pages compare an account with "this page", not "this thread".
- Duplicate detection keeps combining marks inside words (Indic scripts).
- Links and focus outlines in the window use ink instead of an accent blue; colour is kept for
  signs worth a look.
- Settings are read in one place (`src/core/settings.js`), and the background worker deletes data
  older than the user's retention.

## 2026-10-20
- Automatic About lookups pace themselves from X's rate-limit headers.
- Rhetoric recall for active calls, carried-over fate and French replies.

## 2026-10-19
- The hover window: an area strip, tabs, small charts and a comparison with the thread.
- Posting patterns from the posts X loads for an account.
- Reddit account age, karma and sign-up names.
- History page across viewed threads: upstream sources, recurring accounts, trend.
- Deterministic core builds and signal tests.

## 0.3.0 (2026-10-18)
- One compact row per post, hover card, collapsible thread panel, toolbar popup.
- Source trails, upstream summary, government designations and verified report data.
- State links from Wikidata and 17 cited influence-operation reports.
- Media upload dates and reverse image search; YouTube's synthetic-content label.
- Feed mode on X, timing bursts, translation guard, JSON export.

## 0.2.0 (2026-10-18)
- Post metadata X loads but does not show, YouTube page data, cross-thread copied text and pushed
  links.
- Local connections log, inferred active hours and fast-reply flags.
- Machine-writing signs with cautious thresholds, leaked chatbot text, spam patterns.
- Live account data from what X already loaded; automatic in-page About lookups.
- Outlet ownership for links and accounts from 7,374 sourced Wikidata rows.

## 0.1.0 (2026-10-17)
- Duplicate-text clusters, local-claim mismatch and account flags.
- Stance-neutral rhetoric markers with a symmetry test, and the thread norm report.
- The extension: badges, popovers, lookups, thread report; adapters for X, Reddit and YouTube.
- App-store and name-flag location signals; coded-hate markers with precision tests.
