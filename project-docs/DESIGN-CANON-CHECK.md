# Design canon check

Radar follows the design canon of the author's site, harperz9.github.io. This file turns that canon
into values a reviewer can check, records the audit of 2026-10-21, and says what changed.

## Sources

- `DESIGN-RULES.md` on `origin/main` of HarperZ9/HarperZ9.github.io, dated 2026-09-06.
- The site's delivered tokens: `system/tokens.css` and `system/plate.css` on the same commit.
- The live site, read and screenshotted on 2026-10-21: the home page, `flywheel.html`, and the
  Flywheel docs at `/flywheel/docs/`.
- The author's rulings on the site's design, kept in the workspace memory: the live site is the
  canon, the telos-v2 documents are history only, and reader-facing surfaces carry no hashes,
  seeds or machine metadata in the default view.

## The checklist

### Type

| Check | Value |
|---|---|
| Two faces, distinct roles | Hanken Grotesk for words. Conso for figures standing alone and for code. No third family. |
| Display heading | Hanken Grotesk 780, tracking -0.035em, line height 0.98, size `clamp(2.4rem, 1.3rem + 4vw, 4.75rem)` |
| Section heading | Hanken Grotesk 720, tracking -0.022em, line height about 1.1 |
| Sub heading | Hanken Grotesk 680, tracking -0.012em |
| Body | 17px (1.0625rem), line height 1.6, measure 38rem |
| Labels and meta | 14px and 15px, never smaller than 14px for secondary text |
| Case | Mixed case. No tracked uppercase labels or eyebrows. |
| Sentences with figures | Stay in Hanken Grotesk with tabular figures. Conso does not set whole sentences. |

### Colour

| Token | Light (bone) | Dark (void) |
|---|---|---|
| paper | #ebe5d8 | #060608 |
| inset, panel, raised | #e4ddcd, #e2dac9, #d8cfbc | #0c0c0f, #111114, #1a1a1e |
| ink | #16130f (14.7:1) | #ece5d6 |
| soft, muted | #4a443b, #5f584d | #b8b0a0, #958e80 |
| line, line strong | #c9bfab, #7b7262 | #29282c, #6f6a61 |
| verified | #0a6b61 | #63d4ce |
| drift | #8f3a19 | #e29472 |
| unverifiable | #4e4d85 | #b3b1e6 |
| hot, focus | ink | ink |

- Colour carries a verdict only, and always beside a word that says the same thing.
- One hot mark per view, and the hot mark is ink: it names no verdict.
- Ink on a calm ground. The registration field (small crosses on a 96px pitch) runs in the
  gutters; reading text sits on flat paper.
- Forced colours map every token to system colours; print is black on white.

### Space, rules and shape

| Check | Value |
|---|---|
| Spacing scale | 0.25, 0.5, 0.75, 1, 1.5, 2, 3 and 4.5rem |
| Gutter | `clamp(1rem, 4vw, 2.5rem)` |
| Section opening | A 1px hairline in `line`, with a 15px registration cross in ink at its left end |
| Tables | 2px ink rule under the head, 1px hairlines between rows, figures right-aligned |
| Radius | 0 for surfaces, 2px for controls. No pills and no rounded cards. |
| Buttons | Primary filled ink with paper text; secondary outlined in `line strong`. 44px tall on pages. |
| Disclosure | A plus that turns to a minus |
| Structure | No generic card grid as the main structure; no glassmorphism; no gradient text |

### Motion

Motion explains a change. Every transition honours `prefers-reduced-motion`, and the options
page's "Reduce motion" switch removes it entirely. Content never waits on an animation.

### Iconography and art

