// Shared fixtures for the whole-save tests: Instagram's embedded post data in the nesting its web app
// used when this was written, an X conversation as X's answers carry it, and the Reddit, Instagram
// and X pages the browser test serves. Made up; no real post or person.
const cand = (name, w, h) => ({ url: `https://scontent.cdninstagram.com/v/t51/${name}_n.jpg?stp=dst-jpg_e35_p${w}x${h}`, width: w, height: h });
const thumb = (name) => ({ url: `https://scontent.cdninstagram.com/v/t51/${name}_n.jpg?stp=dst-jpg_e15_s240x240`, width: 240, height: 240 });
const user = (username, full_name = null) => ({ username, full_name, pk: username.length });

export const IG_ITEM = {
  code: "CAR0usel1", pk: "3300", id: "3300_77", taken_at: 1792497600, media_type: 8, product_type: "carousel_container",
  user: user("painter", "A Painter"), caption: { text: "Ochre beside blue.\nTwo frames.", created_at: 1792497600, pk: "1", user: user("painter") }, caption_is_edited: true,
  like_count: 41, comment_count: 3, location: { name: "Seattle", pk: 9 },
  carousel_media: [
    { pk: "3301", media_type: 1, accessibility_caption: "A painted wall in ochre.", image_versions2: { candidates: [thumb("AAA"), cand("AAA", 1080, 1080), cand("AAA", 640, 640)] } },
    { pk: "3302", media_type: 2, image_versions2: { candidates: [cand("BBB", 720, 1280), thumb("BBB")] },
      video_versions: [{ url: "https://scontent.cdninstagram.com/o1/v/t2/BBB_small.mp4", width: 360, height: 640, type: 101 }, { url: "https://scontent.cdninstagram.com/o1/v/t2/BBB_video.mp4", width: 720, height: 1280, type: 101 }] },
  ],
  preview_comments: [
    { pk: "900", text: "Warm against the blue.", created_at: 1792501200, comment_like_count: 5, child_comment_count: 1, user: user("ann"),
      child_comments: [{ pk: "901", text: "Agreed, @ann.", created_at: 1792504800, comment_like_count: 0, user: user("bo") }] },
    { pk: "902", text: "Which paint?", created_at: 1792508400, comment_like_count: 2, user: user("cy") },
  ],
};
export const IG_POST = { require: [["ScheduledServerJS", "handle", null, [{ __bbox: { require: [["RelayPrefetchedStreamCache", "next", [],
  ["adp_PolarisPostRootQueryRelayPreloader_1", { __bbox: { complete: true, result: { data: { xdt_api__v1__media__shortcode__web_info: { items: [IG_ITEM] } } } } }]]] } }]]] };

// X: a post quoting another, with a link X shortened, and its replies as X's answers carry them.
const tweet = (id, author, text, extra = {}, legacy = {}) => ({ __typename: "Tweet", rest_id: id, core: { user_results: { result: { core: { screen_name: author } } } },
  legacy: { full_text: text, created_at: "Tue Oct 20 12:00:00 +0000 2026", reply_count: 0, favorite_count: 1, ...legacy }, ...extra });
export const X_ROOT = tweet("100", "painter", "Ochre study https://t.co/abc", { quoted_status_result: { result: tweet("50", "quoted", "The older one.", {}, {
  extended_entities: { media: [{ id_str: "5", type: "photo", media_url_https: "https://pbs.twimg.com/media/Q.jpg", ext_alt_text: "A swatch card" }] } }) } },
{ reply_count: 4, quoted_status_id_str: "50", entities: { urls: [{ url: "https://t.co/abc", expanded_url: "https://example.org/ochre" }] } });
export const X_REPLIES = [
  tweet("101", "ann", "Lovely.", {}, { in_reply_to_status_id_str: "100", in_reply_to_screen_name: "painter", favorite_count: 7 }),
  tweet("102", "painter", "Thank you!", {}, { in_reply_to_status_id_str: "101", in_reply_to_screen_name: "ann" }),
  tweet("103", "bo", "Which ochre?", {}, { in_reply_to_status_id_str: "100", in_reply_to_screen_name: "painter" }),
];
export const X_MORE = [tweet("104", "cy", "Yellow ochre, I think.", {}, { in_reply_to_status_id_str: "103", in_reply_to_screen_name: "bo" })];
const xData = (list) => ({ data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: list.map((t) => ({ content: { itemContent: { tweet_results: { result: t } } } })) }] } } });

