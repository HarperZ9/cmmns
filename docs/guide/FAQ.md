<!-- writing-profile: readme -->
# Questions and answers

**What does CMMNS do for me?**
It shows the evidence behind the replies you read: where an account is based by the site's own
label, signs that several accounts post the same words, what fact-checkers said about a similar
claim, and who owns a linked site. Each sign names its source, so you can check it and decide.

**Does it tell me who is a bot or a propagandist?**
No. It describes posts and accounts and leaves those labels to you. A sign is a reason to look
closer.

**Does it send my browsing anywhere?**
No, by default. It reads the page in your browser and asks only the site you are on for account
details. Two features reach further, both off until you turn them on and click: Other coverage
reads the news feeds of outlets you chose, and evidence lookups send a post's linked repository
names and domains to GitHub, RDAP and the Internet Archive. There is no account, server or analytics.
[PRIVACY.md](../../PRIVACY.md) lists everything it keeps.

**How do I delete what it kept?**
Options, then **Clear all CMMNS data**. Account details expire after 14 days and thread
history after 60, and you can shorten both.

**How accurate is it?**
Each sign shows its measured precision with a 95% interval where it has been measured against posts
people checked, and "not measured yet" where it has not. The measurement page has the results and the
data behind them: [transparency](https://harperz9.github.io/cmmns/transparency.html).

**Why are the Reading lens techniques off?**
A technique shows by default only after it is right at least 80% of the time on posts it was never
tuned on, from at least 3 hits. None has reached that yet: question insinuation was right on both of
its 2 held-out hits in 3.5.0, one short of the rule. **Every reading technique** in Options shows them
all now, unmeasured.

**Does political side change what it shows?**
No. Side is never an input. The same words count the same whoever they target, and tests run every
targeted rule over every named group, party and country to check that the answer does not change.

**Which sites does it work on?**
X, YouTube, Reddit, Bluesky, Facebook, Instagram, Threads and TikTok, plus any Mastodon server you
turn it on for. Site cards work on any link.

**Why is it not in the Chrome Web Store or Firefox Add-ons yet?**
The store listings are prepared and wait for the author's developer accounts. Until then, install
from a release ([INSTALL.md](../../INSTALL.md)). Chrome loads it in Developer mode; release Firefox
keeps it for one session until Mozilla signs it.

**How do I know a download is genuine?**
Each release is signed. `node scripts/verify-release.mjs <folder>` checks the signature and every
file, or open `verify-offline.html` from the release with no network. Compare the key id with one
you got another way.

**Is it free?**
Yes. The code is AGPL-3.0, and the data and docs are CC BY 4.0.

**What is the workbench for?**
`cmmns case` keeps an investigation in one folder: sources with their hashes and archive copies,
claims with how well each is supported, a timeline, a network of who quoted whom, and leads. Its
exports are signed, so a newsroom, a lawyer or a researcher can check them offline.

**Something looks wrong. Where do I report it?**
Press **This was wrong** under the sign for your own count, and open an issue at
[github.com/HarperZ9/cmmns/issues](https://github.com/HarperZ9/cmmns/issues)
for a fix. Security reports go through [SECURITY.md](../../SECURITY.md).
