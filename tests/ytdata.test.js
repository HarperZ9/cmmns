// Fixtures follow the shapes of YouTube's public page data (ytInitialData, ytInitialPlayerResponse,
// /youtubei/v1/next); field placement needs a live check (project-docs/LIVE-CHECKS.md).
import test from "node:test";
import assert from "node:assert/strict";
import { ytVideoInfo, ytCommentAuthors } from "../src/core/ytdata.js";

const page = {
  contents: { twoColumnWatchNextResults: { results: { results: { contents: [
    { videoSecondaryInfoRenderer: { owner: { videoOwnerRenderer: {
      title: { runs: [{ text: "World News Channel" }] }, subscriberCountText: { simpleText: "1.2M subscribers" },
      badges: [{ metadataBadgeRenderer: { tooltip: "Verified" } }],
      navigationEndpoint: { browseEndpoint: { browseId: "UCabc", canonicalBaseUrl: "/@worldnews" } } } } } },
    { infoPanelContainerRenderer: { title: { runs: [{ text: "World News Channel is funded in whole or in part by the Examplian government." }] } } },
  ] } } } },
  currentVideoEndpoint: { watchEndpoint: { videoId: "vid123" } },
};
const player = {
  videoDetails: { videoId: "vid123", viewCount: "45000", author: "World News Channel", channelId: "UCabc" },
  microformat: { playerMicroformatRenderer: { publishDate: "2026-10-01", category: "News & Politics" } },
  paidContentOverlay: { paidContentOverlayRenderer: { text: { runs: [{ text: "Includes paid promotion" }] } } },
};

test("video page: channel, subscribers, funding panel, paid promotion", () => {
  const v = { ...ytVideoInfo(page), ...ytVideoInfo(player) };
  assert.equal(v.channel, "World News Channel");
  assert.equal(v.subscribers, "1.2M subscribers");
  assert.equal(v.channelBadges, "Verified");
  assert.match(v.funding, /Examplian government/);
  assert.equal(v.paidPromotion, "Includes paid promotion");
  assert.equal(v.videoId, "vid123");
  assert.equal(v.views, 45000);
  assert.equal(v.category, "News & Politics");
});

test("comment authors from the new and old comment shapes", () => {
  const json = { frameworkUpdates: { entityBatchUpdate: { mutations: [
    { payload: { commentEntityPayload: { author: { displayName: "@NewShape", channelId: "UC1", isVerified: true, sponsorBadgeA11y: "Member (6 months)" },
      properties: { publishedTime: "3 days ago (edited)" }, toolbar: { likeCountNotliked: "12", replyCount: "2" } } } },
  ] } }, old: { commentRenderer: { authorText: { simpleText: "@OldShape" }, authorEndpoint: { browseEndpoint: { browseId: "UC2" } }, authorIsChannelOwner: true, publishedTimeText: { runs: [{ text: "1 hour ago" }] }, voteCount: { simpleText: "5" } } } };
  const a = ytCommentAuthors(json);
  assert.deepEqual(a.get("newshape"), { channelId: "UC1", verified: true, member: "Member (6 months)", likes: "12", replies: "2", published: "3 days ago", edited: true });
  assert.equal(a.get("oldshape").creator, true);
  assert.equal(a.get("oldshape").channelId, "UC2");
});

test("nothing to read gives null and an empty map", () => {
  assert.equal(ytVideoInfo({ a: 1 }), null);
  assert.equal(ytCommentAuthors({}).size, 0);
});
