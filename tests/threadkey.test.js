// One thread must have one key. Keying by location.pathname let the same X post appear as
// two threads (handle case, /photo/1 or /analytics suffixes, /i/web/status), so its own
// replies showed "same words in other threads you viewed" on a live check (2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { threadKey } from "../src/core/threadkey.js";

test("X: every path to one post gives one key", () => {
  const paths = ["/CokYasaaa/status/2112534570943828302", "/cokyasaaa/status/2112534570943828302",
    "/CokYasaaa/status/2112534570943828302/photo/1", "/CokYasaaa/status/2112534570943828302/analytics",
    "/i/web/status/2112534570943828302", "/i/status/2112534570943828302"];
  const keys = new Set(paths.map((p) => threadKey("x", p, "")));
  assert.deepEqual([...keys], ["x:2112534570943828302"]);
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

test("anything else falls back to the lower-cased path", () => {
  assert.equal(threadKey("facebook", "/Some/Path/", ""), "facebook:/some/path");
});
