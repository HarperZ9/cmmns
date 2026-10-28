// One entry for every file the offline analyser and the CLI read: it decides what the file is from
// its name and its first bytes, and returns posts in CMMNS' input shape. Nothing is fetched.
//   saved page (.html, .htm)            X or Reddit thread, or any page as one text
//   thread JSON                         CMMNS' shape, X GraphQL, Bluesky getPostThread, Mastodon context
//   X archive tweets.js                 the user's own posts
//   Reddit export comments.csv / posts.csv
//   Mastodon archive outbox.json
//   Bluesky repository export (.car)

import { postsFromHtml } from "./import-html.js";
import { threadFromJson } from "./import-json.js";
import { xArchivePosts, redditExportPosts, mastodonOutboxPosts } from "./import-exports.js";
import { blueskyCarPosts } from "./import-car.js";

export const IMPORT_FORMATS = ["saved page", "thread JSON", "X archive tweets.js", "Reddit export CSV", "Mastodon outbox.json", "Bluesky repository .car"];
export const MAX_IMPORT_POSTS = 20000;

const fail = (reason) => ({ ok: false, reason });
const asText = (bytes) => (typeof bytes === "string" ? bytes : new TextDecoder("utf-8").decode(bytes));
// How precise each export's own timestamps are (src/core/precision.js): X, Reddit and Mastodon give
// seconds, Bluesky records give milliseconds.
const EXPORT_PRECISION = { "X archive tweets.js": "second", "Reddit export CSV": "second", "Mastodon outbox.json": "second", "Bluesky repository .car": "exact" };
const fromExport = (format, r) => (r && r.posts.length ? { ok: true, format, source: "export", site: r.site, input: { site: r.site, root: null, replies: r.posts.slice(0, MAX_IMPORT_POSTS), timePrecision: EXPORT_PRECISION[format] }, notes: [...r.notes, ...(r.posts.length > MAX_IMPORT_POSTS ? [`Only the first ${MAX_IMPORT_POSTS} posts were read.`] : [])] } : null);
const fromThread = (format, t, notes = []) => (t && (t.replies.length || t.root) ? { ok: true, format, source: "thread", site: t.site, input: t, notes } : null);

function fromJson(name, text) {
  let json;
  try { json = JSON.parse(text); } catch { return fail(`${name} is not valid JSON.`); }
  if (json && json.kind === "radar-evidence-bundle") return fail("This is a CMMNS evidence bundle. Use Check a bundle to verify it.");
  return fromExport("Mastodon outbox.json", mastodonOutboxPosts(json)) || fromThread("thread JSON", threadFromJson(json)) || fail(`CMMNS found zero readable posts in ${name}.`);
}

function fromBytes(name, bytes) {
  const lower = String(name || "").toLowerCase();
  if (lower.endsWith(".car") && typeof bytes !== "string") return fromExport("Bluesky repository .car", blueskyCarPosts(bytes)) || fail(`${name} is unreadable as a Bluesky repository export.`);
  const text = asText(bytes).replace(/^﻿/, ""), head = text.slice(0, 400).trimStart();
  if (/^window\.YTD\./.test(head)) return fromExport("X archive tweets.js", xArchivePosts(text)) || fail(`${name} holds zero posts CMMNS can read.`);
  if (lower.endsWith(".csv")) return fromExport("Reddit export CSV", redditExportPosts(text)) || fail(`${name} lacks the id, permalink and body columns of a Reddit export.`);
  if (/^[[{]/.test(head)) return fromJson(name, text);
  // A saved X or Reddit page carries machine-readable times (datetime and created attributes) to the second.
  if (/^<|<html|<!doctype/i.test(head)) { const p = postsFromHtml(text); if (p.kind === "thread") p.timePrecision = "second"; return { ok: true, format: "saved page", source: p.kind === "thread" ? "thread" : "page", site: p.site, input: p, notes: p.kind === "page" ? ["CMMNS read this page as one text, its fallback for pages outside the thread readers."] : [] }; }
  return fail(`CMMNS reads these kinds of file: ${IMPORT_FORMATS.join(", ")}.`);
}

// name: the file name; bytes: Uint8Array, ArrayBuffer or string. Returns { ok: true, format,
// source: "thread" | "export" | "page", site, input: { site, root, replies }, notes } or
// { ok: false, reason }.
export function importFile(name, bytes) {
  try { return fromBytes(name, bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes); } catch (e) { return fail(`Could not read ${name}: ${e.message}`); }
}
