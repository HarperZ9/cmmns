# Live checks still to run

Everything below was built against public descriptions of X's pages and a fixture
(`tests/fixtures/thread.html`), not a logged-in session. Each item needs a check on a live,
signed-in X page before the extension is used for real.

| # | Check | How | Status |
|---|---|---|---|
| 1a | Reddit: `shreddit-comment` with `author`, `thingid`, `[slot="comment"]` | Open a Reddit post; confirm badges | open: the agent's browser tool refuses reddit.com, so this needs a manual check |
| 1b | YouTube: `ytd-comment-view-model` or `ytd-comment-renderer` with `#author-text`, `#content-text` | Open a video with comments | pass 2026-10-18: 20 `ytd-comment-view-model` on a watch page, all with `#author-text`, 19 with `#content-text` text |
| 1 | Reply DOM: `article[data-testid="tweet"]`, `[data-testid="User-Name"]`, `[data-testid="tweetText"]`, status link with `<time>` | Open a post with replies; confirm badges appear under each name | pass 2026-10-18: 11 articles on a post page, each with User-Name link, tweetText and a time inside the status link |
| 2 | About page URL is `x.com/<handle>/about` | Open one from a profile; compare URL | pass 2026-10-18 |
| 3 | About page wording: "Account based in", "Date joined", "Connected via", username changes | Read the page text; adjust `LABELS` in `src/core/about.js` and the fixtures in `tests/about.test.js` | pass 2026-10-18: label line then value line for "Date joined", "Account based in", "Connected via" ("<country> App Store"); no username-change line shown on an account without changes, which parses as null |
| 4 | Background-tab lookup reads the page and closes the tab | Click "Look up" on three replies | open |
| 5 | Root post is the first `article` on a post page | Compare with the page | open |
| 6 | Theme detection picks X's light, dim and dark themes | Switch X's display setting | open |
| 7 | Rate: one lookup per 4 s, no X warnings or blocks | Look up 60 accounts once; watch for rate-limit pages | open |

Checked 2026-10-18 in the author's signed-in Chrome by reading page structure only (the extension itself was not installed there). Still blocked on in a browser the agent can read (the built-in browser pane or
Claude in Chrome). The agent does not enter passwords.
