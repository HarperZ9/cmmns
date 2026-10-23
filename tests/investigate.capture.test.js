// daylight case, capture side (src/investigate/capture.js, wayback.js, add.js, ingest.js): pages and
// posts are hashed as captured, login walls are refused, the Wayback request retries with backoff,
// and screenshots and seeds are read the way the hand-made cases read them. No test touches the network.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { htmlToText, htmlTitle, htmlDate, xPostId, syndicationUrl, postFromSyndication, loginGated, captureUrl, sha256 } from "../src/investigate/capture.js";
import { requestSnapshot, snapshotFrom } from "../src/investigate/wayback.js";
import { initCase } from "../src/investigate/layout.js";
import { loadCase } from "../src/investigate/store.js";
import { addSource } from "../src/investigate/add.js";
import { parseSeeds, screenshotPost, postFacts, inboxUrls } from "../src/investigate/ingest.js";

const dir = mkdtempSync(join(tmpdir(), "case-cap-"));
test.after(() => rmSync(dir, { recursive: true, force: true }));
const res = (body, { status = 200, url = "https://example.test/a", type = "text/html", headers = {} } = {}) => {
  const b = Buffer.from(body), h = new Map(Object.entries({ "content-type": type, ...headers }));
  return { ok: status < 400, status, url, headers: { get: (k) => h.get(k) ?? null }, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) };
};

test("HTML text keeps the words and drops scripts, styles and tags", () => {
  const html = "<html><head><title>A &amp; B</title><style>p{}</style><script>var x=1</script></head><body><p>One &#39;two&#39;</p><div>Three</div></body></html>";
  assert.equal(htmlToText(html), "A & B One 'two'\nThree");
  assert.equal(htmlTitle(html), "A & B");
  assert.equal(htmlDate('<meta property="article:published_time" content="2026-10-16T18:19:45Z">'), "2026-10-16T18:19:45.000Z");
  assert.equal(htmlDate("<p>no date</p>"), null);
});

test("an X status address gives its post id and the public post-data address", () => {
  assert.equal(xPostId("https://x.com/elonmusk/status/2110445577184133456?s=20"), "2110445577184133456");
  assert.equal(xPostId("https://twitter.com/a/status/123456"), "123456");
  assert.equal(xPostId("https://example.com/status/1"), null);
  assert.match(syndicationUrl("2110445577184133456"), /^https:\/\/cdn\.syndication\.twimg\.com\/tweet-result\?id=2110445577184133456&lang=en&token=[0-9a-z]+$/);
});

test("a syndication record gives author, time, reply and quote, and edits; a tombstone reads as deleted", () => {
  const p = postFromSyndication({ id_str: "2", created_at: "2026-10-21T16:22:08.000Z", text: "hi", user: { screen_name: "a" }, in_reply_to_status_id_str: "1", in_reply_to_screen_name: "b", quoted_tweet: { id_str: "0", user: { screen_name: "c" } }, edit_control: { edit_tweet_ids: ["1x", "2"] } });
  assert.deepEqual([p.author, p.posted, p.inReplyTo.author, p.quoted.author, p.edited], ["@a", "2026-10-21T16:22:08.000Z", "@b", "@c", true]);
  assert.equal(postFromSyndication({ __typename: "TweetTombstone" }).deleted, true);
});

test("login walls are refused; a sign-in box in a long page's header is not a wall", () => {
  assert.match(loginGated({ status: 401 }), /credentials/);
  assert.match(loginGated({ status: 200, finalUrl: "https://x.com/i/flow/login?redirect=1" }), /sign-in address/);
  assert.match(loginGated({ status: 200, html: "<form><input type=password></form><p>Log in to continue</p>" }), /sign-in/);
  const article = `<header><input type="password"></header><article>${"<p>Reported words of the article. </p>".repeat(80)}</article>`;
  assert.equal(loginGated({ status: 200, html: article }), null);
});

test("captureUrl sends no credentials and reads X posts from the post-data endpoint", async () => {
  const seen = [];
  const fetchFn = async (url, opts) => { seen.push([url, opts.credentials]); return url.includes("syndication") ? res(JSON.stringify({ id_str: "55555", text: "post text", user: { screen_name: "p" } }), { type: "application/json" }) : res("<title>T</title><p>Body</p>"); };
  const x = await captureUrl("https://x.com/p/status/55555", { fetchFn });
  assert.equal(x.kind, "x-post");
  assert.equal(x.text, "post text");
  assert.match(seen[0][0], /cdn\.syndication\.twimg\.com/);
  const w = await captureUrl("https://example.test/a", { fetchFn });
  assert.match(w.text, /Body/);
  assert.equal(w.title, "T");
  assert.ok(seen.every(([, c]) => c === "omit"));
  const gated = await captureUrl("https://example.test/b", { fetchFn: async () => res("<input type=password>", { url: "https://example.test/login" }) });
  assert.equal(gated.ok, false);
  assert.match(gated.reason, /^not captured/);
});

