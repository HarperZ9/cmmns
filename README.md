# Radar

See the evidence behind the replies you read. Rest the pointer on a reply on X, YouTube, Reddit,
Facebook, Instagram, Bluesky, Threads, TikTok or any Mastodon server you turn it on for, and Radar
opens a window beside it (on a phone, tap the post's Radar button): where the platform places the account, signs of coordination,
how the account posts, and how the thread's harshest replies compare with the rest.

Radar gives evidence, never verdicts. It never calls anyone a bot, a propagandist or an extremist,
and every sign says where its data came from and what it does not prove. It runs in your browser
and sends nothing anywhere unless you turn on Other coverage or evidence lookups, each of which says what it sends and to whom first.

## Install in a minute

**Chrome, Edge or Brave**
1. Download `radar-chrome-<version>.zip` from the latest release and unzip it.
2. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and choose the unzipped folder.
4. Radar opens its first-run page. Pick your sites and press **Start Radar**.

**Firefox (128 or later)**
1. Download `radar-firefox-<version>.xpi` from the latest release.
2. Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on** and pick the file.
   Firefox removes temporary add-ons on restart until a signed build is published.

Check a download against the signed `SHA256SUMS` from the same release: the
[install page](https://harperz9.github.io/radar/install.html) has a checker that runs in your
browser, and `node scripts/verify-release.mjs <folder>` does the same offline. Release key id
`0e5e 1984 0565 840c 977e 0f03 6c9a c021`. Each release also carries a git bundle of the whole
source, so it can be rebuilt without any code host.

## What you see

- **Place:** where X labels the account as based, and a sign when a reply speaks as a local of
  somewhere else ("here in France" from an account labelled elsewhere). On Instagram and Facebook,
  Radar remembers what Meta shows when you open an account's "About this account" or a Page's
  "Page transparency", and uses it for that account's replies. Bluesky shows no location; Radar
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
  suggested list spanning 18 countries, or add any RSS or Atom address. Radar sends nothing from
  the page; it matches headlines on your device and labels each outlet by owner and owner type,
  never by a left or right score.
- **Fact-checked claims:** when a post's wording closely matches a claim a fact-checker has
  already reviewed, the fact-checker's name, their rating in their own words and a link. About
  20,000 reviews from 328 fact-checkers ship inside Radar, so no post text is sent anywhere.
  Similar wording is not the same claim, and Radar never rates a post itself. A Community Note on
  a post is shown first.
- **Media:** media first uploaded long before the post that shows it, with reverse image search.
- **Launch campaigns (X, not measured yet):** on a launch post and its repost and quote lists, how
  the engagement is shaped against the account's own posts, shared bio templates and join-date
  waves among the accounts the page loaded, Paid partnership labels and unlabelled look-alike
  quotes, and accounts seen on other launches you opened. It names a company only when several
  independent signs agree, and never names an ordinary account.
- **Thread report:** whether the most extreme replies come mostly from flagged accounts, with 95%
  intervals. It says "skewed" only when the intervals do not overlap.
- **History page:** across threads you opened, the accounts and sites your threads keep leading
  back to.

Keyboard: focus a post to open its window, <kbd>Alt</kbd>+<kbd>R</kbd> to move into it, arrow keys
between its tabs, <kbd>Esc</kbd> to close it.

## How sure it is

Each sign shows its measured precision from Radar's evaluation (`project-docs/EVALUATION.md`), or
"not measured yet". Signs that repeat a site's own label, such as X's "Probable spam", say so. The
options page lists every sign with its figure.

## Privacy

No server, no account, no analytics. Radar reads only what the site shows you, and its only
requests go to the site you are on, for account details that site discloses, plus the feeds of the
outlets you chose if you turn on Other coverage and click, and, for evidence lookups you allow and click, the repository names and domains a post links to, sent to GitHub, RDAP and the Internet Archive. What it keeps stays in
your browser: account details for 14 days and thread history for 60 by default, both adjustable,
with a one-click "Clear all Radar data". Full details in [PRIVACY.md](PRIVACY.md).

## Options

Open the toolbar popup and choose **Options**, or right-click the icon. You can switch Radar off per
site or pause it everywhere, hide areas of the window, stop automatic reading, set retention, clear
everything, reduce motion and enlarge text.

## Limits

- Platform labels can be wrong; VPNs and travel move them, and users can broaden them to a region.
- Local-claim patterns cover English and some French; other languages read as "no claim".
- Radar sees only the replies the site chose to render, in the site's ranked order.
- Mastodon: Radar runs on a server only after you open it, click the Radar button and allow it.
  Options lists the servers and takes access back.
- Facebook, Instagram, Bluesky, Threads and Mastodon are checked against synthetic pages and their
  live structure; TikTok comments are not checked live yet (TikTok asked to sign up first);
  a site redesign can break any adapter until Radar is updated.

## Use Radar outside the browser

Radar's rules also run without the extension, on your own files, with nothing sent anywhere:

```
node bin/radar.mjs analyze saved-thread.html        # a saved X or Reddit thread, thread JSON,
node bin/radar.mjs analyze tweets.js --json         # or your X, Reddit, Mastodon or Bluesky export
node bin/radar.mjs analyze thread.json --bundle out.json
node bin/radar.mjs verify out.json                  # anyone can check a signed bundle offline
```

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

Radar is source-available under the [Functional Source License 1.1, MIT Future
License](LICENSE) (FSL-1.1-MIT): each version becomes MIT two years after release. Hanken Grotesk
is under the SIL Open Font License 1.1 (`src/ext/fonts/OFL-hanken-grotesk.txt`). The outlet and
state tables come from Wikidata (CC0) and the cited public documents listed in
`data/state-reports.README.md`. The fact-check table comes from the Data Commons ClaimReview feed
(CC BY 4.0), credited to each fact-checker in the window.
