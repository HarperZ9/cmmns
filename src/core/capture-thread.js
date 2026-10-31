// A post's conversation as the page showed it: every comment the page rendered or received, as a tree,
// with a completeness block that says how many comments the site counted, how many were captured, and
// whether the user's cap stopped the "load more" expansion. Written beside the post's sidecar as
// "<stem>.thread.json" (project-docs/SIDECAR-FORMAT.md, "Thread file"). Commenters are other people:
// a record keeps the public handle and the words exactly as shown, and nothing the page did not show.
// No DOM and no request here; src/ext/capture-sites.js reads the page and src/ext/full-capture.js
// expands it at a person's pace.

export const CAPTURE_THREAD_FORMAT = "cmmns.capture-thread/1";
export const THREAD_CAP_DEFAULT = 200;
export const THREAD_CAP_MAX = 5000;
export const THREAD_COUNT_NOTE = "The site's own count can include deleted, removed or hidden comments that no page shows, so a capture can be short of it with nothing lost from the page.";

const iso = (t) => {
  if (t == null || t === "") return null;
  const s = typeof t === "number" && t < 1e11 ? t * 1000 : typeof t === "string" ? t.replace(/(\.\d{3})\d+/, "$1").replace(/([+-]\d\d)(\d\d)$/, "$1:$2") : t;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};
const str = (v, max = 100000) => (v == null || v === "" ? null : String(v).replace(/\r\n?/g, "\n").slice(0, max));
// A count as the site gave it: a number where it is one ("1,204" reads 1204), else its own words ("1.2K").
export function countOf(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim(), plain = s.replace(/[,\s]/g, "");
  return /^\d+$/.test(plain) ? Number(plain) : s.slice(0, 40) || null;
}
const whole = (v) => { const n = countOf(v); return typeof n === "number" ? n : null; };

