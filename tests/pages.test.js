// The transparency page and the public privacy policy are generated (npm run pages). These tests
// fail when a committed copy is stale, when a page leaks a local path, or when a sign is missing.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, TARGETS, FONT_FILES, markdown, inline } from "../scripts/site/page.mjs";
import { render as transparency, bullets, corpora } from "../scripts/transparency.mjs";
import { render as privacy } from "../scripts/privacy.mjs";
import { FAMILIES } from "../src/core/families.js";

const lf = (s) => s.split("\r\n").join("\n");
const pages = { "transparency.html": transparency(), "privacy.html": privacy() };
const sitePages = { "transparency.html": transparency("site"), "privacy.html": privacy("site") };

test("the committed pages match a fresh build, inside the extension and in docs/", () => {
  for (const dir of TARGETS) for (const [name, html] of Object.entries(dir.endsWith("docs") ? sitePages : pages)) {
    assert.equal(lf(readFileSync(join(dir, name), "utf8")), html, `run \`npm run pages\` (${name} in ${dir})`);
  }
  for (const f of FONT_FILES) assert.ok(existsSync(join(ROOT, "docs", "fonts", f)), f);
});

test("no page carries a local path, a placeholder or an em dash", () => {
  for (const [name, html] of [...Object.entries(pages), ...Object.entries(sitePages)]) {
    assert.doesNotMatch(html, /\b[A-Z]:[\\/]/, name);
    assert.doesNotMatch(html, /radar-data|project-docs|src\/(core|ext)|scripts\//, name);
    assert.doesNotMatch(html, /AUTHOR|TODO|—/, name);
  }
});

test("the transparency page names every sign, with intervals, corpora and licences", () => {
  const html = pages["transparency.html"];
  const plain = html.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  for (const f of FAMILIES) assert.ok(plain.includes(f.name), f.name);
  assert.match(html, /91\.0% \(3,996 of 4,393; 90\.1% to 91\.8%\)/, "slur precision with its interval");
  for (const l of ["CC BY 4.0", "MIT", "CC0 1.0"]) assert.ok(html.includes(l), l);
  for (const h of ["Side balance", "Still to measure", "Known limits"]) assert.ok(html.includes(`<h2>${h}</h2>`), h);
  assert.match(html, /Gap remains/, "the open MHS side gap is reported, not hidden");
});

test("the known limits come from EVALUATION.md, and corpora from CORPORA.md", () => {
  const md = readFileSync(join(ROOT, "project-docs/EVALUATION.md"), "utf8");
  const b = bullets(md, "### What the numbers do not prove");
  assert.ok(b.length >= 4);
  for (const x of b) assert.ok(pages["transparency.html"].includes(inline(x)), x.slice(0, 40));
  assert.throws(() => bullets(md, "### No such heading"));
  const c = corpora(readFileSync(join(ROOT, "project-docs/evidence/CORPORA.md"), "utf8"));
  assert.ok(c.length >= 5 && c.every((x) => x.url.startsWith("https://") && x.licence));
});

test("the privacy page is dated and links the changelog and issues", () => {
  const html = pages["privacy.html"];
  assert.match(html, /Updated \d{4}-\d{2}-\d{2}\./);
  assert.match(html, /github\.com\/HarperZ9\/cmmns\/issues/);
  assert.match(html, /pb\.feedback\.v1/);
  assert.throws(() => privacy("ext", "# CMMNS privacy policy\n\nNo date here.\n"));
});

test("the Markdown reader handles the shapes the docs use", () => {
  const html = markdown("# T\n\nA **b** `c`\nd.\n\n- one\n  two\n- three\n\n| A | B |\n|---|---|\n| 1 | 2 |\n");
  assert.equal(html, '<p>A <strong>b</strong> <code>c</code> d.</p>\n<ul><li>one two</li>\n<li>three</li></ul>\n<div class="scroll"><table><thead><tr><th scope="col">A</th><th scope="col">B</th></tr></thead><tbody>\n<tr><td>1</td><td>2</td></tr>\n</tbody></table></div>');
  assert.equal(markdown("<script>"), "<p>&lt;script&gt;</p>");
});

// The public site's copies follow the author's site canon (DESIGN-RULES.md on the author's site):
// the shared document cascade and navigation, the mast, the heading rail. The extension's copies
// cannot load those and keep their own shell.
test("the public site's pages use the site's shared cascade, navigation and mast", () => {
  for (const [name, html] of Object.entries(sitePages)) {
    for (const want of ['<link rel="stylesheet" href="/system/doc.css">', '<script type="module" src="/system/nav.js"></script>', '<body class="doc">', '<article class="sheet doc-rail">', '<header class="mast">', '<section aria-labelledby=']) assert.ok(html.includes(want), `${name}: ${want}`);
    assert.doesNotMatch(html, /conso-regular|@font-face/, `${name} takes its fonts from the site cascade`);
  }
  for (const html of Object.values(pages)) assert.doesNotMatch(html, /\/system\//, "the extension's copy loads nothing from the site");
});
