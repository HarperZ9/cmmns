// The feed requests (src/core/feedfetch.js) with a stand-in fetch: what each request carries, that
// a host the browser did not allow is never asked, that redirects are not followed, and the cache.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fetchFeed, feedFetcher, FEED_REQUEST } from "../src/core/feedfetch.js";

const RSS = readFileSync(new URL("./fixtures/feeds/rss.xml", import.meta.url), "utf8");
const feed = (url) => ({ id: url, name: url, url, site: new URL(url).hostname });
const answer = (body, init = {}) => new Response(body, { status: 200, ...init });

test("a request carries no cookies, no referrer and no body, and follows no redirect", async () => {
  const seen = [];
  const r = await fetchFeed(feed("https://courier.example/rss.xml"), { fetch: async (u, o) => { seen.push([u, o]); return answer(RSS); } });
  assert.equal(r.error, null);
  assert.equal(r.items.length, 3);
  const [[url, opts]] = seen;
  assert.equal(url, "https://courier.example/rss.xml");
  for (const [k, v] of Object.entries(FEED_REQUEST)) assert.equal(opts[k], v, k);
  assert.equal(opts.credentials, "omit");
  assert.equal(opts.redirect, "manual");
  assert.equal(opts.headers, undefined, "CMMNS adds no header, so nothing about the user rides along");
  assert.equal(opts.body, undefined);
});

test("redirects, errors, non-feeds, oversize answers and timeouts each say what went wrong", async () => {
  const f = feed("https://x.example/rss");
  assert.equal((await fetchFeed(f, { fetch: async () => ({ type: "opaqueredirect", status: 0, ok: false }) })).error, "redirect");
  assert.equal((await fetchFeed(f, { fetch: async () => answer("no", { status: 503 }) })).error, "http");
  assert.equal((await fetchFeed(f, { fetch: async () => answer("<html>hi</html>") })).error, "not-a-feed");
  assert.equal((await fetchFeed(f, { fetch: async () => answer("x", { headers: { "content-length": "99999999" } }) })).error, "too-large");
  assert.equal((await fetchFeed(f, { fetch: async () => answer("<rss>" + "x".repeat(3_100_000)) })).error, "too-large");
  assert.equal((await fetchFeed(f, { fetch: async () => { throw new TypeError("offline"); } })).error, "network");
  const hang = (u, o) => new Promise((_, rej) => o.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  assert.equal((await fetchFeed(f, { fetch: hang, timeoutMs: 20 })).error, "timeout");
});

test("a host the browser has not allowed is never requested", async () => {
  const asked = [];
  const f = feedFetcher({ fetch: async (u) => { asked.push(u); return answer(RSS); }, allowed: async (origin) => origin === "https://ok.example/*" });
  const out = await f.fetchAll([feed("https://ok.example/rss"), feed("https://no.example/rss")]);
  assert.deepEqual(asked, ["https://ok.example/rss"]);
  assert.deepEqual(out.map((r) => r.error), [null, "no-permission"]);
});

test("answers are kept for ten minutes, then asked again; failures are not kept", async () => {
  let n = 0, t = 0, fail = true;
  const f = feedFetcher({ fetch: async () => { n++; return answer(RSS); }, allowed: async () => true, now: () => t });
  await f.fetchAll([feed("https://ok.example/rss")]);
  t = 5 * 60 * 1000;
  const again = await f.fetchAll([feed("https://ok.example/rss")]);
  assert.equal(n, 1); assert.equal(again[0].cached, true);
  t = 11 * 60 * 1000;
  await f.fetchAll([feed("https://ok.example/rss")]);
  assert.equal(n, 2);
  const g = feedFetcher({ fetch: async () => { n++; if (fail) { fail = false; throw new TypeError("x"); } return answer(RSS); }, allowed: async () => true });
  await g.fetchAll([feed("https://ok.example/rss")]);
  const second = await g.fetchAll([feed("https://ok.example/rss")]);
  assert.equal(second[0].error, null);
});
