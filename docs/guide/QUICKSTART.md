<!-- writing-profile: procedure -->
# Quick start

One short recipe per feature. Each says what it does for you, the steps, and what you should see.
Install first: [INSTALL.md](../../INSTALL.md), or the two-minute version in the [README](../../README.md#install).

## See the evidence beside a reply

What it does: shows where a reply's account is based, signs of coordination, and how the reply
argues, each with its source.

1. Open a post with replies on X, YouTube, Reddit, Bluesky, Facebook, Instagram, Threads or TikTok.
2. Rest the pointer on a reply's text. With the keyboard, focus the post.
3. A window opens beside it. Press <kbd>Alt</kbd>+<kbd>R</kbd> to move into it, the arrow keys to
   switch tabs, <kbd>Esc</kbd> to close it.

You should see tabs such as Place, Coordination, Account, Posting, Language and Sources. A sign you
can open shows its source and its measured precision, or "not measured yet".

## Read the whole thread at once

What it does: tells you whether the most extreme replies come mostly from flagged accounts.

1. On a post's page, find the CMMNS panel at the side of the page.
2. Click its heading to open it.

You should see the thread report, with 95% intervals. It says "skewed" only when the intervals do
not overlap.

## Check who owns a site

What it does: names a news site's owner, owner type, country and fact-check record.

1. Rest the pointer on any link in a post, or open the toolbar menu and press **Site card for this page**.
2. To label search results, open **Options** and turn on labels for Google, Bing or DuckDuckGo.

## Find other coverage of a story (off by default)

What it does: on your click, reads the news feeds of outlets you chose and lists the ones covering
the same story, each labelled by owner type. Nothing from the page is sent.

1. Open **Options**, turn on **Other coverage** and pick outlets, or add any RSS or Atom address.
2. On a news article, open the toolbar menu, press **Site card for this page**, and open its **Other coverage** tab.

## Keep a receipt of a link (off by default)

What it does: on your click, looks up when a linked repository was created, when a domain was
registered and its first Internet Archive copy, and keeps each answer as a receipt you can check
offline.

1. Open **Options** and turn on **Evidence lookups**. The browser asks for access to web.archive.org.
2. In a post's window, press **Look up evidence**.
3. Save the chain with **Save evidence chain**, then check it anywhere with
   `node bin/radar.mjs verify evidence-chain.json`.

## Name the techniques a post uses (Reading lens)

What it does: marks the words in a post that carry a named technique, such as a question that
carries an accusation, and says which factors weighed it.

1. Open **Options** and turn on **Every reading technique**. Techniques that passed their measured
   bar show without this switch; in 3.6.0 none has passed yet, so the switch shows them all.
2. Open a post's window. Marked spans name their technique and the two factors that moved it most.

## Tell it when it is wrong

What it does: keeps your own count of right and wrong for each kind of sign, in your browser.

1. Under any sign, press **This was right** or **This was wrong**.
2. After ten marks on one kind of sign, the window shows your count beside the measured figure.

## Check a saved thread or export from the command line

What it does: runs the same rules on files on your computer, with no network.

```
node bin/radar.mjs analyze saved-thread.html
node bin/radar.mjs analyze thread.json --bundle evidence.json
node bin/radar.mjs verify evidence.json
```

Every command has its own help: `node bin/radar.mjs analyze --help`.

## Run an investigation (workbench)

What it does: keeps sources, claims, a timeline, a network and leads in one folder with its own
history, and writes signed exports a newsroom, a lawyer or a researcher can check offline.

```
node bin/radar.mjs case init "Harbour sale"
node bin/radar.mjs case add https://example.org/council-minutes --case harbour-sale
node bin/radar.mjs case claim "The council voted 7-2 to sell" --source S01 --rung documented --case harbour-sale
node bin/radar.mjs case export --profile all --case harbour-sale
node bin/radar.mjs case verify-export harbour-sale/exports/newsroom-v1
```

`node bin/radar.mjs case help` lists every command; `node bin/radar.mjs case <command> --help`
explains one, with an example.

## Use it on a Mastodon server

1. Open the server in your browser and click the CMMNS toolbar button.
2. Press **Turn on CMMNS here** and allow access when the browser asks.
3. **Options** lists the servers and takes access back.

## Check a release you downloaded

```
node scripts/verify-release.mjs <release folder>
```

It checks the signed head, the signature over `SHA256SUMS` and every file. "RELEASE VERIFIED" at the
end means every check passed. With no network, open `verify-offline.html` from the release folder.
