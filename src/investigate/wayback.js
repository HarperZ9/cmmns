// Asking the Wayback Machine to save a page, with retry and backoff. This is one of the two network
// paths in a case (the other is fetching the page itself in `case add <url>`), and it runs only
// when the user adds a URL without --no-archive. fetchFn and sleep are injected so tests run offline.

export const WAYBACK_SAVE = "https://web.archive.org/save/";
const SNAPSHOT = /\/web\/(\d{14})\/(.+)$/;

// The snapshot address from a save response: the Content-Location header or the final URL.
export function snapshotFrom(res) {
  const loc = (res.headers && typeof res.headers.get === "function" && (res.headers.get("content-location") || res.headers.get("location"))) || "";
  for (const cand of [loc, res.url || ""]) {
    const m = String(cand).match(SNAPSHOT);
    if (m) return { url: `https://web.archive.org/web/${m[1]}/${m[2]}`, timestamp: m[1] };
  }
  return null;
}

const retryable = (status) => status === 429 || status >= 500;

// Resolves to { requested, url, timestamp, attempts, error }. Never throws for network trouble;
// the error is recorded on the source row instead, because a missing archive is itself data.
export async function requestSnapshot(target, { fetchFn = globalThis.fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), tries = 4, baseMs = 2000, now = () => new Date().toISOString() } = {}) {
  const out = { requested: now(), url: null, timestamp: null, attempts: 0, error: null };
  for (let i = 0; i < tries; i++) {
    out.attempts = i + 1;
    try {
      const res = await fetchFn(WAYBACK_SAVE + target, { method: "GET", redirect: "follow", headers: { "user-agent": "daylight-case (+https://github.com/HarperZ9/daylight-commons)" } });
      const snap = snapshotFrom(res);
      if (snap) return { ...out, ...snap, error: null };
      out.error = `HTTP ${res.status}, no snapshot address in the response`;
      if (!retryable(res.status)) return out;
    } catch (e) {
      out.error = `${e.name || "Error"}: ${e.message}`;
    }
    if (i < tries - 1) await sleep(baseMs * 2 ** i);
  }
  return out;
}
