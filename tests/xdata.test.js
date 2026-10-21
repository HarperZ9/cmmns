// Fixtures follow the shape of X's GraphQL User objects as publicly documented by people who read
// them; field placement needs a live check (project-docs/LIVE-CHECKS.md).
import test from "node:test";
import assert from "node:assert/strict";
import { usersIn, parseXDate } from "../src/core/xdata.js";

const legacyUser = {
  __typename: "User", rest_id: "1", is_blue_verified: true,
  legacy: { screen_name: "Patriot84736251", name: "Jack \u{1F1FA}\u{1F1F8}", created_at: "Thu Oct 02 09:00:00 +0000 2026",
    location: "Paris", description: "Truth teller", followers_count: 12, friends_count: 4900, statuses_count: 8100,
    entities: { url: { urls: [{ expanded_url: "https://example.org" }] } } },
  professional: { category: [{ name: "Media & News Company" }] },
  parody_commentary_fan_label: "Commentary",
};
const coreUser = {
  __typename: "User", core: { screen_name: "newsdesk", name: "News Desk", created_at: "Mon Apr 04 10:00:00 +0000 2011" },
  legacy: { followers_count: 50000, friends_count: 300, statuses_count: 90000, verified_type: "Business" },
  about_profile: { account_based_in: "France", source: "France App Store", username_changes: { count: "0" } },
};
const response = { data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: [
  { content: { itemContent: { tweet_results: { result: { core: { user_results: { result: legacyUser } } } } } } },
  { content: { itemContent: { tweet_results: { result: { core: { user_results: { result: coreUser } } } } } } },
  { content: { itemContent: { tweet_results: { result: { core: { user_results: { result: legacyUser } } } } } } },
] }] } } };

test("finds each account once in a nested response", () => {
  const users = usersIn(response);
  assert.equal(users.length, 2);
});

test("reads legacy-shaped fields", () => {
  const u = usersIn(response).find((x) => x.handle === "Patriot84736251");
  assert.equal(u.joinDate, "2026-10-02");
  assert.equal(u.profileLocation, "Paris");
  assert.equal(u.followersCount, 12);
  assert.equal(u.followingCount, 4900);
  assert.equal(u.verifiedType, "Blue");
  assert.equal(u.category, "Media & News Company");
  assert.equal(u.xLabel, "Commentary");
  assert.equal(u.website, "https://example.org");
});

test("reads core-shaped fields and the About block when present", () => {
  const u = usersIn(response).find((x) => x.handle === "newsdesk");
  assert.equal(u.joinDate, "2011-04-04");
  assert.equal(u.verifiedType, "Business");
  assert.equal(u.basedIn, "France");
  assert.equal(u.connectedVia, "France App Store");
  assert.equal(u.nameChanges, 0);
});

test("dates", () => {
  assert.equal(parseXDate("Wed May 02 12:00:00 +0000 2007"), "2007-05-02");
  assert.equal(parseXDate("nonsense"), null);
});

test("the About block is read from an About response, with the VPN note", async () => {
  const { aboutIn } = await import("../src/core/xdata.js");
  const res = { data: { user_result_by_screen_name: { result: { __typename: "User", about_profile: {
    account_based_in: "Belgium", source: "Belgium App Store", location_accurate: false, username_changes: { count: "2" } } } } } };
  const a = aboutIn(res);
  assert.equal(a.basedIn, "Belgium");
  assert.equal(a.connectedVia, "Belgium App Store");
  assert.equal(a.nameChanges, 2);
  assert.equal(a.proxyNote, true);
  assert.equal(a.aboutRead, true);
  assert.equal(aboutIn({ data: {} }), null);
});

test("post metadata X loads but does not show: app, language, views, edits, Community Note", async () => {
  const { tweetsIn, COMMON_CLIENTS } = await import("../src/core/xdata.js");
  const json = { data: { tweetResult: { result: { __typename: "Tweet", rest_id: "99",
    source: '<a href="https://buffer.com" rel="nofollow">Buffer</a>', views: { count: "1200" },
    edit_control: { edit_tweet_ids: ["98", "99"] }, birdwatch_pivot: { subtitle: { text: "This video is from 2019." } },
    legacy: { lang: "fr", favorite_count: 3, retweet_count: 1, quote_count: 0, reply_count: 2 } } } } };
  const [t] = tweetsIn(json);
  assert.deepEqual(t, { id: "99", client: "Buffer", lang: "fr", views: 1200, edits: 1, note: "This video is from 2019.", quotes: 0, reposts: 1, likes: 3, replies: 2 });
  assert.ok(COMMON_CLIENTS.test("Twitter for iPhone"));
  assert.ok(!COMMON_CLIENTS.test("Buffer"));
});

