# CMMNS privacy policy

Last updated: 2026-10-28.

CMMNS, formerly Daylight Commons and Radar before that, runs in your browser, and everything it reads or works out stays there. It talks
to the site you are on, with that site's own session. Two features reach further, and both stay off
until you turn them on and click: Other coverage downloads the public news feeds of outlets you
choose, and evidence lookups send the repository names and web domains a post links to GitHub,
rdap.org and the Internet Archive. Saving media downloads a file from the host the page loaded it
from, on your click. Your browser's extension details page lists every site CMMNS has
access to.

## What CMMNS reads

CMMNS reads what the site you are on has already shown or loaded for you: the replies on
the page, the account details the site discloses (for example X's "About this account" label), and
the post data the site's own app downloaded. That is the same material the site shows any viewer.
IP addresses stay out of it.

## Requests CMMNS makes

Every request below goes to the site you are already using, with that site's own session in your
browser:

| Site | Request | When |
|---|---|---|
| X | The "About this account" data for reply authors, through the same request X's own app makes, at most one account every 1.5 seconds and slower when X says it is busy | Automatically while "Read account details automatically" is on |
| X | One account's profile and About page in a minimised window, so CMMNS can learn X's request the first time, or when you ask CMMNS to read accounts | The first time, and when you ask |
| Reddit | Reddit's public account data (`/user/<name>/about.json`) for comment authors, one account every 2 seconds | Automatically while that setting is on |

On Bluesky, Threads, TikTok and Mastodon servers CMMNS reads the page and copies the
responses the site's own app already loaded: on TikTok and Mastodon, the comment and thread lists.
Request headers and login tokens stay with the site.

**Mastodon servers.** You turn CMMNS on one Mastodon server at a time. Open the toolbar
button on a Mastodon page and it checks that page for the Mastodon web app, its version and its
domain. It then offers "Turn on CMMNS here", and your browser asks you to allow access to
that one server. The servers you turned on are kept in `pb.instances.v1`; Options, Mastodon servers,
Remove takes the access back.

Fact-checks and site cards come from tables bundled inside CMMNS, so the matching happens
on your device. Site cards show a site's owner, owner type, founding date, country, state links and
fact-check record. They appear on links, on search results when you turn an engine on, and on the
page you are reading when you press "Site card for this page".

### Evidence lookups (off by default)

Turn evidence lookups on from the first "Look up evidence" click under a launch campaign section, or
in the options page. Each lookup is one click, for the post you are viewing, and sends one thing:
the repository names (`owner/repo`) and web domains that post links to. They go to GitHub's API
(api.github.com), to rdap.org, which forwards to the registry for the domain, and to the Internet
Archive (web.archive.org). Each service sees an ordinary web request without cookies: your IP
address and the time. A GitHub token you add in the options page stays in this browser and goes to
api.github.com alone, to read star timestamps. Ad libraries appear as links for you to open
yourself. "Save this post to the Internet Archive" opens the archive's own save page in a tab, and
the archive then sees which post you asked it to save. Results are kept as sealed receipts in this
browser (`pb.seal.v1`) until you clear CMMNS data.

### Other coverage (off by default)

Turn Other coverage on in the options page, then pick outlets from a suggested list or add any RSS
or Atom feed address. Each outlet you choose asks the browser for access to that one feed's host.
When you click "Find other coverage" on an article's site card, CMMNS downloads each
chosen outlet's feed from the feed's own address and compares the article's title with the feed's
headlines on your device.

Each request is a plain download of a public feed, with your browser's standard headers and nothing
added: no cookies, no referrer, and no redirect followed to another address. The outlet sees your IP
address and the time, and could guess that someone was reading news at that moment. Answers live in
memory for ten minutes. Before the first request the card lists every host it will ask and waits for
your click; adding an outlet asks again. Turning the option off withdraws every feed host's
permission and forgets your choices.

CMMNS 2.x used the GDELT Project's search service for this feature, which received the
main words of the title. CMMNS 3.0 replaced it with the feed downloads above and gives
back that permission on update.

The window offers reverse image search links (Google Lens, TinEye, Bing, Yandex) for media. When you
click one, that service receives the image address.

**Media checks, when you click.** "Check this file" re-requests one image or video file the page
already loaded, from the exact address the page used (for X, its own media server), without cookies,
so the browser usually answers from its cache. CMMNS reads the file's Content Credentials
and metadata in the tab and keeps the result in memory. "Take 4 frames" copies frames from the
page's own video player in the tab. Choosing a search service then copies one frame to your
clipboard and opens that service; the frame reaches it when you paste it there. Credentials stored
online (a file that points to a remote manifest) stay where they are.

**Reading text in an image, when you click.** Turn on "Read text in images" in the options page.
"Read text in this image" then re-requests that one image the same way, from the address the page
used and without cookies, and hands its bytes to CMMNS' own background worker in your
browser. Code and weights shipped inside CMMNS read the words there. The image, the text
and any hash of either stay in your browser, and the text lasts as long as that window.

## Saved media, conversions and ad blocking

- **Save to CMMNS** and **Save media from this page** read the current tab once, on your click,
  to list the media it loaded. On **Save**, your browser asks you to let CMMNS reach the
  one host each file or stream comes from (for example `pbs.twimg.com`); it then downloads the file
  from there, as the page did, with your browser's own cookies for that host. Nothing from the page
  is sent anywhere else.
- Saved files, their hashes, addresses, page, time, tags, notes and lineage are kept in this
  browser's IndexedDB for the extension, until you delete them on the collections page ("Delete all
  saved media") or remove CMMNS. A case save also adds the file's address, page and hash
  to the case list in `chrome.storage.local`.
- **Ask the Internet Archive to keep a copy**, a tick box on a case save that is off unless you tick
  it, sends the saved file's address (or the page's, for a stream) to web.archive.org. Firefox asks
  you to allow "browsing activity" for this the first time.
