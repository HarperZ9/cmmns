// Evidence capture (project-docs/EVIDENCE-CAPTURE.md): one record per capture, daylight.capture/1,
// holding the artifact's hashes, the words and counts the page showed, the screenshot, the local
// time and the transparency record (what survived the capture, property by property, as a clarity
// from 0 to 1 where it can be measured and null where it cannot). Captures are linked by a custody
// chain: each log line names the SHA-256 of the line before it, so a removed or edited line breaks
// the chain. Pure: hashing goes through Web Crypto, present in browsers and in Node.

export const CAPTURE_FORMAT = "daylight.capture/1";
export const CUSTODY_FORMAT = "daylight.custody/1";
const ENGAGEMENT_KEYS = ["replies", "reposts", "quotes", "likes", "views", "bookmarks"];

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export async function sha256Text(s) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }

// One fixed serialisation, so the same object always hashes the same: keys sorted at every level.
export function captureCanonical(v) {
  if (Array.isArray(v)) return `[${v.map(captureCanonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${captureCanonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v === undefined ? null : v);
}

const round = (x) => Math.round(x * 100) / 100;

// What survived, per property: { property, clarity (0..1 or null), kept: "full" | "partial" | "none" | "n/a", measure }.
// clarity is a measured fraction; null means the loss is known but its size is not.
export function transparencyRecord(meta = {}, { files = [], screenshot = null, transformed = null } = {}) {
  const rows = [];
  const row = (property, clarity, kept, measure) => rows.push({ property, clarity: clarity == null ? null : round(clarity), kept, measure });
  for (const f of files) {
    if (f.made) row(`file ${f.name}`, null, "partial", `made in the page (${f.made}); the page's own media was not saved byte for byte`);
    else row(`file ${f.name}`, 1, "full", "the bytes the page served, SHA-256 taken before any words were written into the file");
    if (f.saved_sha256 && f.saved_sha256 !== f.sha256) row(`embedded copy ${f.name}`, 1, "full", "the saved file carries the description, so its own hash differs; the original hash is kept");
  }
  if (transformed) row("media form", null, "partial", transformed);
  row("text", meta.kind === "media" && !meta.text ? null : meta.textComplete === false ? null : 1, meta.textComplete === false ? "partial" : meta.text ? "full" : "n/a",
    meta.textComplete === false ? "the page showed only the start of the text" : meta.text ? "the text as the page showed it" : "no text on the post");
  if (meta.threadComplete === true) row("thread", 1, "full", "each part answers the one before");
  else if (meta.threadComplete === "unknown") row("thread", null, "partial", "the page may hold more of the thread than could be proved");
  // Counts and the account are measured where the page is a post; a page with neither (an article,
  // a gallery) has nothing to keep, so those rows are n/a rather than a loss.
  const e = meta.engagement || null, shown = e ? ENGAGEMENT_KEYS.filter((k) => e[k] != null).length : 0;
  const a = meta.author || {}, acc = [a.name, a.handle].filter(Boolean).length, post = !!(meta.postUrl || acc || e);
  if (post) row("engagement", shown / ENGAGEMENT_KEYS.length, shown === ENGAGEMENT_KEYS.length ? "full" : shown ? "partial" : "none", `${shown} of ${ENGAGEMENT_KEYS.length} counts read from the page`);
  else row("engagement", null, "n/a", "not a post; no counts on the page");
  if (post) row("account as shown", acc / 2, acc === 2 ? "full" : acc ? "partial" : "none", `${acc} of 2 (display name, handle)`);
  else row("account as shown", null, "n/a", "not a post; no account on the page");
  if (screenshot && screenshot.page_height > 0) {
    const c = Math.min(1, screenshot.viewport_height / screenshot.page_height);
    row("page picture", c, c >= 1 ? "full" : "partial", `the visible part of the page: ${screenshot.viewport_height} of ${screenshot.page_height} px high`);
  } else row("page picture", 0, "none", "no screenshot");
  row("page snapshot", 0, "none", "MHTML or WARC snapshot not taken in this release");
  row("local time", 1, "full", "this computer's clock, UTC and offset");
  row("trusted time", 0, "none", "no RFC 3161 or OpenTimestamps proof requested");
  const measured = rows.filter((r) => r.clarity != null);
  return { rows, mean: measured.length ? round(measured.reduce((s, r) => s + r.clarity, 0) / measured.length) : null, measured: measured.length, of: rows.length };
}

// The capture record. files: [{ name, sha256, saved_sha256?, bytes, mime, made? }];
// screenshot: { name, sha256, viewport_height, page_height, scroll_y } | null.
export function captureRecord({ meta = {}, files = [], screenshot = null, page = {}, tool = {}, transformed = null, now = new Date(), offsetMinutes = 0 }) {
  return {
    format: CAPTURE_FORMAT,
    captured: { utc: new Date(now).toISOString(), offset_minutes: offsetMinutes },
    page: { url: page.url || meta.pageUrl || null, title: page.title || null },
    tool: { name: "Daylight Commons", version: tool.version || null, browser: tool.browser || null },
    artifact: files.map((f) => ({ name: f.name, sha256: f.sha256, saved_sha256: f.saved_sha256 || f.sha256, bytes: f.bytes, mime: f.mime || null, made: f.made || null })),
    words: { site: meta.site || null, post: meta.postUrl || null, media: meta.mediaUrl || null, text: meta.text || null, text_complete: meta.textComplete !== false, posted: meta.postedAt || null },
    engagement: meta.engagement || null,
    account: { name: (meta.author && meta.author.name) || null, handle: (meta.author && meta.author.handle) || null },
    thread: { parent: meta.parent ? meta.parent.url || null : null, quoted: meta.quoted ? meta.quoted.url || null : null, parts: (meta.thread || []).length, complete: meta.threadComplete ?? null },
    screenshot,
    transparency: transparencyRecord(meta, { files, screenshot, transformed }),
    // Filled after hashing: the custody line naming this record's hash (custodyLine).
    custody: null,
  };
}

// The custody log line for one event. prevLine: the line before (null for the first).
// event: { what: "capture" | "export" | "note" | "correction", page, hashes: [hex], key_id? }.
export async function custodyLine(prevLine, event, now = new Date()) {
  const body = { format: CUSTODY_FORMAT, seq: prevLine ? prevLine.seq + 1 : 1, at: new Date(now).toISOString(), what: event.what, page: event.page || null,
    hashes: [...(event.hashes || [])], key_id: event.key_id || null, tool: event.tool || null, prev: prevLine ? prevLine.hash : null };
  return { ...body, hash: await sha256Text(captureCanonical(body)) };
}

// Checks a log: every line's hash matches its body, and each names the one before.
// { ok, lines, broken_at (seq or null), reason }.
export async function verifyCustody(lines) {
  let prev = null;
  for (const l of lines) {
    const { hash, ...body } = l;
    if ((await sha256Text(captureCanonical(body))) !== hash) return { ok: false, lines: lines.length, broken_at: l.seq, reason: "this line was changed after it was written" };
    if (l.prev !== (prev ? prev.hash : null)) return { ok: false, lines: lines.length, broken_at: l.seq, reason: "the line before it is missing or was changed" };
    if (prev && l.seq !== prev.seq + 1) return { ok: false, lines: lines.length, broken_at: l.seq, reason: "a line is missing before this one" };
    prev = l;
  }
  return { ok: true, lines: lines.length, broken_at: null, reason: null };
}
