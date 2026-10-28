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
| 9 | One-click scan: the toolbar button scans, one minimised window is reused, it closes when idle | Click CMMNS on a post page | open |
| 10 | X's VPN or proxy note wording on the About page | Find an account X marks; compare with `proxyNote` in src/core/about.js | open |
| 11 | Live page data: X's GraphQL User objects (legacy or core fields) reach the content script via sniff.js | Open a post; account cards fill without a scan | open |
| 12 | Automatic About data: AboutAccountQuery learned once, then repeated in the page; response carries `about_profile` | Open a post; watch "Reading About data automatically" count down | pass 2026-10-21: on a 154-reply post the thread report read 19 of 19, then 24 of 24 accounts with no manual step; the hover window showed "Based in" and join month |
| 13 | "Translated from", Parody/Commentary labels and the "Probable spam" heading as X shows them | Compare chips with the page | open |

| 14 | YouTube comment data (`commentEntityPayload.author`, `properties.publishedTime`, `toolbar.likeCountNotliked`) reaches ytdata.js | Read a /youtubei/v1/next response on a watch page | pass 2026-10-18: 8 authors read from a replies response with channel id, likes and time; displayName carries the "@handle" the page shows |
| 15 | YouTube `videoOwnerRenderer` (channel, subscribers) and `currentVideoEndpoint` in ytInitialData | Read the watch page's data | pass 2026-10-18: channel, "13.7K subscribers" and browse id read; ytInitialData keeps the first video's id after in-page navigation, so CMMNS keys video data by id |
| 16 | YouTube funding and context panels, paid-promotion overlay, member badge field | Open a state-funded broadcaster's video and a sponsored video | open |
| 17 | X post data: `source`, `legacy.lang`, `views.count`, `edit_control`, `birdwatch_pivot` on Tweet objects | Open a post with a Community Note; open the account card | open |
| 18 | X media fields: `extended_entities.media[].id_str`, `source_status_id_str`, `media_url_https`; `legacy.created_at` on Tweet objects | Open a post with an old video re-shared ("From @..."); compare the chip's date | open |
| 19 | Feed mode: badges on home, profile, likes and search pages without slowing scrolling | Scroll a timeline for a minute | open |
| 20 | YouTube "Altered or synthetic content" text in the page data | Open a video with the disclosure | open |
| 21 | Reddit `/user/<name>/about.json` from the content script: same-origin fetch works, fields `created_utc`, `total_karma`, `has_verified_email` | Open a Reddit thread; check the window shows the account age | open |

| 22 | Live rhetoric recall on a real thread | Open a political reply thread; compare the report's extreme count with a reading of the replies | 2026-10-21, before the fix: a 154-reply post about the riots in France; of 44 replies loaded, 26 were French that X had not translated, 16 English, 1 Chinese, 1 Spanish. The report said 0 extreme replies although one English reply proposed exterminating a group. Causes: violence grammar matched only the passive form, and no French markers. Fixed in `rhetoric.js` (active calls, carried-over fate) and `rhetoric-fr.js`, covered by `tests/rhetoric.recall.test.js`. Recheck on the same post after reloading the extension: open |
| 23 | Hover window on live X | Hover a reply | pass 2026-10-21: area strip, tabs and "Compared with this thread" render; thread showed 10 of 19 accounts flagged, which needs a look at which flags fire (possible over-flagging) |
| 24 | Rate pacing on live X | Read one long thread, then a second load | 2026-10-21, before the fix: after about 40 automatic About lookups across two loads, X answered 429 and CMMNS paused (the pause worked). Handles that got the 429 were not retried in that page session. Fixed: pacing now follows `x-rate-limit-remaining` and `x-rate-limit-reset`, keeps 5 requests in reserve for the viewer's own use of X, and retries a 429 or timeout up to twice (`src/core/pace.js`, `tests/pace.test.js`). Header names are X's documented v1.1 ones; that GraphQL returns them is unverified until the recheck. Recheck after reloading the extension: open |

## Facebook, Instagram, Bluesky (stream B, 2026-10-21)
Checked in the author's signed-in Chrome by reading page structure only, with the extension not installed. Nothing was posted, liked or followed. Fixtures are synthetic (`tests/fixtures/meta.html`).

