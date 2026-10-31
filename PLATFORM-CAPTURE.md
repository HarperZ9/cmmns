# Platform capture

**Draft for counsel review. Not legal advice. Not in force: this page awaits a lawyer's review and
is not part of CMMNS' terms until that review is done.**

Drafted 2026-10-28. How CMMNS reads and saves material on each platform, what it will not
do, and what stays your responsibility under each site's own terms.

## The posture, on every platform

1. **Public material, as the page delivered it.** CMMNS reads what the site has already
   shown or loaded for you, and saves what the page delivered to your browser in the clear. It reads
   only what the platform discloses to a viewer, and never an IP address or anything the platform
   keeps back.
2. **No circumvention.** It does not decrypt DRM or encrypted streams (an encrypted HLS key, a DASH
   `ContentProtection` element, or MP4 and WebM encryption markers stop a save before any segment is
   fetched), does not bypass a login or paywall, does not use credentials other than the session you
   already have in your own browser, does not rotate addresses or identities to evade blocking, and
   does not solve CAPTCHAs.
3. **Human pace.** Requests are started by you or run at a fixed slow rate: at most one account
   every 1.5 seconds on X and every 2 seconds on Reddit, slower when the site says it is busy. A
   person decides what to open and what to save.
4. **Your own session.** In the browser, requests to a site go with that site's own session in your
   browser, as the site's own app would make them. Login tokens and request headers stay with the
   site. On the command line, requests carry no cookies or credentials, and a page behind a sign-in
   is refused and logged as withheld.
5. **Nothing sent onward.** What the extension reads stays on your device unless you turn on a named
   feature and click (`PRIVACY.md`, `DATA-PROTECTION.md`).

## Per platform

| Platform | What CMMNS reads | What it saves on your click | Limits |
|---|---|---|---|
| X | replies on the page, the post data X's app loaded, and the "About this account" data through the same request X's app makes | pictures, GIFs, videos with sound, the post's text and details beside the file, link addresses as X resolved them, the quoted post with its pictures' alt text, and the replies X sent the page as a thread file | the About request runs only while "Read account details automatically" is on; the command line uses X's public post-data endpoint without cookies |
| Reddit | comments on the page; Reddit's public `about.json` per author | pictures, galleries, videos with sound (DASH), and the post's comment tree as rendered, opening "more replies" up to your cap | one account every 2 seconds |
| YouTube | the watch page and its comments as shown | in store builds, a reference only: the thumbnail and a note with the description, chapters, the transcript when its panel is open, and the comments the page drew; no video | the command line `cmmns media fetch` hands an address you give to yt-dlp, which you run yourself; protected video is refused |
| Facebook, Instagram | the page, and what Meta shows in "About this account" or "Page transparency" when you open it; on Instagram, the post data its own app received | media the page delivered; on Instagram, every carousel item at full size, videos, alt text, caption, time, counts and the comments the page received; a likes-page thumbnail opens its post in a background tab and is saved from there | nothing behind a login you do not hold |
| Bluesky | the page, the join date and the labels Bluesky's moderation service applied | media the page delivered | no location is shown by Bluesky, so none is read |
| Threads, TikTok | the page and the lists the site's own app already loaded | media the page delivered | TikTok comments are not checked live yet |
| Mastodon servers | only on a server you turn on, after your browser asks you to allow that one server | media the page delivered | Options lists the servers and takes access back |
| Any https site | the "Download" control on media, after you turn on "Show it on every site" | the file the page loaded | protected media is never saved |

## Library capture and auto-scroll

Library capture saves a body of an account's or a creator's public work into one folder with one
index, for study and for conduct records. As of this draft it is in development and in no release.
It ships under these rules:

- it captures what the page delivered as you scroll, at the pace of a person reading, with every
  item hashed and the time recorded;
- nothing is overwritten; a later capture of the same page is a new snapshot beside the old one;
- **auto-scroll exists only in the self-distributed build.** The Chrome Web Store and Firefox Add-ons
  packages do not carry it, and a build test will fail if either does, the same way
  `tests/store-build.test.js` keeps the YouTube download hand-off out of store packages today.

Why auto-scroll stays out of store builds:

1. **Store review.** Browser stores review extensions against their own developer policies, and
   automated collection from third-party sites draws that review. The store packages are kept to
   what a person does by hand. (The text of each store's current policy has not been checked for
   this draft.)
2. **Site terms.** Many sites' terms restrict automated access. A human-paced, person-driven capture
   is the posture least likely to conflict with them.
3. **Load and pace.** An automated scroll can run faster and longer than a person, and courts and
   sites treat server load as its own issue. The self-distributed build carries it for users who
   choose it, take on the responsibility for its use, and set its pace.

## Your responsibility under each site's terms

Each platform has terms of service, developer or data policies, and rules on automated access. They
bind you as an account holder, and some may bind visitors who are not logged in. CMMNS
cannot read them for you, and the project does not say whether any use complies with them.

Before you capture at scale, or publish what you captured:

- read the terms of the sites you capture from, including any rules on automated access, scraping
  and reuse of content;
- capture while logged out where the work allows it, since some terms apply only to logged-in use
  (US courts have read at least one platform's terms that way: *Meta Platforms v. Bright Data*, N.D.
  Cal. 2024);
- remember that a post's copyright belongs to its author, not usually to the platform, and quoting,
  reporting and research have their own legal bases (`CREATORS-AND-IP.md`);
- respect a site that blocks you: do not work around a block, a rate limit or a ban;
- keep captures of private people private, and pseudonymise them in anything you share.

In the United States, accessing public pages without a login has been held unlikely to be access
"without authorization" under the Computer Fraud and Abuse Act (*hiQ Labs v. LinkedIn*, 9th Cir.
2022, after *Van Buren v. United States*, 2021). That line concerns one statute in one circuit, and
contract, copyright and other claims are separate. `project-docs/LEGAL-REVIEW-CHECKLIST.md` lists the
open questions with their sources.

## What the project does not do

The project does not run capture on anyone's behalf, operate any crawler, hold any captured
material, or offer capture as a service. Each capture is made by a user, on the user's device, from
the user's own view of the page.
