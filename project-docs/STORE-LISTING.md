# Store listing

Final listing text and form answers for the Chrome Web Store (CWS) and Firefox Add-ons (AMO). The
author submits under their own developer accounts: creating the accounts, paying the CWS
registration fee and accepting each store's developer agreement are the author's steps. Everything
else is here, so uploading and pasting is the only work left.

Field text sits between `<!-- field:NAME -->` markers. `tests/store-listing.test.js` checks each
field against the limits below and fails on placeholders.

## Limits, as published by each store (read 2026-10-21)

| Field | Limit | Source |
|---|---|---|
| CWS name (manifest `name`) | 75 characters | developer.chrome.com/docs/extensions/reference/manifest/name |
| CWS summary (manifest `description`) | 132 characters, plain text | developer.chrome.com/docs/extensions/reference/manifest/description |
| CWS detailed description | no limit stated on the listing page | developer.chrome.com/docs/webstore/cws-dashboard-listing |
| CWS images | icon 128x128; at least one screenshot at 1280x800, up to 5; small promo tile 440x280 (PNG or JPEG); marquee 1400x560 optional; the page also lists a YouTube video link among the required items | developer.chrome.com/docs/webstore/cws-dashboard-listing |
| CWS privacy tab | single purpose, one justification per permission, remote code, data usage, certifications; no character limits stated | developer.chrome.com/docs/webstore/cws-dashboard-privacy |
| AMO name | 50 characters (since February 2024) | developer.mozilla.org, manifest.json `name` |
| AMO summary | 250 characters | extensionworkshop.com/documentation/develop/create-an-appealing-listing/ |
| AMO description | no practical limit | same page |
| AMO screenshots | 1280x800 recommended, 1.6:1 otherwise; no maximum count | same page |
| AMO data collection | `browser_specific_settings.gecko.data_collection_permissions`, required for new extensions since 2025-11-03; `"required": ["none"]` declares no collection | extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/ (page updated 2026-03-12) |

## Shared copy

**Name**

<!-- field:name -->
Radar
<!-- /field -->

**Summary** (CWS takes it from the manifest `description`; the test keeps the two identical)

<!-- field:summary -->
Free, no account, nothing leaves your browser unless you opt in. Sourced evidence on posts and links, each sign with its error rate.
<!-- /field -->

**AMO summary**

<!-- field:amo-summary -->
Free, no account, nothing leaves your browser unless you opt in. Sourced evidence behind the posts and links you read on X, YouTube, Reddit, Facebook, Instagram and Bluesky, each sign with its measured error rate. Never a score.
<!-- /field -->

**Description**

<!-- field:description -->
Free. No account. Nothing leaves your browser unless you turn on Other coverage.
Radar has no server, no sign-in and no analytics. What it reads stays in your browser, and one click deletes it.

Evidence, with its error rate. Never a score.
Every sign says where its data came from and what it does not prove. Every sign Radar works out itself shows how often it was right when people checked by hand, with a 95% interval, or says "not measured yet". The full results, the data behind them and their licences are on the transparency page.

Rest the pointer on a reply on X, YouTube, Reddit, Facebook, Instagram or Bluesky, and a window opens beside it with:
- Place: where the site labels the account as based, and replies that speak as a local of somewhere else.
- Coordination: the same text from several accounts, the same upload pushed by many, replies that arrive in bursts, wording that turns up in other threads you opened.
- Account and posting: its age, renames, posting hours and the apps it posts from.
- Sources: outlet owners, state links only where a cited report or official document names them, Community Notes, and fact-checks of similar claims with the fact-checker's own rating.
- Language: slurs, calls for violence and dehumanising language, measured on public research data.
- Site cards: rest the pointer on a link to see who owns the site, its owner type, founding date and country from Wikidata, any cited state link, and its fact-check record ("N reviews by M fact-checkers since a date"), with every rating in the fact-checker's own words. Press "Site card for this page" for the news site you are reading, and turn on labels under Google, Bing or DuckDuckGo results if you want them.
- Other coverage, off by default: on a click, Radar reads the news feeds of outlets you choose, finds the ones covering the same story and labels each by owner and owner type (state media, public broadcaster, nonprofit, commercial), never by a left or right score. Nothing from the page is sent; the options page names every outlet it would ask.
- A thread report: whether the most extreme replies come mostly from flagged accounts, with intervals, and "skewed" only when the intervals do not overlap.

