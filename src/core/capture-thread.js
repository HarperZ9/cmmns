// A post's conversation as the page showed it: every comment the page rendered or received, as a tree,
// with a completeness block that says how many comments the site counted, how many were captured, and
// whether the user's cap stopped the "load more" expansion. Written beside the post's sidecar as
// "<stem>.thread.json" (project-docs/SIDECAR-FORMAT.md, "Thread file"). Commenters are other people:
// a record keeps the public handle and the words exactly as shown, and nothing the page did not show.
// No DOM and no request here; src/ext/capture-sites.js reads the page and src/ext/full-capture.js
// expands it at a person's pace.

export const CAPTURE_THREAD_FORMAT = "cmmns.capture-thread/2";
export const CAPTURE_THREAD_FORMAT_V1 = "cmmns.capture-thread/1";
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

// What the site's own count counts. X's reply count is of the replies directly under the post, the
// author's own included; it leaves out replies to replies. The other sites' counts are taken to cover
// the whole conversation.
export const expectedCountsFor = (site) => (site === "x" ? "direct" : "all");
// The part of a flat reading that compares with the site's count, for deciding when to stop opening more.
export const countedTowardExpected = (flat = [], site = null) => (expectedCountsFor(site) === "direct" ? flat.filter((c) => !c.parent).length : flat.length);

// True of a comment that answers the post itself, not one whose parent is missing from the page.
const isDirect = (n) => !n.parent;
const handleKey = (h) => (h ? String(h).trim().replace(/^(@|\/?u\/)/i, "").toLowerCase() || null : null);
// The post author's own continuation: their replies to the post, and to those replies, unbroken. Their
// answer to someone else is a comment like any other, and so is someone else's answer to the chain.
// Marks the nodes and returns how many, or null when the post's author is not known.
function markContinuations(roots, author) {
  const key = handleKey(author);
  if (!key) return null;
  let n = 0;
  const walk = (list) => { for (const c of list) if (handleKey(c.author) === key) { c.continuation = true; n++; walk(c.replies || []); } };
  walk(roots.filter(isDirect));
  return n;
}

// expected: the site's count (null when it gave none); expectedCounts: what that count covers ("direct"
// or "all"); captured: every comment in the tree; capturedDirect and capturedNested: those directly under
// the post and those deeper, which add up to captured; continuations: how many of captured are the post
// author's own continuation (null when the author is not known); cap: the user's cap on expansion; capHit:
// expansion stopped at the cap; stubs: "more replies" controls still unopened.
// complete is true only when the capture reached a count above zero with nothing left to open, false when
// something is known to be missing, "empty" when the site counted none, none were captured and nothing is
// left to open, and "unknown" when no count can check the capture. An empty thread has no comments to go
// and find, so it carries no reason.
export function completeness({ expected = null, expectedCounts = "all", captured = 0, capturedDirect = null, continuations = null, cap = THREAD_CAP_DEFAULT, capHit = false, stubs = 0, expanded = 0, reason = null } = {}) {
  const exp = whole(expected), open = Math.max(0, Number(stubs) || 0), blocked = !!capHit || open > 0;
  const counted = expectedCounts === "direct" && capturedDirect != null ? capturedDirect : captured;
  const complete = blocked && (exp == null || exp === 0) ? false : exp == null ? "unknown" : exp === 0 ? (captured === 0 ? "empty" : "unknown") : counted >= exp && !blocked;
  return { expected: exp, expectedCounts, captured, capturedDirect, capturedNested: capturedDirect != null ? captured - capturedDirect : null, continuations,
    missing: exp != null ? Math.max(0, exp - counted) : null, cap, capHit: !!capHit, moreStubs: open, expanded: Math.max(0, Number(expanded) || 0), complete,
    reason: complete === "empty" ? null : str(reason, 300), countNote: exp != null && counted < exp ? THREAD_COUNT_NOTE : null };
}
const countAll = (tree, block) => ({ captured: countTree(tree), capturedDirect: tree.filter(isDirect).length, ...block });

