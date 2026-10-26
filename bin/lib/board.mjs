// `daylight board make <folder> --title ... --lane ... --keywords ... --layout book|grid|timeline|evidence
// [--site x] [--study] [--since date] [--until date] [--case folder] [--clean] [--no-sidecars] [--pdf] --out <folder>`:
// a study board (project-docs/STUDY-BOARDS.md) from saved items and their daylight.sidecar/1 notes.
// Writes index.html, board.json, plates/, fonts/, sidecars/ and MANIFEST.sha256 into --out; with
// --pdf, board.pdf through a local Chrome or Edge in headless mode. Reads and writes local files only.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { parseSidecar, boardFrom } from "../../src/core/board.js";
import { boardHtml } from "../../src/core/board-html.js";
import { shareClean } from "../../src/core/clean.js";
import { loadCase } from "../../src/investigate/store.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
// The three faces that ship with Daylight Commons, all under the SIL Open Font License 1.1: Accession
// Stencil for running heads and titles, Hanken Grotesk for words, JetBrains Mono for figures.
const FONTS = [["AccessionStencil.woff2", "src/ext/fonts/AccessionStencil.woff2"], ["hanken-grotesk.woff2", "src/ext/fonts/hanken-grotesk.woff2"], ["jetbrains-mono-regular.woff2", "src/ext/fonts/jetbrains-mono-regular.woff2"]];
const sha = (b) => createHash("sha256").update(b).digest("hex");

function* notes(dir, depth = 0) {
  if (depth > 8) return;
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) yield* notes(p, depth + 1);
    else if (name.endsWith(".md")) yield p;
  }
}

// Saved items under a folder: [{ path, sidecar, sidecarName, files: [paths] }], filtered.
export function collect(dir, f = {}) {
  const out = [];
  for (const p of notes(dir)) {
    const sc = parseSidecar(readFileSync(p, "utf8"));
    if (!sc) continue;
    const fr = sc.front, posted = Date.parse(fr.posted || fr.saved || "");
    if (f.site && fr.site !== f.site) continue;
    if (f.study && !fr.study) continue;
    if (f.since && !(posted >= Date.parse(f.since))) continue;
    if (f.until && !(posted <= Date.parse(f.until))) continue;
    const files = (Array.isArray(fr.files) ? fr.files : []).map((n) => join(dirname(p), n)).filter((x) => existsSync(x));
    out.push({ path: p, sidecar: sc, sidecarName: basename(p), files });
  }
  return out.sort((a, b) => String(a.sidecar.front.posted || a.sidecar.front.saved).localeCompare(String(b.sidecar.front.posted || b.sidecar.front.saved)));
}

// Copies each plate's file into plates/ as NN-name (or a neutral NN.ext when cleaned).
async function writePlates(out, items, f) {
  mkdirSync(join(out, "plates"), { recursive: true });
  const entries = [], lines = [];
  let n = 0;
  for (const it of items) {
    const names = [], hashes = {};
    for (const file of it.files) {
      n++;
      let bytes = readFileSync(file);
      const original = sha(bytes);
      let name = `${String(n).padStart(3, "0")}-${basename(file)}`;
      if (f.clean) {
        const r = await shareClean(bytes);
        if (!r.ok) { lines.push(`plate ${n}: ${basename(file)} left out, ${r.reason}`); n--; continue; }
        bytes = Buffer.from(r.bytes); name = `${String(n).padStart(3, "0")}${extname(file)}`;
      }
      writeFileSync(join(out, "plates", name), bytes);
      names.push(name); hashes[name] = f.clean ? sha(bytes) : original;
    }
    if (!it.files.length) n++;
    if (it.files.length && !names.length) continue;
    entries.push({ sidecar: it.sidecar, sidecarName: it.sidecarName, files: names, sha256: hashes });
  }
  return { entries, lines };
}

// Chrome, Edge or Chromium on this computer (CHROME names another), or null.
export function findChrome(env = process.env) {
  const c = [env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge"];
  return c.find((p) => p && existsSync(p)) || null;
}

function manifest(out) {
  const files = [];
  const walk = (d) => { for (const n of readdirSync(d).sort()) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (n !== "MANIFEST.sha256") files.push(p); } };
  walk(out);
  writeFileSync(join(out, "MANIFEST.sha256"), files.map((p) => `${sha(readFileSync(p))}  ${relative(out, p).split("\\").join("/")}`).join("\n") + "\n");
  return files.length;
}

