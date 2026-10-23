// The public catalogue page (docs/catalogue.html) is generated from catalogue/ by
// scripts/catalogue-page.mjs. These fail when the committed page is stale, when an entry or one of
// its elements, sources or hashes is missing, or when the page leaves the site canon.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OUT, render, loadEntries, grouped, groupOf, updated, entryHtml } from "../scripts/catalogue-page.mjs";

const lf = (s) => s.split("\r\n").join("\n");
const entries = loadEntries();
const html = render();

test("the committed catalogue page matches a fresh build", () => {
  assert.equal(lf(readFileSync(OUT, "utf8")), html, "run `node scripts/catalogue-page.mjs`");
});

test("every entry is on the page with its anchor, version, sources, dates, hashes and elements", () => {
  assert.ok(entries.length >= 15);
  for (const e of entries) {
    assert.ok(html.includes(`id="${e.id}"`), `${e.id} anchor`);
    assert.ok(html.includes(`<code>${e.id}@${e.version}</code>`), `${e.id} version`);
    assert.ok(html.includes(`href="#${e.id}"`), `${e.id} in the contents`);
    for (const s of e.sources) {
      assert.ok(html.includes(`href="${s.url.replace(/&/g, "&amp;")}"`), `${e.id} source link`);
      assert.ok(html.includes(`retrieved ${s.retrieved_at}`), `${e.id} retrieval date`);
      assert.ok(html.includes(s.sha256), `${e.id} source hash`);
    }
    const one = entryHtml(e);
    assert.equal((one.match(/<tr><td>/g) || []).length, e.elements.length, `${e.id} element rows`);
  }
});

test("entries are grouped by jurisdiction in a fixed order", () => {
  const names = grouped(entries).map(([n]) => n);
  assert.deepEqual(names, ["United States", "European Union", "United Kingdom", "Platform policies"]);
  assert.equal(groupOf({ jurisdiction: { code: "UK-EW-NI", name: "x" } }), "United Kingdom");
  assert.equal(groupOf({ jurisdiction: { code: "platform:x", name: "x" } }), "Platform policies");
  assert.equal(groupOf({ jurisdiction: { code: "CA", name: "Canada" } }), "Canada");
  const counted = grouped(entries).reduce((n, [, l]) => n + l.length, 0);
  assert.equal(counted, entries.length, "no entry dropped by grouping");
});

test("the page follows the site canon and carries no local path or verdict wording", () => {
  for (const want of ['<link rel="stylesheet" href="/system/doc.css">', '<script type="module" src="/system/nav.js"></script>', '<body class="doc">', '<header class="mast">', '<section aria-labelledby=']) assert.ok(html.includes(want), want);
  assert.doesNotMatch(html, /@font-face|\b[A-Z]:[\/]|project-docs|TODO/);
  const outsideQuotes = html.replace(/<blockquote>[\s\S]*?<\/blockquote>/g, "");
  assert.doesNotMatch(outsideQuotes, /—/, "em dashes appear only inside verbatim quotes");
  assert.match(html, /<details><summary>Quoted text and source hashes<\/summary>/, "hashes sit outside the reading path");
  assert.match(html, /issues\/new\?template=challenge\.yml/);
});

test("the page date is the newest catalogue version", () => {
  assert.equal(updated("## 1.1.0 (2026-11-02)\n\n## 1.0.0 (2026-10-22)\n"), "2026-11-02");
  assert.throws(() => updated("# no versions\n"));
});