// The thread file's record. post: { url, id, author }; source: where the comments were read ("the rendered
// page", "the page's own data"). savedAt is the time of the save.
export function captureThread({ site = null, post = {}, comments = [], expected = null, cap = THREAD_CAP_DEFAULT, capHit = false, stubs = 0, expanded = 0, source = null, reason = null, savedAt = new Date().toISOString() } = {}) {
  const tree = commentTree(comments), continuations = markContinuations(tree, post.author);
  return { format: CAPTURE_THREAD_FORMAT, site, post: { url: str(post.url, 2000), id: str(post.id, 120), author: str(post.author, 120) }, savedAt: iso(savedAt) || savedAt, source: str(source, 120),
    completeness: completeness(countAll(tree, { expected, expectedCounts: expectedCountsFor(site), continuations, cap, capHit, stubs, expanded, reason })), comments: tree };
}

// A thread file of any format this build knows, as the current format. A first-format file kept one
// captured total and no post author: the counts are worked out again from its tree, and the author comes
// from the post's address where that names one. The object passed in is left as it was.
export function readCaptureThread(record) {
  if (!record || typeof record !== "object") throw new Error("not a thread file: expected an object with a format");
  if (record.format === CAPTURE_THREAD_FORMAT) return record;
  if (record.format !== CAPTURE_THREAD_FORMAT_V1) throw new Error(`thread file format ${record.format} is not one this build reads`);
  const tree = structuredClone(record.comments || []), old = record.completeness || {};
  const author = (record.post && record.post.author) || (record.site === "x" && (/\/\/(?:www\.)?(?:x|twitter)\.com\/(?!i\/)([^/]+)\/status\//.exec((record.post || {}).url || "") || [])[1]) || null;
  const continuations = markContinuations(tree, author);
  const block = countAll(tree, { expected: old.expected, expectedCounts: expectedCountsFor(record.site), continuations, cap: old.cap, capHit: old.capHit, stubs: old.moreStubs, expanded: old.expanded, reason: old.reason });
  return { ...record, format: CAPTURE_THREAD_FORMAT, upgradedFrom: CAPTURE_THREAD_FORMAT_V1, post: { ...record.post, author }, completeness: completeness(block), comments: tree };
}

export const threadFileJson = (capture) => JSON.stringify(capture, null, 2) + "\n";

// The block a sidecar's front matter and .json carry instead of the whole tree.
export function threadSummary(capture, file = null) {
  if (!capture) return null;
  const c = capture.completeness;
  return { file, expected: c.expected, expectedCounts: c.expectedCounts, captured: c.captured, capturedDirect: c.capturedDirect, capturedNested: c.capturedNested, continuations: c.continuations, complete: c.complete, capHit: c.capHit, cap: c.cap, moreStubs: c.moreStubs };
}

// The opening of the sentence, in the units the site's count is in.
function capturedLine(c) {
  const plain = (n) => `${n} comment${n === 1 ? "" : "s"}`;
  if (c.expected == null || c.expected === 0) return `Captured ${plain(c.captured)}`;
  if (c.expectedCounts !== "direct" || c.capturedDirect == null) return `Captured ${c.captured} of ${plain(c.expected)}`;
  const nested = c.capturedNested ? `, and ${c.capturedNested} more deeper in the thread` : "";
  return `Captured ${c.capturedDirect} of ${c.expected} direct repl${c.expected === 1 ? "y" : "ies"}${nested}`;
}
// The sentence a person reads first: "Captured 12 of 40 comments; the cap of 10 stopped loading more."
export function completenessSentence(c) {
  if (c.complete === "empty") return "No comments: the site counted none on this post.";
  const parts = [capturedLine(c)];
  if (c.expected === 0 && c.captured) parts.push("the site counted none");
  if (c.continuations) parts.push(`${c.continuations} of ${c.captured} ${c.continuations === 1 ? "is" : "are"} the post author's own continuation`);
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
      const facts = [x.continuation ? "the post author's continuation" : null, x.score != null ? score(x.score) : null, x.postedAt || x.timeShown, x.edited ? "edited" : null, x.deleted ? "deleted" : null, x.flair ? `flair: ${x.flair}` : null].filter(Boolean);
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
