// The design canon (project-docs/DESIGN-CANON-CHECK.md): no em dash anywhere a user reads, every
// page on the shared tokens, and no colour outside the canon's set in Radar's own styles.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const list = (dir, re) => readdirSync(join(ROOT, dir)).filter((f) => re.test(f)).map((f) => join(dir, f));
const read = (p) => readFileSync(join(ROOT, p), "utf8");

// Everything a user can read: pages, scripts that build text, styles, Radar's own data files, the
// store listing, the README and the privacy policy. Left out: the claims and owners tables, which
// quote fact-checkers and Wikidata word for word; the rhetoric grammars and word lists, where a
// dash is the copula Radar matches in Russian and Ukrainian and is never shown; and the core
// bundle, which is built from the core files checked here.
const SKIP = /^(claims(-\d+)?\.json|owners\.json|core\.bundle\.js|(rhetoric|lexicon)(-[a-z]+)?\.js)$/;
const USER_FACING = [
  ...list("src/ext", /\.(html|js|css|json)$/), ...list("src/ext/learn", /\.js$/), ...list("src/core", /\.js$/),
  ...list("docs", /\.html$/), "README.md", "PRIVACY.md", "project-docs/STORE-LISTING.md",
].filter((p) => !SKIP.test(basename(p)));

// A regular expression that looks for an em dash (the machine-writing sign, the About-page reader)
// is a detector, not text, so regex literals are removed before the check.
const DASH = "—";
const REGEX = /\/(?:[^/\n\\]|\\.)+\/[gimsuy]*/g;
const text = (p) => (p.endsWith(".js") ? read(p).replace(REGEX, "") : read(p));

test("no em dash in anything a user reads", () => {
  const hits = USER_FACING.filter((p) => text(p).includes(DASH));
  assert.deepEqual(hits, [], "replace each em dash with a comma, a colon or a full stop");
});

test("the em dash check catches an em dash in text and skips one in a pattern", () => {
  const strip = (s) => s.replace(REGEX, "");
  assert.ok(strip(`const t = "one ${DASH} two";`).includes(DASH));
  assert.ok(!strip(`if (s.match(/${DASH}/g)) n++;`).includes(DASH));
});

test("every Radar page loads the shared tokens before its own styles", () => {
  for (const p of list("src/ext", /\.html$/).filter((f) => !/(transparency|privacy)\.html$/.test(f))) {
    const html = read(p), canon = html.indexOf('href="canon.css"');
    assert.ok(canon > 0, `${p} links canon.css`);
    for (const m of html.matchAll(/href="([\w-]+\.css)"/g)) assert.ok(m.index >= canon, `${p}: canon.css comes before ${m[1]}`);
  }
  for (const p of ["src/ext/transparency.html", "src/ext/privacy.html", "docs/transparency.html", "docs/privacy.html"]) {
    assert.match(read(p), /--paper: #ebe5d8;/, `${p} carries the canon tokens`);
  }
});

// The canon's colours: the site's light and dark tokens, the window's adapted grounds for X, and
// the art's bone and void. Anything else in Radar's own styles is a deviation.
const CANON = new Set(["#ebe5d8", "#e4ddcd", "#e2dac9", "#d8cfbc", "#16130f", "#4a443b", "#5f584d", "#c9bfab", "#7b7262",
  "#0a6b61", "#8f3a19", "#4e4d85", "#060608", "#0c0c0f", "#111114", "#1a1a1e", "#ece5d6", "#b8b0a0", "#958e80", "#29282c",
  "#6f6a61", "#63d4ce", "#e29472", "#b3b1e6", "#f1ece1", "#0a0a0d", "#38363b", "#1e2732", "#3a4550", "#fff6e6",
  "#fff", "#000", "#333", "#444", "#aaa", "#555", "#006b73", "#8a3219", "#4b4b7a"]);

test("Radar's styles use only canon colours", () => {
  for (const p of [...list("src/ext", /\.css$/), "src/ext/pages.js", "src/ext/evidence-card.js"]) {
    const off = [...read(p).matchAll(/#[0-9a-f]{3,6}\b/gi)].map((m) => m[0].toLowerCase()).filter((c) => !CANON.has(c));
    assert.deepEqual(off, [], p);
  }
});

test("no pill or rounded-card shapes and no tracked uppercase labels", () => {
  for (const p of list("src/ext", /\.css$/)) {
    const css = read(p);
    assert.doesNotMatch(css, /border-radius:\s*(999px|[3-9]px|1\dpx)/, `${p}: controls are square (2px at most)`);
    assert.doesNotMatch(css, /text-transform:\s*uppercase/, `${p}: labels are mixed case`);
  }
});
