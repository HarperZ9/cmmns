# Daylight Commons

Formerly Radar. The name follows Justice Brandeis: "Sunlight is said to be the best of
disinfectants."

See the evidence behind the replies you read. Rest the pointer on a reply on X, YouTube, Reddit,
Facebook, Instagram, Bluesky, Threads, TikTok or any Mastodon server you turn it on for, and Daylight Commons
opens a window beside it (on a phone, tap the post's Daylight Commons button): where the platform places the account, signs of coordination,
how the account posts, and how the thread's harshest replies compare with the rest.

![Daylight Commons installed, a synthetic thread, a reply's window and its evidence, a lookup's receipts, and the saved chain checked offline](docs/demo/demo-install-to-verify.gif)

How it works, with every finding type and what each does not prove:
[harperz9.github.io/daylight-commons/how-it-works.html](https://harperz9.github.io/daylight-commons/how-it-works.html).
The stills, the recording and how they were made are in [docs/demo](docs/demo/README.md).

Daylight Commons gives evidence, never verdicts. It never calls anyone a bot, a propagandist or an extremist,
and every sign says where its data came from and what it does not prove. It runs in your browser
and sends nothing anywhere unless you turn on Other coverage or evidence lookups, each of which says what it sends and to whom first.

## Install in a minute

**Chrome, Edge or Brave**
1. Download `radar-chrome-<version>.zip` from the latest release and unzip it.
2. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and choose the unzipped folder.
4. Daylight Commons opens its first-run page. Pick your sites and press **Start Daylight Commons**.

**Firefox (128 or later)**
1. Download `radar-firefox-<version>.xpi` from the latest release.
2. Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on** and pick the file.
   Firefox removes temporary add-ons on restart until a signed build is published.

Check a download against the signed `SHA256SUMS` from the same release: the
[install page](https://harperz9.github.io/daylight-commons/install.html) has a checker that runs in your
browser, and `node scripts/verify-release.mjs <folder>` does the same offline. Release key id
`0e5e 1984 0565 840c 977e 0f03 6c9a c021`. Each release also carries a git bundle of the whole
source, so it can be rebuilt without any code host.

## What you see

- **Place:** where X labels the account as based, and a sign when a reply speaks as a local of
  somewhere else ("here in France" from an account labelled elsewhere). On Instagram and Facebook,
  Daylight Commons remembers what Meta shows when you open an account's "About this account" or a Page's
  "Page transparency", and uses it for that account's replies. Bluesky shows no location; Daylight Commons
  shows the join date and the labels Bluesky's own moderation service applied.
- **Account:** age, renames, sign-up handles, follow patterns, Reddit karma for the account's age.
- **Posting:** a 24-hour posting clock, the last 14 days, the apps it posts from, reply speed.
- **Coordination:** the same text from several accounts, the same upload carried by many, wording
  that turns up in other threads you opened, replies that arrive in bursts.
- **Language:** slurs, calls for violence, dehumanising language, spam patterns and
  machine-writing signs, each with the words that matched. Rhetoric is read in English, French,
  Spanish, German, Portuguese, Italian, Arabic, Russian, Ukrainian, Chinese and Hindi (Devanagari
  and Latin spelling); each sign says which language's word list found it and how that language
  was measured, or that it was not.
- **Sources:** who owns a linked outlet, and state links only where a cited report or official
  document names the site or account.
- **Site cards:** rest the pointer on any link for the linked site's owner, owner type, founding
  year and country from Wikidata, any cited state link, and its fact-check record ("24 reviews by
  13 fact-checkers since 2017-03-03, ratings as the checkers wrote them") with a list of every
  review. Press **Site card for this page** in the toolbar menu for the news site you are reading,
  and turn on labels under Google, Bing or DuckDuckGo results in the options if you want them.
  No score: each fact names its source, and the record says what a count does not prove.
- **Other coverage (off by default):** on a click, other outlets covering the same story, read
  from each outlet's own news feed with no aggregator in between. You choose the outlets from a
  suggested list spanning 18 countries, or add any RSS or Atom address. Daylight Commons sends nothing from
  the page; it matches headlines on your device and labels each outlet by owner and owner type,
  never by a left or right score.
- **Fact-checked claims:** when a post's wording closely matches a claim a fact-checker has
  already reviewed, the fact-checker's name, their rating in their own words and a link. About
  19,000 reviews from 319 fact-checkers ship inside Daylight Commons, so no post text is sent anywhere.
  Similar wording is not the same claim, and Daylight Commons never rates a post itself. A Community Note on
  a post is shown first.
- **Media:** media first uploaded long before the post that shows it, with reverse image search.
- **Launch campaigns (X, not measured yet):** on a launch post and its repost and quote lists, how
  the engagement is shaped against the account's own posts, shared bio templates and join-date
  waves among the accounts the page loaded, Paid partnership labels and unlabelled look-alike
  quotes, and accounts seen on other launches you opened. It states an inference only when two or
  more independent signs agree, and never names an ordinary account. Naming the company behind a
  launch is held until a media lawyer has reviewed the wording, so for now every claim reads "this
  launch".
- **Thread report:** whether the most extreme replies come mostly from flagged accounts, with 95%
  intervals. It says "skewed" only when the intervals do not overlap.
- **History page:** across threads you opened, the accounts and sites your threads keep leading
  back to.

Keyboard: focus a post to open its window, <kbd>Alt</kbd>+<kbd>R</kbd> to move into it, arrow keys
between its tabs, <kbd>Esc</kbd> to close it.

## How sure it is

Each sign shows its measured precision from Daylight Commons' evaluation (`project-docs/EVALUATION.md`), or
"not measured yet". Signs that repeat a site's own label, such as X's "Probable spam", say so. The
options page lists every sign with its figure.

## Privacy

No server, no account, no analytics. Daylight Commons reads only what the site shows you, and its only
requests go to the site you are on, for account details that site discloses, plus the feeds of the
outlets you chose if you turn on Other coverage and click, and, for evidence lookups you allow and click, the repository names and domains a post links to, sent to GitHub, RDAP and the Internet Archive. What it keeps stays in
your browser: account details for 14 days and thread history for 60 by default, both adjustable,
with a two-step "Clear all Daylight Commons data" (press, then confirm). Full details in [PRIVACY.md](PRIVACY.md).

## Options

Open the toolbar popup and choose **Options**, or right-click the icon. You can switch Daylight Commons off per
site or pause it everywhere, hide areas of the window, stop automatic reading, set retention, clear
everything, reduce motion and enlarge text.

## Limits

- Platform labels can be wrong; VPNs and travel move them, and users can broaden them to a region.
- Local-claim patterns cover English and some French; other languages read as "no claim".
- Daylight Commons sees only the replies the site chose to render, in the site's ranked order.
- Mastodon: Daylight Commons runs on a server only after you open it, click the Daylight Commons button and allow it.
  Options lists the servers and takes access back.
- Facebook, Instagram, Bluesky, Threads and Mastodon are checked against synthetic pages and their
  live structure; TikTok comments are not checked live yet (TikTok asked to sign up first);
  a site redesign can break any adapter until Daylight Commons is updated.

## Use Daylight Commons outside the browser

Daylight Commons' rules also run without the extension, on your own files, with nothing sent anywhere.
Each release carries the tool as `radar-cli-<version>.zip`; unzip it and run it with Node 22 or
later, with no install step:

```
node bin/radar.mjs analyze saved-thread.html        # a saved X or Reddit thread, thread JSON,
node bin/radar.mjs analyze tweets.js --json         # or your X, Reddit, Mastodon or Bluesky export
node bin/radar.mjs analyze thread.json --bundle out.json
node bin/radar.mjs analyze thread.json --bundle out.json --carrier-safe   # one-time key, day only
node bin/radar.mjs verify out.json                  # anyone can check a signed bundle offline
node bin/radar.mjs verify evidence-chain.json       # or an evidence chain saved in the extension
node bin/radar.mjs export evidence-chain.json --profile legal --out dossier
```

`export` writes a saved evidence chain for the reader who needs it, into a new folder, with the
chain itself beside it so anyone can run `verify`:

- `legal`: a dossier with numbered exhibits, a chain-of-custody log, each cited definition with its
  elements, the method, the limits and the verifier steps.
- `technical`: every receipt as W3C PROV (`provenance.json`), the raw observations and the steps to
  reproduce.
- `journalistic`: a write-up with a sourcing note on every line, a right-of-reply log
  (`--reply replies.json`) and corrections (`--corrections corrections.json`).
- `research`: one JSON line per receipt with its lineage, train, dev and test splits fixed by hash,
  Croissant metadata and a datasheet.

Exports hold identifiers, hashes and extracted features, never post text, and a private account
only as a pseudonym. A chain that fails its check is refused. The legal dossier is Markdown; a
PDF/A version is not built yet.

In the extension, the toolbar popup's **Analyse a file** does the same on a file you choose. Code
can import `src/core/api.js` (radar-core): `analyzeThread`, `analyzeText`, `checkMedia` and
`siteInfo` return evidence that fits `schema/evidence.v1.json`, each item with what it shows, its
source and what it does not prove. A signed evidence bundle holds post ids and the matched words,
not other people's full posts unless you ask. The API, schema, bundle format and stability promise
are in [project-docs/INTEGRATION.md](project-docs/INTEGRATION.md).

## Develop

```
npm test                 # every test
npm run build            # rebuild src/ext/core.bundle.js from src/core
npm run ci               # exactly what GitHub Actions runs, on any machine
npm run package          # dist/radar-chrome-<v>.zip, the two Firefox xpis, dist/SHA256SUMS
npm run release          # a signed release folder with a git bundle (key kept outside the repo)
node scripts/serve.mjs   # the fixture thread at http://127.0.0.1:8742/tests/fixtures/thread.html
```

To run from source, load `src/ext` as an unpacked extension. Design notes are in
`project-docs/DESIGN.md`. Icons are drawn by `scripts/render-icons.py` from `assets/icons/`.

## Licence

Daylight Commons is free and open source software. The code is under the [GNU Affero General Public License
v3.0 only](LICENSE) (AGPL-3.0-only). The data tables, the definition catalogue, the schemas and the
documentation are under [Creative Commons Attribution 4.0](LICENSES/CC-BY-4.0.txt) (CC BY 4.0).
`REUSE.toml` maps every file to its licence, and [THIRD-PARTY.md](THIRD-PARTY.md) lists the parts
that keep their own terms.

Why the AGPL: Daylight Commons is a tool for the commons, and the AGPL keeps it there. Anyone may use, study,
change and share it, and anyone who passes on a changed Daylight Commons, or runs one as a service people use
over a network, must offer the people they serve the changed source under the same licence. So no
one can take the commons' tool and close it, whether in a product or behind a server. The grant on
every released version is irrevocable, contributions come in under the
[Developer Certificate of Origin](CONTRIBUTING.md) with no contributor licence agreement, and no
single party, the author included, can relicense them closed. [GOVERNANCE.md](GOVERNANCE.md) sets
out the permanence commitments, the funding rules and how to challenge an entry.

What this asks of anyone who redistributes Daylight Commons, including through a browser store:
- Ship `LICENSE.txt` with the extension (it is inside every package built by `npm run package`).
- Offer the complete source for the exact version shipped, with the build scripts. Daylight Commons' store
  listings and this repository do that: each release is tagged here, and each release carries a git
  bundle of the whole source.
- Keep the copyright and licence notices, and mark your changes.

Store notes (checked 2026-10-22): the Chrome Web Store's policies say nothing against GPL-family
licences and ask only that code is not obfuscated. Firefox Add-ons lists AGPL-3.0-only as a
licence choice. Firefox reviewers rebuild any built or bundled files from the submitted source and
expect no differences, so a store upload of `core.bundle.js` or `ocr.bundle.js` goes with the
source and the command `npm run build`. That upload is for review only and does not by itself
offer the source to users, so the listing links here.

Quoted laws, regulations and official guidance in the catalogue keep their own status: many are
government works, and the rest are quoted for commentary with their source. Daylight Commons never
redistributes platform content; captures of other people's posts stay on the user's device. Hanken
Grotesk and JetBrains Mono are under the SIL Open Font License 1.1, so every file in a package is
free to reuse. The outlet and
state tables come from Wikidata (CC0) and the cited public documents listed in
`data/state-reports.README.md`. The fact-check table comes from the Data Commons ClaimReview feed
(CC BY 4.0), credited to each fact-checker in the window.