Tell Radar when it is wrong. Each sign has "This was right" and "This was wrong". Your marks stay in your browser, and after ten on one kind of sign the window shows your own count beside the measured figure. You can save them to a file and choose whether to share it.

What Radar never does:
- Call anyone a bot, propagandist or extremist.
- Use political side as an input. The same words count the same whoever they target, and the transparency page shows how evenly each side is covered.
- Guess who runs an account, or anyone's age, gender, ethnicity, religion or politics.
- Send your data anywhere. Other coverage, which you turn on yourself, requests the public feeds of outlets you chose on your click and sends nothing from the page.

Keyboard: focus a post to open its window, Alt+R to move into it, Esc to close it.

How Radar is measured: https://harperz9.github.io/radar/transparency.html
Privacy policy: https://harperz9.github.io/radar/privacy.html
Source code: https://github.com/HarperZ9/radar
<!-- /field -->

| Field | CWS | AMO |
|---|---|---|
| Category | Social & Communication | Social & Communication |
| Language | English | English |
| Visibility | Public | Listed |
| Homepage | https://github.com/HarperZ9/radar | https://github.com/HarperZ9/radar |
| Support | https://github.com/HarperZ9/radar/issues | https://github.com/HarperZ9/radar/issues |
| Privacy policy | https://harperz9.github.io/radar/privacy.html | https://harperz9.github.io/radar/privacy.html |
| Mature content | Off | n/a |
| Licence | n/a | GNU Affero General Public License v3.0 only (AGPL-3.0-only) |
| Tags (AMO) | n/a | misinformation, fact-check, privacy, social media, transparency |

The privacy and transparency URLs go live when GitHub Pages serves `/docs` from `main`.

## Chrome Web Store: privacy practices tab

**Single purpose**

<!-- field:single-purpose -->
Shows the evidence behind the posts and accounts in the social media threads the user is reading: where it comes from, signs of coordination and how it argues, each with its source and measured error rate.
<!-- /field -->

**Permission justifications**

| Permission | Justification |
|---|---|
| `storage` | Keeps the user's settings, the account details the site disclosed, thread summaries and the user's own feedback marks in this browser, for the retention the user sets. Nothing is synced or sent. |
| Host `https://x.com/*`, `https://twitter.com/*` | Reads the replies and account details X shows on the page, and repeats X's own "About this account" request for reply authors, at most one account every 1.5 seconds. |
| Host `https://www.youtube.com/*` | Reads the comments and channel data YouTube already loaded for the page. |
| Host `https://www.reddit.com/*` | Reads comments and Reddit's public account data for comment authors, one account every 2 seconds. |
| Host `https://www.facebook.com/*`, `https://www.instagram.com/*` | Reads comments and the account transparency details Meta shows when the user opens them. |
| Host `https://bsky.app/*` | Reads replies, account data and moderation labels the Bluesky app loaded. |
| `scripting` | Injects the site card into the current tab when the user presses "Site card for this page", and registers the search-result labels only for the engines the user turned on. Also runs Radar on a Mastodon server only after the user turns it on for that server, and checks, when the user opens the toolbar button on such a page, whether it is the Mastodon web app (its root element, version and domain, nothing else). |
| `activeTab` | Lets the site card and that one check read the current tab when the user opens the toolbar button, and no other time. |
| Host `https://www.threads.com/*`, `https://www.threads.net/*` | Reads the posts and replies Threads shows on the page. |
| Host `https://www.tiktok.com/*` | Reads the comments TikTok shows and the comment list its app already loaded. |
| Optional host `https://*/*` | Asked for one Mastodon server at a time, only when the user clicks "Turn on Radar here" on that server; the browser shows its own prompt. Never granted for all sites. The options page lists the servers and takes access back. The same optional permission is asked for `https://www.google.com/*`, `https://www.bing.com/*` or `https://duckduckgo.com/*` only when the user turns on result labels for that engine, and for one news feed's host at a time (for example `https://feeds.bbci.co.uk/*`) only when the user chooses that outlet or adds that feed for Other coverage, which on the user's click downloads the feed and sends nothing from the page. |