| # | Check | How | Status |
|---|---|---|---|
| 25 | Facebook comments: `[role="article"]` labelled "Comment by NAME TIME"; author link `profile.php?id=` or a vanity path; permalink with a numeric `comment_id`; text in `div[dir="auto"]`; replies are separate articles, not nested | Open a public Page post with comments | pass 2026-10-21: 20 comment articles on a public Page post, every one with both author link shapes, a 16 to 17 digit `comment_id`, and one `div[dir="auto"]` body (one image-only comment had none) |
| 26 | Facebook reply wording "Reply by" and non-English labels | Expand replies; switch Facebook's language | open: the adapter also accepts any article holding a `comment_id` link |
| 27 | Facebook Page transparency text: "Page created", "Changed name to", "Primary country/region location for people who manage this Page" | Open a Page's transparency view | open: on 2026-10-21 the `about_profile_transparency` view rendered empty for two large Pages, and their About tab listed no transparency item. Parser built from Meta's public description |
| 28 | Instagram comments: each has a permalink `/<owner>/p/<code>/c/<id>/` around a `<time datetime>`; the comment is the largest box holding one such link; author link `/<name>/`; body is the first plain `span[dir="auto"]` | Open a public post | pass 2026-10-21: 16 comment permalinks on a post, each box with one author link, the time span, the body span and its Reply button |
| 29 | Instagram "About this account" dialog: "Date joined", "Account based in", "Verified" as label then value lines | Profile menu, About this account | pass 2026-10-21 on a large public account. "Former usernames" and the "Not shared" value are open: neither was on that account |
| 30 | Instagram About data in the page's own requests | Watch the request when the dialog opens | 2026-10-21: it arrives as a Bloks UI payload from `/async/wbloks/fetch/`, not as data. CMMNS reads the rendered dialog instead and does not repeat the request |
| 31 | Bluesky thread: `data-testid="postThreadItem-by-<handle>"`, text in `[data-word-wrap]`, post link `/profile/<handle>/post/<rkey>`; the app requests `app.bsky.unspecced.getPostThreadV2` | Open a public thread | pass 2026-10-21: 26 thread items on a public post; the V2 thread request seen in the page's resource list |
| 32 | Bluesky response fields `author.createdAt`, `author.labels`, `author.verification` reach bsky.js | Read one getPostThreadV2 response | open: fields from the public lexicons; the response body was not read |
| 33 | Badges and the thread window with CMMNS installed on Facebook, Instagram and Bluesky | Reload the extension; open a post on each | open (author check per the release gate) |

## Live checks after reload, 2026-10-21 (build ab9fd9f, the author's Chrome)
| # | Check | Result |
|---|---|---|
| 22 | Rhetoric recall on the riots-in-France thread | pass: the reply proposing extermination now carries "call for violence"; the report counts 1 extreme reply among the 17 to 21 accounts read (the report counts only read accounts) |
| 23 | Flag rate on the same thread | pass: 5 of 21 accounts flagged after the tiers change, against 10 of 19 before |
| 24 | Rate pacing | partial: lookups returned 200 at about one per 20 s with no pause from X in about 10 minutes; whether the pace came from rate-limit headers is inferred from the spacing, not seen in the headers |
| 25 | Thread echo | fail, fixed in #6: one thread counted as two, so a reply showed "same words in 1 other thread you viewed, from this account"; threads are now keyed by post id |
| 19 | Feed mode on x.com/home | pass with one defect fixed in #11: the window opens beside X's hover card; it said "this thread" on a feed. No long tasks in 30 s of scrolling; frame rate not measurable in a background tab |
| 16 | YouTube funding panel | partial: CGTN and Al Jazeera English videos carry YouTube's funding text in the page, but those videos showed 0 comments, so CMMNS drew nothing; fixed in #12 (video context without comments). CMMNS on a video with comments: panel "CMMNS · 20" renders |
| 1a, 21 | Reddit | open: the browser tool is blocked on reddit.com; needs the author's check |

## Threads, Mastodon, TikTok (stream 6, 2026-10-21)
Checked in the author's Chrome by reading page structure only, signed out on each site, with the
extension not installed. Nothing was posted, liked, followed or messaged; no private messaging
panel opened. Fixtures are synthetic (`tests/fixtures/reach.html`), and the fixture adapters were
checked in a local page on 2026-10-21 (all six posts read on each site, badges and thread panel
drawn, touch mode tested at 375 px).

