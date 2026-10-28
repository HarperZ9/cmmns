// What a post said about the media it carried, kept beside the file: the post's text exactly as
// written, who posted it and when, where it lives, the alt text, hashtags and links, the quoted or
// parent post, the author's own continuation of the thread, and the item's place in a gallery.
// Built only from what the page already shows; nothing here makes a request.

// UTC ISO time from a date, a number or text such as Reddit's "2026-10-20T21:04:00.000000+0000".
const iso = (t) => {
  if (t == null || t === "") return null;
  const s = typeof t === "string" ? t.replace(/(\.\d{3})\d+/, "$1").replace(/([+-]\d\d)(\d\d)$/, "$1:$2") : t;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};
const clean = (s) => (s == null ? null : String(s).replace(/\r\n?/g, "\n"));

// The sidecar format, the contract with any library that reads these files
// (project-docs/SIDECAR-FORMAT.md). A change that removes or renames a field raises the number.
export const SIDECAR_FORMAT = "daylight.sidecar/1";

// Hashtags and links in a text, each once, in order.
export function textTags(text) {
  const t = String(text || "");
  const hashtags = [...new Set([...t.matchAll(/(^|[^\p{L}\p{N}_&])#([\p{L}\p{N}_]{1,100})/gu)].map((m) => "#" + m[2]))];
  const links = [...new Set([...t.matchAll(/\bhttps?:\/\/[^\s<>"')\]]+/gi)].map((m) => m[0].replace(/[.,;:!?]+$/, "")))];
  return { hashtags, links };
}

// One record. Fields not known stay null; the text keeps its line breaks.
export function postMeta(m = {}, now = new Date().toISOString()) {
  const text = clean(m.text);
  const tags = textTags([text, ...(m.thread || [])].join("\n"));
  const sub = (p) => (p && (p.text || p.url) ? { text: clean(p.text), url: p.url || null, author: p.author || null } : null);
  return {
    format: SIDECAR_FORMAT,
    site: m.site || null, title: m.title ? String(m.title) : null, text,
    author: { name: m.authorName || null, handle: m.handle ? String(m.handle).replace(/^@/, "") : null },
    postUrl: m.postUrl || null, mediaUrl: m.mediaUrl || null, pageUrl: m.pageUrl || null,
    postedAt: iso(m.postedAt), savedAt: iso(now) || now,
    alt: m.alt && !/^(image|video|gif|embedded video)$/i.test(String(m.alt).trim()) ? String(m.alt) : null,
    hashtags: [...new Set([...tags.hashtags, ...(m.hashtags || [])])], links: [...new Set([...(m.links || []), ...tags.links])],
    quoted: sub(m.quoted), parent: sub(m.parent), thread: (m.thread || []).map(clean).filter(Boolean),
    subreddit: m.subreddit || null, flair: m.flair ? String(m.flair).slice(0, 120) : null,
    item: m.total > 1 ? { index: (m.index || 0) + 1, total: m.total } : null,
    // "text" for a post or a selection saved on its own, as a note with no file; else "media"
    kind: m.kind === "text" ? "text" : "media", selection: !!m.selection,
    // link cards as the page showed them, and a poll's options and results
    cards: (m.cards || []).filter((c) => c && c.url).map((c) => ({ url: String(c.url), title: c.title ? String(c.title).slice(0, 300) : null })).slice(0, 20),
    poll: m.poll && (m.poll.options || []).length ? { options: m.poll.options.map((o) => ({ label: String(o.label || "").slice(0, 200), result: o.result != null ? String(o.result) : null })),
      total: m.poll.total != null ? String(m.poll.total) : null, status: m.poll.status ? String(m.poll.status) : null } : null,
    // false when the page showed only the start of the text ("Show more") and no fuller copy was loaded
    textComplete: m.textComplete !== false,
    // true when the author's continuation is proved part by part; "unknown" when the page may hold
    // more of the thread than could be proved; null when there is no thread
    threadComplete: m.threadComplete === true ? true : m.threadComplete === "unknown" ? "unknown" : null,
    // the counts the page showed, as it showed them, with the time they were read
    engagement: m.engagement && typeof m.engagement === "object" ? { ...Object.fromEntries(Object.entries(m.engagement).filter(([, v]) => v != null).map(([k, v]) => [k, typeof v === "number" ? v : String(v)])), at: iso(now) || now } : null,
    // Study: saved to study later; the optional line on what draws the person to it
    study: !!m.study, studyNote: m.studyNote ? String(m.studyNote).replace(/\s+/g, " ").trim().slice(0, 300) || null : null,
    // Further text the page showed, under its own heading (YouTube chapters and transcript).
    notes: (m.notes || []).filter((n) => n && n.label && n.text).map((n) => ({ label: String(n.label).slice(0, 80), text: clean(n.text) })),
    // The analyses a study save carries as notes (src/core/discourse/cards.js studyNotes), by sign family.
    analysis: (m.analysis || []).filter((a) => typeof a === "string" && /^[a-z][a-z0-9-]{1,40}$/.test(a)).slice(0, 20),
  };
}

// Letters and digits joined by hyphens, cut at a word boundary within max characters.
function slugText(s, max) {
  const full = String(s || "").normalize("NFKC").replace(/https?:\/\/\S+/g, " ").replace(/[#@]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase();
  if (full.length <= max) return full;
  const cut = full.slice(0, max + 1), at = cut.lastIndexOf("-");
  return (at > max / 2 ? cut.slice(0, at) : full.slice(0, max)).replace(/-+$/, "");
}

// "<handle>_<date>_<slug-from-text>[-n].<ext>": sorts by person then day, and reads at a glance.
export function metaName(meta, ext) {
  const handle = slugText(meta.author && meta.author.handle, 30) || slugText(meta.site, 30) || "media";
  const date = (meta.postedAt || meta.savedAt || "").slice(0, 10) || "undated";
  const words = slugText(meta.text || meta.title || meta.alt, 48) || "post";
  const n = meta.item ? `-${meta.item.index}` : "";
  return `${handle}_${date}_${words}${n}.${String(ext || "bin").replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin"}`;
}

// "@name" on X, "u/name" on Reddit as Reddit writes it.
const at = (h) => (/^u\//.test(h) ? h : "@" + h);
const quoteBlock = (t) => String(t).split("\n").map((l) => (l ? "> " + l : ">")).join("\n");

// The front matter that opens every .md sidecar: the fields a library indexes, one JSON value per
// line (YAML reads them as they are), so a reader needs no Markdown parser.
function frontMatter(meta, files) {
  const rows = { format: SIDECAR_FORMAT, files, kind: meta.kind || "media", site: meta.site, handle: meta.author.handle, author: meta.author.name, posted: meta.postedAt, saved: meta.savedAt,
    post: meta.postUrl, media: meta.mediaUrl, page: meta.postUrl ? null : meta.pageUrl, subreddit: meta.subreddit, hashtags: meta.hashtags,
    item: meta.item ? `${meta.item.index} of ${meta.item.total}` : null,
    flair: meta.flair || null, selection: meta.selection ? true : null,
    thread_complete: meta.thread && meta.thread.length && meta.threadComplete === true ? true : meta.threadComplete === "unknown" ? "unknown" : null,
    engagement: meta.engagement || null,
    text_complete: meta.textComplete === false ? false : null, study: meta.study ? true : null, note: meta.studyNote || null, analysis: meta.analysis || null };
  return ["---", ...Object.entries(rows).filter(([k, v]) => k === "files" || (v != null && !(Array.isArray(v) && !v.length))).map(([k, v]) => `${k}: ${JSON.stringify(v)}`), "---", ""];
}

// The sidecar a person reads: front matter, then the post's text first. fileNames: one name, or
// every file of a post saved together (then the item line is left out: the list says it).
export function sidecarMarkdown(meta, fileNames = null) {
  const files = [].concat(fileNames || []).filter(Boolean);
  const m = files.length > 1 ? { ...meta, item: null } : meta;
  const who = [m.author.name, m.author.handle ? at(m.author.handle) : null].filter(Boolean).join(" ");
  const out = [...frontMatter(m, files), `# ${who || m.title || (m.kind === "text" ? "Saved text" : "Saved media")}${m.item ? ` (item ${m.item.index} of ${m.item.total})` : ""}`, ""];
  if (m.title && (m.site === "reddit" || m.site === "youtube" || m.selection)) out.push(`**${m.title}**`, "");
  if (m.text) out.push(quoteBlock(m.text), "");
  if (m.textComplete === false) out.push("The page showed only the start of this text, and no fuller copy was loaded.", "");
  if (m.studyNote) out.push(`What draws me to this: ${m.studyNote}`, "");
  for (const t of m.thread) out.push("Continued by the author:", "", quoteBlock(t), "");
  if (m.alt) out.push(`Alt text: ${m.alt}`, "");
  for (const n of m.notes || []) out.push(`## ${n.label}`, "", n.text, "");
  if (m.poll) out.push("## Poll", "", ...m.poll.options.map((o) => `- ${o.label}${o.result ? `: ${o.result}` : ""}`), ...(m.poll.total || m.poll.status ? ["", [m.poll.total, m.poll.status].filter(Boolean).join(", ")] : []), "");
  if ((m.cards || []).length) out.push("## Link cards", "", ...m.cards.map((c) => `- ${c.title ? c.title + ": " : ""}${c.url}`), "");
  for (const [label, p] of [["Quoting", m.quoted], ["Replying to", m.parent]]) {
    if (!p) continue;
    out.push(`${label}${p.author ? " " + at(String(p.author).replace(/^@/, "")) : ""}${p.url ? ` (${p.url})` : ""}:`, "");
    if (p.text) out.push(quoteBlock(p.text), "");
  }
  const rows = [[files.length > 1 ? "Files" : "File", files.length > 1 ? files.map((f, i) => `${i + 1}. ${f}`).join(", ") : files[0]], ["Post", m.postUrl], ["Media", files.length > 1 ? null : m.mediaUrl],
    ["Page", m.postUrl ? null : m.pageUrl], ["Subreddit", m.subreddit], ["Flair", m.flair], ["Posted (UTC)", m.postedAt], ["Saved (UTC)", m.savedAt],
    ["Engagement at save", m.engagement ? Object.entries(m.engagement).filter(([k]) => k !== "at").map(([k, v]) => `${k} ${v}`).join(", ") : null], ["Hashtags", m.hashtags.join(" ") || null], ["Links", m.links.join(" ") || null]].filter(([, v]) => v);
  out.push(...rows.map(([k, v]) => `- ${k}: ${v}`), "", "Saved by CMMNS from what the page showed.", "");
  return out.join("\n");
}

// The folder for one save from the settings: "<folder>/<site>/", "<folder>/study/<site>/" for
// Study, or "" only when the user turned on saving straight into Downloads.
export function savePath(settings, site, study = false) {
  const s = settings || {}, base = String(s.mediaFolder || "").trim() || "CMMNS";
  if (s.mediaToRoot) return study ? saveFolder("study", site) : "";
  return saveFolder(study ? `${base}/study` : base, site);
}

// The folder a save goes to, inside Downloads: "<folder>/<site>/", each part safe on every system.
// An empty folder setting saves straight into Downloads.
export function saveFolder(folder, site) {
  const part = (s) => String(s || "").normalize("NFKC").replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "-").replace(/^[\s.]+|[\s.]+$/g, "").slice(0, 60);
  const root = String(folder || "").split(/[\\/]+/).map(part).filter((x) => x && x !== "..").join("/");
  if (!root) return "";
  const s = part(String(site || "").replace(/^www\./, ""));
  return s ? `${root}/${s}/` : `${root}/`;
}

export const sidecarJson = (meta, fileNames = null) => JSON.stringify({ ...meta, files: [].concat(fileNames || []).filter(Boolean) }, null, 2) + "\n";

// The text for "Copy with caption": the post's words, who said them, and the link.
export function captionText(meta, link = null) {
  const who = meta.author.handle ? at(meta.author.handle) : meta.author.name || meta.site || "";
  const body = meta.text || meta.title || meta.alt || "";
  return [body, [who ? `${who}` : null, link || meta.postUrl || meta.mediaUrl || meta.pageUrl].filter(Boolean).join(" ")].filter(Boolean).join("\n\n");
}

// The one-paragraph description embedded in the file itself (XMP, MP4 comment, GIF comment).
export function embedText(meta) {
  const who = meta.author.handle ? at(meta.author.handle) : meta.author.name;
  return [meta.title && meta.site === "reddit" ? meta.title : null, meta.text, meta.alt ? `Alt text: ${meta.alt}` : null,
    [who, meta.postedAt, meta.postUrl || meta.pageUrl].filter(Boolean).join(", ")].filter(Boolean).join("\n\n");
}

// The file name at the end of a path the browser reports ("C:\Users\a\Downloads\x\n (1).jpg").
export const fileBase = (path) => String(path || "").split(/[\\/]/).pop() || null;

// The sidecar's name, without ".md", from the names the browser wrote: the first file's name, and
// for a post saved together the first file's name without "-1". A suffix the browser added to a
// name already taken stays, so "name-1 (1).jpg" gets "name (1).md", beside its own files.
export function sidecarStem(fileNames) {
  const list = [].concat(fileNames || []).filter(Boolean);
  const stem = String(list[0] || "").replace(/\.[a-z0-9]{1,5}$/i, "");
  return list.length > 1 ? stem.replace(/-1(?=(?: \(\d+\))?$)/, "") : stem;
}
