# Store listing draft

A draft for the Chrome Web Store and Firefox Add-ons (AMO). The author publishes under their own
developer accounts; nothing here has been submitted. Fields marked AUTHOR need the author's input.

## Shared copy

**Name:** Radar

**Summary (Chrome 132 characters max, AMO 250):**
Evidence behind social media replies: where an account is labelled as based, signs of coordination, and a thread report. All local.

**Description:**

Radar shows the evidence behind the replies you read on X, YouTube, Reddit, Facebook, Instagram and Bluesky. Rest the pointer on
a reply and a window opens beside it.

What it shows:
- Where X labels the account as based, and a flag when a reply speaks as a local of somewhere else.
- Signs of coordination: the same text from several accounts, the same upload pushed by many,
  replies that arrive in bursts, wording that turns up in other threads you opened.
- How an account posts: its age, renames, posting hours and the apps it posts from.
- Links to outlets with their owners, and state links only where a cited report or official
  document names them.
- A thread report: whether the most extreme replies come mostly from flagged accounts, with a 95%
  interval, and "skewed" only when the intervals do not overlap.

What it never does:
- Gives verdicts. Radar never calls anyone a bot, propagandist or extremist. Every sign says where
  its data came from and what it does not prove.
- Sends your data anywhere. No server, no account, no analytics. What it keeps stays in your
  browser and you can clear it in one click.
- Guesses who runs an account or anyone's demographics.
- Uses political side as an input. The same words score the same whoever they target.

How sure it is: each sign shows its measured precision from Radar's published evaluation, or
"not measured yet" where none exists.

Keyboard: focus a post to open its window, Alt+R to move into it, Esc to close it.

**Category:** Chrome: Social & Communication. AMO: Social & Communication.

**Language:** English.

**Homepage URL:** AUTHOR (the repository or a site page, once public).

**Support URL:** AUTHOR (the repository's issues page, once public).

**Privacy policy URL:** AUTHOR (PRIVACY.md at a public address).

## Chrome Web Store fields

| Field | Value |
|---|---|
| Package | `dist/radar-chrome-<version>.zip` from `npm run package` |
| Single purpose | Shows evidence about the accounts and posts in social media threads the user is reading. |
| Permission: `storage` | Keeps settings, account details the site disclosed, and thread summaries in the browser, for the retention the user sets. |
| Host permission: x.com, twitter.com | Reads replies and the account details X shows on the page; repeats X's own About request for reply authors. |
| Host permission: youtube.com | Reads comments and the channel data YouTube loaded for the page. |
| Host permission: reddit.com | Reads comments and Reddit's public account data for comment authors. |
| Host permission: facebook.com, instagram.com | Reads comments and the account transparency details Meta shows when the user opens them. |
| Host permission: bsky.app | Reads replies and the account data and moderation labels the Bluesky app loaded. |
| Remote code | No. All code ships in the package. |
| Data usage disclosure | Collects nothing. Website content is read and kept locally only; none is transmitted to the developer or third parties. |
| Certifications | Not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending. |
| Visibility | AUTHOR (public or unlisted) |
| Developer account and verified publisher | AUTHOR |

## Firefox Add-ons (AMO) fields

| Field | Value |
|---|---|
| Package | `dist/radar-firefox-<version>.xpi` (unsigned; AMO signs it) |
| Add-on id | `radar@local` today. AUTHOR: choose a permanent id before the first upload; it cannot change later. |
| Minimum version | Firefox 128 (main-world content scripts) |
| Source code submission | Not needed: no minified or generated code beyond `core.bundle.js`, which `npm run build` makes from `src/core`. Upload the source archive anyway so reviewers can rebuild it. |
| Licence | FSL-1.1-MIT (AMO lists it as "Other"; link the LICENSE file) |
| Data collection permissions | None |
| Notes to reviewer | Load the package and open `tests/fixtures/thread.html` through `node scripts/serve.mjs` to see the window without an X account. |

## Screenshots

Chrome: 1280x800 or 640x400, up to 5. AMO: any size, 1280x800 recommended. Each uses the invented
fixture thread or the author's own posts; never another person's real account.

1. The window beside a reply on the fixture thread, light theme: the glance line, the area strip,
   a "speaks as local, labelled elsewhere" sign opened with its evidence, "Does not prove" and
   "Measured".
2. The same window in X's dim theme.
3. The Account tab with the 24-hour posting clock and posting apps.
4. The thread report panel with the flagged shares and intervals.
5. The first-run page: what Radar shows, what it never does, the site switches.

Promotional tile (Chrome, 440x280): the aperture icon on the ink ground with the name. AUTHOR to
approve.

**Icon:** `src/ext/icons/radar-128.png` (source `assets/icons/radar.svg`).

## Before submitting

- Version bumped to the release version in `manifest.json` and `package.json`.
- `npm test` green, `npm run build` leaves no diff, `npm run package` hashes recorded.
- PRIVACY.md published at a stable public address.
