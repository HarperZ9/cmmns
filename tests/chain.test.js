// The laundering chain (src/core/chain.js): post, then the accounts and sites its material passed
// through, then the earliest origin Daylight Commons can see. Built only from pointers the platform records
// (quotes, reposts, "media from", the same upload, the same link), never from wording.
import test from "node:test";
import assert from "node:assert/strict";
import { launderingChain, CHAIN_DOES_NOT_PROVE } from "../src/core/chain.js";
import { recordSpread } from "../src/core/trail.js";

const tw = (id, author, posted, extra = {}) => ({ id, author, posted, media: [], links: [], ...extra });

test("a quote of a quote leads back through the intermediary to the origin", () => {
  const origin = tw("1", "origin", "2026-10-01T00:00:00Z");
  const mid = tw("2", "relay", "2026-10-01T02:00:00Z", { quotedId: "1" });
  const post = tw("3", "poster", "2026-10-01T05:00:00Z", { quotedId: "2" });
  const tweets = new Map([origin, mid, post].map((t) => [t.id, t]));
  const c = launderingChain(post, tweets, null);
  assert.deepEqual(c.hops.map((h) => [h.role, h.handle]), [["post", "poster"], ["intermediary", "relay"], ["origin", "origin"]]);
  assert.equal(c.intermediaries, 1);
  assert.equal(c.originHidden, true, "the post does not point at the origin itself");
  assert.equal(c.hoursFromOrigin, 5);
});

test("a direct quote of the origin has no intermediary", () => {
  const origin = tw("1", "origin", "2026-10-01T00:00:00Z");
  const post = tw("3", "poster", "2026-10-01T01:00:00Z", { quotedId: "1" });
  const c = launderingChain(post, new Map([[origin.id, origin], [post.id, post]]), null);
  assert.equal(c.intermediaries, 0);
  assert.equal(c.originHidden, false);
});

test("an upload seen earlier from another account is the origin; the post's own credit is the intermediary", () => {
  const m = { url: "https://pbs.twimg.com/media/X.jpg", type: "photo" };
  const first = tw("1", "first", "2026-10-01T00:00:00Z", { media: [m] });
  const relay = tw("2", "relay", "2026-10-02T00:00:00Z", { media: [m] });
  const post = tw("3", "poster", "2026-10-03T00:00:00Z", { media: [{ ...m, fromPost: "2", fromPostTime: "2026-10-02T00:00:00Z" }] });
  const log = recordSpread(null, [first, relay]);
  const c = launderingChain(post, new Map([first, relay, post].map((t) => [t.id, t])), log);
  assert.deepEqual(c.hops.map((h) => h.handle), ["poster", "relay", "first"]);
  assert.equal(c.hops[2].how, "same upload seen earlier");
});

test("a link names the site as an intermediary and an earlier sharer as the origin Daylight Commons saw", () => {
  const L = "https://news.example/a";
  const first = tw("1", "seed", "2026-10-01T00:00:00Z", { links: [L] });
  const post = tw("3", "poster", "2026-10-02T00:00:00Z", { links: [L] });
  const c = launderingChain(post, new Map([[first.id, first], [post.id, post]]), recordSpread(null, [first, post]));
  assert.deepEqual(c.hops.map((h) => [h.role, h.handle || h.domain]), [["post", "poster"], ["intermediary", "news.example"], ["origin", "seed"]]);
});

test("nothing upstream gives no chain; the rule ignores names", () => {
  assert.equal(launderingChain(tw("1", "a", "2026-10-01T00:00:00Z"), new Map(), null), null);
  const mk = (n) => { const o = tw("1", n + "o", "2026-10-01T00:00:00Z"), p = tw("2", n + "p", "2026-10-01T03:00:00Z", { quotedId: "1" }); return launderingChain(p, new Map([[o.id, o], [p.id, p]]), null); };
  assert.deepEqual(mk("left").hops.map((h) => h.role), mk("right").hops.map((h) => h.role));
  assert.match(CHAIN_DOES_NOT_PROVE, /first upload|cannot see/i);
});
