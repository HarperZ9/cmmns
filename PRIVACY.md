# Radar privacy policy

Last updated: 2026-10-21.

Radar runs entirely in your browser. It has no server, no account, no analytics and no telemetry.
Nothing Radar reads or works out is sent to the author or to anyone else.

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

Fact-check matching runs against a table bundled inside Radar, so post text is never sent to a
fact-checking service.

The window offers reverse image search links (Google Lens, TinEye, Bing, Yandex) for media. Those
open only when you click one, and then that service receives the image address.

**Media checks, only when you click.** "Check this file" re-requests one image or video file the
page already loaded, from the exact address the page used (for X, its own media server), without
cookies, so the browser usually answers from its cache. Radar reads the file's Content Credentials
and metadata in the tab and keeps the result in memory only. "Take 4 frames" copies frames from
the page's own video player in the tab; choosing a search service then copies one frame to your
clipboard and opens that service, which receives nothing until you paste the frame there.
Credentials stored online (a file that points to a remote manifest) are never fetched.

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
| Thread card (session storage) | The card you asked for from a thread panel, held until the card page opens it. It names no account | Until the browser closes |
| Your feedback (`pb.feedback.v1`) | Your "This was right" and "This was wrong" marks: which sign (its kind, the post id and a short hash of its label), the thread, your mark and the time. The post text only for marks where you ticked "include the text" | Until you clear it or remove Radar; at most 2,000 marks, the oldest dropped first |
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
- **Removing Radar** deletes everything it kept.

## What Radar never does

- Sends anything to the author or a third party.
- Sells, shares or uses data for advertising.
- Guesses who runs an account, or anyone's age, gender, ethnicity, religion or politics.
- Links accounts across sites.

## Changes

Changes to this policy are listed in CHANGELOG.md with the version that made them.

Contact: open an issue on the project's repository.
