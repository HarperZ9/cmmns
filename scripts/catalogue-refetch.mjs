// Re-reads every catalogue source live and reports what changed (project-docs/DEFINITION-CATALOGUE.md).
//   node scripts/catalogue-refetch.mjs           report only
//   node scripts/catalogue-refetch.mjs --quotes  also check each quote against the fetched text
// For each source: the same hash ("same"), the same visible text with different bytes ("same text,
// bytes differ": legislation.gov.uk reorders XML attributes between requests), a new text
// ("changed": read the page and bump the entry if the quoted text moved), or a refusal ("blocked": the site turned away a script, so recheck it in a
// browser and record the hash there). One request per source, no retries, nothing written.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "catalogue", "definitions");
const UA = "Daylight Commons definition catalogue check (https://github.com/HarperZ9/daylight-commons)";
const LABEL = /\((?:[0-9]+[a-z]?|[a-z]{1,4}|[A-Z])\)\s*/;

// The same text normalisation the catalogue's quotes were checked with.
export function normText(s) {
  return String(s).replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").replace(/ ([,.;:])/g, "$1").replace(/“ /g, "“").replace(/ ”/g, "”").trim();
}

export function htmlText(html) {
  return normText(String(html).replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x?([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, /x/i.test(m) ? 16 : 10))));
}

// Every segment of a quote between list labels and ellipses must appear in the source text.
export function quoteFound(quote, text) {
  const segs = String(quote).split(LABEL).flatMap((x) => x.split("…")).map(normText).filter(Boolean);
  return segs.every((s) => text.includes(s) || text.includes(s.replace(/—$/, "").trim()));
}

async function fetchSource(url) {
  const headers = { "User-Agent": UA };
  if (url.includes("publications.europa.eu")) Object.assign(headers, { Accept: "application/xhtml+xml", "Accept-Language": "eng" });
  try {
    const r = await fetch(url, { headers, redirect: "follow" });
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, buf, type: r.headers.get("content-type") || "" };
  } catch (e) {
    console.error(`fetch failed for ${url}:`, e.message);
    return { status: 0, buf: Buffer.alloc(0), type: "" };
  }
}

function verdict(src, got) {
  if (got.status !== 200 || !got.buf.length) return "blocked";
  if (src.hash_method !== "raw-bytes") return "recheck in a browser";
  if (createHash("sha256").update(got.buf).digest("hex") === src.sha256) return "same";
  const text = createHash("sha256").update(htmlText(got.buf.toString("utf8"))).digest("hex");
  return src.text_sha256 && text === src.text_sha256 ? "same text, bytes differ" : "changed";
}

async function main() {
  const quotes = process.argv.includes("--quotes");
  const entries = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(join(DIR, f), "utf8")));
  const seen = new Map();
  let changed = 0;
  for (const e of entries) {
    for (const [i, src] of e.sources.entries()) {
      if (!seen.has(src.retrieved_url)) seen.set(src.retrieved_url, await fetchSource(src.retrieved_url));
      const got = seen.get(src.retrieved_url), v = verdict(src, got);
      if (v === "changed") changed++;
      let q = "";
      if (quotes && got.status === 200 && !/pdf/.test(got.type)) {
        const text = htmlText(got.buf.toString("utf8"));
        const mine = e.quotes.filter((x) => x.source === i);
        const missing = mine.filter((x) => !quoteFound(x.text.replace(/\[X\]/g, ""), text)).length;
        q = mine.length ? `, quotes ${mine.length - missing}/${mine.length} found` : "";
      }
      console.log(`${e.id}@${e.version} source ${i}: ${v} (HTTP ${got.status}${q}) ${src.retrieved_url}`);
    }
  }
  console.log(changed ? `${changed} source(s) changed since retrieval: read them and update the entries.` : "No source changed among those a script can read.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
