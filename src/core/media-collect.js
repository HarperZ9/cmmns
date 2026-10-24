// Collections of saved media: an investigation case (rows that `daylight case add case-inbox.jsonl`
// captures, archives and verifies) or a moodboard (tags and notes, shown as a grid). Every saved
// file keeps its SHA-256, where it came from and when; every converted or compressed file keeps
// its own hash and the chain of steps back to the original. Pure records; storage is in the
// extension (src/ext/media-store.js).

export const MEDIA_KINDS = ["image", "gif", "video", "audio"];
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif", "image/svg+xml": "svg",
  "video/mp4": "mp4", "video/webm": "webm", "video/mp2t": "ts", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/ogg": "ogg",
  "audio/webm": "webm", "audio/wav": "wav", "audio/opus": "opus", "video/quicktime": "mov", "application/vnd.apple.mpegurl": "m3u8" };

// SHA-256 of bytes as lower-case hex, in the browser and in Node.
export async function mediaSha256(bytes) {
  const d = await crypto.subtle.digest("SHA-256", bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// image, gif, video or audio from a MIME type, then the address's extension.
export function mediaKindOf(mime, url = "") {
  const m = String(mime || "").toLowerCase().split(";")[0].trim();
  if (m === "image/gif") return "gif";
  for (const k of ["image", "video", "audio"]) if (m.startsWith(k + "/")) return k;
  const ext = (/\.([a-z0-9]{2,5})(?:$|[?#])/i.exec(String(url)) || [])[1];
  const e = ext ? ext.toLowerCase() : "";
  if (e === "gif") return "gif";
  if (["png", "jpg", "jpeg", "webp", "avif", "svg", "bmp"].includes(e)) return "image";
  if (["mp4", "webm", "mov", "m4v", "ts", "m3u8", "mpd"].includes(e)) return "video";
  if (["mp3", "m4a", "aac", "ogg", "opus", "wav", "flac"].includes(e)) return "audio";
  return null;
}

export const extFor = (mime) => EXT[String(mime || "").toLowerCase().split(";")[0].trim()] || "bin";

// A file name from the source address and hash: readable, safe on every system, never a path.
export function fileNameFor(item) {
  let stem = "media";
  try { stem = decodeURIComponent(new URL(item.source.url).pathname.split("/").pop() || "media"); } catch { /* keep the default */ }
  stem = stem.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[^\w.-]+/g, "-").replace(/^[.-]+|[.-]+$/g, "").slice(0, 60) || "media";
  return `${stem}-${String(item.sha256).slice(0, 12)}.${extFor(item.mime)}`;
}

export const normTags = (v) => [...new Set((Array.isArray(v) ? v : String(v || "").split(","))
  .map((t) => String(t).trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40)).filter(Boolean))].slice(0, 30);

const collectionOk = (c) => c && (c.type === "case" || (c.type === "moodboard" && typeof c.id === "string" && c.id.length > 0));

// The record for a file saved from a page. src: { bytes, mime, url, page, pageTitle, stream?, alt? }.
export function savedRecord(src, { sha256, collection, tags, note, now = new Date().toISOString() }) {
  if (!collectionOk(collection)) throw new Error("A saved file needs a case or a moodboard.");
  if (!/^[0-9a-f]{64}$/.test(String(sha256))) throw new Error("A saved file needs its SHA-256.");
  const kind = mediaKindOf(src.mime, src.url) || "image";
  return { id: `${sha256.slice(0, 16)}-${Date.parse(now) || 0}`, collection: { type: collection.type, id: collection.type === "case" ? "case" : collection.id },
    kind, mime: src.mime || "application/octet-stream", bytes: src.bytes, sha256, original: sha256,
    source: { url: src.url || null, page: src.page || null, pageTitle: src.pageTitle ? String(src.pageTitle).slice(0, 300) : null, alt: src.alt ? String(src.alt).slice(0, 300) : null, savedAt: now, stream: src.stream || null },
    tags: normTags(tags), note: String(note || "").slice(0, 2000), lineage: [], archive: null };
}

// The record for a converted or compressed copy. step: { op, params, tool }.
export function derivedRecord(parent, { bytes, mime, sha256, step, now = new Date().toISOString() }) {
  if (!/^[0-9a-f]{64}$/.test(String(sha256))) throw new Error("A derived file needs its SHA-256.");
  const link = { op: step.op, from: parent.sha256, to: sha256, params: step.params || {}, tool: step.tool || null, at: now,
    bytesBefore: parent.bytes, bytesAfter: bytes };
  return { ...parent, id: `${sha256.slice(0, 16)}-${Date.parse(now) || 0}`, kind: mediaKindOf(mime) || parent.kind, mime, bytes, sha256,
    original: parent.original || parent.sha256, derivedFrom: parent.id, lineage: [...(parent.lineage || []), link], archive: null };
}

// Checks every derived item against the items it came from: each step's "from" is the previous
// step's "to", the first step starts at the original, the last ends at the item's own hash, and
// the original is in the collection or recorded. Returns [{ id, problem }]; empty means sound.
export function checkLineage(items) {
  const byHash = new Map(items.map((i) => [i.sha256, i]));
  const problems = [];
  for (const it of items) {
    const L = it.lineage || [];
    if (!L.length) { if (it.original !== it.sha256) problems.push({ id: it.id, problem: "no steps, but the original hash differs" }); continue; }
    if (L[0].from !== it.original) problems.push({ id: it.id, problem: "the first step does not start at the original" });
    for (let i = 1; i < L.length; i++) if (L[i].from !== L[i - 1].to) problems.push({ id: it.id, problem: `step ${i + 1} does not start where step ${i} ended` });
    if (L[L.length - 1].to !== it.sha256) problems.push({ id: it.id, problem: "the last step does not end at this file's hash" });
    const parent = byHash.get(L[L.length - 1].from);
    if (parent && (parent.lineage || []).length !== L.length - 1) problems.push({ id: it.id, problem: "the parent's chain is not this chain's prefix" });
  }
  return problems;
}

// One row for case-inbox.jsonl. The case command captures the address, hashes what it fetches and
// compares it with the hash the browser saw, so a changed file shows as a difference.
export function caseInboxRow(item) {
  return { url: item.source.url, title: item.source.pageTitle, added: item.source.savedAt, page: item.source.page,
    media: { kind: item.kind, mime: item.mime, bytes: item.bytes, sha256: item.sha256, original: item.original, lineage: item.lineage, stream: item.source.stream ? item.source.stream.type : null },
    archive: item.archive };
}

const unit = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} bytes`);
export const sizeText = unit;

// "2.4 MB to 610 KB, 75% smaller" or "... 12% larger".
export function sizeLine(before, after) {
  if (!before || !Number.isFinite(after)) return `${unit(after || 0)}`;
  const d = Math.round((100 * (before - after)) / before);
  return `${unit(before)} to ${unit(after)}, ${d >= 0 ? `${d}% smaller` : `${-d}% larger`}`;
}

// Items of one collection, filtered by kind, tag and free text in notes, tags and addresses.
export function filterItems(items, { collection, kind, tag, q } = {}) {
  const needle = String(q || "").toLowerCase();
  return items.filter((i) => (!collection || (i.collection.type === collection.type && i.collection.id === collection.id))
    && (!kind || i.kind === kind) && (!tag || (i.tags || []).includes(tag))
    && (!needle || [i.note, ...(i.tags || []), i.source.url, i.source.page, i.source.pageTitle].some((s) => String(s || "").toLowerCase().includes(needle))))
    .sort((a, b) => String(b.source.savedAt).localeCompare(String(a.source.savedAt)));
}
