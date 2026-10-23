// The "How Daylight Commons works" page (scripts/how-it-works.mjs): built fresh, every still it
// shows is in docs/demo, each finding has a caption and at most one plain line on how to read it, and
// the page follows the author's site canon like the other public pages.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, esc } from "../scripts/site/page.mjs";
import { render, FINDINGS, missingStills } from "../scripts/how-it-works.mjs";

const lf = (s) => s.split("\r\n").join("\n");
const html = render();

test("the committed page matches a fresh build", () => {
  assert.equal(lf(readFileSync(join(ROOT, "docs/how-it-works.html"), "utf8")), html, "run `npm run pages`");
});

test("every still, the diagram and the recording it shows are in docs/demo", () => {
  assert.deepEqual(missingStills(), []);
  for (const f of ["how-it-works-light.svg", "how-it-works-dark.svg", "demo-install-to-verify.webm"]) assert.ok(existsSync(join(ROOT, "docs/demo", f)), f);
});

test("each finding shows its still and caption, and at most one short line on how to read it", () => {
  assert.ok(FINDINGS.length >= 10);
  for (const [src, title, what, read] of FINDINGS) {
    assert.ok(what && what.length > 20, title);
    assert.ok(html.includes(`<h3>${esc(title)}</h3>`) && html.includes(`src="demo/${src}"`), title);
    if (read) {
      assert.ok(html.includes(`<p class="dc-read">${esc(read)}</p>`), title);
      assert.ok(read.split(/[.!?](\s|$)/).filter((x) => x && x.trim()).length <= 3 && read.length < 160, `${title}: keep it short`);
    }
  }
  assert.doesNotMatch(html, /Does not prove/);
});

test("the page uses the site canon and carries no local path, placeholder or em dash", () => {
  for (const want of ['href="/system/doc.css"', 'src="/system/nav.js"', '<article class="sheet doc-rail">', 'class="art-light"', 'class="art-dark"']) assert.ok(html.includes(want), want);
  assert.doesNotMatch(html, /\b[A-Z]:[\/]|project-docs|TODO|—/);
});
