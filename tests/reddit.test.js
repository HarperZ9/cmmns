import test from "node:test";
import assert from "node:assert/strict";
import { redditAbout, REDDIT_DEFAULT_NAME } from "../src/core/reddit.js";
import { flagsFor } from "../src/core/flags.js";

const about = { kind: "t2", data: { name: "Lumpy_Garden_4821", created_utc: 1758000000, link_karma: 3, comment_karma: 9, total_karma: 12, has_verified_email: false, is_gold: false, is_mod: false, subreddit: { public_description: "" } } };

test("reads Reddit's public account fields", () => {
  const r = redditAbout(about);
  assert.equal(r.handle, "Lumpy_Garden_4821");
  assert.equal(r.joinDate, "2025-09-16");
  assert.equal(r.karma, 12);
  assert.equal(r.emailVerified, false);
  assert.equal(r.defaultName, true);
  assert.equal(r.premium, undefined);
  assert.equal(redditAbout({}), null);
});

test("the sign-up name pattern", () => {
  assert.ok(REDDIT_DEFAULT_NAME.test("Lumpy_Garden_4821"));
  assert.ok(REDDIT_DEFAULT_NAME.test("Ok-Instance-17"));
  assert.ok(!REDDIT_DEFAULT_NAME.test("spez"));
  assert.ok(!REDDIT_DEFAULT_NAME.test("john_smith"));
});

test("Reddit flags: new account, low karma for its age, sign-up name", () => {
  const now = Date.parse("2026-10-19T00:00:00Z");
  const old = flagsFor({ handle: "", redditDefaultName: true, joinDate: "2025-09-16", karma: 12 }, { now }).map((f) => f.id);
  assert.ok(old.includes("low-karma"));
  assert.ok(old.includes("default-handle"));
  const fresh = flagsFor({ handle: "", joinDate: "2026-10-10", karma: 1 }, { now }).map((f) => f.id);
  assert.ok(fresh.includes("new-account"));
  assert.ok(!fresh.includes("low-karma"));
});
