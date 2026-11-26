// Automated X Likes pagination, canonical deduplication index (seenIds + media/content SHA-256),
// rate-limit-safe backoff, pause/stop control, and fail-closed CAPTCHA/challenge halt.
// Pure ES module: no DOM, no network I/O (caller supplies fetchPage and sleep).

import { parseLikes, manifestLine, postKey } from "./likes.js";
import { sidecarRoutingMeta } from "./download-route.js";

export const LIKES_DEDUP_KEY = "pb.likes.dedup.v1";
export const LIKES_DEDUP_FORMAT = "cmmns.likes-dedup/1";
const CHALLENGE_RE = /captcha|arkose|verify\s+your\s+identity|human\s+verification|challenge_required|are\s+you\s+a\s+robot/i;

function walkTimeline(root, visit, limit = 20000) {
  const stack = [root];
  for (let n = 0; stack.length && n < limit; n++) {
    const v = stack.pop();
    if (!v || typeof v !== "object") continue;
    visit(v);
    if (Array.isArray(v)) { for (const x of v) if (x && typeof x === "object") stack.push(x); }
    else { for (const k of Object.keys(v)) if (v[k] && typeof v[k] === "object") stack.push(v[k]); }
  }
}

// Extracts the bottom/top pagination cursors from X's Likes GraphQL response.
export function extractLikesCursor(json) {
  let bottomCursor = null, topCursor = null;
  if (!json || typeof json !== "object") return { bottomCursor, topCursor };
  if (typeof json.cursor === "string" && json.cursor) bottomCursor = json.cursor;
  walkTimeline(json, (node) => {
    const entryId = String(node.entryId || "");
    const c = node.content && typeof node.content === "object" ? node.content : node;
    const type = String(c.cursorType || c.cursor_type || "");
    const val = typeof c.value === "string" && c.value.trim() ? c.value.trim() : null;
    if (!val) return;
    if (!bottomCursor && (type === "Bottom" || entryId.startsWith("cursor-bottom"))) bottomCursor = val;
    if (!topCursor && (type === "Top" || entryId.startsWith("cursor-top"))) topCursor = val;
  });
  return { bottomCursor, topCursor };
}

// Rewrites the cursor parameter in a learned X Likes GraphQL URL (or simple ?cursor= URL).
export function buildNextLikesUrl(templateUrl, cursor) {
  const u = new URL(templateUrl, "https://x.com");
  const rawVars = u.searchParams.get("variables");
  if (rawVars) {
    try {
      const vars = JSON.parse(rawVars);
      if (cursor != null && cursor !== "") vars.cursor = String(cursor);
      else delete vars.cursor;
      u.searchParams.set("variables", JSON.stringify(vars));
      return u.toString();
    } catch { /* fall through to query param */ }
  }
  if (cursor != null && cursor !== "") u.searchParams.set("cursor", String(cursor));
  else u.searchParams.delete("cursor");
  return u.toString();
}

// Fail-closed check for CAPTCHA or anti-bot challenges. Never attempts to bypass.
export function isChallengeResponse({ status = 200, json = null, bodyText = "" } = {}) {
  const text = `${bodyText || ""} ${json ? JSON.stringify(json) : ""}`;
  if (CHALLENGE_RE.test(text)) return true;
  if (status === 403 && /challenge|locked|suspended|verify/i.test(text)) return true;
  return false;
}

// Canonical deduplication index across post IDs, media/content SHA-256 hashes, and direct URLs.
export function createDedupIndex(initial = null) {
  const seenIds = new Set();
  const contentHashes = new Set();
  const mediaUrls = new Set();
  const addId = (id) => {
    if (id == null || id === "") return;
    const raw = String(id).replace(/^x:/, "");
    seenIds.add(postKey(raw));
  };
  const addHash = (h) => {
    if (!h) return;
    const norm = String(h).toLowerCase();
    contentHashes.add(norm.startsWith("sha256:") ? norm : `sha256:${norm}`);
  };
  const addUrl = (u) => { if (u) mediaUrls.add(String(u)); };
  if (initial) {
    for (const id of initial.seenIds || initial.ids || []) addId(id);
    for (const h of initial.contentHashes || initial.hashes || []) addHash(h);
    for (const u of initial.mediaUrls || initial.urls || []) addUrl(u);
  }
  return {
    seenIds, contentHashes, mediaUrls,
    has({ id = null, sha256 = null, urls = [] } = {}) {
      if (id != null && seenIds.has(postKey(String(id).replace(/^x:/, "")))) return true;
      if (sha256) {
        const norm = String(sha256).toLowerCase();
        if (contentHashes.has(norm.startsWith("sha256:") ? norm : `sha256:${norm}`)) return true;
      }
      const list = (urls || []).filter(Boolean);
      return list.length > 0 && list.every((u) => mediaUrls.has(String(u)));
    },
    add({ id = null, sha256 = null, urls = [] } = {}) {
      addId(id);
      addHash(sha256);
      for (const u of urls || []) addUrl(u);
    },
    size: () => ({ ids: seenIds.size, hashes: contentHashes.size, urls: mediaUrls.size }),
    serialize(now = new Date().toISOString()) {
      return { format: LIKES_DEDUP_FORMAT, updatedAt: now, seenIds: [...seenIds].sort(), contentHashes: [...contentHashes].sort(), mediaUrls: [...mediaUrls].sort() };
    },
  };
}