- **Download**, **Download as GIF**, **Copy**, **Copy link** and **Copy with caption** read the current
  tab once, on your click (the Download button on X and Reddit posts reads that post). The file comes
  from the host the page loaded it from, with the same request the page's own player makes; cookies go
  only to the page's own site. It goes to your Downloads folder through your browser's downloads.
  The post's text, author, time, alt text and links that the page already shows go into a `.md` file
  beside it and into the file's own description; nothing is fetched for them and nothing is sent
  anywhere. Both can be turned off in the settings.
- The **Download control on pictures and videos** watches where the pointer rests, in that tab only,
  to know when to show; it reads and sends nothing until you click it. It runs on the sites CMMNS
  Commons reads, and on every https site only after you turn on "Show it on every site", when your
  browser asks you once. **Alt+Shift+D** reads the current tab once, on the key press. **Study**,
  **Save as note**, **Save selection** and **Save as card** keep text the page shows (and, for a card,
  a picture made on this device) in your Downloads folder; nothing is sent.
- On YouTube, **Save reference** keeps the thumbnail the page shows and a note; CMMNS
  never downloads YouTube video. The command line's `cmmns media fetch`, which you run yourself,
  asks yt-dlp to download from the address you give it.
- The **side panel** shows what the window beside a post would show. It reads nothing itself.
- Protected media (DRM or encrypted streams) is never downloaded.
- **Convert and compress** runs on this device. No file is uploaded.
- **Ad and tracker blocking**, off until you turn it on, is done by your browser's own blocking
  engine with the bundled EasyList and EasyPrivacy rules. CMMNS does not see which
  requests were blocked. The sites where you allowed ads are kept with your settings.

## Source protection, Share clean and the self-audit

- **Source protection**, off until you turn it on (toolbar menu, Source protection), stops every
  request in this policy that CMMNS makes on its own: no About pages or Reddit account
  data read for you, no evidence lookups, no Other coverage, no Internet Archive copy, and no file
  downloaded again from its host. Save to CMMNS keeps only what the page already holds in
  memory. Download gives Share clean copies, and every evidence bundle is carrier-safe. The toolbar
  button shows a P while it is on. The sites you open still load their own pages and record what
  you do there; the mode's own page lists what it cannot protect against. It has not yet been
  independently reviewed.
