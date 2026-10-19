# Design: Radar (provenance badges and the thread norm report)

## The problem
Coordinated accounts shape what readers think "people like them" believe. Two patterns matter:
accounts that speak as locals of a place they are not based in, and accounts that inject unusually
extreme rhetoric so it reads as normal for a group. A reader scrolling replies cannot check either.

## What the tool shows
1. **Per reply, evidence badges.** Where the platform labels the account as based, account age,
   username changes, the sign-up handle pattern, a "speaks as local, labelled elsewhere" mismatch,
   and "same text as other replies". Each badge opens a popover with its evidence and what it does
   not prove.
2. **Per thread, the norm report.** The flagged share among the most extreme replies against the
   flagged share among the rest, each with a 95% Wilson interval. It says "skewed" only when the two
   intervals do not overlap.

## What it never does
- Call anyone a bot, propagandist, extremist or liar.
- Use political side or stance as an input. `tests/rhetoric.symmetry.test.js` holds the rhetoric
  scoring to identical treatment of the same sentence about 25 groups from every direction, plus
  matched pairs of coded slogans.
- Flag a person for extremity. Rhetoric scores only feed the thread-level comparison.
- Collect IP addresses or anything the platform does not show the viewer. No server, no telemetry.

## Data sources
| Platform | Location signal | Status |
|---|---|---|
| X | "About this account": inferred country or region, join date, username changes, how the app was installed (rolled out November 2025) | milestone 1 and 2 |
| Facebook, Instagram | "Based in" on some high-reach accounts; Page Transparency | milestone 3 |
| YouTube | self-declared channel country only | milestone 3, behaviour signals |
| Reddit | none | milestone 3, behaviour signals |

## How account data is read on X
- **Passive:** whenever the user opens an account's About page, the reading is cached locally.
- **On request:** "Look up" on a reply, or "Look up N more" in the thread report, opens that
  account's About page in a background tab, reads what X renders, and closes the tab. One account
  every 4 seconds, at most 60 per click. No private API calls.

## Detectors
- **Mismatch** (`src/core/mismatch.js`): explicit local-claim patterns ("here in X", "as a
  Frenchman", "we Americans", "ici en France", "nous les Français") compared with the label at
  country or region level.
- **Duplicates** (`src/core/similarity.js`): word 3-gram MinHash with banding, confirmed by exact
  Jaccard of at least 0.6, across distinct authors, ignoring replies under 6 words.
- **Rhetoric** (`src/core/rhetoric.js`): four marker families (dehumanise, violence, conspiracy,
  absolutist) with negation handling. Policy positions such as deportation under law score zero.
- **Report** (`src/core/report.js`): as above; needs at least 10 extreme replies.

## Known limits
- X's labels can be wrong; VPNs and travel move them; users can broaden them to a region.
- The local-claim patterns are English and a little French. Other languages read as "no claim".
- The rhetoric lexicon is English and hand-built. It needs precision and recall measured on
  labelled data before anyone relies on the report (EVALUATION.md).
- The report sees only the replies X chose to render and the accounts that were looked up.

## Ownership table
`src/ext/owners.json` is built from Wikidata (CC0) by `scripts/owners-build.mjs`: news outlets,
broadcasters, news websites and platforms with an official website and a current owner (P127 with
no end date, not deprecated; owners who have died or companies that were dissolved are dropped).
Built 2026-10-18: 7,374 domains, 3,602 with an X handle. The background worker holds it; pages ask
only for the domains and handles they show. Known limits: Wikidata lags sales, some rows name a
division rather than the parent company, and one domain can map to an edition rather than the
main outlet. Rebuild with the author's approval and review the diff before committing.

## State links and media provenance (2026-10-18)

**State links** (`src/core/state.js`, built by `scripts/state-build.mjs`). A link or account gets a
state chip only when a cited source ties it to a government. There are two bases: an ownership
chain on Wikidata that ends at a government or state agency, or a mention in a published
influence-operation report (platform threat reports, government filings, sanctions listings),
with the report's title, URL and date. The same rule applies to every country. Radar does not
attribute a reply, account or narrative to a state from its wording or behaviour. That would
present a guess as a finding, and coordination looks the same whether a state, a PR firm or a
fan group runs it. The table ships empty until the build runs with the author's approval.

**Media provenance** (`olderMedia` in `src/core/xdata.js`). X ids encode their creation time, so
a media id dates the first upload, and a reused source post id dates the original post. Media
uploaded two or more days before the post that shows it gets a "media from <date>" chip. Every
media chip offers reverse image searches (Google Lens, TinEye, Bing, Yandex), and nothing is sent
until the user clicks one. Radar cannot tell real media from AI-made media. It shows only what
the platform or uploader discloses, such as YouTube's "Altered or synthetic content" label.
