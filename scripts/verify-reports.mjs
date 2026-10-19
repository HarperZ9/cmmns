// Checks data/state-reports.json against its sources: downloads each cited document once (cached in
// .cache/reports/), extracts its text (pdftotext for PDFs), and confirms that every row's domain
// or handle appears verbatim. Defanged forms ("example[.]com") count. Prints misses per document and
// exits non-zero if any row is not found.
//   node scripts/verify-reports.mjs        (network download: run only with the author's approval)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, ".cache/reports");
mkdirSync(dir, { recursive: true });
// Report rows are checked by domain or handle; designation rows by the outlet name.
const designations = existsSync(join(root, "data/state-designations.json")) ? JSON.parse(readFileSync(join(root, "data/state-designations.json"), "utf8")) : [];
const rows = [...JSON.parse(readFileSync(join(root, "data/state-reports.json"), "utf8")), ...designations.map((d) => ({ ...d, key: d.outlet }))];

async function textOf(url) {
  const base = join(dir, createHash("sha256").update(url).digest("hex").slice(0, 16));
  if (existsSync(base + ".txt")) return readFileSync(base + ".txt", "utf8");
  // Sites differ in which clients they serve: Meta rejects a full browser string, state.gov serves
  // Node's own client a different page, and openai.com blocks it. curl (installed with Git for
  // Windows and on most systems) is tried first with each agent, then Node's fetch.
  const UAS = ["Mozilla/5.0", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"];
  const usable = (b) => b && b.length > 2000 && !/technical difficulties/i.test(b.subarray(0, 4000).toString());
  let buf = null, status = "no response";
  for (const ua of UAS) {
    try { const b = execFileSync("curl", ["-sL", "--fail", "-A", ua, url], { maxBuffer: 64 << 20 }); if (usable(b)) { buf = b; break; } } catch (e) { status = "curl: " + e.status; }
  }
  // Some government hosts block scripted readers outright; the Internet Archive's copy is the
  // same document, so it is tried before giving up.
  if (!buf) {
    // EUR-Lex shows bots a holding page at its ELI address; its PDF route serves the same act.
    const eli = url.match(/eur-lex\.europa\.eu\/eli\/reg(?:_impl)?\/(\d{4})\/(\d+)/);
    const alts = [
      ...(eli ? [`https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:3${eli[1]}R${eli[2].padStart(4, "0")}`] : []),
      "https://web.archive.org/web/2020/" + url, "https://web.archive.org/web/" + url,
    ];
    for (const alt of alts) {
      try { const b = execFileSync("curl", ["-sL", "--fail", "-A", UAS[0], alt], { maxBuffer: 64 << 20 }); if (usable(b)) { buf = b; break; } } catch (e) { status = "fallback: " + e.status; }
    }
  }
  for (const ua of buf ? [] : UAS) {
    const res = await fetch(url, { headers: { "User-Agent": ua } });
    status = res.status;
    const b = res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    if (usable(b)) { buf = b; break; }
  }
  if (!buf) throw new Error(`${status} for ${url}`);
  let text;
  if (buf.subarray(0, 5).toString() === "%PDF-") {
    writeFileSync(base + ".pdf", buf);
    execFileSync("pdftotext", ["-q", base + ".pdf", base + ".txt"]);
    text = readFileSync(base + ".txt", "utf8");
  } else {
    const html = buf.toString("utf8");
    // Link targets count as document text: a page may name a domain only as a link.
    const hrefs = [...html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]).join(" ");
    text = hrefs + " " + html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&");
    writeFileSync(base + ".txt", text);
  }
  return text;
}

// U+FFFD stands for a PDF dash glyph pdftotext could not map.
const norm = (s) => s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u2010-\u2015\u2212\u00ad\ufffd]/g, "-").replace(/\[\.\]|\(\.\)|\[dot\]/g, ".").replace(/\s+/g, " ");
const byUrl = new Map();
for (const r of rows) (byUrl.get(r.source.url) || byUrl.set(r.source.url, []).get(r.source.url)).push(r);
let miss = 0, fail = 0;
for (const [url, list] of byUrl) {
  let t;
  try { t = norm(await textOf(url)); } catch (e) { console.log(`UNREADABLE ${url}: ${e.message} (${list.length} rows)`); fail += list.length; continue; }
  // Long URLs and PDF line breaks split tokens; also compare with spaces removed.
  const tight = t.replace(/ /g, "");
  const missing = list.filter((r) => { const k = norm(r.key || r.domain || r.x); return !t.includes(k) && !tight.includes(k.replace(/ /g, "")); });
  miss += missing.length;
  console.log(`${list.length - missing.length}/${list.length}  ${url}` + (missing.length ? `\n   missing: ${missing.slice(0, 10).map((r) => r.key || r.domain || "@" + r.x).join(", ")}` : ""));
}
console.log(`\nrows ${rows.length}; not found ${miss}; unreadable ${fail}`);
process.exit(miss || fail ? 1 : 0);