// Applies skip-duplicates policy (default skipDuplicates=true; user can opt in via includeDuplicates=true).
export function admitWithPolicy(dedupIndex, post, { skipDuplicates = true, includeDuplicates = false, sha256 = null, seen = undefined } = {}) {
  const shouldSkip = includeDuplicates ? false : skipDuplicates !== false;
  const line = manifestLine(post, seen);
  const urls = line.files.map((f) => f.url);
  const duplicate = dedupIndex.has({ id: post.id, sha256, urls });
  const routing = sidecarRoutingMeta({ site: "x", postUrl: `https://x.com/${post.handle || "i"}/status/${post.id}`, links: post.links || [], kind: line.files.length ? line.files[0].kind : "text" }, { url: urls[0] || "", sha256 });
  if (duplicate && shouldSkip) return { action: "skip", duplicate: true, dedupKey: routing.dedup_key };
  dedupIndex.add({ id: post.id, sha256, urls });
  return { action: "save", duplicate, dedupKey: routing.dedup_key, line: { ...line, ...routing } };
}

function backoffDelay(res, attempt, initialMs, maxMs, nowMs) {
  if (res && Number.isFinite(Number(res.retryAfterSec)) && Number(res.retryAfterSec) >= 0) {
    return Math.min(maxMs, Math.max(initialMs, Math.round(Number(res.retryAfterSec) * 1000)));
  }
  if (res && Number.isFinite(Number(res.resetEpochSec))) {
    const delta = Math.round(Number(res.resetEpochSec) * 1000 - nowMs);
    if (delta > 0) return Math.min(maxMs, Math.max(initialMs, delta));
  }
  return Math.min(maxMs, initialMs * Math.pow(2, attempt));
}

async function waitWhilePaused(shouldPause, shouldStop, sleep) {
  while (!shouldStop() && shouldPause()) await sleep(200);
}

// Automatically paginates every X Likes timeline page until exhaustion, stop, challenge, or rate-limit cap.
// maxPages = 0 (default) paginates until timeline exhaustion with no arbitrary client-side page ceiling.
export async function paginateLikes({
  fetchPage,
  dedupIndex = createDedupIndex(),
  skipDuplicates = true,
  includeDuplicates = false,
  startCursor = null,
  maxPages = 0,
  initialBackoffMs = 1500,
  maxBackoffMs = 60000,
  maxRateLimitRetries = 6,
  onProgress = null,
  onItem = null,
  shouldPause = () => false,
  shouldStop = () => false,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = () => Date.now(),
} = {}) {
  const items = [], visitedCursors = new Set();
  const pageCap = Number(maxPages) > 0 ? Math.floor(Number(maxPages)) : Infinity;
  let cursor = startCursor, pagesFetched = 0, saved = 0, skippedDuplicates = 0, totalSeen = 0, stoppedReason = "exhausted", rateRetries = 0;
  const report = () => {
    const snap = { saved, skippedDuplicates, totalSeen, pagesFetched, nextCursor: cursor, stoppedReason };
    if (onProgress) onProgress(snap);
    return snap;
  };
  for (;;) {
    await waitWhilePaused(shouldPause, shouldStop, sleep);
    if (shouldStop()) { stoppedReason = "stopped"; break; }
    if (pagesFetched >= pageCap) { stoppedReason = "max_pages"; break; }
    const res = await fetchPage(cursor);
    if (!res) { stoppedReason = "error"; break; }
    if (isChallengeResponse(res)) { stoppedReason = "challenge_required"; break; }
    if (res.status === 429 || res.remaining === 0) {
      if (rateRetries >= maxRateLimitRetries) { stoppedReason = "rate_limited"; break; }
      const wait = backoffDelay(res, rateRetries++, initialBackoffMs, maxBackoffMs, now());
      await sleep(wait);
      continue;
    }
    if (res.status && res.status >= 400) { stoppedReason = "error"; break; }
    rateRetries = 0;
    pagesFetched++;
    const posts = parseLikes(res.json);
    for (const p of posts) {
      if (shouldStop()) { stoppedReason = "stopped"; break; }
      if (!p.media.length && !p.text) continue;
      totalSeen++;
      const resAdmit = admitWithPolicy(dedupIndex, p, { skipDuplicates, includeDuplicates });
      if (resAdmit.action === "skip") skippedDuplicates++;
      else { saved++; items.push(resAdmit.line); if (onItem) await onItem(resAdmit.line, p); }
      if (shouldStop()) { stoppedReason = "stopped"; break; }
    }
    if (shouldStop()) { stoppedReason = "stopped"; report(); break; }
    const { bottomCursor } = extractLikesCursor(res.json);
    if (!posts.length || !bottomCursor || bottomCursor === cursor || visitedCursors.has(bottomCursor)) {
      cursor = null;
      stoppedReason = "exhausted";
      report();
      break;
    }
    visitedCursors.add(bottomCursor);
    cursor = bottomCursor;
    report();
    if (initialBackoffMs > 0) await sleep(initialBackoffMs);
  }
  return { ...report(), items };
}
