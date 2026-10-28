// Library capture (project-docs/LIBRARY-CAPTURE.md): a whole page's posts saved as one folder.
// This module is the part with no page in it: which pages are library pages and what folder each
// one fills, which posts a library keeps, the index.jsonl line for each saved post, and the
// LIBRARY.md header. The page side is src/ext/library.js; the case hand-off is
// `daylight case add-library` (src/investigate/library.js).

export const LIBRARY_FORMAT = "daylight.library/1";
export const LIBRARY_CAP = 500;

// The scope note carried by every LIBRARY.md and by the command line help (person mode, settled by
// the author on 2026-10-28): about a person, the tools show only what can be measured or quoted from
// their public material, each with its method and a link to the posts; they never say anything about
// the person themself.
export const LIBRARY_SCOPE = [
  "Scope: a library is the posts this page showed, saved as they were shown.",
  "When the subject is a person, the tools show only evidence: what can be measured (with its method and denominator) or quoted from the public posts, each linked to the post it came from.",
  "They never label a person's character, disposition, beliefs not stated, honesty or intent, never predict what a person will do, and never rank people on any of these. Two quotes on the same subject from different dates are shown side by side; a person reads them and judges.",
];

const X_RESERVED = new Set(["home", "explore", "notifications", "messages", "settings", "compose", "tos", "privacy", "login", "logout", "signup", "i", "search", "hashtag", "communities", "jobs", "premium", "account", "intent", "share", "who_to_follow"]);
const X_TABS = new Set(["", "media", "with_replies", "highlights", "articles", "superfollows"]);
const part = (s, max = 60) => String(s || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/, "");

function xLibrary(u, parts) {
  const [first = "", second = "", third = ""] = parts;
  if (first === "search") {
    const q = u.searchParams.get("q");
    return q && part(q) ? { site: "x", kind: "search", name: `search-${part(q, 48)}`, label: `X search "${q}"`, author: null } : null;
  }
  if (first === "hashtag" && second) return { site: "x", kind: "search", name: `hashtag-${part(second, 48)}`, label: `X hashtag #${second}`, author: null };
  if (first === "i" && second === "lists" && /^\d+$/.test(third) && parts.length === 3) return { site: "x", kind: "list", name: `list-${third}`, label: `X list ${third}`, author: null };
  if (!/^[A-Za-z0-9_]{1,15}$/.test(first) || X_RESERVED.has(first.toLowerCase()) || parts.length > 2 || !X_TABS.has(second)) return null;
  return { site: "x", kind: "profile", name: first.toLowerCase(), label: `@${first} on X`, author: first };
}

function redditLibrary(parts) {
  const [first = "", name = "", tab = "", ...rest] = parts;
  if (!/^[A-Za-z0-9_-]{2,30}$/.test(name) || rest.length) return null;
  if (first === "r" && ["", "hot", "new", "top", "rising", "controversial"].includes(tab)) return { site: "reddit", kind: "subreddit", name: `r-${name.toLowerCase()}`, label: `r/${name} on Reddit`, author: null };
  if ((first === "user" || first === "u") && ["", "submitted", "posts", "overview"].includes(tab)) return { site: "reddit", kind: "user", name: `u-${name.toLowerCase()}`, label: `u/${name} on Reddit`, author: `u/${name}` };
  return null;
}

// The library a page fills, or null when the page is not a profile, list, search, user or
// subreddit page. { site, kind, name, label, author, folder }: folder is "<site>-<name>", the folder
// under "<save folder>/library/". author is set where the library is one account's own posts.
export function libraryOf(href) {
  let u;
  try { u = new URL(href); } catch { return null; }
  const host = u.hostname.replace(/^(www|mobile|old|new)\./, ""), parts = u.pathname.split("/").filter(Boolean);
  const lib = host === "x.com" || host === "twitter.com" ? xLibrary(u, parts) : host === "reddit.com" ? redditLibrary(parts) : null;
  return lib ? { ...lib, folder: `${lib.site}-${lib.name}` } : null;
}

