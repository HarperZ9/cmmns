# Live checks still to run

Everything below was built against public descriptions of X's pages and a fixture
(`tests/fixtures/thread.html`), not a logged-in session. Each item needs a check on a live,
signed-in X page before the extension is used for real.

| # | Check | How | Status |
|---|---|---|---|
| 1 | Reply DOM: `article[data-testid="tweet"]`, `[data-testid="User-Name"]`, `[data-testid="tweetText"]`, status link with `<time>` | Open a post with replies; confirm badges appear under each name | open |
| 2 | About page URL is `x.com/<handle>/about` | Open one from a profile; compare URL | open |
| 3 | About page wording: "Account based in", "Date joined", "Connected via", username changes | Read the page text; adjust `LABELS` in `src/core/about.js` and the fixtures in `tests/about.test.js` | open |
| 4 | Background-tab lookup reads the page and closes the tab | Click "Look up" on three replies | open |
| 5 | Root post is the first `article` on a post page | Compare with the page | open |
| 6 | Theme detection picks X's light, dim and dark themes | Switch X's display setting | open |
| 7 | Rate: one lookup per 4 s, no X warnings or blocks | Look up 60 accounts once; watch for rate-limit pages | open |

Blocked on: a signed-in X session in a browser the agent can read (the built-in browser pane or
Claude in Chrome). The agent does not enter passwords.
