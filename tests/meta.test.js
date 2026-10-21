// Facebook and Instagram account context. The Instagram dialog text follows the layout read on a
// live page on 2026-10-21 (labels then values); names, dates and countries here are synthetic.
// The Facebook Page transparency text follows Meta's public description of the section and
// has not been seen live yet (project-docs/LIVE-CHECKS.md).
import test from "node:test";
import assert from "node:assert/strict";
import { igAbout, pageTransparency, fbKey, parseFullDate } from "../src/core/meta.js";
import { flagsFor } from "../src/core/flags.js";

const IG = "About this account\nexample.shop\nTo help keep our community authentic, we’re showing information about profiles on Instagram. See why this information is important.\nDate joined\nAugust 2013\nAccount based in\nExampleland\nVerified\nThe verified badge means an account has been verified based on their activity across our products.\nClose";

test("Instagram About this account: joined, based in, verified", () => {
  const r = igAbout(IG);
  assert.equal(r.handle, "example.shop");
  assert.equal(r.joinDate, "2013-08-01");
  assert.equal(r.basedIn, "Exampleland");
  assert.equal(r.verified, true);
  assert.equal(r.nameChanges, undefined);
  assert.equal(r.aboutRead, true);
});

test("Instagram: former usernames are counted, 'Not shared' is no location", () => {
  const r = igAbout("About this account\nsome_user\nDate joined\nMarch 2026\nAccount based in\nNot shared\nFormer usernames\nold_name_1\nold.name.2\nClose", "Some_User");
  assert.equal(r.handle, "Some_User");
  assert.equal(r.basedIn, undefined);
  assert.equal(r.basedInHidden, true);
  assert.equal(r.nameChanges, 2);
  assert.equal(igAbout("Something else entirely"), null);
});

const FB = "Page transparency\nFacebook is showing information to help you better understand the purpose of a Page. See actions taken by the people who manage and post content.\nPage created - May 3, 2015\nPage name changes\nChanged name to Example Daily - June 1, 2020\nChanged name to Example News Now - March 2, 2022\nChanged name to Example Truth - January 9, 2026\nPrimary country/region location for people who manage this Page includes:\nExampleland (4)\nOtherland (1)\nThis Page is currently running ads.";

test("Facebook Page transparency: created, renames, manager countries, ads", () => {
  const r = pageTransparency(FB, "exampletruth");
  assert.equal(r.handle, "exampletruth");
  assert.equal(r.joinDate, "2015-05-03");
  assert.equal(r.nameChanges, 3);
  assert.deepEqual(r.managedFrom, [{ country: "Exampleland", people: 4 }, { country: "Otherland", people: 1 }]);
  assert.equal(r.basedIn, undefined, "two countries: no single label");
  assert.equal(r.runningAds, true);
});

test("Facebook: one manager country becomes the label; no renames is zero", () => {
  const r = pageTransparency("Page transparency\nCreation date\nOctober 2, 2026\nThis Page has not changed its name.\nPrimary country/region location for people who manage this Page includes: France (2)\nThis Page is not currently running ads.", "p");
  assert.equal(r.basedIn, "France");
  assert.equal(r.joinDate, "2026-10-02");
  assert.equal(r.nameChanges, 0);
  assert.equal(r.runningAds, undefined);
  assert.equal(pageTransparency("Intro\nCategory", "p"), null);
});

test("Page readings feed the existing flags", () => {
  const now = Date.parse("2026-10-21T00:00:00Z");
  const ids = flagsFor({ handle: "", joinDate: "2026-10-02", nameChanges: 3 }, { now }).map((f) => f.id);
  assert.ok(ids.includes("new-account"));
  assert.ok(ids.includes("name-changes"));
});

test("full and month dates", () => {
  assert.equal(parseFullDate("February 8, 2009"), "2009-02-08");
  assert.equal(parseFullDate("8 February 2009"), "2009-02-08");
  assert.equal(parseFullDate("Joined March 2019"), "2019-03-01");
  assert.equal(parseFullDate("soon"), null);
});

test("Facebook author keys from profile links", () => {
  assert.equal(fbKey("https://www.facebook.com/profile.php?id=100000000000001&comment_id=Y29t"), "id.100000000000001");
  assert.equal(fbKey("https://www.facebook.com/Example.Page?comment_id=Y29t&__tn__=R"), "example.page");
  assert.equal(fbKey("https://www.facebook.com/people/Some-Name/61550000000000/"), "id.61550000000000");
  assert.equal(fbKey("https://www.facebook.com/ExamplePage/posts/pfbid0abc?comment_id=1"), null);
  assert.equal(fbKey("https://www.facebook.com/groups/123/"), null);
  assert.equal(fbKey("https://l.facebook.com/l.php?u=x"), null);
  assert.equal(fbKey("not a url"), null);
});