test("the Wayback request retries on 429 and 5xx with doubling waits, then records the snapshot", async () => {
  const waits = [];
  let n = 0;
  const fetchFn = async () => (++n < 3 ? res("", { status: n === 1 ? 429 : 503 }) : res("", { headers: { "content-location": "/web/20261023120000/https://a.test/" } }));
  const r = await requestSnapshot("https://a.test/", { fetchFn, sleep: async (ms) => waits.push(ms), baseMs: 100, now: () => "T" });
  assert.deepEqual(waits, [100, 200]);
  assert.equal(r.attempts, 3);
  assert.equal(r.url, "https://web.archive.org/web/20261023120000/https://a.test/");
  const fail = await requestSnapshot("https://a.test/", { fetchFn: async () => { throw new Error("offline"); }, sleep: async () => {}, tries: 2 });
  assert.equal(fail.url, null);
  assert.match(fail.error, /offline/);
  assert.equal(snapshotFrom(res("", { url: "https://web.archive.org/web/20250101000000/https://b.test/" })).timestamp, "20250101000000");
});

test("case add writes the capture, its hash, the access time and the derived edges", async () => {
  const c = join(dir, "add");
  initCase(c, "Add test", "2026-10-23T00:00:00Z");
  const post = { id_str: "99999", created_at: "2026-10-20T00:00:00Z", text: "quoting", user: { screen_name: "q" }, quoted_tweet: { id_str: "8", user: { screen_name: "r" } }, edit_control: { edit_tweet_ids: ["77777", "99999"] } };
  const fetchFn = async (url) => (url.includes("syndication") ? res(JSON.stringify(post), { type: "application/json" }) : res("", { headers: { "content-location": "/web/20261023000000/x" } }));
  const r = await addSource(c, "https://x.com/q/status/99999", { fetchFn, sleep: async () => {}, now: () => "2026-10-23T01:00:00Z" });
  const bytes = readFileSync(join(c, r.source.capture.file));
  assert.equal(r.source.capture.sha256, sha256(bytes));
  assert.equal(r.source.accessed, "2026-10-23T01:00:00Z");
  assert.equal(r.source.archive.url, "https://web.archive.org/web/20261023000000/x");
  const data = loadCase(c);
  assert.deepEqual(data.edges.map((e) => [e.from, e.to, e.type, e.source]), [["@q", "@r", "quote", "S01"]]);
  assert.deepEqual(data.absent.map((a) => a.status), ["edited"]);
});

test("seeds: a URL list, an inbox from the extension, a URL and a claim", () => {
  writeFileSync(join(dir, "list.txt"), "# comment\nhttps://a.test/1\nThe council voted 7-2\n");
  writeFileSync(join(dir, "inbox.jsonl"), JSON.stringify({ url: "https://b.test/2", title: "B" }) + "\n");
  assert.deepEqual(parseSeeds(join(dir, "list.txt")).map((x) => x.type), ["url", "claim"]);
  assert.deepEqual(inboxUrls(join(dir, "inbox.jsonl")), ["https://b.test/2"]);
  assert.equal(parseSeeds("https://c.test/").length, 1);
  assert.equal(parseSeeds("A claim in quotes")[0].type, "claim");
  assert.throws(() => parseSeeds(" "), /needs a seed/);
});

test("a screenshot transcript gives its author and day, and its body keeps every offset", () => {
  const t = "Made Up Account @made_up_account · 3h\nThe council voted 7-2.\n9:41 AM · Oct 21, 2026 · 12.4K Views\nReply";
  const p = screenshotPost(t);
  assert.equal(p.author, "@made_up_account");
  assert.equal(p.date, "2026-10-21");
  assert.equal(p.body.length, t.length);
  assert.equal(p.body.trim(), "The council voted 7-2.");
  assert.deepEqual(postFacts("see @a and https://x.test/p, and nytimes.com/2026/…").urls, ["https://x.test/p"]);
});
