# Daylight Commons

A browser extension that shows where social media replies come from. Rest the pointer on a reply on
X, YouTube, Reddit, Facebook, Instagram, Bluesky, Threads, TikTok or a Mastodon server you turn it
on for, and a window opens beside it: where the platform places the account, signs of coordination,
how the account posts, how the reply argues, and whether a fact-checker has reviewed the claim. On a
phone, tap the post's Daylight Commons button. Formerly Radar, so release files still carry that name.

![Daylight Commons installed, a synthetic thread, a reply's window and its evidence, a lookup's receipts, and the saved chain checked offline](docs/demo/demo-install-to-verify.gif)

## Install

**Chrome, Edge or Brave**
1. Download `radar-chrome-<version>.zip` from the latest release and unzip it.
2. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and choose the unzipped folder.
4. Pick your sites on the first-run page and press **Start Daylight Commons**.

**Firefox (128 or later)**
1. Download `radar-firefox-<version>.xpi` from the latest release.
2. Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on** and pick the file.
   Firefox removes temporary add-ons on restart until a signed build is published.

To check a download, compare it with the signed `SHA256SUMS` from the same release, either on the
[install page](https://harperz9.github.io/daylight-commons/install.html) or offline with
`node scripts/verify-release.mjs <folder>`. Release key id `0e5e 1984 0565 840c 977e 0f03 6c9a c021`.

**Command line, no install step.** Unzip `radar-cli-<version>.zip` from a release and run it with
Node 22 or later on a saved thread or your own export:

```
node bin/radar.mjs analyze saved-thread.html
```

New here? [Quick start](docs/guide/QUICKSTART.md) has one short recipe per feature;
[Troubleshooting](docs/guide/TROUBLESHOOTING.md) and [questions and answers](docs/guide/FAQ.md)
cover the rest.

## What the window shows

- **Place:** where X labels the account as based, and a sign when a reply speaks as a local of
  somewhere else ("here in France" from an account labelled elsewhere). On Instagram and Facebook it
  uses what Meta shows when you open an account's "About this account" or a Page's "Page
  transparency". On Bluesky, which shows no location, it gives the join date and the labels
  Bluesky's moderation service applied.
- **Account:** age, renames, sign-up handles, follow patterns, Reddit karma for the account's age.
- **Posting:** a 24-hour posting clock, the last 14 days, the apps it posts from, reply speed.
- **Coordination:** the same text from several accounts, the same upload carried by many, wording
  that turns up in other threads you opened, replies that arrive in bursts.
- **Language:** slurs, calls for violence, dehumanising language, spam patterns and machine-writing
  signs, each with the words that matched. Rhetoric is read in English, French, Spanish, German,
  Portuguese, Italian, Arabic, Russian, Ukrainian, Chinese and Hindi (Devanagari and Latin spelling).
- **Sources:** who owns a linked outlet, and state links where a cited report or official document
  names the site or account.
- **Site cards:** rest the pointer on any link for the site's owner, owner type, founding year and
  country from Wikidata, any cited state link, and its fact-check record ("24 reviews by 13
  fact-checkers since 2017-03-03"). **Site card for this page** in the toolbar menu does the same for
  the site you are reading. Labels under Google, Bing and DuckDuckGo results can be turned on in the
  options.
- **Fact-checked claims:** when a post closely matches a claim a fact-checker has reviewed, the
  fact-checker's name, their rating in their own words and a link. About 19,000 reviews from 319
  fact-checkers ship inside the extension. A Community Note on a post is shown first.
- **Other coverage (off by default):** on a click, other outlets covering the same story, read from
  each outlet's own news feed. Pick outlets from a suggested list spanning 18 countries or add any
  RSS or Atom address.
- **Media:** media first uploaded long before the post that shows it, with reverse image search.
- **Launch campaigns (X, not measured yet):** on a launch post and its repost and quote lists, how
  the engagement compares with the account's own posts, shared bio templates and join-date waves,
  Paid partnership labels and unlabelled look-alike quotes, and accounts seen on other launches you
  opened.
- **Thread report:** whether the most extreme replies come mostly from flagged accounts, with 95%
  intervals. It says "skewed" only when the intervals do not overlap.
- **History page:** the accounts and sites your threads keep leading back to.
- **Pressure lens (off by default):** urgency, shrinking the ask, a newcomer vouching, crediting both
  sides to close a dispute, "check it yourself" and "that's just noise", in messages from anyone.
  Held out, it was right on 8 of its 9 marks and found 8 of 47 moves, so silence is not a clean bill.

Each sign shows its measured precision from the evaluation in `project-docs/EVALUATION.md`, or "not
measured yet". The options page lists every sign with its figure. Every finding type is explained on
the [how it works page](https://harperz9.github.io/daylight-commons/how-it-works.html).

Keyboard: focus a post to open its window, <kbd>Alt</kbd>+<kbd>R</kbd> to move into it, arrow keys
between its tabs, <kbd>Esc</kbd> to close it.

## Quotes, counts, documents and corrections

Turn on **Discourse checks** in the options and the window adds five more, all on this device:
- **Where a quote comes from.** A quoted line is looked up in eleven public-domain works (Marcus
  Aurelius, Schopenhauer, Nietzsche, Plato, Dostoevsky, Epictetus) and in a sourced list of famous
  misquotes. It says found, close paraphrase, listed as misattributed, or not found, and not found
  proves nothing. A list of one-line sayings pinned on names is counted with its sources.
- **Accounts named after someone who died,** with the name in the handle or a word like "Quotes",
  from Wikidata. Names a living person shares are left out.
- **Counts with their sample size:** 45/50 gets its 95% interval, and two arms are compared.
- **The post's words against the pages it shows,** read from the images with "Read text in images"
  on: which of the post's terms are on which page, and which are on none.
- **Replies that bring a source or name an error,** ranked by the source, never by likes.

**Argument lens** (its own switch): the parts of an argument (premises, conclusions, turns) at the
words that join them, in five languages; the kind of claim each sentence makes; where a post goes
beyond what it states; and posts that rearrange their sources' facts. Details in
[project-docs/ARGUMENT-LENS.md](project-docs/ARGUMENT-LENS.md).

Each can be saved with its post as a study item. Held out, the quote finder named the right passage
for 8 of the 8 quotes it placed and found 8 of 11; details in
[project-docs/DISCOURSE.md](project-docs/DISCOURSE.md).

## Download, save, convert and keep media

Rest the pointer on any picture, GIF or video for a moment and a small **Download** button shows in its
corner, even where the site blocks right-click (Alt+Shift+D does the same from the keyboard). **Study**
keeps it in a study folder, and text posts and selections save as notes. Or right-click any picture, GIF
or video and choose **Download**: it lands in your Downloads folder in one
click, with its real type and a name from the page. X and Reddit posts get a quiet **Download** button
that saves every picture and video in the post, videos with their sound. **Download as GIF** makes a
real GIF from the MP4 that sites send in place of GIFs. **Copy** and **Copy link** sit beside it.
Other tools can use the same code: `import { assembleStream, encodeGif } from "daylight-commons/media"`
([project-docs/MEDIA-LIBRARY.md](project-docs/MEDIA-LIBRARY.md)).

To keep a file as evidence instead, right-click any image, GIF, video or audio and choose **Save to Daylight**, or use **Save media from
this page** in the toolbar menu. A video the page streams is put together from its HLS or DASH
segments. Each file goes into an investigation case, with its SHA-256, address, page and time and an
optional Internet Archive copy, or into a moodboard with tags and notes. **Collections** shows them as
a grid. Protected media (DRM or encrypted streams) is never saved, and Daylight Commons says so.

**Capture as evidence** (right-click a picture, video or sound) saves the file and its note, a
picture of the visible page and a capture record: the file's SHA-256 before any words went in, what
the page showed, the time, and what the capture kept and lost, part by part. Each capture adds a
line to a hash chain in your browser; `daylight capture verify <folder>` checks them all. Details:
[project-docs/EVIDENCE-CAPTURE.md](project-docs/EVIDENCE-CAPTURE.md).

**Study boards** turn a moodboard or a folder of saves into numbered plates with their source,
author, time and link: a book with running heads and captions, a grid, or a timeline in posted order.
Print it, save it as one web page, or keep it as a folder with a SHA-256 manifest. On the command
line, `daylight board make Downloads/Daylight --title "Shore" --layout book --pdf` does the same, and
adds an evidence layout for a case. Details: [project-docs/STUDY-BOARDS.md](project-docs/STUDY-BOARDS.md).

**Convert or compress a file** changes pictures among PNG, JPEG, WebP and AVIF, turns a GIF into MP4
or WebM, makes video smaller as WebM or MP4, and turns sound into Opus. It runs in your browser with no
upload, shows the size before and after, and keeps a hash chain from every copy to the original. On
the command line, `daylight media convert clip.gif --to mp4` and `daylight media compress talk.mp4
--max-height 720` do the same with ffmpeg. Details: [project-docs/MEDIA-TOOLKIT.md](project-docs/MEDIA-TOOLKIT.md).

**Block ads and trackers**, off until you turn it on, uses EasyList and EasyPrivacy in your browser's
own blocking engine, with **Allow ads on this site** in the toolbar menu.

## What it sends and keeps

Daylight Commons reads what the site shows you and requests account details only from the site you
are on. Two features reach further, and only after you turn them on and click: Other coverage reads
the feeds of the outlets you chose, and evidence lookups send the repository names and domains a post
links to GitHub, RDAP and the Internet Archive. Account details stay in your browser for 14 days and
thread history for 60, both adjustable, and **Clear all Daylight Commons data** removes everything.
Details are in [PRIVACY.md](PRIVACY.md).

## Options

Open the toolbar popup and choose **Options**, or right-click the icon. You can switch it off per
site or pause it everywhere, hide areas of the window, stop automatic reading, set retention, clear
everything, reduce motion and enlarge text.

## Limits

- Platform location labels can be wrong. VPNs and travel move them, and users can broaden them to a
  region.
- Local-claim patterns cover English and some French. Other languages read as "no claim".
- It sees only the replies the site rendered, in the site's order.
- On Mastodon it runs on a server only after you open it, click the Daylight Commons button and
  allow it. Options lists the servers and takes access back.
- TikTok comments are not checked live yet. A site redesign can break any adapter until the next
  update.

## Command line and API

The same rules run on your own files:

```
node bin/radar.mjs analyze saved-thread.html        # a saved X or Reddit thread, thread JSON,
node bin/radar.mjs analyze tweets.js --json         # or your X, Reddit, Mastodon or Bluesky export
node bin/radar.mjs analyze thread.json --bundle out.json
node bin/radar.mjs analyze thread.json --bundle out.json --carrier-safe   # one-time key, day only
node bin/radar.mjs verify out.json                  # check a signed bundle offline
node bin/radar.mjs verify evidence-chain.json       # or an evidence chain saved in the extension
node bin/radar.mjs export evidence-chain.json --profile legal --out dossier
node bin/radar.mjs media convert photo.png --to webp   # with ffmpeg; writes photo.webp.lineage.json
```

`export` writes a saved evidence chain into a new folder in one of four layouts: `legal` (numbered
exhibits, a chain-of-custody log, cited definitions and verifier steps, as Markdown), `technical`
(W3C PROV and the raw observations), `journalistic` (a write-up with a sourcing note per line, plus
`--reply replies.json` and `--corrections corrections.json`) and `research` (JSON lines with fixed
train, dev and test splits, Croissant metadata and a datasheet). Exports hold identifiers, hashes
and extracted features, with private accounts as pseudonyms. A chain that fails its check is
refused.

In the extension, the toolbar popup's **Analyse a file** does the same. Code can import
`src/core/api.js`: `analyzeThread`, `analyzeText`, `checkMedia` and `siteInfo` return evidence that
fits `schema/evidence.v2.json`. The API, schema and bundle format are in
[project-docs/INTEGRATION.md](project-docs/INTEGRATION.md).

## Investigate: case folders

`daylight case` keeps an investigation in one folder with its own git history: each source captured
with its hash, access time and Wayback copy; each claim on a rung (documented, inference, unproven,
contradicted) with its source; the chain from a retelling back to its origin with a word diff per
hop; a timeline with gaps and contradictions flagged; who quoted or replied to whom; ranked leads;
and deleted, edited, sealed and missing records. Exports verify offline.

```
node bin/radar.mjs case init "Harbour sale"     # a new folder, harbour-sale/, with its own git repo
node bin/radar.mjs case add https://example.org/council-minutes --case harbour-sale   # capture, hash, archive
node bin/radar.mjs case claim "The council voted 7-2 to sell" --source S01 --rung documented --case harbour-sale
node bin/radar.mjs case trace C01 --case harbour-sale            # origin, retellings, independent origins
node bin/radar.mjs case export --profile newsroom --case harbour-sale   # signed dossier in exports/
```

`case run <screenshots/ | urls.txt | URL | "a claim">` does all of it with nobody at the keyboard:
it transcribes screenshots, captures and archives every source, proposes claims with their spans,
looks for the primary record behind each one, traces drift, builds the timeline and network, ranks
leads, logs absences, runs the reading and writes the dossier in all three profiles. It resumes
after a crash. A model is optional; without one, rules propose and a person accepts or rejects each
item with `case review`. `case watch` re-checks captures and leads on a schedule you set. The
extension's popup has **Add to case**, which keeps the page's address in your browser for
`case add case-inbox.jsonl`.

Private accounts appear as pseudonyms in every export unless marked public figures, pages behind a
login are never captured, and only the fetches and archive requests you start leave your machine.
The format, pipeline and a test against a hand-built case are in
[project-docs/INVESTIGATE.md](project-docs/INVESTIGATE.md); a worked example is in
[examples/musk-ukraine-case](examples/musk-ukraine-case).

## Develop

```
npm test                 # every test
npm run build            # rebuild src/ext/core.bundle.js from src/core
npm run ci               # exactly what GitHub Actions runs
npm run package          # dist/radar-chrome-<v>.zip, the two Firefox xpis, dist/SHA256SUMS
npm run release          # a signed release folder with a git bundle (key kept outside the repo)
node scripts/serve.mjs   # the fixture thread at http://127.0.0.1:8742/tests/fixtures/thread.html
```

To run from source, load `src/ext` as an unpacked extension. Design notes are in
`project-docs/DESIGN.md`. Icons are drawn by `scripts/render-icons.py` from `assets/icons/`.

## Licence

The code is under the [GNU Affero General Public License v3.0 only](LICENSE). The data tables, the
definition catalogue, the schemas and the documentation are under
[Creative Commons Attribution 4.0](LICENSES/CC-BY-4.0.txt). `REUSE.toml` maps every file to its
licence, and [THIRD-PARTY.md](THIRD-PARTY.md) lists the parts with their own terms. Contributions
come in under the [Developer Certificate of Origin](CONTRIBUTING.md). Governance is in
[GOVERNANCE.md](GOVERNANCE.md).

If you redistribute Daylight Commons, including through a browser store, ship `LICENSE.txt` (every
package from `npm run package` includes it), offer the complete source and build scripts for the
exact version, keep the copyright and licence notices, and mark your changes.

The outlet and state tables come from Wikidata (CC0) and the public documents listed in
`data/state-reports.README.md`. The fact-check table comes from the Data Commons ClaimReview feed
(CC BY 4.0), credited to each fact-checker in the window. Hanken Grotesk and JetBrains Mono are under
the SIL Open Font License 1.1.
