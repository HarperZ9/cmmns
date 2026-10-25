// The page's side of putting a stream together (src/core/media-assemble.js does the work): fetch
// with the same requests the page's own player makes, sending cookies only to the page's own site.
// Protected streams stop with Protected before any more is fetched.
globalThis.PBQuickStream = globalThis.PBQuickStream || (() => {
  "use strict";
  const TIMEOUT_MS = 30000;
  const Protected = PB.MediaProtected;
  const sameSite = (u) => { try { return new URL(u, location.href).origin === location.origin; } catch { return false; } };

  async function get(url, { range = null, as = "bytes" } = {}) {
    const headers = range ? { Range: `bytes=${range.offset}-${range.offset + range.length - 1}` } : {};
    const res = await fetch(url, { headers, credentials: sameSite(url) ? "include" : "omit", mode: "cors", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
    if (as === "text") return res.text();
    return { bytes: new Uint8Array(await res.arrayBuffer()), type: (res.headers.get("content-type") || "").split(";")[0].trim() };
  }

  // The stream's one file. Where a target lists several streams (Reddit: HLS and DASH), the last
  // is tried first and the others in turn; a protected stream is never retried another way.
  async function assemble(stream, onProgress, others = []) {
    let last = null;
    for (const s of [stream, ...others.filter((o) => o !== stream).reverse()]) {
      try { return await PB.assembleStream(s, { get, onProgress }); }
      catch (e) { if (e instanceof Protected) throw e; last = e; console.warn("[daylight-commons] stream could not be put together", s.url, e); }
    }
    throw last;
  }

  return Object.freeze({ assemble, get, Protected });
})();
