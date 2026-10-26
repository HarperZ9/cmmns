// `case add <url|file>`: capture, hash, record the access time, write a sources.jsonl row and the
// extracted text, and, only when asked (--archive or the case's archive setting), ask the Wayback
// Machine for a snapshot. Since the release after 3.6 no snapshot is requested by default: a save request tells the
// page's server and the Internet Archive who is looking and when, and the copy is public. In
// source-protection mode a URL is refused outright and only files are added. An X post also adds its reply and quote edges to the
// network, and a deleted or edited post adds a row to the absence log.
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { captureUrl, captureFile, sha256, xPostId } from "./capture.js";
import { requestSnapshot } from "./wayback.js";
import { ProtectionBlocked } from "./protection.js";
import { addRow, readJsonl, nextId, TABLES } from "./store.js";

const isUrl = (s) => /^https?:\/\//i.test(String(s));

// opts: { fetchFn, sleep, now, archive (true to request a snapshot; default false), protection,
// origin, tier, date, what }
export async function addSource(dir, target, opts = {}) {
  const now = opts.now || (() => new Date().toISOString());
  const url = isUrl(target);
  if (!url && !existsSync(target)) throw new Error(`${target} is neither a URL nor a file`);
  if (url && opts.protection) throw new ProtectionBlocked(`case add ${new URL(target).host}`);
  const cap = url ? await captureUrl(target, { fetchFn: opts.fetchFn }) : captureFile(target);
  if (!cap.ok) throw new Error(cap.reason);
  const id = nextId("S", readJsonl(join(dir, TABLES.sources[0])));
  const file = `captures/${id}${cap.ext}`, textFile = `captures/${id}.txt`;
  writeFileSync(join(dir, file), cap.bytes);
  writeFileSync(join(dir, textFile), cap.text);
  const archive = url && opts.archive === true ? await requestSnapshot(target, { fetchFn: opts.fetchFn, sleep: opts.sleep, now }) : null;
  const post = cap.post || null;
  const row = {
    kind: cap.kind, url: url ? target : opts.url || null, file: url ? null : cap.name,
    title: cap.title, author: post && !post.deleted ? post.author : opts.author || null,
    source_date: (post && post.posted) || opts.date || cap.date || null, accessed: now(), read_mode: cap.readMode,
    tier: opts.tier || null, origin: opts.origin || null, what: opts.what || null,
    capture: { file, sha256: sha256(cap.bytes), bytes: cap.bytes.length, text_file: textFile, text_sha256: sha256(Buffer.from(cap.text, "utf8")) },
    archive: archive ? { service: "Wayback Machine", ...archive } : { service: null, note: url ? "archive not requested (opt in with --archive)" : "local file; nothing requested" },
    post: post && !post.deleted ? { id: post.id, in_reply_to: post.inReplyTo, quoted: post.quoted, edited: post.edited, edit_ids: post.editIds } : post ? { deleted: true } : null,
    ...(opts.tag ? { run_item: opts.tag } : {}),
  };
  const { id: written, ...rest } = addRow(dir, "sources", row);
  if (written !== id) throw new Error(`source id changed while writing (${id} -> ${written}); another process is writing this case`);
  return { source: { id, ...rest }, derived: deriveFromPost(dir, id, row, target, opts.tag) };
}

// Edges and absences that follow from a captured post, each sourced to the new row.
function deriveFromPost(dir, id, row, target, tag) {
  const out = { edges: [], absent: [] }, t = tag ? { run_item: tag } : {};
  const p = row.post;
  if (!p) return out;
  if (p.deleted) {
    out.absent.push(addRow(dir, "absent", { what: `post ${xPostId(target) || target}`, status: "deleted", custodian: "X Corp.", source: id, noted: row.accessed, note: "the public post-data endpoint returned no post", ...t }));
    return out;
  }
  if (p.in_reply_to) out.edges.push(addRow(dir, "edges", { from: row.author, to: p.in_reply_to.author, type: "reply", source: id, post: p.id, target_post: p.in_reply_to.id, ...t }));
  if (p.quoted) out.edges.push(addRow(dir, "edges", { from: row.author, to: p.quoted.author, type: "quote", source: id, post: p.id, target_post: p.quoted.id, ...t }));
  if (p.edited) out.absent.push(addRow(dir, "absent", { what: `earlier versions of post ${p.id}`, status: "edited", custodian: "X Corp.", source: id, noted: row.accessed, note: `edit history ids: ${(p.edit_ids || []).join(", ")}`, ...t }));
  return out;
}