| # | Check | How | Status |
|---|---|---|---|
| 34 | Threads post page: each post is a `[data-pressable-container]` box with `<time>` inside its permalink `/@user/post/<code>`; body in a `span[dir="auto"]` outside links; first box is the post, the rest replies | Open a public post (threads.net redirects to threads.com) | pass 2026-10-21: 24 boxes on a public post, every one with a permalink time and an author link; the body is the longest plain span |
| 35 | Threads data in the page's own requests | Resource list | 2026-10-21: one `/api/graphql` endpoint for everything; CMMNS reads the rendered page and copies no response |
| 36 | Mastodon 4.x: `.status[data-id]`, `a.status__relative-time` to `/@acct/<id>` around `<time>`, `.status__content__text` | fosstodon.org explore page | pass 2026-10-21: remote authors as `/@user@host/<id>` |
| 37 | Mastodon 5.0 (alpha on mastodon.social): `article._comp_status__root[data-id]`, `a._comp_status_header__date` to `/@acct/<id>` around `<time>`, `._comp_status_content__text` | A public thread on mastodon.social | pass 2026-10-21: 45 statuses in the thread; ancestors, the focused post (`data-variant="page"`), then replies |
| 38 | Mastodon detection: `#mastodon` root element and `#initial-state` JSON with `meta.version` and `meta.domain` | Both servers | pass 2026-10-21. The probe reads only version and domain; the same JSON also holds the signed-in viewer's access token, which CMMNS never reads |
| 39 | Mastodon thread request `/api/v1/statuses/<id>/context` and `/api/v1/statuses/<id>` (Account `created_at`, `bot`, counts) | Resource list on a thread | partial 2026-10-21: the requests were seen; the response bodies were not read. Fields follow Mastodon's public API documentation |
| 40 | Permission flow: popup offer, browser prompt, scripts registered for that server only, removal in options | Install the build; open a Mastodon server; click the toolbar button | open (author check after reload) |
| 41 | TikTok comments: `data-e2e="comment-level-1"`, `comment-username-1`; comment list request `/api/comment/list/` | Open a video's comments | blocked 2026-10-21: signed out, TikTok showed a log-in dialog and then a "Create username" sign-up step before any comment loaded. The check stopped there and created nothing. The adapter follows TikTok's public data-e2e attributes and needs the author's check in a signed-in browser |
| 42 | Firefox for Android: install from file, tap a post's CMMNS button, popup as a page, a Mastodon server prompt | Steps in `project-docs/ANDROID.md` | open (needs a phone or emulator) |

## Launch campaign lens (2026-10-22, not run)
Not run: live checks on X need the author's go-ahead in chat. To check, on one launch post and its
repost and quote lists:
- the repost list's accounts arrive in X's own response while `/status/<id>/retweets` is open, with
  bio and join date (`src/ext/campaign.js`);
- the "Paid partnership" text is a span of its own under labelled quote posts (`src/ext/platforms.js`);
- `bookmark_count` is in the post data (`src/core/xdata.js`);
- whether X's Human and AI account labels can be read from the page data (not read yet);
- the panel's "Launch campaign" section on the post page and on the repost list page.

## Campaign lens live check, 2026-10-22 (the author's signed-in Chrome, read-only)
Two public launch threads: a data-marketplace launch (repost list and quotes) and a local coding
model launch (quotes), plus each account's own recent posts. 15 page views at human pace, three
screens per list at most; nothing liked, reposted, followed or saved. CMMNS' own reader
and lens ran in the page on the responses X's app had already loaded; only aggregate results left
the page, and they stay outside the repository.

| # | Check | Result |
|---|---|---|
| 34 | Reply and post DOM test ids, status link with `<time>`, `role="group"` counts label | pass: unchanged |
| 35 | "Paid partnership" as a span of its own under a quote post | pass; and the same mark is in the response as `content_disclosure.advertising_disclosure.is_paid_promotion` |
| 36 | X's GraphQL User objects (item 11) | fail, fixed: 0 of 330 User objects had a `legacy` block; counts moved to `relationship_counts`, `tweet_counts`, `action_counts`. `core.screen_name`, `core.created_at`, `profile_bio.description`, `avatar.image_url` unchanged |
| 37 | Quote lists are complete in the page | fail, fixed: X virtualizes the list (about 7 posts in the page at once); the lens now reads paid marks and text from the responses |
| 38 | Operation names | `TweetDetail`, `SearchTimeline` (quotes), `Retweeters` (pages of 20), `UserOriginalsTimeline` (profile Posts tab), `UserRepliesTimeline`, `UserByScreenName`. CMMNS walks any GraphQL response, so the new names need no change |
| 39 | X's Human and AI account labels | not seen: no response key and no rendered span on these pages. Still open |
| 40 | The page's Reposts number | includes quotes: the number shown equals `retweet_count` plus `quote_count`. The lens uses `retweet_count`, so its ratio is lower than one read off the page |

Lens output on the two threads after the fix: both "coordinated" (disclosed paid quotes and quote
bunching), no sign fired, ladder step 1 only (10 of 20 and 6 of 21 quotes carry X's Paid
partnership mark). Does not prove: two threads at one moment each; a lens with no sign is not a
finding that a launch is organic.

| 25 | Offline kit trial: a person who has not seen the project follows the key card on a laptop with Wi-Fi off and verifies a kit from a USB stick | Record the time taken and any step that blocked them, whatever the result | open: skipped when the kit was built (2026-10-23) by the author's direction; the kit is not done until one trial is written here |
| 26 | Carrier-safe linkage review: someone who did not write the profile tries to link two carrier-safe bundles from one install using only the files | Give them bundles from two installs, keep the answer back, record what they found | 2026-10-23, model review only: a fresh Claude agent with no access to the code got three carrier-safe bundles of one thread (two from one install, one with post text; one from another) and found no linking field, confidence none. Only the key, key id and signature differed; the shared content identifies the thread and says nothing of the install. It noted the post text in one bundle reveals the thread's subject. Open for an independent person; any link found reopens the profile |
