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
