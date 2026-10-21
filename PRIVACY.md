# Radar privacy policy

Last updated: 2026-10-21.

Radar runs entirely in your browser. It has no server, no account, no analytics and no telemetry.
Nothing Radar reads or works out is sent to the author or to anyone else. One feature, Other
coverage, requests the public news feeds of outlets you choose, and only when you turn it on and
click; it sends nothing from the page, is off by default and is described below.

## What Radar reads

Radar reads what the site you are on has already shown or loaded for you: the replies on the page,
the account details the site discloses (for example X's "About this account" label), and the post
data the site's own app downloaded. It reads nothing the site does not show its viewers, and never
reads IP addresses.

## Requests Radar makes

Radar sends no data to the author, to analytics services or to any server of its own. It makes
these requests, all to the site you are already using, with that site's own session in your browser:

| Site | Request | When |
|---|---|---|
| X | The "About this account" data for reply authors, through the same request X's own app makes, at most one account every 1.5 seconds and slower when X says it is busy | Automatically, unless you switch off "Read account details automatically" |
| X | One account's profile and About page in a minimised window, so Radar can learn X's request the first time, or when you ask Radar to read accounts | The first time, and when you ask |
| Reddit | Reddit's public account data (`/user/<name>/about.json`) for comment authors, one account every 2 seconds | Automatically, unless you switch that setting off |

On Bluesky, Threads, TikTok and Mastodon servers Radar makes no request at all: it reads the page and
copies responses the site's own app already loaded (on TikTok and Mastodon, the comment and thread
lists; Radar never reads request headers or login tokens).

**Mastodon servers.** Radar has no access to any Mastodon server until you turn it on for that
server. When you open Radar's toolbar button on a page Radar does not run on, it checks two things
on that page only: whether it is the Mastodon web app, and the app's version and domain. If it is,
the button offers "Turn on Radar here", and your browser asks you to allow access to that one
server. The list of servers you turned on is kept in `pb.instances.v1`; Options, Mastodon servers,
Remove takes the access back.

