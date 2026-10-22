// Banned features for the launch campaign lens (project-docs/CAMPAIGN-LENS.md): language, script,
// place, name origin and avatar appearance must never change a score. Each test changes only a
// banned feature and checks every sign stays the same.
import test from "node:test";
import assert from "node:assert/strict";
import { campaignLens } from "../src/core/campaign.js";
import { sampleSigns } from "../src/core/campaign-sample.js";
import { skeleton } from "../src/core/campaign-text.js";
import { farmAccounts, organicAccounts, campaignQuotes, OWN_POSTS, LAUNCH_COUNTS, LAUNCH_TEXT } from "./fixtures/campaign-fixtures.js";

const PLACES = ["Avalon", "Brightwater", "Calder", "Dunmore", "Eastvale", "Fairhaven", "Glenrock", "Harlow"];
const REAL = ["Gambia", "Norway", "Somalia", "Canada", "Japan", "Brazil", "India", "France"];
const swapPlaces = (bio, to) => PLACES.reduce((s, p, i) => s.replaceAll(p, to[i]), bio);
const strip = (lens) => JSON.parse(JSON.stringify({ status: lens.status, families: lens.families, ind: lens.indicators.map((i) => i.text) }));

test("place names in bios never change a score", () => {
  const base = farmAccounts(30);
  for (const to of [REAL, [...REAL].reverse()]) {
    const moved = base.map((a) => ({ ...a, bio: swapPlaces(a.bio, to) }));
    assert.deepEqual(sampleSigns(moved, LAUNCH_TEXT), sampleSigns(base, LAUNCH_TEXT));
  }
});

test("slot words in another script read the same as Latin ones", () => {
  assert.deepEqual(skeleton("A Recruiter in Avalon, stacking $ETH like a pro"), skeleton("A 看護師 in 東京, stacking $ETH like a pro"));
  assert.deepEqual(skeleton("A Recruiter in Avalon"), skeleton("A Рекрутер in Москва"));
});

test("a sample of organic bios in different scripts and places scores the same as Latin ones", () => {
  const latin = organicAccounts(24);
  const other = latin.map((a, i) => ({ ...a, bio: ["東京のエンジニア", "مهندس برمجيات", "Ingeniera en Lima", "डेटा वैज्ञानिक"][i % 4] + ` ${i}` }));
  assert.equal(sampleSigns(other, LAUNCH_TEXT).indicators.length, 0);
  assert.equal(sampleSigns(latin, LAUNCH_TEXT).indicators.length, 0);
});

test("display names and default pictures never count toward the lead", () => {
  const accounts = organicAccounts(30).map((a, i) => ({ ...a, display: ["Oluwaseun", "Nguyễn", "María José", "Сергей"][i % 4], defaultAvatar: true }));
  const lens = campaignLens({ platform: "x", post: LAUNCH_COUNTS, ownPosts: [], accounts, quotes: [] });
  assert.equal(lens.indicators.length, 0);
  assert.ok(lens.context.some((c) => c.id === "default-avatar"));
});

test("random-suffix handles alone never reach an indicator", () => {
  const accounts = organicAccounts(30).map((a, i) => ({ ...a, handle: `q${i}x7k${i % 9}` }));
  const lens = campaignLens({ platform: "x", post: LAUNCH_COUNTS, ownPosts: [], accounts, quotes: [] });
  assert.equal(lens.indicators.length, 0);
});

test("the positive fixture's lead holds whichever places fill its bios", () => {
  const base = farmAccounts(30);
  const run = (accounts) => strip(campaignLens({ platform: "x", post: LAUNCH_COUNTS, ownPosts: OWN_POSTS, accounts, quotes: campaignQuotes(8) }));
  assert.deepEqual(run(base.map((a) => ({ ...a, bio: swapPlaces(a.bio, REAL) }))), run(base));
});
