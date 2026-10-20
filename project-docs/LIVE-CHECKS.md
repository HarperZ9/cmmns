# Live checks still to run

Everything below was built against public descriptions of X's pages and a fixture
(`tests/fixtures/thread.html`), not a logged-in session. Each item needs a check on a live,
signed-in X page before the extension is used for real.

| # | Check | How | Status |
|---|---|---|---|
| 1a | Reddit: `shreddit-comment` with `author`, `thingid`, `[slot="comment"]` | Open a Reddit post; confirm badges | open: the agent's browser tool refuses reddit.com, so this needs a manual check |
| 1b | YouTube: `ytd-comment-view-model` or `ytd-comment-renderer` with `#author-text`, `#content-text` | Open a video with comments | pass 2026-10-18: 20 `ytd-comment-view-model` on a watch page, all with `#author-text`, 19 with `#content-text` text |
| 1 | Reply DOM: `article[data-testid="tweet"]`, `[data-testid="User-Name"]`, `[data-testid="tweetText"]`, status link with `<time>` | Open a post with replies; confirm badges appear under each name | pass 2026-10-18: badges render under every name on live X in the author's Chrome (screenshots), including a sign-up-handle flag |
| 2 | About page URL is `x.com/<handle>/about` | Open one from a profile; compare URL | pass 2026-10-18 |
| 3 | About page wording: "Account based in", "Date joined", "Connected via", username changes | Read the page text; adjust `LABELS` in `src/core/about.js` and the fixtures in `tests/about.test.js` | pass 2026-10-18: label line then value line for "Date joined", "Account based in", "Connected via" ("<country> App Store"); no username-change line shown on an account without changes, which parses as null |
| 4 | Background-tab lookup reads the page and closes the tab | Click "Look up" on three replies | open |
| 5 | Root post is the first `article` on a post page | Compare with the page | open |
| 6 | Theme detection picks X's light, dim and dark themes | Switch X's display setting | open |
| 7 | Rate: one lookup per 4 s, no X warnings or blocks | Look up 60 accounts once; watch for rate-limit pages | open |

Checked 2026-10-18 in the author's signed-in Chrome by reading page structure only (the extension itself was not installed there). Still blocked on in a browser the agent can read (the built-in browser pane or
Claude in Chrome). The agent does not enter passwords.
| 8 | Profile header testids: `UserDescription`, `UserLocation`, `UserUrl`, `UserJoinDate`, follower and following links | Scan one thread; open an account card | open |
| 9 | One-click scan: the toolbar button scans, one minimised window is reused, it closes when idle | Click Radar on a post page | open |
| 10 | X's VPN or proxy note wording on the About page | Find an account X marks; compare with `proxyNote` in src/core/about.js | open |
| 11 | Live page data: X's GraphQL User objects (legacy or core fields) reach the content script via sniff.js | Open a post; account cards fill without a scan | open |
| 12 | Automatic About data: AboutAccountQuery learned once, then repeated in the page; response carries `about_profile` | Open a post; watch "Reading About data automatically" count down | open |
| 13 | "Translated from", Parody/Commentary labels and the "Probable spam" heading as X shows them | Compare chips with the page | open |

| 14 | YouTube comment data (`commentEntityPayload.author`, `properties.publishedTime`, `toolbar.likeCountNotliked`) reaches ytdata.js | Read a /youtubei/v1/next response on a watch page | pass 2026-10-18: 8 authors read from a replies response with channel id, likes and time; displayName carries the "@handle" the page shows |
| 15 | YouTube `videoOwnerRenderer` (channel, subscribers) and `currentVideoEndpoint` in ytInitialData | Read the watch page's data | pass 2026-10-18: channel, "13.7K subscribers" and browse id read; ytInitialData keeps the first video's id after in-page navigation, so Radar keys video data by id |
| 16 | YouTube funding and context panels, paid-promotion overlay, member badge field | Open a state-funded broadcaster's video and a sponsored video | open |
| 17 | X post data: `source`, `legacy.lang`, `views.count`, `edit_control`, `birdwatch_pivot` on Tweet objects | Open a post with a Community Note; open the account card | open |
| 18 | X media fields: `extended_entities.media[].id_str`, `source_status_id_str`, `media_url_https`; `legacy.created_at` on Tweet objects | Open a post with an old video re-shared ("From @..."); compare the chip's date | open |
| 19 | Feed mode: badges on home, profile, likes and search pages without slowing scrolling | Scroll a timeline for a minute | open |
| 20 | YouTube "Altered or synthetic content" text in the page data | Open a video with the disclosure | open |
| 21 | Reddit `/user/<name>/about.json` from the content script: same-origin fetch works, fields `created_utc`, `total_karma`, `has_verified_email` | Open a Reddit thread; check the window shows the account age | open |
