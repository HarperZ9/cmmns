// Bluesky account and post data from the responses the Bluesky web app already loaded for the
// page (app.bsky.unspecced.getPostThreadV2, app.bsky.feed.getPostThread, getProfile(s), feeds),
// passed on by src/ext/bskysniff.js. Radar makes no request of its own. Field names follow the
// public AT Protocol lexicons (app.bsky.actor.defs#profileViewBasic, app.bsky.feed.defs#postView).

function walk(json, visit, limit = 200000) {
  const stack = [json];
  let guard = 0;
  while (stack.length && guard++ < limit) {
    const v = stack.pop();
    if (!v || typeof v !== "object") continue;
    visit(v);
    for (const k in v) if (v[k] && typeof v[k] === "object") stack.push(v[k]);
  }
}

const isProfile = (v) => typeof v.did === "string" && v.did.startsWith("did:") && typeof v.handle === "string";

// handle (lower case) -> what Bluesky loaded about the account. Labels the account put on itself
// (src equal to its own DID) and system values starting with "!" are left out.
export function bskyAuthors(json) {
  const out = new Map();
  if (!json) return out;
  walk(json, (v) => {
    if (!isProfile(v)) return;
    const labels = (Array.isArray(v.labels) ? v.labels : []).filter((l) => l && l.val && l.src !== v.did && !String(l.val).startsWith("!")).map((l) => String(l.val));
    const r = { handle: v.handle, did: v.did, aboutRead: true, labelSource: "Bluesky moderation" };
    if (v.displayName) r.display = String(v.displayName).slice(0, 80);
    if (typeof v.createdAt === "string" && /^\d{4}-\d{2}-\d{2}/.test(v.createdAt)) r.joinDate = v.createdAt.slice(0, 10);
    if (labels.length) r.platformLabels = [...new Set(labels)];
    if (v.verification && v.verification.verifiedStatus === "valid") r.verified = true;
    if (v.verification && v.verification.trustedVerifierStatus === "valid") r.trustedVerifier = true;
    if (v.handle === "handle.invalid") r.handleInvalid = true;
    if (Number.isFinite(v.followersCount)) r.followersCount = v.followersCount;
    if (Number.isFinite(v.followsCount)) r.followingCount = v.followsCount;
    if (Number.isFinite(v.postsCount)) r.postsCount = v.postsCount;
    const k = v.handle.toLowerCase();
    out.set(k, { ...(out.get(k) || {}), ...r });
  });
  return out;
}

// Post record key -> { id, author, posted, langs } for posts in the response.
export function bskyPosts(json) {
  const out = new Map();
  if (!json) return out;
  walk(json, (v) => {
    if (typeof v.uri !== "string" || !v.author || !isProfile(v.author) || !v.record || typeof v.record.text !== "string") return;
    const id = v.uri.split("/").pop();
    out.set(id, { id, author: v.author.handle, posted: v.record.createdAt || null, langs: Array.isArray(v.record.langs) ? v.record.langs : [] });
  });
  return out;
}
