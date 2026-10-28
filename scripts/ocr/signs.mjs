// Do the matchers find the same signs in text read from a screenshot as in the typed text? Makes
// screenshot pages of made-up posts that carry a named theory's stock line, a persuasion cue or a
// claim from CMMNS' own fact-check table, then compares the signs found on each side. R&D only.
//
//   node scripts/ocr/signs.mjs make PAGES_DIR      (then eval.mjs PAGES_DIR OUT_DIR)
//   node scripts/ocr/signs.mjs score OUT_DIR
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

await import("../../src/ext/core.bundle.js");
const PB = globalThis.PB, ROOT = join(import.meta.dirname, "../..");
const [mode, dir] = process.argv.slice(2);
const FONTS = ["Segoe UI", "Arial", "Lato Web", "Hanken Grotesk", "Georgia", "Verdana"];
const THEMES = [["#fff", "#0f1419"], ["#000", "#e7e9ea"], ["#15202b", "#f7f9f9"]];
const esc = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function claimIndex() {
  const main = JSON.parse(readFileSync(join(ROOT, "src/ext/claims.json"), "utf8"));
  const parts = main.parts.map((p) => JSON.parse(readFileSync(join(ROOT, "src/ext", p), "utf8")));
  return PB.buildClaimIndex(PB.joinClaims(main, parts));
}

// The signs a text carries, as comparable keys.
function signs(text, index, fuzzy = false) {
  const m = PB.score(text).markers.map((x) => `marker:${x.family}:${x.theory || ""}`);
  const p = PB.persuasion(text).map((x) => `technique:${x.technique}`);
  const c = PB.matchClaims(index, text, { fuzzy }).map((x) => `claim:${x.url || x.claim || JSON.stringify(x).slice(0, 80)}`);
  return new Set([...m, ...p, ...c]);
}

function wrap(text, n) {
  const out = [];
  let cur = "";
  for (const w of text.split(/\s+/)) { if ((cur + " " + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  return cur ? [...out, cur] : out;
}

function make() {
  const r = { s: 7, next() { this.s = (this.s * 1103515245 + 12345) % 2147483648; return this.s / 2147483648; } };
  const pick = (a) => a[Math.floor(r.next() * a.length)];
  const index = claimIndex();
  const main = JSON.parse(readFileSync(join(ROOT, "src/ext/claims.json"), "utf8"));
  const claims = main.rows.map((x) => x[0]).filter((t) => /^[\x20-\x7e]{40,160}$/.test(t) && PB.matchClaims(index, t).length);
  const theoryLines = PB.THEORIES.flatMap((t) => (t.terms || []).slice(0, 2).map((term) => `Funny how nobody talks about ${term} anymore. Do your own research.`));
  const bodies = [...theoryLines, ...Array.from({ length: 30 }, () => pick(claims))];
  mkdirSync(dir, { recursive: true });
  const pages = bodies.map((body, i) => {
    const [bg, fg] = pick(THEMES), family = pick(FONTS), size = pick([15, 16, 17, 20]);
    const lines = wrap(body, 55).map((l) => `<div data-line data-size="${size}" style="white-space:nowrap;font-size:${size}px">${esc(l)}</div>`).join("");
    const file = `sign-${String(i).padStart(3, "0")}.html`;
    writeFileSync(join(dir, file), `<!doctype html><meta charset="utf-8"><body style="margin:0;background:${bg};color:${fg};font-family:'${family}'"><div style="padding:20px;max-width:640px">${lines}</div></body>`);
    return { file, kind: "post", split: "signs", family, scale: pick([1, 1, 2]), jpeg: r.next() < 0.33, body };
  });
  writeFileSync(join(dir, "pages.json"), JSON.stringify(pages, null, 1));
  console.log(`${pages.length} sign pages`);
}

function score() {
  const index = claimIndex(), { results } = JSON.parse(readFileSync(join(dir, "results-x1.json"), "utf8"));
  let typed = 0, both = 0, extra = 0;
  for (const r of results) {
    const truth = r.lines.map((l) => l.text).join(" "), a = signs(truth, index), b = signs(r.ocr.text, index, true);
    typed += a.size; both += [...a].filter((k) => b.has(k)).length; extra += [...b].filter((k) => !a.has(k)).length;
  }
  console.log(JSON.stringify({ pages: results.length, signsOnTypedText: typed, alsoFoundInImageText: both, recall: both / typed, onlyInImageText: extra }, null, 1));
}

if (mode === "make") make(); else score();
