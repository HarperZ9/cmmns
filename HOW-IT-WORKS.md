# How Daylight Commons works

Last updated: 2026-10-23.

Daylight Commons is a browser extension. Rest the pointer on a reply on X, Reddit, YouTube,
Bluesky, Mastodon and a few other sites, and a window opens beside it. The window shows where the
platform places the account, signs of coordination, how the post argues, and who stands behind a
linked outlet. Each sign names its source and says what it does not prove. Daylight Commons never
calls anyone a bot, a propagandist or an extremist, and it never decides for you.

## The path a reply takes

Everything up to the window happens in your browser. The reader takes only what the site already
shows you, and what the site discloses about accounts. The rules turn that into signs. Political side
is never an input, and a test checks that the same words count the same whichever side they target.

Two features reach further, and only after you turn them on and click. Evidence lookups send the
repository names and web domains a post links to GitHub, rdap.org and the Internet Archive. Other
coverage reads the news feeds of outlets you chose and sends nothing from the page. Each says what it
sends and to whom before the first use.

## Receipts you can check without us

When an evidence lookup answers, Daylight Commons keeps the answer as a receipt: what the source said,
its address, the time, a hash of the answer and what the fact does not prove. Each receipt is
appended to a hash chain in your browser, with a Merkle root over the chain and a proof for each
receipt. "Save evidence chain" downloads the whole chain as one file.

Anyone holding that file can check it offline, with the command line tool or the Analyse a file page
inside the extension. The check fails when a receipt was changed, removed or reordered. A passing
check shows the chain is the one this browser recorded. It does not show that a source told the
truth, and whoever holds the device could start a new chain.

## Run it on us

The screen recording on this page runs the evidence lookup on a synthetic post that links Daylight
Commons' own repository and site. The answers are real: GitHub's creation date for the repository,
and the Internet Archive's first capture of the site. The site is a page on github.io, a hosting
service, so Daylight Commons does not ask RDAP when github.io was registered. That date would say
nothing about this site.

## Limits

- Platform labels can be wrong. VPNs and travel move them, and users can broaden them to a region.
- Daylight Commons sees only the replies the site chose to show, in the site's order.
- Most signs are not measured yet and say so. The measured ones show their precision with a 95%
  interval on the measurement page.
- The launch campaign lens has no measured precision. Until a media lawyer has reviewed its wording,
  it names no company: every claim reads "this launch".
- A site redesign can break a reader until Daylight Commons is updated. The extension says so when
  it reads nothing where it should.
