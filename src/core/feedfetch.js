// Requests for Other coverage, run by the background worker only on the user's click. Each request
// goes to one feed address the user chose, with no cookies, no referrer, no added headers and no
// body, and Daylight Commons does not follow a redirect to another address the user never allowed. The fetch
// and permission functions are passed in, so tests run without a network.

import { parseFeed, FEED_MAX_BYTES } from "./feeds.js";
import { feedOrigin } from "./outlets.js";

export const FEED_TIMEOUT_MS = 10000;
export const FEED_CACHE_MS = 10 * 60 * 1000;
export const FEED_REQUEST = Object.freeze({ method: "GET", credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", redirect: "manual" });

// The body as text, read no further than the cap. Null when the feed is larger.
async function cappedText(res, cap) {
  const len = Number(res.headers && res.headers.get && res.headers.get("content-length"));
  if (Number.isFinite(len) && len > cap) return null;
  if (!res.body || !res.body.getReader) { const t = await res.text(); return t.length > cap ? null : t; }
  const reader = res.body.getReader(), parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > cap) { reader.cancel().catch(() => {}); return null; }
    parts.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { all.set(p, at); at += p.length; }
  return new TextDecoder("utf-8").decode(all);
}

// One feed: { feed, items, error, ms }. error is a key of FEED_ERRORS (src/core/coverage.js).
export async function fetchFeed(feed, { fetch: fetchFn, now = () => Date.now(), timeoutMs = FEED_TIMEOUT_MS } = {}) {
  const t0 = now();
  const done = (extra) => ({ feed, items: [], error: null, ms: now() - t0, ...extra });
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await fetchFn(feed.url, { ...FEED_REQUEST, ...(ctl ? { signal: ctl.signal } : {}) });
    if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) return done({ error: "redirect" });
    if (!res.ok) return done({ error: "http", status: res.status });
    const text = await cappedText(res, FEED_MAX_BYTES);
    if (text == null) return done({ error: "too-large" });
    const parsed = parseFeed(text);
    if (!parsed.kind) return done({ error: "not-a-feed" });
    return done({ items: parsed.items });
  } catch (e) {
    return done({ error: e && e.name === "AbortError" ? "timeout" : "network" });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Every chosen feed at once (each to its own host, so they run in parallel). A feed whose host the
// browser has not allowed is not requested. Answers are kept in memory for ten minutes, so a second
// click on the same story asks no one again.
export function feedFetcher({ fetch: fetchFn, allowed, now = () => Date.now() }) {
  const cache = new Map();
  async function one(feed) {
    const hit = cache.get(feed.url);
    if (hit && now() - hit.at < FEED_CACHE_MS) return { ...hit.result, feed, cached: true };
    const origin = feedOrigin(feed.url);
    if (!origin || !(await allowed(origin))) return { feed, items: [], error: "no-permission", ms: 0 };
    const result = await fetchFeed(feed, { fetch: fetchFn, now });
    if (!result.error) cache.set(feed.url, { at: now(), result });
    return result;
  }
  return { fetchAll: (feeds) => Promise.all((feeds || []).map(one)), clear: () => cache.clear() };
}