test("media upload dates from X ids, and media lifted from an earlier post", async () => {
  const { tweetsIn, snowflakeTime, olderMedia } = await import("../src/core/xdata.js");
  // An id for 2019-05-02T00:00:00Z: (ms - epoch) << 22
  const id = (iso) => String((BigInt(Date.parse(iso) - 1288834974657)) << 22n);
  assert.equal(snowflakeTime(id("2019-05-02T00:00:00Z")), "2019-05-02T00:00:00.000Z");
  const json = { __typename: "Tweet", rest_id: "1", legacy: { created_at: "Sat Oct 18 08:44:00 +0000 2026",
    extended_entities: { media: [{ id_str: id("2019-05-02T00:00:00Z"), type: "video", media_url_https: "https://pbs.twimg.com/x.jpg", source_status_id_str: id("2019-05-01T12:00:00Z") }] } } };
  const [t] = tweetsIn(json);
  assert.equal(t.posted, "2026-10-18T08:44:00.000Z");
  assert.equal(t.media[0].uploaded.slice(0, 10), "2019-05-02");
  assert.equal(t.media[0].fromPostTime.slice(0, 10), "2019-05-01");
  const old = olderMedia(t);
  assert.equal(old.length, 1);
  assert.ok(old[0].days > 2700);
  const fresh = { ...t, media: [{ ...t.media[0], uploaded: "2026-10-18T08:40:00.000Z" }] };
  assert.equal(olderMedia(fresh).length, 0);
});

test("trail fields: author, quoted post, repost, reply and real link addresses", async () => {
  const { tweetsIn } = await import("../src/core/xdata.js");
  const json = { __typename: "Tweet", rest_id: "5", core: { user_results: { result: { __typename: "User", core: { screen_name: "relay" } } } },
    legacy: { created_at: "Sat Oct 18 08:44:00 +0000 2026", quoted_status_id_str: "4", in_reply_to_status_id_str: "3", in_reply_to_screen_name: "root",
      entities: { urls: [{ expanded_url: "https://news.example/story" }, { expanded_url: "https://x.com/someone/status/1" }] } } };
  const t = tweetsIn(json).find((x) => x.id === "5");
  assert.equal(t.author, "relay");
  assert.equal(t.quotedId, "4");
  assert.equal(t.replyTo, "3");
  assert.deepEqual(t.links, ["https://news.example/story"]);
});

test("X's account-operation disclosures; payment handles are not read", async () => {
  const { usersIn } = await import("../src/core/xdata.js");
  const u = { __typename: "User", core: { screen_name: "org" }, legacy: { pinned_tweet_ids_str: ["77"] },
    verification_info: { is_identity_verified: true, reason: { description: { text: "This account is verified because it's an official organisation on X." } } },
    professional: { professional_type: "Business" }, profile_image_shape: "Square", business_account: { affiliates_count: 12 },
    creator_subscriptions_count: 3, tipjar_settings: { is_enabled: true, cash_app_handle: "$someone" } };
  const [r] = usersIn({ u });
  assert.equal(r.identityVerified, true);
  assert.match(r.verifiedReason, /official organisation/);
  assert.equal(r.professionalType, "Business");
  assert.equal(r.squareAvatar, true);
  assert.equal(r.pinnedPost, "77");
  assert.equal(r.affiliatesCount, 12);
  assert.equal(r.creatorSubscriptions, 3);
  assert.ok(!JSON.stringify(r).includes("someone"));
});

test("Community Note timing: when the note was written, against the post and now", async () => {
  const { tweetsIn, noteTiming } = await import("../src/core/xdata.js");
  const id = (iso) => String((BigInt(Date.parse(iso) - 1288834974657)) << 22n);
  const posted = "Sat Oct 18 08:00:00 +0000 2026";
  const viaNote = { __typename: "Tweet", rest_id: "7", legacy: { created_at: posted }, birdwatch_pivot: { title: "Readers added context", note: { rest_id: id("2026-10-18T11:00:00Z") } } };
  const viaLink = { __typename: "Tweet", rest_id: "8", legacy: { created_at: posted }, birdwatch_pivot: { title: "Readers added context", destinationUrl: `https://x.com/i/birdwatch/n/${id("2026-10-20T08:00:00Z")}` } };
  const [a, b] = tweetsIn({ list: [viaNote, viaLink] }).sort((x, y) => x.id.localeCompare(y.id));
  const now = Date.parse("2026-10-21T08:00:00Z");
  const ta = noteTiming(a, now), tb = noteTiming(b, now);
  assert.equal(ta.afterPost, 3 * 3600);
  assert.equal(ta.text, "Note written 3 h after the post, 3 days ago. The page does not say when X began to show it.");
  assert.equal(tb.afterPost, 48 * 3600);
  assert.match(tb.text, /^Note written 2 days after the post, 24 h ago\./);
  assert.equal(noteTiming({ note: "x" }, now), null, "no note id, no timing");
  assert.equal(noteTiming({ noteId: id("2026-10-21T07:30:00Z") }, now).text, "Note written 30 min ago. The page does not say when X began to show it.");
  const junk = tweetsIn({ __typename: "Tweet", rest_id: "9", legacy: {}, birdwatch_pivot: { destinationUrl: "https://x.com/i/birdwatch/n/abc" } })[0];
  assert.equal(junk.noteId, undefined);
});
