// The importers (src/core/imports.js and its readers): every supported file gives posts in
// CMMNS' input shape, the user's own exports come back with one author, other people's reposts
// are left out, Reddit's ip column is dropped, and a page script is never treated as text.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { importFile } from "../src/core/imports.js";
import { parseCsv } from "../src/core/import-exports.js";
import { htmlText, innerAt } from "../src/core/import-html.js";
import { varint } from "../src/core/import-car.js";

const fx = (f) => readFileSync(new URL(`./fixtures/integration/${f}`, import.meta.url));
const read = (f) => importFile(f, fx(f));

test("a thread in CMMNS' own shape reads as it is", () => {
  const r = read("thread.json");
  assert.equal(r.ok, true);
  assert.equal(r.source, "thread");
  assert.equal(r.input.root.id, "1");
  assert.equal(r.input.replies.length, 14);
});

test("saved X and Reddit pages give the root post and the replies, and scripts are not text", () => {
  const x = read("x-saved.html");
  assert.equal(x.site, "X");
  assert.equal(x.input.root.id, "700");
  assert.equal(x.input.root.text, "Library budget & hours\nnews.example.org/x");
  assert.deepEqual(x.input.replies.map((p) => [p.id, p.author]), [["701", "replyone"], ["702", "replytwo"]]);
  assert.equal(x.input.replies[0].posted, "2026-10-01T12:00:40.000Z");
  assert.deepEqual(x.input.replies[0].links, ["https://news.example.org/x"]);
  const rd = read("reddit-saved.html");
  assert.equal(rd.site, "Reddit");
  assert.equal(rd.input.root.text, "Library hours?\nWhen does it open?");
  assert.deepEqual(rd.input.replies.map((p) => p.id), ["t1_c1", "t1_c2"]);
  assert.deepEqual(rd.input.replies[0].links, ["https://news.example.org/hours"]);
});

test("any other page is read as one text with its links", () => {
  const p = read("page.html");
  assert.equal(p.source, "page");
  assert.match(p.input.replies[0].text, /^A town news page\nBudget\nThe council met/);
  assert.doesNotMatch(p.input.replies[0].text, /Menu/, "only the main element is read");
  assert.deepEqual(p.input.replies[0].links, ["https://rt.com/x"]);
});

test("thread JSON from X, Bluesky and Mastodon finds the root and the replies", () => {
  const b = read("bsky-thread.json");
  assert.equal(b.site, "Bluesky");
  assert.equal(b.input.root.id, "r0");
  assert.deepEqual(b.input.replies.map((p) => p.id), ["r1", "r2", "r3"]);
  const m = read("masto-context.json");
  assert.equal(m.site, "Mastodon");
  assert.equal(m.input.root.text, "Root post");
  const tweet = (id, user, text, reply) => ({ __typename: "Tweet", rest_id: id, core: { user_results: { result: { core: { screen_name: user } } } }, legacy: { full_text: text, created_at: "Wed Oct 01 12:00:00 +0000 2026", in_reply_to_status_id_str: reply, entities: { urls: [] } } });
  const x = importFile("TweetDetail.json", JSON.stringify({ data: { entries: [tweet("1", "a", "root", null), tweet("2", "b", "first", "1"), tweet("3", "c", "second", "1")] } }));
  assert.equal(x.site, "X");
  assert.equal(x.input.root.id, "1");
  assert.equal(x.input.replies.length, 2);
});

