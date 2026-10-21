// One thread must have one key. Keying by location.pathname let the same X post appear as
// two threads (handle case, /photo/1 or /analytics suffixes, /i/web/status), so its own
// replies showed "same words in other threads you viewed" on a live check (2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { threadKey } from "../src/core/threadkey.js";

test("X: every path to one post gives one key", () => {
  const paths = ["/SomeAccount/status/1000000000000000001", "/someaccount/status/1000000000000000001",
    "/SomeAccount/status/1000000000000000001/photo/1", "/SomeAccount/status/1000000000000000001/analytics",
    "/i/web/status/1000000000000000001", "/i/status/1000000000000000001"];
  const keys = new Set(paths.map((p) => threadKey("x", p, "")));
  assert.deepEqual([...keys], ["x:1000000000000000001"]);
});

test("Reddit: the post id, whatever the slug or comment permalink", () => {
  const a = threadKey("reddit", "/r/europe/comments/1abc23/riots_in_france/", "");
  const b = threadKey("reddit", "/r/Europe/comments/1abc23/riots_in_france/kx9z8y1/", "");
  const c = threadKey("reddit", "/comments/1abc23", "");
  assert.equal(a, "reddit:1abc23");
  assert.equal(b, a);
  assert.equal(c, a);
});

test("YouTube: the video id from watch and shorts", () => {
  assert.equal(threadKey("youtube", "/watch", "?v=dQw4w9WgXcQ&t=30s"), "youtube:dQw4w9WgXcQ");
  assert.equal(threadKey("youtube", "/shorts/dQw4w9WgXcQ", ""), "youtube:dQw4w9WgXcQ");
});

test("Instagram, Bluesky and Facebook: the post id, case kept", () => {
  assert.equal(threadKey("instagram", "/exampleowner/p/AbC_d-1/c/18000000000000001/", ""), "instagram:AbC_d-1");
  assert.equal(threadKey("instagram", "/reel/AbC_d-1/", ""), "instagram:AbC_d-1");
  assert.equal(threadKey("bluesky", "/profile/Alice.Example.com/post/3mabc", ""), "bluesky:3mabc");
  assert.equal(threadKey("facebook", "/ExamplePage/posts/pfbid0AbC", "?comment_id=1"), "facebook:pfbid0AbC");
  assert.equal(threadKey("facebook", "/permalink.php", "?story_fbid=123&id=9"), "facebook:123");
  assert.equal(threadKey("facebook", "/watch/", "?v=456"), "facebook:456");
  assert.equal(threadKey("facebook", "/reel/789", ""), "facebook:789");
});

test("anything else falls back to the lower-cased path", () => {
  assert.equal(threadKey("facebook", "/Some/Path/", ""), "facebook:/some/path");
});