Fact-check matching runs against a table bundled inside Radar, so post text is never sent to a
fact-checking service. Site cards (owner, owner type, founding date, country, state links and a
site's fact-check record) come from tables bundled inside Radar too, on links, on search results
when you turn an engine on, and on the page you are reading when you press "Site card for this
page". None of these send anything.

### Other coverage (off by default)

Other coverage is off unless you turn it on in the options page. When it is on, you choose which
outlets to ask from a suggested list, and you may add any RSS or Atom feed address. Choosing an
outlet asks the browser for access to that one feed's host, never to all sites. When you click
"Find other coverage" on an article's site card, Radar requests each chosen outlet's feed from the
feed's own address, then compares the article's title with the feed's headlines on your device.

Radar sends nothing from the page: not the title, not the page address, not your history, not any
post, not any account. Each request is an ordinary download of a public feed, with no cookies, no
referrer and no header added by Radar, and Radar does not follow a redirect to another address.
Each outlet receives the request like any web request, so it sees your IP address, the time and
your browser's standard headers, and could guess that someone was reading news at that moment. No
aggregator or Radar server is involved. Answers are kept in memory for ten minutes and never
stored. Before the first request the card lists every host it will ask and waits for your click;
adding an outlet resets that consent. Turning the option off withdraws every feed host's
permission and forgets your choices.

Radar 2.x used the GDELT Project's search service for this feature, which received the main words
of the title. Radar 3.0 removed it and gives back that permission on update.

The window offers reverse image search links (Google Lens, TinEye, Bing, Yandex) for media. Those
open only when you click one, and then that service receives the image address.

**Media checks, only when you click.** "Check this file" re-requests one image or video file the
page already loaded, from the exact address the page used (for X, its own media server), without
cookies, so the browser usually answers from its cache. Radar reads the file's Content Credentials
and metadata in the tab and keeps the result in memory only. "Take 4 frames" copies frames from
the page's own video player in the tab; choosing a search service then copies one frame to your
clipboard and opens that service, which receives nothing until you paste the frame there.
Credentials stored online (a file that points to a remote manifest) are never fetched.

**Reading text in an image, off by default, only when you click.** With "Read text in images"
turned on in the options page, "Read text in this image" re-requests that one image the same way,
from the address the page used and without cookies, and hands its bytes to Radar's own background
worker in your browser. The words are read there by code and weights shipped inside Radar; nothing
is downloaded for it. The image, the text and any hash of either never leave your browser. The text
is kept in memory for that window only.

## What Radar keeps, where, and for how long

Everything is kept in `chrome.storage.local` (Firefox: `browser.storage.local`) in the browser
profile you installed Radar in. It is not synced to other devices.

| Store | What it holds | Kept for |
|---|---|---|
| Settings (`pb.settings`) | Your choices on the options page | Until you change them or remove Radar |
| Account details (`pb.about.v1`, `pb.reddit.v1`) | What X or Reddit disclosed about accounts you saw: location label, join date, counts, name changes, and a summary of posting times and apps | 14 days by default; 1 to 30 days in options |
| Connections log (`pb.net.v2`) | Which accounts replied in which threads you opened, how many seconds after the post, link domains, and a short hash of each reply's wording (not the wording) | 30 days, or less if you set history shorter |
| Source trails (`pb.trail.v1`) | Post ids, handles and times that carried the same upload or link | 30 days, or less if you set history shorter |
| Thread history (`pb.history.v1`) | One summary per thread you opened: counts, origins, flagged shares, linked sites, Community Note and fact-check counts. No reply text | 60 days by default; 1 to 60 days in options, at most 600 threads |
| Feed tally (`pb.feed.v1`) | Per site and day: the ids of feed posts counted (so each counts once), how many linked each site, and how many showed strong rhetoric signs, a Community Note or a fact-check match. No post text | 60 days by default; follows the history setting |
| Media checks (`pb.media.v1`) | For each file you asked Radar to check: a short hash of its address (not the address), the site, the time and the outcome (credentials intact, partly checked, changed, stored online, or none found), for the survival count on the feed page | 60 days by default; follows the history setting; at most 5,000 files |
| Thread card (session storage) | The card you asked for from a thread panel, and the thread's posts as the page showed them, so the card page can build a signed evidence bundle if you ask for one. The card names no account | Until the browser closes |
| Bundle key (IndexedDB `radar-keys`) | The ECDSA P-256 key pair Radar makes the first time you save a signed evidence bundle. The private half is stored so that it can sign but cannot be read, exported or sent | Until you remove Radar |
| Your feedback (`pb.feedback.v1`) | Your "This was right" and "This was wrong" marks: which sign (its kind, the post id and a short hash of its label), the thread, your mark and the time. The post text only for marks where you ticked "include the text" | Until you clear it or remove Radar; at most 2,000 marks, the oldest dropped first |
| Account details from other sites (`pb.meta.v1`) | What Instagram, Facebook, Bluesky or a Mastodon server showed about accounts you saw: join date, counts, labels, renames | 14 days |
| Mastodon servers (`pb.instances.v1`) | The servers you turned Radar on for | Until you remove them |
| Data packs (`pb.packs.v1`, `pb.packkeys.v1`) | Pack files you imported on the options page, whether each is on, and the public keys you chose to trust. Radar never downloads a pack and sends none anywhere | Until you remove them |
| X request shape (`pb.tpl`) | The shape of X's About request, so Radar can repeat it. It holds no login token; the token is read fresh from X's cookie each time | Until X changes it or you clear Radar's data |

Post data from the page (views, posting app, media upload times) is held in memory for the tab and
is gone when you close it.

## Your controls

- **Options page:** switch Radar off per site or pause it everywhere, change how long it keeps
  data, and press "Clear all Radar data" to delete everything above except your settings.
- **History page:** clear the history, connections and trails on their own.
- **Save report:** writes a JSON file to your computer only when you click it. It holds the thread
  report, account labels and flags, and leaves reply text out.
- **Save feedback to a file** (options page): writes your marks to a JSON file on your computer
  only when you click it. Radar never sends it. You choose whether to share it, for example by
  attaching it to an issue on Radar's repository. "Clear feedback" deletes your marks.
- **Analyse a file:** reads a saved page, thread JSON, a platform data export or a media file you
  choose, on your device. The file is not kept and nothing is sent.
- **Save signed bundle** (Analyse a file and the thread card page): writes a JSON file to your
  computer only when you click it. It holds post ids, the evidence with the matched words, Radar's
  version, a hash of its data tables, the time and your bundle key's public half. Full post text
  goes in only if you tick the box. Radar never sends it.
- **Removing Radar** deletes everything it kept.

## What Radar never does

- Sends anything to the author, or to a third party except the title words you send through Other
  coverage.
- Sells, shares or uses data for advertising.
- Guesses who runs an account, or anyone's age, gender, ethnicity, religion or politics.
- Links accounts across sites.

## Changes

Changes to this policy are listed in CHANGELOG.md with the version that made them.

Contact: open an issue on the project's repository.