The APIs Radar also calls (`action`, `tabs.create`, `tabs.query`, `tabs.sendMessage`,
`windows.create`) need no manifest permission. `tests/store-listing.test.js` fails when the
manifest asks for a host or permission this table does not justify.

**Remote code:** No, I am not using remote code. Every script ships in the package.

**Data usage.** The CWS user-data FAQ says disclosure applies "even when data is processed or stored
locally". Tick these, because Radar reads and keeps them in the browser:

| CWS category | Ticked | Why |
|---|---|---|
| Website content | Yes | Reads the replies and account details on the page; keeps summaries and, only when the user ticks it, a post's text with a feedback mark |
| Web browsing activity | Yes | Keeps a summary of each thread the user opened, for the history page |
| Website content, sent | No | Other coverage downloads the feeds of outlets the user chose and sends nothing from the page; each outlet sees an ordinary request from the user's IP address. Off by default |
| Personally identifiable information, Health, Financial and payment, Authentication, Personal communications, Location, User activity | No | Radar reads none of these. The location labels are the sites' public labels about other accounts, not the user's location |

Certifications (tick all three): not sold or transferred to third parties outside the approved use
cases; not used or transferred for purposes unrelated to the single purpose; not used or
transferred to determine creditworthiness or for lending.

## Firefox Add-ons fields

| Field | Value |
|---|---|
| Package | `dist/radar-firefox-<version>.xpi` from `npm run package`; AMO signs it |
| Add-on ID | `radar@harperz9.github.io`. Permanent: see DESIGN.md, "Add-on identity" |
| Minimum version | Firefox 128 (main-world content scripts) |
| Data collection | `"required": ["none"]`: Radar sends no user data. Other coverage, when the user turns it on, downloads public news feeds from hosts the user approved one by one and sends nothing from the page |
| Lint | `web-ext lint` 8.10.0 on the 2026-10-21 build: 0 errors, 0 warnings, 0 notices |
| Source code | Upload a source archive (`git archive`) and note: `core.bundle.js` is generated by `npm run build` from `src/core`; nothing is minified |
| Notes to reviewer | Run `node scripts/serve.mjs` and open `http://127.0.0.1:8742/tests/fixtures/thread.html` to see the window without any account. On a real site, Firefox asks for site access on the first-run page |

Radar 2.x declared `websiteContent` under `optional` for the GDELT lookup, which sent title words.
3.0 removed that lookup and the declaration. Any future feature that sends user data must add
its data type here first.

## Screenshots and images

Use the invented fixture thread or the author's own posts only, never another person's real
account. Take them in a clean browser profile at 1280x800 (CWS needs that size; AMO uses the same
files).

1. The window beside a reply on the fixture thread, light theme: the area strip, "speaks as local,
   labelled elsewhere" open with its evidence, "Does not prove", "Measured" and the feedback
   buttons.
2. The same window in a dark theme, with a measured language sign showing its precision and
   interval.
3. The thread report panel with the flagged shares and intervals.
4. The transparency page at the side-balance table.
5. The first-run page: what Radar shows, what it never does, the site switches.

Small promo tile (CWS, 440x280, required): the aperture icon on the void ground (#060608) with the name in Hanken Grotesk 780, from
`assets/icons/radar.svg`. Marquee (1400x560): optional, skip. Icon: `src/ext/icons/radar-128.png`.
YouTube video: the CWS listing page lists one; if the dashboard requires it, a 30 to 60 second
screen recording of the fixture thread, uploaded to the author's channel.

## Before submitting

- The coordinator bumps the version in `manifest.json` and `package.json`.
- `npm test` green; `npm run build` and `npm run pages` leave no diff; `npm run package` hashes
  recorded in the release notes.
- GitHub Pages on, serving `docs/`; both policy URLs load.
- `web-ext lint` on the Firefox package: no errors.
- Author steps: CWS developer account, the registration fee and the developer agreement; AMO
  account and its agreement; the YouTube video if the CWS dashboard asks for one.
