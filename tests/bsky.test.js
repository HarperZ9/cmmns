// Bluesky thread data. Shapes follow the public AT Protocol lexicons (app.bsky.feed.defs,
// app.bsky.actor.defs, app.bsky.unspecced.getPostThreadV2); every account and post is synthetic.
import test from "node:test";
import assert from "node:assert/strict";
import { bskyAuthors, bskyPosts } from "../src/core/bsky.js";
import { flagsFor, isFlagged } from "../src/core/flags.js";

const author = (handle, extra = {}) => ({ did: "did:plc:" + handle.replace(/\W/g, ""), handle, displayName: handle.split(".")[0], createdAt: "2026-10-15T08:00:00.000Z", labels: [], ...extra });
const post = (a, rkey, text) => ({ uri: `at://${a.did}/app.bsky.feed.post/${rkey}`, author: a, record: { $type: "app.bsky.feed.post", text, createdAt: "2026-10-20T10:00:00.000Z", langs: ["en"] }, indexedAt: "2026-10-20T10:00:01.000Z" });

const A = author("alice.example.com", { verification: { verifiedStatus: "valid", trustedVerifierStatus: "none" } });
const B = author("spammy.bsky.social", { labels: [{ src: "did:plc:moderation", val: "spam" }, { src: "did:plc:spammybskysocial", val: "!no-unauthenticated" }] });
const v2 = { thread: [
  { uri: "a", depth: 0, value: { $type: "app.bsky.unspecced.defs#threadItemPost", post: post(A, "3aaa", "Root post") } },
  { uri: "b", depth: 1, value: { $type: "app.bsky.unspecced.defs#threadItemPost", post: post(B, "3bbb", "Buy now") } },
] };
const v1 = { thread: { $type: "app.bsky.feed.defs#threadViewPost", post: post(A, "3aaa", "Root post"), replies: [{ post: post(B, "3bbb", "Buy now") }] } };

test("authors from the V2 and V1 thread shapes", () => {
  for (const json of [v2, v1]) {
    const m = bskyAuthors(json);
    const a = m.get("alice.example.com"), b = m.get("spammy.bsky.social");
    assert.equal(a.joinDate, "2026-10-15");
    assert.equal(a.verified, true);
    assert.equal(a.display, "alice");
    assert.deepEqual(b.platformLabels, ["spam"], "self-labels are not moderation labels");
    assert.equal(b.aboutRead, true);
  }
});

test("posts: id, author, time", () => {
  const p = bskyPosts(v2);
  assert.deepEqual(p.get("3bbb"), { id: "3bbb", author: "spammy.bsky.social", posted: "2026-10-20T10:00:00.000Z", langs: ["en"] });
});

test("a moderation label for spam or impersonation is a flag; other labels are not", () => {
  const now = Date.parse("2026-10-21T00:00:00Z");
  const spam = flagsFor({ handle: "", platformLabels: ["spam"], labelSource: "Bluesky moderation" }, { now });
  assert.ok(spam.some((f) => f.id === "platform-label" && /spam/.test(f.evidence) && f.doesNotProve));
  assert.ok(isFlagged(spam));
  const other = flagsFor({ handle: "", platformLabels: ["rude", "porn"] }, { now });
  assert.ok(!other.some((f) => f.id === "platform-label"));
  assert.equal(bskyAuthors(null).size, 0);
});