// Why a post is left out, as the words LIBRARY.md counts it under; null to keep it.
// post: { id, handle, promoted }. One account's library keeps that account's own posts only, so a
// repost of someone else's post (which the profile also shows) is skipped and counted.
export const SKIP = Object.freeze({
  noId: "no post id on the page, so it could not be told apart from the others",
  promoted: "a promoted post (an advert)",
  other: "a post by another account (a repost, or another account's post shown in the feed)",
});
export function librarySkip(lib, post) {
  if (!post || !post.id) return SKIP.noId;
  if (post.promoted) return SKIP.promoted;
  const norm = (h) => String(h || "").replace(/^@/, "").replace(/^u\//i, "").toLowerCase();
  if (lib.author && norm(post.handle) !== norm(lib.author)) return SKIP.other;
  return null;
}

// A new library's record, or the one kept from before (resumable).
export function libraryState(lib, kept = null, now = new Date().toISOString()) {
  const base = kept && kept.format === LIBRARY_FORMAT && kept.folder === lib.folder ? kept : { format: LIBRARY_FORMAT, folder: lib.folder, site: lib.site, kind: lib.kind, label: lib.label, author: lib.author || null, created: now, sources: [], sessions: [], items: [], skipped: {} };
  return { ...base, sources: [...base.sources], sessions: [...base.sessions], items: [...base.items], skipped: { ...base.skipped } };
}

// One saved post's line for index.jsonl. files: [{ name, sha256 }] in the order saved, the sidecar
// last; sha256 is null for a file the host did not let the page read (the browser saved it as sent).
// fields: what the site's own data says about the post beyond its words (language, edits, labels),
// kept as the site gave it.
export function libraryLine({ id, url, handle = null, posted = null, saved, kind = "media", files = [], missing = [], fields = null }) {
  const f = files.map((x) => ({ name: String(x.name), sha256: x.sha256 || null, ...(x.sha256 ? {} : { note: x.note || "not hashed: the host did not let the page read the file" }) }));
  return { id: String(id), url: url || null, handle: handle || null, posted: posted || null, saved, kind, files: f, ...(missing.length ? { missing: missing.map(String) } : {}), ...(fields && Object.keys(fields).length ? { fields } : {}) };
}

export const libraryIndex = (state) => state.items.map((l) => JSON.stringify(l)).join("\n") + (state.items.length ? "\n" : "");

// The header a person reads first: where the posts came from, when, how many, and what was left out.
export function libraryMarkdown(state) {
  const files = state.items.reduce((n, l) => n + l.files.length, 0), unhashed = state.items.reduce((n, l) => n + l.files.filter((f) => !f.sha256).length, 0);
  const missing = state.items.filter((l) => (l.missing || []).length).length;
  const L = ["---", `format: ${JSON.stringify(LIBRARY_FORMAT)}`, `library: ${JSON.stringify(state.folder)}`, `site: ${JSON.stringify(state.site)}`, `kind: ${JSON.stringify(state.kind)}`,
    ...(state.author ? [`author: ${JSON.stringify(state.author)}`] : []), `posts: ${state.items.length}`, `created: ${JSON.stringify(state.created)}`, "---", "", `# Library: ${state.label}`, ""];
  L.push(`${state.items.length} post${state.items.length === 1 ? "" : "s"} saved, ${files} files. Each post has its files and a sidecar note (daylight.sidecar/1); index.jsonl lists every post with the SHA-256 of each file.`, "");
  L.push("## Source pages", "", ...state.sources.map((s) => `- ${s}`), "");
  L.push("## Sessions (UTC)", "", ...state.sessions.map((s) => `- ${s.started} to ${s.stopped || "still running, or the tab closed before Stop"}: ${s.saved || 0} saved, ${s.mode === "auto" ? "auto-scroll" : "collected while scrolling"}${s.why ? `; stopped: ${s.why}` : ""}`), "");
  const skipped = Object.entries(state.skipped).filter(([, n]) => n > 0);
  L.push("## Skipped", "", ...(skipped.length ? skipped.map(([why, n]) => `- ${n}: ${why}`) : ["- none"]));
  if (missing) L.push(`- ${missing} saved post${missing === 1 ? " lacks" : "s lack"} some media; index.jsonl says why under "missing" (protected media is never downloaded).`);
  if (unhashed) L.push(`- ${unhashed} file${unhashed === 1 ? "" : "s"} saved without a hash (the host did not let the page read them); \`daylight case add-library\` hashes them from disk.`);
  L.push("", "Only posts the page loaded are here. A feed that stopped loading, deleted or hidden posts, and anything past the cap are not.", "", "## Scope", "", ...LIBRARY_SCOPE.map((s) => `- ${s}`), "",
    "Hand-off: `daylight case add-library <this folder> --case <case folder>` adds every post, with its hashes, to a case.", "");
  return L.join("\n");
}
