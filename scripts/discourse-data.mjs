// The discourse checks' data (project-docs/DISCOURSE.md): the quote finder's index and the persona
// marker's name list, built from pinned public sources and signed by the project key.
//   node scripts/discourse-data.mjs fetch  [--cache DIR]   download the texts in data/discourse/texts.json (network)
//   node scripts/discourse-data.mjs query  [--cache DIR]   run data/discourse/persons.sparql on QLever (network)
//   node scripts/discourse-data.mjs texts  [--cache DIR]   build src/ext/discourse/quotes.json
//   node scripts/discourse-data.mjs persons [--cache DIR]  build src/ext/discourse/persons.json
//   node scripts/discourse-data.mjs sign   [--key FILE]    sign both into src/ext/discourse/discourse-data.pack.json
//   node scripts/discourse-data.mjs check  [--cache DIR]   rebuild in memory and compare (skipped without the cache)
// The cache holds downloads only and is never committed. Only fetch and query touch the network.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { buildQuotes } from "./discourse/texts.mjs";
import { buildPersons } from "./discourse/persons.mjs";
import { signPack, keyFingerprint } from "../src/core/packs.js";
import { sha256Hex, lfBytes } from "../src/core/sig.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data/discourse"), OUT = join(ROOT, "src/ext/discourse");
export const PACK = join(OUT, "discourse-data.pack.json");
export const PACK_FILES = ["quotes.json", "persons.json"];
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const cacheDir = () => arg("--cache", process.env.DAYLIGHT_DISCOURSE_CACHE || join(ROOT, ".cache/discourse"));
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const ENDPOINT = "https://qlever.cs.uni-freiburg.de/api/wikidata";
const write = (p, obj) => writeFileSync(p, JSON.stringify(obj) + "\n");

async function fetchTexts() {
  const dir = cacheDir(), m = json(join(DATA, "texts.json"));
  mkdirSync(dir, { recursive: true });
  for (const t of m.texts) {
    const p = join(dir, t.file);
    if (!existsSync(p)) { const r = await fetch(t.url); if (!r.ok) throw new Error(`${t.id}: HTTP ${r.status}`); writeFileSync(p, Buffer.from(await r.arrayBuffer())); }
    const got = sha(readFileSync(p));
    console.log(`${t.id}: ${got === t.sha256 ? "matches the pinned hash" : `DIFFERS from the pinned hash (${got})`}`);
  }
}

// The query file holds labelled blocks (#@ name); homonyms expands to four SRC x DST queries.
function queries(min) {
  const text = readFileSync(join(DATA, "persons.sparql"), "utf8").replace(/MIN_SITELINKS/g, String(min));
  const prefix = text.split("#@")[0].split("\n").filter((l) => !l.startsWith("#")).join("\n");
  const out = {};
  for (const block of text.split("#@").slice(1)) {
    const [head, ...body] = block.split("\n"), q = prefix + body.join("\n"), name = head.trim().split(" ")[0];
    const vars = Object.fromEntries([...head.matchAll(/(SRC|DST)=([\w:,]+)/g)].map((x) => [x[1], x[2].split(",")]));
    if (!vars.SRC) { out[name] = q; continue; }
    for (const s of vars.SRC) for (const d of vars.DST) out[`${name}-${s.split(":")[1]}-${d.split(":")[1]}`] = q.replace(/\bSRC\b/g, s).replace(/\bDST\b/g, d);
  }
  return out;
}

async function query() {
  const meta = json(join(DATA, "persons-meta.json")), dir = cacheDir();
  mkdirSync(dir, { recursive: true });
  for (const [name, q] of Object.entries(queries(meta.minSitelinks))) {
    const r = await fetch(`${ENDPOINT}?query=${encodeURIComponent(q)}`, { headers: { accept: "text/tab-separated-values" } });
    const text = await r.text();
    if (!r.ok || text.startsWith("{")) throw new Error(`${name}: the endpoint answered ${r.status}: ${text.slice(0, 200)}`);
    writeFileSync(join(dir, `persons-${name}.tsv`), text);
    console.log(`${name}: ${text.split("\n").length - 2} rows, sha256 ${sha(text)}`);
  }
}

export function quotesFrom(dir) {
  const m = json(join(DATA, "texts.json"));
  return buildQuotes(m, (t) => readFileSync(join(dir, t.file), "utf8"), json(join(DATA, "misattributions.json")), json(join(DATA, "attested.json")));
}

export function personsFrom(dir) {
  const meta = json(join(DATA, "persons-meta.json")), r = (n) => readFileSync(join(dir, `persons-${n}.tsv`), "utf8");
  const homonyms = ["label-label", "label-altLabel", "altLabel-label", "altLabel-altLabel"].map((n) => r(`homonyms-${n}`));
  return buildPersons({ people: r("people"), aliases: r("aliases"), homonyms }, meta);
}

async function sign() {
  const priv = json(arg("--key", process.env.RADAR_PACK_KEY || "D:/radar-keys/radar-project.private.jwk"));
  const files = {};
  for (const f of PACK_FILES) files[f] = await sha256Hex(lfBytes(readFileSync(join(OUT, f))));
  const created = process.env.RADAR_BUILT || new Date().toISOString().slice(0, 10);
  const pack = await signPack({ name: "Daylight Commons discourse data", version: created.replace(/-/g, "."), description: "The quote finder's index of public-domain texts with its sourced lists, and the persona marker's names of people who have died, from Wikidata.", authorName: "Daylight Commons project key", created }, priv, { files });
  writeFileSync(PACK, JSON.stringify(pack, null, 1) + "\n");
  console.log(`discourse-data.pack.json signed by ${keyFingerprint(pack.manifest.author.keyId)}`);
}

function check() {
  const dir = cacheDir();
  if (!existsSync(join(dir, "pg6920.txt"))) { console.log(`skipped: no cache at ${dir} (run fetch and query first)`); return; }
  for (const [f, built] of [["quotes.json", quotesFrom(dir)], ["persons.json", personsFrom(dir)]]) {
    const same = JSON.stringify(built) + "\n" === readFileSync(join(OUT, f), "utf8").replace(/\r/g, "");
    console.log(`${f}: ${same ? "matches a fresh build" : "DIFFERS from a fresh build"}`);
    if (!same) process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cmd = process.argv[2];
  const run = {
    fetch: fetchTexts, query,
    texts: async () => { const q = quotesFrom(cacheDir()); mkdirSync(OUT, { recursive: true }); write(join(OUT, "quotes.json"), q); console.log(`quotes.json: ${q.works.length} works, ${q.passages.length} passages`); },
    persons: async () => { const p = personsFrom(cacheDir()); mkdirSync(OUT, { recursive: true }); write(join(OUT, "persons.json"), p); console.log(`persons.json: ${p.people.length} people, ${p.droppedNames} names dropped`); },
    sign, check: async () => check(),
  }[cmd];
  if (!run) { console.error("usage: node scripts/discourse-data.mjs fetch|query|texts|persons|sign|check (see the header of this file)"); process.exit(2); }
  run().catch((e) => { console.error(`[discourse-data] ${cmd} failed: ${e.message}`); process.exit(1); });
}
