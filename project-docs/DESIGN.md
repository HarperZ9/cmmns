# Design: provenance badges and the thread norm report

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
