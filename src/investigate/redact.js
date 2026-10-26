// Redaction for newsroom, legal and research exports. Every @handle, and every handle inside an X,
// Twitter, Bluesky, Threads, Instagram or TikTok address, becomes a salted pseudonym unless the
// case's actor list marks that account public-figure. A private actor's recorded name is replaced
// the same way. The salt lives in case.json, so one case gives one pseudonym per account and two
// cases cannot be joined on them. In source-protection mode (forceAll) public figures are shown as
// pseudonyms too, unless the actor list marks one keep_name (`case actor @h --keep-name`).
import { createHash } from "node:crypto";

const HANDLE = /(^|[^\w@.])@([A-Za-z0-9_]{1,30})\b/g;
const PROFILE_URL = /(https?:\/\/(?:www\.|mobile\.)?(?:x|twitter|instagram|tiktok|threads)\.(?:com|net)\/@?)([A-Za-z0-9_.]{1,30})(?=[/?#\s"]|$)/gi;
const NOT_HANDLES = new Set(["i", "home", "search", "explore", "intent", "share", "hashtag", "settings", "status", "p", "reel"]);

export const pseudonym = (handle, salt) => "acct-" + createHash("sha256").update(`${salt}\u0000${String(handle).toLowerCase().replace(/^@/, "")}`).digest("hex").slice(0, 10);

export function makeRedactor(actors, salt, { forceAll = false } = {}) {
  const pub = new Set(actors.filter((a) => (forceAll ? a.keep_name : a.public_figure)).map((a) => String(a.handle || "").toLowerCase().replace(/^@/, "")).filter(Boolean));
  const names = actors.filter((a) => !(forceAll ? a.keep_name : a.public_figure) && a.name && String(a.name).trim().length > 2).map((a) => [a.name, a.handle]);
  const seen = new Map();
  const swap = (h) => {
    const k = h.toLowerCase();
    if (pub.has(k)) return null;
    const p = pseudonym(k, salt);
    seen.set(k, p);
    return p;
  };
  const text = (s) => {
    let out = String(s).replace(PROFILE_URL, (m, pre, h) => (NOT_HANDLES.has(h.toLowerCase()) ? m : (swap(h) ? pre + swap(h) : m)));
    out = out.replace(HANDLE, (m, pre, h) => { const p = swap(h); return p ? `${pre}[${p}]` : m; });
    for (const [name, h] of names) out = out.split(name).join(`[${pseudonym(h || name, salt)}]`);
    return out;
  };
  const deep = (v) => (typeof v === "string" ? text(v) : Array.isArray(v) ? v.map(deep) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)])) : v);
  return { text, deep, redacted: () => seen.size, publicFigures: [...pub].sort() };
}