The aperture: a luminous orb in fine concentric line-work, drawn on the void (#060608) in bone
(#ece5d6, core #fff6e6), with a #6f6a61 rim. The reading state adds one lit bone mark on the outer
ring; the paused state closes the orb to a ring on #29282c. The spectrum lives only in art.

### Voice

Feature first: say what the reader gets, then the limit beside it. No em dashes. Honest nulls
stay ("not measured yet"). No local paths, gate or operator language on public pages. Every
public page has a route back to the author's site.

## How Radar applies it

- `src/ext/canon.css` holds the site's tokens and base rules. Every Radar page loads it before its
  own stylesheet. The transparency and privacy pages carry it inline, so `docs/` works alone.
- The window and panel on social sites (`badges.css`) use the same values under `--pb-*` names.
  The ground adapts to the site: a bone sheet (#f1ece1) on X light, the void (#0a0a0d) on X dark,
  and X's own blue-grey (#1e2732) on dim. Type, rules, square shapes and colour logic stay the
  canon's. `--pb-hot` is the canon's drift colour and marks only signs worth a look.
- The window's two faces reach the page as bytes from the worker (`fonts.js`, `background.js`)
  under the names "Radar Hanken" and "Radar Conso". The page never loads an extension URL, so no
  resource is web-accessible and the site's own fonts never change. If the fonts fail, the window
  uses the system sans and monospace.
- `tests/canon.test.js` fails on an em dash in anything a user reads, on a page that skips the
  shared tokens, on a colour outside the canon's set, and on a pill radius or an uppercase label.

## Audit, 2026-10-21

Screenshots of every surface before and after, light and dark, and the window and panel on X's
light, dim and dark themes, were taken from the fixture pages (`tests/fixtures/page.html` and
`tests/fixtures/thread.html`) and inspected.

| Surface | Deviation found | Fixed |
|---|---|---|
| All pages | Own palette (#f7f6f2 ground, #14181c ink, orange #b93c0a hot mark), not the site's bone and void | Yes: canon tokens |
| All pages | Headings at 700 with no tracking; no display scale | Yes: 780, 720, 680 with the site's tracking and sizes |
| All pages | Pill buttons (999px) and rounded boxes (8 to 16px) | Yes: square, 2px controls |
| All pages | Sections opened on a plain border, no registration cross | Yes |
| All pages | Links underlined at 400 | Yes: 600, as on the site |
| History | System font, X-blue links (#1d9bf0), orange bars, card grid of rounded boxes, tracked uppercase labels | Yes: rebuilt on the canon, one column of ruled sections |
| Popup | Own palette, system font fallback, pill buttons | Yes |
| Lessons | Tracked uppercase example labels, rounded boxes | Yes |
| Self-check | Each post in a rounded card | Yes: ruled list |
| Feed page | Rounded tracks and orange interval marks | Yes: square tracks, drift interval marks |
| Window and panel on X | Took X's font (Chirp) instead of the canon's faces; tracked uppercase section labels; pills and rounded boxes; orange hot colour; triangle disclosure glyphs | Yes |
| Options and lessons | Whole measured sentences set in Conso | Yes: Hanken Grotesk with tabular figures |
| Transparency and privacy pages | Own palette, plain rules, no route back to the site | Yes |
| Aperture art and icons | Cool blue-grey palette (#14181c, #8b98a5, #cfd6dc) and an orange reading mark | Yes: void and bone, a bone reading mark |
| Thread card image | Cool palette | Yes: bone and ink |
| Thread card page | The worker opened `card.html`, which does not exist | Yes: opens `evidence-card.html` |

## Consistency with the author's other public work

- **Product pages.** `flywheel.html` leads each measured figure with one plain sentence, draws the
  interval as a figure, and keeps counts and hashes in a collapsed "how we know" detail. Radar's
  transparency page still gives every figure inline as "precision (k of n; low to high)" in dense
  tables. Matching the product page means a lead figure per sign family, an interval figure, and
  the counts in a disclosure. Not done in this pass; it changes the page generator and its tests.
- **Spec at a glance.** The product pages end with a two-column spec table (bold first column).
  Radar's public pages have none; a short spec table (sites, permissions, data kept, network use)
  would match.
- **Flywheel docs.** The docs theme at `/flywheel/docs/` uses green links and tracked uppercase nav
  labels, which the site's own rules ban. Radar follows the site's product pages, not that theme.
- **Hosting.** `https://harperz9.github.io/radar/` returned 404 on 2026-10-21. The store listing
  and the privacy URL depend on it.
- **Hashes on the thread card.** The card image prints a SHA-256 hash so a copy can be checked.
  The site's ruling moves hashes out of the default view. This needs the author's call, since the
  hash is the card's check.
