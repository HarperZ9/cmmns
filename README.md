# Radar

See the evidence behind the replies you read. Rest the pointer on a reply on X, YouTube, Reddit,
Facebook, Instagram or Bluesky and Radar opens a window beside it: where the platform places the account, signs of coordination,
how the account posts, and how the thread's harshest replies compare with the rest.

Radar gives evidence, never verdicts. It never calls anyone a bot, a propagandist or an extremist,
and every sign says where its data came from and what it does not prove. It runs in your browser
and sends nothing anywhere.

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

Check a download against `SHA256SUMS` from the same release.

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
  machine-writing signs, each with the words that matched.
- **Sources:** who owns a linked outlet, and state links only where a cited report or official
  document names the site or account.
- **Fact-checked claims:** when a post's wording closely matches a claim a fact-checker has
  already reviewed, the fact-checker's name, their rating in their own words and a link. About
  20,000 reviews from 328 fact-checkers ship inside Radar, so no post text is sent anywhere.
  Similar wording is not the same claim, and Radar never rates a post itself. A Community Note on
  a post is shown first.
- **Media:** media first uploaded long before the post that shows it, with reverse image search.
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
requests go to the site you are on, for account details that site discloses. What it keeps stays in
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
- Facebook, Instagram and Bluesky are checked against synthetic pages and their live structure;
  a site redesign can break any adapter until Radar is updated.

## Develop

```
npm test                 # every test
npm run build            # rebuild src/ext/core.bundle.js from src/core
npm run package          # dist/radar-chrome-<v>.zip, dist/radar-firefox-<v>.xpi, dist/SHA256SUMS
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
