// `case watch`: a re-check meant to run on a schedule (the OS scheduler runs it; nothing here
// stays resident). It re-reads every captured URL and every open lead's search address, and
// writes what changed to watch.jsonl and to CHANGELOG.md under the date:
//   edited       a page's text or a post's text differs from the capture (with a word diff)
//   deleted      a post now returns no record, or a page answers 404 or 410
//   archived     the Wayback Machine now holds a copy of a source that had none
//   lead-changed a lead's public search now returns different results: a new record may settle it
// New text is saved beside the capture as captures/<id>.<date>.txt; the original stays untouched.
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { within } from "./paths.js";
import { captureUrl, sha256 } from "./capture.js";
import { wordDiff, renderDiff, hopChanges } from "./diff.js";
import { addRow, updateRow } from "./store.js";

const AVAILABLE = "https://archive.org/wayback/available?url=";
const short = (s, n = 600) => (s.length > n ? s.slice(0, n) + " ..." : s);

async function checkSource(ctx, s) {
  const out = [];
  let cap;
  try { cap = await captureUrl(s.url, { fetchFn: ctx.fetchFn }); } catch (e) { return [{ kind: "unreachable", ref: s.id, text: `${s.url}: ${e.message}` }]; }
  if (!cap.ok) return [{ kind: /HTTP 4(04|10)/.test(cap.reason) ? "deleted" : "unreachable", ref: s.id, text: `${s.url}: ${cap.reason}` }];
  if (cap.post && cap.post.deleted) return [{ kind: "deleted", ref: s.id, text: `post ${s.url} returns no record now` }];
  const f = s.capture && s.capture.text_file ? within(ctx.dir, s.capture.text_file) : null;
  const before = f && existsSync(f) ? readFileSync(f, "utf8") : "";
  if (sha256(Buffer.from(cap.text, "utf8")) !== sha256(Buffer.from(before, "utf8"))) {
    const day = ctx.now().slice(0, 10), name = `captures/${s.id}.${day}.txt`;
    writeFileSync(join(ctx.dir, name), cap.text);
    const ops = wordDiff(before, cap.text), c = hopChanges(ops);
    out.push({ kind: "edited", ref: s.id, text: `${s.url}: ${c.added} words added, ${c.removed} removed${c.numbers.added.length || c.numbers.removed.length ? `; numbers +${c.numbers.added.join(" ")} -${c.numbers.removed.join(" ")}` : ""}`, file: name, sha256: sha256(Buffer.from(cap.text, "utf8")), diff: short(renderDiff(ops.filter((o, i, a) => o.op !== "=" || (a[i - 1] && a[i - 1].op !== "=") || (a[i + 1] && a[i + 1].op !== "=")))) });
  }
  return out;
}

async function checkArchive(ctx, s) {
  if (!s.url || (s.archive && s.archive.url)) return [];
  try {
    const res = await ctx.fetchFn(AVAILABLE + encodeURIComponent(s.url));
    const j = res.ok ? await res.json() : null, snap = j && j.archived_snapshots && j.archived_snapshots.closest;
    if (snap && snap.available && snap.url) return [{ kind: "archived", ref: s.id, text: `the Wayback Machine now holds ${snap.url}`, url: snap.url, timestamp: snap.timestamp }];
  } catch (e) { return [{ kind: "unreachable", ref: s.id, text: `archive lookup failed: ${e.message}` }]; }
  return [];
}

async function checkLead(ctx, l) {
  try {
    const res = await ctx.fetchFn(l.check_url, { credentials: "omit" });
    if (!res.ok) return [{ kind: "unreachable", ref: l.id, text: `${l.check_url}: HTTP ${res.status}` }];
    const h = sha256(Buffer.from(await res.arrayBuffer()));
    if (l.watch_sha256 && l.watch_sha256 !== h) return [{ kind: "lead-changed", ref: l.id, text: `the search for "${l.search_terms || l.question}" returns different results; a new record may settle ${l.id}`, sha256: h }];
    return l.watch_sha256 ? [] : [{ kind: "lead-baseline", ref: l.id, text: `first look at ${l.check_url}`, sha256: h }];
  } catch (e) { return [{ kind: "unreachable", ref: l.id, text: `${l.check_url}: ${e.message}` }]; }
}

function record(ctx, changes) {
  const at = ctx.now();
  for (const c of changes) {
    addRow(ctx.dir, "watch", { at, ...c });
    if (c.kind === "deleted") addRow(ctx.dir, "absent", { what: `${c.ref} as captured`, status: "deleted", custodian: "the publisher", source: c.ref, noted: at, note: c.text });
    if (c.kind === "edited") addRow(ctx.dir, "absent", { what: `the captured version of ${c.ref}`, status: "edited", custodian: "the publisher", source: c.ref, noted: at, note: `new text saved as ${c.file}` });
    if (c.kind === "archived") updateRow(ctx.dir, "sources", c.ref, (r) => ({ ...r, archive: { ...(r.archive || {}), service: "Wayback Machine", url: c.url, found: at } }));
    if (c.kind === "lead-changed" || c.kind === "lead-baseline") updateRow(ctx.dir, "leads", c.ref, (r) => ({ ...r, watch_sha256: c.sha256, watched_at: at }));
  }
  const shown = changes.filter((c) => c.kind !== "lead-baseline");
  appendFileSync(join(ctx.dir, "CHANGELOG.md"), `\n## ${at.slice(0, 10)} (${at})\n\n${shown.length ? shown.map((c) => `- ${c.kind} ${c.ref}: ${c.text}${c.diff ? `\n  ${c.diff}` : ""}`).join("\n") : "- No change found."}\n`);
  return shown;
}

// ctx: { dir, data, fetchFn, now }. Returns the changes recorded (baselines left out).
export async function watchCase(ctx) {
  const data = ctx.data(), changes = [];
  for (const s of data.sources.filter((x) => x.url)) { changes.push(...(await checkSource(ctx, s))); changes.push(...(await checkArchive(ctx, s))); }
  for (const l of data.leads.filter((x) => x.check_url && (x.status || "open") === "open" && x.review !== "rejected")) changes.push(...(await checkLead(ctx, l)));
  return record(ctx, changes);
}

export const SCHEDULE_HELP = `Run case watch on a schedule with the system's own scheduler, for example daily at 07:00:
  Linux or macOS (crontab -e):  0 7 * * * cd /path/to/case && daylight case watch --export >> watch.log 2>&1
  Windows (one line):           schtasks /Create /SC DAILY /ST 07:00 /TN "daylight-watch" /TR "cmd /c cd /d C:\\path\\to\\case && daylight case watch --export"
`;