- **Share clean** (Collections, and the save page's result) makes a copy of a saved file with what
  the file says about itself removed: EXIF with GPS, XMP, IPTC, colour-profile text, comments, video
  tags and dates, PDF and office document authors, and the description CMMNS wrote into
  it. It runs on this device and sends nothing. The copy gets a neutral name. The saved file keeps
  everything, as your evidence copy, and its record gains a line tying the two hashes together.
- **What CMMNS shows about you** runs CMMNS' account signals on your own account:
  your profile as X already loaded it in this browser, read only when the page shows you signed in
  on your own profile, or the data export files you choose. It sends nothing and keeps nothing.
- On the command line, `cmmns case add` no longer asks the Wayback Machine for a copy unless you
  pass `--archive` or turn the case's archive setting on.

## Discourse checks

Off until you turn on Discourse checks in the options. The quote index and the name list ship inside
the extension and are read in its background worker; a post's text and an account's display name
and handle go there, inside your browser, and nowhere else. Counts, replies and document pages are
read on the page. Document pages are read only on your click, with Read text in images on. Nothing
is kept beyond the page, except what you save as a study item.

The **argument lens**, with its claim-type, inference-gap and reframing markers, is off until you turn
it on under the discourse checks. It reads the post's own text on the page and sends nothing.

## What CMMNS keeps, where, and for how long

Everything is kept in `chrome.storage.local` (Firefox: `browser.storage.local`) in the browser
profile you installed CMMNS in, on this device.

| Store | What it holds | Kept for |
|---|---|---|
| Settings (`pb.settings`) | Your choices on the options page | Until you change them or remove CMMNS |
| Account details (`pb.about.v1`, `pb.reddit.v1`) | What X or Reddit disclosed about accounts you saw: location label, join date, counts, name changes, and a summary of posting times and apps | 14 days by default; 1 to 30 days in options |
| Connections log (`pb.net.v2`) | Which accounts replied in which threads you opened, how many seconds after the post, link domains, and a short hash of each reply's wording in place of the wording | 30 days, or your shorter history setting |
| Source trails (`pb.trail.v1`) | Post ids, handles and times that carried the same upload or link | 30 days, or your shorter history setting |
| Thread history (`pb.history.v1`) | One summary per thread you opened: counts, origins, flagged shares, linked sites, Community Note and fact-check counts | 60 days by default; 1 to 60 days in options, at most 600 threads |
| Feed tally (`pb.feed.v1`) | Per site and day: the ids of feed posts counted (so each counts once), how many linked each site, and how many showed strong rhetoric signs, a Community Note or a fact-check match | 60 days by default; follows the history setting |
| Saved files (`pb.saved.v1`) | For each file you downloaded: its address (or, for a file made on this device, its SHA-256) and the name it was saved under, so the same file is not saved twice | Until you delete your data; at most 20,000 files, the oldest dropped first |
| Media checks (`pb.media.v1`) | For each file you asked CMMNS to check: a short hash of its address, the site, the time and the outcome (credentials intact, partly checked, changed, stored online, or absent), for the survival count on the feed page | 60 days by default; follows the history setting; at most 5,000 files |
| Thread card (session storage) | The card you asked for from a thread panel, and the thread's posts as the page showed them, so the card page can build a signed evidence bundle if you ask for one. The card names no account | Until the browser closes |
| Bundle key (IndexedDB `radar-keys`) | The ECDSA P-256 key pair CMMNS makes the first time you save a signed evidence bundle. The browser stores the private half so it can sign and stays sealed against reading, export or sending. Carrier-safe bundles use their own one-time keys | Until you remove CMMNS |
| Your feedback (`pb.feedback.v1`) | Your "This was right" and "This was wrong" marks: which sign (its kind, the post id and a short hash of its label), the thread, your mark and the time, plus the post text when you ticked "include the text" | Until you clear it or remove CMMNS; at most 2,000 marks, the oldest dropped first |
| Count ledger (`pb.ledger.v1`) | For each launch post you opened: its post id and the public counts (reposts, likes, replies, quotes, bookmarks, views) at each visit, at most one point per 10 minutes | 30 days, at most 48 visits per post and 500 posts |
| Evidence log (`pb.seal.v1`) | The receipts of evidence lookups you ran: what GitHub, RDAP and the Internet Archive said about a repository or domain, when, a hash of each answer, and the chain that seals them | Until you clear CMMNS data; at most 2,000 receipts |
| GitHub token (`pb.evidence.github`) | The token you add in the options page, sent to api.github.com alone | Until you remove it or clear CMMNS data |
| Launch overlap (`pb.campaign.v1`) | For each launch post you opened with enough accounts loaded: its post id and salted hashes of the sampled accounts (a random salt made in your browser that stays there), so the campaign lens can count accounts seen on several launches. "Forget launches I viewed" in the thread panel clears it | 30 days, at most 200 launches |
| Account details from other sites (`pb.meta.v1`) | What Instagram, Facebook, Bluesky or a Mastodon server showed about accounts you saw: join date, counts, labels, renames | 14 days |
| Mastodon servers (`pb.instances.v1`) | The servers you turned CMMNS on for | Until you remove them |
| Catalogue age (`pb.head.v1`) | After you check a signed head on the options page: its version, a hash of it, its signed time and expiry, the catalogue version and how many signatures it carried. Used to refuse an older head and to show how old the catalogue is | Until you remove CMMNS |
| Data packs (`pb.packs.v1`, `pb.packkeys.v1`) | Pack files you imported on the options page, whether each is on, and the public keys you chose to trust. Packs arrive only as files you pick, and stay in this browser | Until you remove them |
| X request shape (`pb.tpl`) | The shape of X's About request, so CMMNS can repeat it. The login token is read fresh from X's cookie each time | Until X changes it or you clear CMMNS' data |

Post data from the page (views, posting app, media upload times) is held in memory for the tab and
goes when you close it.

### Carrier-safe evidence bundles

An ordinary bundle is signed with this browser's own key, so every bundle you save carries the same
key id, and it records the exact save time and the page address. Anyone who holds two of your
bundles can tell they came from one install. For a bundle you will hand to someone else, tick
**Carrier-safe** on the card page, or use `radar analyze --carrier-safe` on the command line. A
carrier-safe bundle:

- is signed with a one-time key made for that bundle alone and discarded when the signing ends;
- keeps the day it was saved and blanks every time of day inside it;
- carries a page address when you type one in;
- names the tool by its major version.

Its signature proves the bundle is unchanged and says nothing about who made it. Anyone watching the
network can still link two bundles sent from one connection, and the post ids identify the thread
and, on X, when each post was made. For information that could put you at risk, use a newsroom's
SecureDrop or a GlobaLeaks site through Tor Browser, with their own tools for removing hidden data.
The carrier-safe profile awaits independent review.

## Your controls

- **Options page:** switch CMMNS off per site or pause it everywhere, change how long it
  keeps data, and press "Clear all CMMNS data", then confirm, to delete everything above
  except your choices: your settings, the Mastodon servers you turned on, your data packs and the
  keys you trust, and the tour's "No more tips". The bundle signing key stays too, so bundles you
  already shared still check as yours.
- **History page:** clear the history, connections and trails on their own.
- **Save report:** writes a JSON file to your computer when you click it, with the thread report,
  account labels and flags and without reply text.
- **Save feedback to a file** (options page): writes your marks to a JSON file on your computer when
  you click it. You choose whether to share it, for example by attaching it to an issue on CMMNS
  Commons' repository. "Clear feedback" deletes your marks.
- **Analyse a file:** reads a saved page, thread JSON, a platform data export or a media file you
  choose, on your device, and leaves the file where it is.
- **Save signed bundle** (Analyse a file and the thread card page): writes a JSON file to your
  computer when you click it. It holds post ids, the evidence with the matched words, CMMNS
  Commons' version, a hash of its data tables, the time and your bundle key's public half. Tick the
  box to include full post text. The file stays on your computer for you to share.
- **Removing CMMNS** deletes everything it kept.

## What CMMNS sends, in full

- To the sites you use: the requests in the table above.
- To GitHub, rdap.org and the Internet Archive: the repository names and web domains a post links
  to, when evidence lookups are on and you click.
- To the news outlets you chose: a feed download, when Other coverage is on and you click.
- To the host a saved file came from: the download of that file, when you click Save.
- To the Internet Archive: a saved file's address, when you tick "Ask the Internet Archive to keep a
  copy" on a case save.

With source protection on, the list is empty: only the sites you open load their own pages.

That is the whole list. Your data serves the features above and stays out of advertising and
sale. Account labels show what each site discloses about an account, kept per site; CMMNS
Commons leaves who runs an account, and anyone's age, gender, ethnicity, religion or politics,
unguessed.

## More detail

Drafts that go further are being written and await a lawyer's review. They are not in force and
change nothing in this policy:
[Data protection](https://github.com/HarperZ9/cmmns/blob/main/DATA-PROTECTION.md) (who is
responsible for which data, and the exemptions for personal, journalistic and research use),
[Requests from people named or shown](https://github.com/HarperZ9/cmmns/blob/main/SUBJECT-REQUESTS.md),
the [acceptable use policy](https://github.com/HarperZ9/cmmns/blob/main/ACCEPTABLE-USE.md) and the
[legal notice](https://github.com/HarperZ9/cmmns/blob/main/LEGAL-NOTICE.md).

## Changes

Changes to this policy are listed in CHANGELOG.md with the version that made them.

Contact: open an issue on the project's repository.
