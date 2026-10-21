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
| 12 | Automatic About data: AboutAccountQuery learned once, then repeated in the page; response carries `about_profile` | Open a post; watch "Reading About data automatically" count down | pass 2026-10-21: on a 154-reply post the thread report read 19 of 19, then 24 of 24 accounts with no manual step; the hover window showed "Based in" and join month |
| 13 | "Translated from", Parody/Commentary labels and the "Probable spam" heading as X shows them | Compare chips with the page | open |

| 14 | YouTube comment data (`commentEntityPayload.author`, `properties.publishedTime`, `toolbar.likeCountNotliked`) reaches ytdata.js | Read a /youtubei/v1/next response on a watch page | pass 2026-10-18: 8 authors read from a replies response with channel id, likes and time; displayName carries the "@handle" the page shows |
| 15 | YouTube `videoOwnerRenderer` (channel, subscribers) and `currentVideoEndpoint` in ytInitialData | Read the watch page's data | pass 2026-10-18: channel, "13.7K subscribers" and browse id read; ytInitialData keeps the first video's id after in-page navigation, so Radar keys video data by id |
| 16 | YouTube funding and context panels, paid-promotion overlay, member badge field | Open a state-funded broadcaster's video and a sponsored video | open |
| 17 | X post data: `source`, `legacy.lang`, `views.count`, `edit_control`, `birdwatch_pivot` on Tweet objects | Open a post with a Community Note; open the account card | open |
| 18 | X media fields: `extended_entities.media[].id_str`, `source_status_id_str`, `media_url_https`; `legacy.created_at` on Tweet objects | Open a post with an old video re-shared ("From @..."); compare the chip's date | open |
| 19 | Feed mode: badges on home, profile, likes and search pages without slowing scrolling | Scroll a timeline for a minute | open |
| 20 | YouTube "Altered or synthetic content" text in the page data | Open a video with the disclosure | open |
| 21 | Reddit `/user/<name>/about.json` from the content script: same-origin fetch works, fields `created_utc`, `total_karma`, `has_verified_email` | Open a Reddit thread; check the window shows the account age | open |

| 22 | Live rhetoric recall on a real thread | Open a political reply thread; compare the report's extreme count with a reading of the replies | 2026-10-21, before the fix: a 154-reply post about the riots in France; of 44 replies loaded, 26 were French that X had not translated, 16 English, 1 Chinese, 1 Spanish. The report said 0 extreme replies although one English reply proposed exterminating a group. Causes: violence grammar matched only the passive form, and no French markers. Fixed in `rhetoric.js` (active calls, carried-over fate) and `rhetoric-fr.js`, covered by `tests/rhetoric.recall.test.js`. Recheck on the same post after reloading the extension: open |
| 23 | Hover window on live X | Hover a reply | pass 2026-10-21: area strip, tabs and "Compared with this thread" render; thread showed 10 of 19 accounts flagged, which needs a look at which flags fire (possible over-flagging) |
| 24 | Rate pacing on live X | Read one long thread, then a second load | 2026-10-21, before the fix: after about 40 automatic About lookups across two loads, X answered 429 and Radar paused (the pause worked). Handles that got the 429 were not retried in that page session. Fixed: pacing now follows `x-rate-limit-remaining` and `x-rate-limit-reset`, keeps 5 requests in reserve for the viewer's own use of X, and retries a 429 or timeout up to twice (`src/core/pace.js`, `tests/pace.test.js`). Header names are X's documented v1.1 ones; that GraphQL returns them is unverified until the recheck. Recheck after reloading the extension: open |

## Facebook, Instagram, Bluesky (stream B, 2026-10-21)
Checked in the author's signed-in Chrome by reading page structure only, with the extension not installed. Nothing was posted, liked or followed. Fixtures are synthetic (`tests/fixtures/meta.html`).

| # | Check | How | Status |
|---|---|---|---|
| 25 | Facebook comments: `[role="article"]` labelled "Comment by NAME TIME"; author link `profile.php?id=` or a vanity path; permalink with a numeric `comment_id`; text in `div[dir="auto"]`; replies are separate articles, not nested | Open a public Page post with comments | pass 2026-10-21: 20 comment articles on a public Page post, every one with both author link shapes, a 16 to 17 digit `comment_id`, and one `div[dir="auto"]` body (one image-only comment had none) |
| 26 | Facebook reply wording "Reply by" and non-English labels | Expand replies; switch Facebook's language | open: the adapter also accepts any article holding a `comment_id` link |
| 27 | Facebook Page transparency text: "Page created", "Changed name to", "Primary country/region location for people who manage this Page" | Open a Page's transparency view | open: on 2026-10-21 the `about_profile_transparency` view rendered empty for two large Pages, and their About tab listed no transparency item. Parser built from Meta's public description |
| 28 | Instagram comments: each has a permalink `/<owner>/p/<code>/c/<id>/` around a `<time datetime>`; the comment is the largest box holding one such link; author link `/<name>/`; body is the first plain `span[dir="auto"]` | Open a public post | pass 2026-10-21: 16 comment permalinks on a post, each box with one author link, the time span, the body span and its Reply button |
| 29 | Instagram "About this account" dialog: "Date joined", "Account based in", "Verified" as label then value lines | Profile menu, About this account | pass 2026-10-21 on a large public account. "Former usernames" and the "Not shared" value are open: neither was on that account |
| 30 | Instagram About data in the page's own requests | Watch the request when the dialog opens | 2026-10-21: it arrives as a Bloks UI payload from `/async/wbloks/fetch/`, not as data. Radar reads the rendered dialog instead and does not repeat the request |
| 31 | Bluesky thread: `data-testid="postThreadItem-by-<handle>"`, text in `[data-word-wrap]`, post link `/profile/<handle>/post/<rkey>`; the app requests `app.bsky.unspecced.getPostThreadV2` | Open a public thread | pass 2026-10-21: 26 thread items on a public post; the V2 thread request seen in the page's resource list |
| 32 | Bluesky response fields `author.createdAt`, `author.labels`, `author.verification` reach bsky.js | Read one getPostThreadV2 response | open: fields from the public lexicons; the response body was not read |
| 33 | Badges and the thread window with Radar installed on Facebook, Instagram and Bluesky | Reload the extension; open a post on each | open (author check per the release gate) |