// Makes the board. Returns { out, board, line }.
export async function makeBoard(dir, f = {}, env = process.env) {
  if (!dir || !existsSync(dir)) throw new Error(`No such folder: ${dir}. Point at a folder of Daylight saves, such as Downloads/Daylight.`);
  const out = resolve(typeof f.out === "string" ? f.out : join(dir, "boards", String(f.title || "study-board").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()));
  const items = collect(dir, f);
  if (!items.length) throw new Error("No saved items with Daylight notes were found there (or none matched the filters).");
  mkdirSync(out, { recursive: true });
  const { entries, lines } = await writePlates(out, items, f);
  const board = boardFrom(entries, { title: f.title, lane: f.lane, keywords: f.keywords, layout: f.layout, head: f.head });
  const caseData = f.case ? loadCase(f.case) : null;
  mkdirSync(join(out, "fonts"), { recursive: true });
  for (const [name, from] of FONTS) copyFileSync(join(ROOT, from), join(out, "fonts", name));
  if (!f["no-sidecars"]) { mkdirSync(join(out, "sidecars"), { recursive: true }); for (const it of items) copyFileSync(it.path, join(out, "sidecars", it.sidecarName)); }
  if (caseData) { mkdirSync(join(out, "case"), { recursive: true }); for (const t of ["case.json", "sources.jsonl", "claims.jsonl", "edges.jsonl"]) if (existsSync(join(f.case, t))) copyFileSync(join(f.case, t), join(out, "case", t)); }
  writeFileSync(join(out, "board.json"), JSON.stringify(board, null, 2) + "\n");
  writeFileSync(join(out, "index.html"), boardHtml(board, { caseData }));
  let pdf = "";
  if (f.pdf) {
    const chrome = findChrome(env);
    if (!chrome) pdf = "\nNo Chrome or Edge was found for the PDF; open index.html and print it to PDF, or set CHROME.";
    else {
      const r = spawnSync(chrome, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${join(out, "board.pdf")}`, pathToFileURL(join(out, "index.html")).href], { encoding: "utf8", timeout: 120000 });
      pdf = existsSync(join(out, "board.pdf")) ? "\nPDF: board.pdf" : `\nThe PDF was not written: ${(r.stderr || "").trim().split("\n").pop() || "the browser gave no reason"}`;
    }
  }
  const count = manifest(out);
  return { out, board, line: `Board "${board.running_head.left}" (${board.layout}, ${board.plates.length} plates) written to ${out}.${pdf}\n${count} files listed in MANIFEST.sha256.${lines.length ? "\n" + lines.join("\n") : ""}\n` };
}

// `daylight board render <board.json>`: draws a refdb.board/1 spec made elsewhere (the reference
// library's `refdb board`), copying each plate's media into plates/ beside the page.
export async function renderSpec(specPath, f = {}, env = process.env) {
  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  if (spec.format !== "refdb.board/1") throw new Error(`${specPath} is not a refdb.board/1 board.`);
  const out = resolve(typeof f.out === "string" ? f.out : join(dirname(specPath), basename(specPath, ".json")));
  mkdirSync(join(out, "plates"), { recursive: true });
  const missing = [];
  for (const p of spec.plates) for (const m of p.media || []) {
    const from = isAbsolute(m.path) ? m.path : join(dirname(specPath), m.path);
    if (existsSync(from) && statSync(from).isFile()) copyFileSync(from, join(out, "plates", basename(from))); else missing.push(`plate ${p.n}: ${m.path}`);
  }
  mkdirSync(join(out, "fonts"), { recursive: true });
  for (const [name, from] of FONTS) copyFileSync(join(ROOT, from), join(out, "fonts", name));
  const layout = typeof f.layout === "string" ? f.layout : spec.layout || "book";
  writeFileSync(join(out, "board.json"), JSON.stringify(spec, null, 2) + "\n");
  writeFileSync(join(out, "index.html"), boardHtml(spec, { layout, head: typeof f.head === "string" ? f.head : spec.head, caseData: f.case ? loadCase(f.case) : null }));
  const count = manifest(out);
  return { out, line: `Board "${spec.running_head.left}" (${layout}, ${spec.plates.length} plates) written to ${out}.\n${count} files listed in MANIFEST.sha256.${missing.length ? "\nNot found: " + missing.join("; ") : ""}\n` };
}