test("an X archive gives the user's own posts and leaves reposts out", () => {
  const r = read("tweets.js");
  assert.equal(r.source, "export");
  assert.deepEqual(r.input.replies.map((p) => p.id), ["9001", "9003"]);
  assert.ok(r.input.replies.every((p) => p.author === "you"));
  assert.deepEqual(r.input.replies[1].links, ["https://rt.com/news/1"]);
  assert.match(r.notes[0], /^1 repost of other people's posts left out/);
});

test("a Reddit export drops its ip column, deleted comments skipped", () => {
  const r = read("comments.csv");
  assert.equal(r.site, "Reddit");
  assert.equal(r.input.replies.length, 1);
  assert.equal(r.input.replies[0].text, "Good question, \"opening hours\" are posted\non the door");
  assert.ok(!JSON.stringify(r).includes("192.0.2.1"), "the ip value never appears");
  assert.match(r.notes.join(" "), /ip column was left out/);
  assert.deepEqual(parseCsv("a,b\r\n\"x,1\",\"y\"\"z\"\n"), [["a", "b"], ["x,1", "y\"z"]]);
});

test("a Mastodon outbox gives the user's posts, links without hashtags, boosts left out", () => {
  const r = read("outbox.json");
  assert.equal(r.input.replies[0].id, "111");
  assert.equal(r.input.replies[0].text, "Library hours are here #town");
  assert.deepEqual(r.input.replies[0].links, ["https://news.example.org/a"]);
  assert.match(r.notes[0], /1 boost of other/);
});

// A minimal DAG-CBOR encoder and CAR writer, to build a Bluesky repository export in the test.
const cat = (...p) => { const o = new Uint8Array(p.reduce((s, x) => s + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
const head = (m, n) => (n < 24 ? [m << 5 | n] : n < 256 ? [m << 5 | 24, n] : [m << 5 | 25, n >> 8, n & 255]);
const enc = (v) => {
  if (v === null) return Uint8Array.of(0xf6);
  if (v instanceof Uint8Array) return cat(Uint8Array.from(head(2, v.length)), v);
  if (typeof v === "string") { const s = new TextEncoder().encode(v); return cat(Uint8Array.from(head(3, s.length)), s); }
  if (Number.isInteger(v)) return Uint8Array.from(head(0, v));
  if (Array.isArray(v)) return cat(Uint8Array.from(head(4, v.length)), ...v.map(enc));
  if (v.link) return cat(Uint8Array.of(0xd8, 42), enc(cat(Uint8Array.of(0), v.link)));
  const ks = Object.keys(v);
  return cat(Uint8Array.from(head(5, ks.length)), ...ks.flatMap((k) => [enc(k), enc(v[k])]));
};
const cidOf = (data) => cat(Uint8Array.of(1, 0x71, 0x12, 0x20), createHash("sha256").update(data).digest());
const vint = (n) => { const o = []; while (n >= 128) { o.push((n & 127) | 128); n >>>= 7; } o.push(n); return Uint8Array.from(o); };

test("a Bluesky repository .car gives the user's posts named by record key", () => {
  const posts = [{ $type: "app.bsky.feed.post", text: "Second post", createdAt: "2026-10-02T09:00:00Z" }, { $type: "app.bsky.feed.post", text: "First post", createdAt: "2026-10-01T09:00:00Z", facets: [{ features: [{ uri: "https://news.example.org/b" }] }] }];
  const blocks = posts.map((p) => { const d = enc(p); return { cid: cidOf(d), data: d }; });
  const mst = enc({ l: null, e: [{ p: 0, k: new TextEncoder().encode("app.bsky.feed.post/3kaaa"), v: { link: blocks[0].cid }, t: null }, { p: 19, k: new TextEncoder().encode("3kbbb"), v: { link: blocks[1].cid }, t: null }] });
  blocks.push({ cid: cidOf(mst), data: mst });
  const header = enc({ roots: [{ link: blocks[2].cid }], version: 1 });
  const car = cat(vint(header.length), header, ...blocks.flatMap((b) => [vint(b.cid.length + b.data.length), b.cid, b.data]));
  const r = importFile("repo.car", car);
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.site, "Bluesky");
  assert.deepEqual(r.input.replies.map((p) => [p.id, p.text]), [["3kbbb", "First post"], ["3kaaa", "Second post"]]);
  assert.deepEqual(r.input.replies[0].links, ["https://news.example.org/b"]);
  assert.equal(importFile("broken.car", Uint8Array.of(5, 1, 2)).ok, false);
  assert.deepEqual(varint(Uint8Array.of(0xac, 0x02), 0), [300, 2]);
});

test("files CMMNS cannot read are refused with a reason, never guessed at", () => {
  for (const [name, body] of [["x.json", "{not json"], ["x.json", "{\"a\":1}"], ["x.bin", "\u0001\u0002"], ["x.csv", "a,b\n1,2\n"]]) {
    const r = importFile(name, body);
    assert.equal(r.ok, false, name);
    assert.ok(r.reason.length > 10);
  }
  assert.match(importFile("b.json", JSON.stringify({ kind: "radar-evidence-bundle" })).reason, /Check a bundle/);
});

test("the HTML readers decode entities and match nested elements", () => {
  assert.equal(htmlText("<p>a &amp; b&#39;s &#x41;</p><script>no</script>"), "a & b's A");
  const html = "<div id=x><div>in</div>tail</div>after";
  assert.equal(innerAt(html, 0), "<div>in</div>tail");
});
