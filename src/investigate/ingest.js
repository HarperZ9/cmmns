// Seeds for `case run`. A seed is a folder (screenshots, URL lists, saved X records), a text file
// of URLs and claims (one per line), one URL (an X post URL brings its thread with it), or one
// claim string. Screenshots are transcribed into posts.jsonl the way the hand-made feed sets were:
// a transcription file beside the image wins (person-made), then the built-in OCR for PNG; an
// image with neither goes to the review queue as "needs transcription".
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { sha256 } from "./capture.js";

const IMAGE = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const isUrl = (s) => /^https?:\/\/\S+$/i.test(String(s).trim());

function fileSeeds(path) {
  const ext = extname(path).toLowerCase();
  if (IMAGE.has(ext)) return [{ type: "screenshot", path, key: `screenshot:${sha256(readFileSync(path))}` }];
  if (ext === ".txt" || ext === ".urls" || ext === ".md") {
    const stem = path.slice(0, -ext.length);
    if (IMAGE.has(extname(stem).toLowerCase()) || [...IMAGE].some((x) => existsSync(stem + x))) return [];   // a screenshot's transcription
    return readFileSync(path, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => (isUrl(l) ? { type: "url", url: l, key: `url:${l}` } : { type: "claim", text: l, key: `claim:${l}` }));
  }
  if (ext === ".jsonl") return inboxUrls(path).map((u) => ({ type: "url", url: u, key: `url:${u}` }));
  if (ext === ".json" || ext === ".html" || ext === ".htm" || ext === ".pdf") return [{ type: "file", path, key: `file:${sha256(readFileSync(path))}` }];
  return [];
}

// The addresses in a case list saved by the extension's "Add to case" (case-inbox.jsonl).
export function inboxUrls(path) {
  return readFileSync(path, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l, i) => {
    let r;
    try { r = JSON.parse(l); } catch { throw new Error(`${path} line ${i + 1} is not JSON`); }
    return r && typeof r.url === "string" && isUrl(r.url) ? r.url : null;
  }).filter(Boolean);
}

// Seeds from one argument, in a stable order.
export function parseSeeds(arg) {
  if (existsSync(arg)) {
    if (statSync(arg).isDirectory()) return readdirSync(arg).sort().flatMap((n) => (statSync(join(arg, n)).isFile() ? fileSeeds(join(arg, n)) : []));
    return fileSeeds(arg);
  }
  const s = String(arg).trim();
  if (!s) throw new Error("case run needs a seed: a URL, a folder, a file of URLs, or a claim in quotes");
  return isUrl(s) ? [{ type: "url", url: s, key: `url:${s}` }] : [{ type: "claim", text: s, key: `claim:${s}` }];
}

// The person-made transcription beside an image: shot.png.txt or shot.txt.
export function transcriptFor(path) {
  for (const c of [`${path}.txt`, path.replace(/\.[^.]+$/, ".txt")]) if (existsSync(c)) return readFileSync(c, "utf8");
  return null;
}

// Reads a screenshot's text. ocr(bytes) -> { text, confidence } | null, injected so this module
// does not load the recogniser unless a PNG needs it.
export function transcribe(path, ocr) {
  const t = transcriptFor(path);
  if (t != null) return { text: t.trim(), method: "transcription file", confidence: null };
  if (extname(path).toLowerCase() === ".png" && ocr) {
    const r = ocr(readFileSync(path));
    if (r && r.text.trim()) return { text: r.text.trim(), method: "built-in OCR (CMMNS latin model)", confidence: Number(r.confidence.toFixed(3)) };
  }
  return null;
}

// What a transcribed post names: handles, full URLs (truncated ones with an ellipsis are left out).
export function postFacts(text) {
  return {
    handles: [...new Set((String(text).match(/(?<![\w@])@[A-Za-z0-9_]{1,15}\b/g) || []))],
    urls: [...new Set((String(text).match(/https?:\/\/[^\s"'<>…]+/g) || []).filter((u) => !/…$/.test(u)).map((u) => u.replace(/[.,;:)]+$/, "")))],
  };
}

// The OCR function on the built-in recogniser. Loaded lazily by the caller.
export async function loadOcr(root) {
  const [{ decodeWeights }, { readImage }, { decodePng }] = await Promise.all([import("../ocr/weights.js"), import("../ocr/read.js"), import("../../scripts/ocr/png.mjs")]);
  const model = decodeWeights(readFileSync(join(root, "src", "ext", "ocr", "latin.bin")));
  return (bytes) => {
    try { const r = readImage(model, decodePng(bytes)); return { ...r, text: r.lines.filter((l) => !l.low).map((l) => l.text).join("\n") }; } catch (e) { return { text: "", confidence: 0, error: e.message }; }
  };
}

const MONTH = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
const HEADER = /^(.{0,60}?)\s*(@[A-Za-z0-9_]{1,15})\s*(?:·\s*(?:\d{1,2}[smhd]|\w{3} \d{1,2}(?:, \d{4})?))?\s*$/;
const FOOTER = /^\d{1,2}:\d{2}\s?(?:AM|PM)?\s*·\s*(\w{3})\w*\.? (\d{1,2}), (\d{4})(?:\s*·.*)?$/i;
const CHROME = /^(?:[\d.,]+[KMB]?\s*(?:Views?|Reposts?|Quotes?|Likes?|Bookmarks?|Replies)\b.*|Reply|Repost|Like|Share|Show more|Translate post|Follow|Following|Quote)$/i;

// A screenshot transcript of a post: who posted it (the first header line), the day from the
// footer, and the text with header, footer and button lines blanked to spaces, so every offset
// into the body still points into the transcript.
export function screenshotPost(text) {
  let author = null, date = null, offset = 0;
  const out = String(text).split("\n").map((line) => {
    const t = line.trim(), at = offset;
    offset += line.length + 1;
    const h = t.match(HEADER), f = t.match(FOOTER);
    if (h && !author && at < 200) { author = h[2]; return " ".repeat(line.length); }
    if (f && MONTH[f[1].slice(0, 3).toLowerCase()]) { date = `${f[3]}-${MONTH[f[1].slice(0, 3).toLowerCase()]}-${f[2].padStart(2, "0")}`; return " ".repeat(line.length); }
    if (CHROME.test(t)) return " ".repeat(line.length);
    return line;
  });
  return { author, date, body: out.join("\n") };
}
