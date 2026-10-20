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

### State links: what shipped on 2026-10-18

`src/ext/state.json` holds 1,604 rows, built by `scripts/state-build.mjs`:

- **977 report rows**, from 17 primary documents: Meta threat reports (2022 to 2026), OpenAI threat reports, the US Justice Department's 2024 Doppelganger affidavit and a 2024 State Department fact sheet. `scripts/verify-reports.mjs` downloads each document and confirms every domain or handle appears verbatim. On 2026-10-18 it found 977 of 977. Each row says who the report blames, in the report's own words: a government (86 rows), a commercial firm (217) or individuals or a group (674). A firm is never upgraded to a government. By country: Russia 698, China 131, Iran 44, Togo 29, Bangladesh 18, the United States 11, Vietnam 10, Israel 8, Venezuela 7, Türkiye 7, and 5 more with under 5 each. The counts follow what the reports published, which is not a measure of how much each country does. For example, Meta's 2022 report on a US military-linked network named no domains, so it adds no rows.
- **627 Wikidata rows.** An outlet counts as state-owned when Wikidata classes it as state media, or when its chain of parent organisations and majority owners reaches a national government body (370 rows). Regional and city government bodies are labelled "regional govt" (136 rows), and public broadcasters get their own label (121 rows). Sovereign wealth funds, pension funds, investment funds and universities never count as controllers, and governments' own .gov-style websites are left out.

Known gaps:

- Wikidata files Chinese party media (Global Times, China Daily) under Chinese Communist Party bodies, which are not government entities, so under the same rule for every country those two outlets get no chip.
- Press TV, TASS and Kan are missing because of how Wikidata models them.
- The State Department's 2020 foreign-mission designations of Chinese outlets could not be read.
- Google Threat Analysis Group (TAG) bulletins have not been searched yet.
- EU sanctions name RT and Sputnik without giving domains.

`data/state-reports.README.md` lists every document, the exclusions and the judgment calls.

### Source trails and designations (2026-10-18, later)

**Source trails** (`src/core/trail.js`) follow a post upstream through pointers X itself records: the post it quotes or reposts, the earlier post its media was lifted from, the media's first upload time (from the media id), and the real address behind each t.co link. Radar keeps a 30-day local log of which posts carried each upload and link, so the card can say "in 6 posts by 5 accounts you have seen; first by @x at 01:00 UTC". The panel's Upstream section counts which accounts and sites a thread's material leads back to. The trail stops at the first upload: who filmed it, and who paid for it, is not in the data.

**Designations** (`data/state-designations.json`): official documents in which a government or the EU classifies a named outlet as state-controlled. These are the US State Department's foreign-mission designations (China 2020, Russia 2024), EU Annex XV broadcasting suspensions, UK sanctions, US Treasury (OFAC) on IRIB, and the EU on Belteleradio. They name outlets and rarely give domains. `scripts/designations-match.mjs` maps a name to its official sites only on an exact Wikidata label or alias match in the same country, and each row cites the designation and the Wikidata match separately. The chip reads "govt-designated", and its does-not-prove line says a designation records one government's assessment, not an independent finding.

**Verification.** `scripts/verify-reports.mjs` checks every report row and every designated outlet name against its cited document. It falls back to curl, the EUR-Lex PDF route and Internet Archive copies when a host blocks scripted readers. On 2026-10-18 it found 1,171 of 1,171.

### History page (2026-10-18)

Radar saves a small snapshot of each thread report locally (`pb.history.v1`, 60 days, at most 600 threads). `src/core/history.js` pools those snapshots with the connections log and the trail log. The history page shows the pooled flagged share with a Wilson interval, the upstream "funnel" (the accounts and sites that the quotes, lifted media and links in the user's threads lead back to, counted by threads, and how concentrated they are), recurring accounts, uploads carried by three or more accounts, a per-day flagged share, origins and state links. The page states its limit: these totals cover only what the user opened, in platform-ranked order, so they are not a sample of any platform. The concentration figure is shown only when there are more than five upstream sources.

### The hover window (2026-10-19)

Radar draws nothing on the page. Resting the pointer on a post for 450 ms fades in a window beside it: to the right of the timeline column when there is room, else to its left, else below or above the post. It stays while the pointer is on the post or the window, fades out 260 ms after the pointer leaves, and stays open after a click inside it until Escape or a click elsewhere. Alt+R opens it for a focused post. The first lines are a glance: the account, where the platform places it (or its age where the site shows no location), the warn-level signals by name, and how many more signs are below. The full card follows.

Radar describes how an account operates. It does not try to work out who runs an account: no linking accounts across platforms, no guessing names, employers, ages or homes, no reverse search of profile photos, and no payment or tip-jar handles. Those steps would identify people, most of whom are ordinary users, and they add nothing to the evidence that an operation exists.
