// The fetch and hash kernels of `cmmns likes fetch`: one HTTP/2 connection per CDN host, reused for
// every file; a resumable ranged download into "<name>.part" with its SHA-256 computed as the bytes
// arrive; retries with backoff; a 429 from the host honoured (its Retry-After, and fewer files at once).
// Media addresses on pbs.twimg.com and video.twimg.com need no sign-in, so nothing here carries a
// cookie or touches the account. Node's standard library only.
import { connect } from "node:http2";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, statSync, renameSync, rmSync } from "node:fs";

const sessions = new Map();
// One session per origin, opened once and reused; a closed or failed one is opened again.
function session(origin, opts) {
  const s = sessions.get(origin);
  if (s && !s.closed && !s.destroyed) return s;
  const n = connect(origin, opts.tls || {});
  n.on("error", () => sessions.delete(origin));
  n.on("close", () => sessions.delete(origin));
  n.setTimeout(60000, () => n.close());
  sessions.set(origin, n);
  return n;
}
export function closeAll() { for (const s of sessions.values()) s.close(); sessions.clear(); }

export class HttpError extends Error {
  constructor(status, retryAfter = null) { super(`the host answered ${status}`); this.status = status; this.retryAfter = retryAfter; }
}

// The SHA-256 of bytes already on disk (a .part to resume, or a file to compare).
export function hashFile(path, h = createHash("sha256")) {
  return new Promise((ok, no) => { createReadStream(path).on("data", (d) => h.update(d)).on("end", () => ok(h)).on("error", no); });
}

// One GET into dest. Resumes from dest.part when the host answers the range (206); starts over when it
// sends the whole file (200). Resolves to { bytes, sha256 }.
export async function getFile(url, dest, opts = {}) {
  const u = new URL(url), part = dest + ".part";
  const have = existsSync(part) ? statSync(part).size : 0;
  const h = have ? await hashFile(part) : createHash("sha256");
  const s = session(u.origin, opts);
  const req = s.request({ ":method": "GET", ":path": u.pathname + u.search, "user-agent": opts.agent || "cmmns-likes-fetch", accept: "*/*", ...(have ? { range: `bytes=${have}-` } : {}) });
  req.setTimeout(opts.timeoutMs || 60000, () => req.close());
  const head = await new Promise((ok, no) => { req.on("response", ok); req.on("error", no); req.on("close", () => no(new Error("the connection closed before the host answered"))); });
  const status = head[":status"];
  if (status === 429 || status >= 500 || status === 404 || status === 403) {
    req.close();
    const ra = Number(head["retry-after"]);
    throw new HttpError(status, Number.isFinite(ra) ? ra * 1000 : null);
  }
  if (status !== 200 && status !== 206) { req.close(); throw new HttpError(status); }
  const append = status === 206 && have > 0, hash = append ? h : createHash("sha256");
  const out = createWriteStream(part, { flags: append ? "a" : "w" });
  let bytes = append ? have : 0;
  await new Promise((ok, no) => {
    req.on("data", (d) => { hash.update(d); bytes += d.length; if (!out.write(d)) { req.pause(); out.once("drain", () => req.resume()); } });
    req.on("end", () => out.end(ok));
    req.on("error", (e) => { out.end(); no(e); });
    out.on("error", no);
  });
  renameSync(part, dest);
  return { bytes, sha256: hash.digest("hex") };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRY = new Set([429, 500, 502, 503, 504]);

// getFile with retries: network errors and 5xx back off 0.5 s, 1 s, 2 s, 4 s (with jitter); a 429
// waits as long as the host asks (30 s when it does not say) and tells the pool to slow down. A 404
// or 403 is final: the file is gone or not public.
export async function getWithRetry(url, dest, opts = {}, onLimit = () => {}) {
  const tries = opts.tries || 5;
  for (let n = 0; ; n++) {
    try { return await getFile(url, dest, opts); }
    catch (e) {
      const final = e instanceof HttpError && !RETRY.has(e.status);
      if (final || n + 1 >= tries) { if (final) rmSync(dest + ".part", { force: true }); throw e; }
      if (e instanceof HttpError && e.status === 429) { onLimit(e); await sleep(e.retryAfter ?? 30000); }
      else await sleep(500 * 2 ** n + Math.random() * 250);
    }
  }
}

// A pool that runs at most `width` jobs at once; width can drop when a host says to slow down.
export function pool(width) {
  let running = 0, limit = width;
  const waiting = [];
  const next = () => { while (running < limit && waiting.length) { const [fn, ok, no] = waiting.shift(); running++; fn().then(ok, no).finally(() => { running--; next(); }); } };
  return {
    run: (fn) => new Promise((ok, no) => { waiting.push([fn, ok, no]); next(); }),
    slow() { limit = Math.max(1, Math.floor(limit / 2)); },
    get width() { return limit; }, get busy() { return running + waiting.length; },
  };
}