const art = (handle, id, text) => `<article><a href="/${handle}">${handle} name</a><a href="/${handle}/status/${id}"><time datetime="2026-10-20T12:00:00.000Z">Oct 20</time></a><div data-testid="tweetText" lang="en">${text}</div></article>`;
// The X page: the post, its replies, and "Show more replies", which loads one more reply as X would.
export const X_PAGE = `${art("painter", "100", "Ochre study example.org/ochre")}${art("ann", "101", "Lovely.")}${art("painter", "102", "Thank you!")}${art("bo", "103", "Which ochre?")}
<div data-testid="cellInnerDiv"><div role="button" id="more">Show more replies</div></div>
<script>
  window.postMessage({ source: "radar-sniff", json: ${JSON.stringify(xData([X_ROOT, ...X_REPLIES]))} }, location.origin);
  document.getElementById("more").addEventListener("click", (e) => { e.currentTarget.closest("[data-testid=cellInnerDiv]").remove();
    window.postMessage({ source: "radar-sniff", json: ${JSON.stringify(xData(X_MORE))} }, location.origin); });
</script>`;

// Reddit: a post with a picture and a comment tree of four, with "2 more replies" under the last,
// which adds two replies when pressed, as Reddit's own control would.
const rc = (id, parent, depth, author, text, inner = "") => `<shreddit-comment thingid="t1_${id}" ${parent ? `parentid="t1_${parent}"` : ""} postid="t3_abc123" depth="${depth}" author="${author}" score="${depth + 2}"
  created-timestamp="2026-10-2${depth}T10:00:00.000000+0000" permalink="/r/ColorTheory/comments/abc123/ochre/${id}/"><div slot="comment"><p>${text}</p></div>${inner}</shreddit-comment>`;
export const REDDIT_PAGE = `<shreddit-post id="t3_abc123" author="painter" post-title="Ochre study" permalink="/r/ColorTheory/comments/abc123/ochre/" created-timestamp="2026-10-20T09:00:00.000000+0000"
  subreddit-prefixed-name="r/ColorTheory" score="41" comment-count="6" post-type="image"><div slot="text-body"><p>See <a href="https://example.org/ochre">the swatch</a>.</p></div>
  <div slot="post-media-container"><img src="https://i.redd.it/abc.png" width="300" height="300" alt="A swatch"></div></shreddit-post>
<shreddit-comment-tree post-id="t3_abc123">
${rc("c1", null, 0, "ann", "Warm.", rc("c2", "c1", 1, "bo", "Very.", rc("c3", "c2", 2, "cy", "Agreed <a href='https://example.org/why'>why</a>.")))}
${rc("c4", null, 0, "di", "Which paint?", `<faceplate-partial loading="action" id="more"><button>2 more replies</button></faceplate-partial>`)}
</shreddit-comment-tree>
<script>
  document.addEventListener("click", (e) => {
    const b = e.target.closest("#more button");
    if (!b) return;
    const host = b.closest("shreddit-comment");
    b.closest("faceplate-partial").remove();
    host.insertAdjacentHTML("beforeend", ${JSON.stringify(rc("c5", "c4", 1, "ed", "Yellow ochre.") + rc("c6", "c4", 1, "fy", "Raw sienna."))});
  });
</script>`;

// Instagram: the post's own page, with its data embedded, and the likes page, which shows only a
// thumbnail of a post it has not received.
export const IG_PAGE = `<script type="application/json" data-sjs>${JSON.stringify(IG_POST)}</script>
<article><img id="pic" src="${thumb("AAA").url}" alt="Photo by A Painter"><a href="/p/CAR0usel1/"><time datetime="2026-10-20T12:00:00.000Z">Oct 20</time></a></article>`;
export const IG_LIKES = `<div><a href="/p/LIKED0001/"><img id="tile" src="${thumb("ZZZ").url}" alt=""></a></div>`;

// YouTube: two comment threads as the watch page draws them, the second with "1 reply" that opens it.
const yc = (id, author, text, likes) => `<ytd-comment-view-model id="comment"><a id="author-text" href="/${author}">${author}</a><span id="published-time-text"><a href="/watch?v=abcdefghijk&lc=${id}">2 days ago</a></span>
  <span id="content-text">${text}</span><span id="vote-count-middle">${likes}</span></ytd-comment-view-model>`;
export const YT_PAGE = `<ytd-comments-header-renderer><span id="count">3 Comments</span></ytd-comments-header-renderer>
<ytd-comment-thread-renderer>${yc("Ug1", "@ann", "Lovely light.", "12")}</ytd-comment-thread-renderer>
<ytd-comment-thread-renderer>${yc("Ug2", "@bo", "Which lens? <a href='https://www.youtube.com/redirect?q=https%3A%2F%2Fexample.org%2Flens'>example.org/lens</a>", "3")}
  <ytd-comment-replies-renderer><div id="more-replies"><button id="yt-more">1 reply</button></div></ytd-comment-replies-renderer></ytd-comment-thread-renderer>
<script>
  document.getElementById("yt-more").addEventListener("click", (e) => { const box = e.currentTarget.closest("ytd-comment-replies-renderer"); e.currentTarget.closest("#more-replies").remove();
    box.insertAdjacentHTML("beforeend", ${JSON.stringify(yc("Ug2.r1", "@cy", "A 35 mm.", "1"))}); });
</script>`;
