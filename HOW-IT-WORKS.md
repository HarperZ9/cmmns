# How CMMNS works

Last updated: 2026-10-23.

CMMNS (formerly Daylight Commons, and Radar before that) is a browser extension. Rest the pointer on a reply on X, Reddit, YouTube,
Bluesky, Mastodon and a few other sites, and a window opens beside it. The window shows where the
platform places the account, signs of coordination, how the post argues, and who stands behind a
linked outlet. Each sign names its source, so you can open it and judge for yourself.

## The path a reply takes

Everything up to the window happens in your browser. The reader takes only what the site already
shows you, and what the site discloses about accounts. The rules turn that into signs, and the same
words count the same whichever side they target.

Two features reach further, and only after you turn them on and click. Evidence lookups send the
repository names and web domains a post links to GitHub, rdap.org and the Internet Archive. Other
coverage reads the news feeds of outlets you chose and sends nothing from the page. Each says what it
sends and to whom before the first use.

## Receipts you can check without us

Click an evidence lookup and the answer comes back as a receipt: what the source said, its
address, the time, and a hash of the answer. Each receipt joins a hash chain in your browser, with a
Merkle root over the chain and a proof for each receipt. "Save evidence chain" downloads the whole
chain as one file.

Hand that file to anyone. They can check it offline, with the command line tool or the Analyse a
file page inside the extension. Change one receipt, drop one or swap two, and the check fails. A
pass tells you the chain is the one this browser recorded. To know whether a source was right, open
the source the receipt names.

## Run it on us

The recording on this page points the evidence lookup at a made-up post that links CMMNS
Commons' own repository and site. The answers are live: GitHub's creation date for the repository,
and the Internet Archive's first capture of the site. The site sits on github.io, a shared host, so
the lookup skips RDAP there. Its registration date would belong to GitHub.

## Before you rely on it

- The window sees the replies the site chose to show, in the site's order.
- Platform labels follow the connection. A VPN or a trip moves them, and users can widen them to a
  region.
- The measurement page lists which signs have a measured precision, each with a 95% interval. The
  window marks every other sign "not measured yet".
- The launch campaign lens has no measured precision yet. Until a media lawyer has reviewed its
  wording, every claim reads "this launch" and names no company.
- A site redesign can break a reader until the next update. The extension says so when it reads
  nothing where replies should be.