// One comment, as kept. c: { id, parent, depth, author, text, score, postedAt, timeShown, edited,
// permalink, flair, deleted, links, replies (the site's own reply count) }.
export function commentRecord(c = {}) {
  return {
    id: str(c.id, 120), parent: str(c.parent, 120), depth: Number.isFinite(Number(c.depth)) && c.depth !== null && c.depth !== "" ? Number(c.depth) : null,
    author: str(c.author, 120), text: str(c.text), score: countOf(c.score), postedAt: iso(c.postedAt), timeShown: str(c.timeShown, 80),
    edited: c.edited === true ? true : null, permalink: str(c.permalink, 2000), flair: str(c.flair, 120), deleted: c.deleted === true ? true : null,
    links: [...new Set((c.links || []).filter((u) => /^https?:\/\//i.test(String(u))).map(String))].slice(0, 50), replyCount: whole(c.replies),
  };
}

// The flat list as a tree: each comment under its parent when the parent was captured, else at the top
// with parentMissing set (its parent was not on the page). Depth is the place in the tree; the site's
// own depth is kept where it differs. A comment seen twice keeps the later reading of it.
export function commentTree(flat = []) {
  const byId = new Map(), order = [];
  for (const raw of flat) {
    const c = commentRecord(raw);
    const key = c.id || `anon-${order.length}`;
    if (!byId.has(key)) order.push(key);
    byId.set(key, { ...(byId.get(key) || {}), ...Object.fromEntries(Object.entries(c).filter(([, v]) => v != null)), id: c.id });
  }
  const nodes = new Map(order.map((k) => [k, { ...byId.get(k), replies: [] }])), roots = [];
  for (const k of order) {
    const n = nodes.get(k), p = n.parent && nodes.get(n.parent);
    if (p && p !== n && !isAncestor(n, p, nodes)) p.replies.push(n);
    else { if (n.parent && !p) n.parentMissing = true; roots.push(n); }
  }
  const place = (list, d) => { for (const n of list) { if (n.depth != null && n.depth !== d) n.siteDepth = n.depth; n.depth = d; place(n.replies, d + 1); } };
  place(roots, 0);
  return roots;
}
// True when a is above b already (a cycle in what the page gave would otherwise loop).
function isAncestor(a, b, nodes) {
  for (let cur = b, i = 0; cur && i < 10000; i++) { if (cur === a) return true; cur = cur.parent ? nodes.get(cur.parent) : null; }
  return false;
}
export const countTree = (list) => list.reduce((n, c) => n + 1 + countTree(c.replies || []), 0);

// expected: the site's count (null when it gave none); captured: comments in the tree; cap: the user's
// cap on expansion; capHit: expansion stopped at the cap; stubs: "more replies" controls still unopened.
// complete is true only when nothing is known to be missing, false when something is, and "unknown"
// when the site gave no count to check against.
export function completeness({ expected = null, captured = 0, cap = THREAD_CAP_DEFAULT, capHit = false, stubs = 0, expanded = 0, reason = null } = {}) {
  const exp = whole(expected), open = Math.max(0, Number(stubs) || 0);
  const complete = exp != null ? captured >= exp && !capHit && !open : capHit || open ? false : "unknown";
  return { expected: exp, captured, missing: exp != null ? Math.max(0, exp - captured) : null, cap, capHit: !!capHit, moreStubs: open, expanded: Math.max(0, Number(expanded) || 0), complete,
    reason: str(reason, 300), countNote: exp != null && captured < exp ? THREAD_COUNT_NOTE : null };
}

// The thread file's record. post: { url, id }; source: where the comments were read ("the rendered
// page", "the page's own data"). savedAt is the time of the save.
export function captureThread({ site = null, post = {}, comments = [], expected = null, cap = THREAD_CAP_DEFAULT, capHit = false, stubs = 0, expanded = 0, source = null, reason = null, savedAt = new Date().toISOString() } = {}) {
  const tree = commentTree(comments), captured = countTree(tree);
  return { format: CAPTURE_THREAD_FORMAT, site, post: { url: str(post.url, 2000), id: str(post.id, 120) }, savedAt: iso(savedAt) || savedAt, source: str(source, 120),
    completeness: completeness({ expected, captured, cap, capHit, stubs, expanded, reason }), comments: tree };
}

export const threadFileJson = (capture) => JSON.stringify(capture, null, 2) + "\n";

// The block a sidecar's front matter and .json carry instead of the whole tree.
export function threadSummary(capture, file = null) {
  if (!capture) return null;
  const c = capture.completeness;
  return { file, expected: c.expected, captured: c.captured, complete: c.complete, capHit: c.capHit, cap: c.cap, moreStubs: c.moreStubs };
}

// The sentence a person reads first: "Captured 12 of 40 comments; the cap of 10 stopped loading more."
export function completenessSentence(c) {
  const of = c.expected != null ? `${c.captured} of ${c.expected}` : `${c.captured}`;
  const parts = [`Captured ${of} comment${(c.expected ?? c.captured) === 1 ? "" : "s"}`];
  if (c.expanded) parts.push(`after opening ${c.expanded} "more" control${c.expanded === 1 ? "" : "s"}`);
  if (c.capHit) parts.push(`the cap of ${c.cap} stopped loading more`);
  if (c.moreStubs) parts.push(`${c.moreStubs} "more replies" control${c.moreStubs === 1 ? " was" : "s were"} left unopened`);
  if (c.reason) parts.push(c.reason);
  return parts.join("; ") + ".";
}

// The comments as a person reads them, nested by reply, each with its author, score and time.
// At most max comments are written out; the thread file always holds all of them.
export function commentsMarkdown(capture, max = 1000) {
  if (!capture) return [];
  const c = capture.completeness, out = ["## Comments", "", completenessSentence(c), ...(c.countNote ? ["", c.countNote] : []), ""];
  let n = 0;
  // Reddit counts points; X, Instagram and YouTube count likes.
  const unit = capture.site === "reddit" ? "point" : "like", score = (v) => (v === 1 ? `1 ${unit}` : `${v} ${unit}s`);
  const walk = (list) => {
    for (const x of list) {
      if (n++ >= max) return;
      const pad = "  ".repeat(Math.min(x.depth || 0, 12));
      const facts = [x.score != null ? score(x.score) : null, x.postedAt || x.timeShown, x.edited ? "edited" : null, x.deleted ? "deleted" : null, x.flair ? `flair: ${x.flair}` : null].filter(Boolean);
      out.push(`${pad}- **${x.author || "unknown"}**${facts.length ? ` (${facts.join(", ")})` : ""}${x.permalink ? ` ${x.permalink}` : ""}`);
      for (const line of String(x.text || "").split("\n")) out.push(`${pad}  ${line ? "> " + line : ">"}`);
      walk(x.replies || []);
    }
  };
  walk(capture.comments);
  if (n > max) out.push("", `${n - max} more comment${n - max === 1 ? " is" : "s are"} in the thread file only.`);
  out.push("");
  return out;
}

// The wait between two "load more" steps, at a person's pace: 1.2 to 3.0 s, longer now and then.
export function expandPace(rnd = Math.random, n = 0) {
  const pause = n > 0 && n % 8 === 0 ? 2000 + rnd() * 3000 : 0;
  return Math.round(1200 + rnd() * 1800 + pause);
}
