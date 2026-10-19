import test from "node:test";
import assert from "node:assert/strict";
import { recordSpread, trailFor, upstream, normLink } from "../src/core/trail.js";

const T = (id, author, posted, extra = {}) => ({ id, author, posted, ...extra });
const vid = { type: "video", url: "https://pbs.twimg.com/amplify_video_thumb/1/img/a.jpg", uploaded: "2019-05-02T00:00:00.000Z" };

test("an upload shared by several accounts: first poster and spread", () => {
  const posts = [T("3", "c", "2026-10-18T10:05:00Z", { media: [vid] }), T("1", "a", "2026-10-18T10:00:00Z", { media: [vid] }), T("2", "b", "2026-10-18T10:02:00Z", { media: [vid] })];
  const log = recordSpread({}, posts);
  const tr = trailFor(posts[0], new Map(posts.map((p) => [p.id, p])), log);
  assert.equal(tr.media[0].accounts, 3);
  assert.equal(tr.media[0].first.handle, "a");
  assert.equal(tr.media[0].isFirst, false);
  assert.deepEqual(tr.steps.map((s) => s.kind), ["uploaded"]);
});

test("quotes and lifted media are followed upstream", () => {
  const src = T("10", "origin", "2026-10-17T09:00:00Z");
  const mid = T("11", "relay", "2026-10-18T09:00:00Z", { quotedId: "10" });
  const top = T("12", "reply", "2026-10-18T09:30:00Z", { quotedId: "11", media: [{ type: "photo", url: "u", uploaded: "2026-10-18T09:29:00Z", fromPost: "10", fromPostTime: "2026-10-17T09:00:00Z" }] });
  const map = new Map([src, mid, top].map((p) => [p.id, p]));
  const tr = trailFor(top, map, {});
  assert.deepEqual(tr.steps.map((s) => [s.kind, s.handle || null]), [["quotes", "relay"], ["quotes", "origin"], ["media from", "origin"], ["uploaded", null]]);
  const up = upstream([{ id: "12" }, { id: "11" }], map, {});
  assert.deepEqual(up.accounts, [{ handle: "origin", n: 2 }]);
});

test("links are normalised so tracking parameters do not split one source", () => {
  assert.equal(normLink("https://site.example/a?utm_source=x&id=2#top"), normLink("https://site.example/a?id=2"));
  const log = recordSpread({}, [T("1", "a", "2026-10-18T10:00:00Z", { links: ["https://site.example/a?utm_source=x"] }), T("2", "b", "2026-10-18T10:01:00Z", { links: ["https://site.example/a"] })]);
  assert.equal(Object.keys(log.links).length, 1);
});
