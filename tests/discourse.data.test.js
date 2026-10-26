// The discourse checks' data and wiring: the signed pack, the licence of every source, the size the
// extension carries, the scripts the manifest loads, the switch that keeps it all off, and the rule
// that nothing here reaches the network.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { verifyPack, verifyFiles } from "../src/core/packs.js";
import { PROJECT_KEY } from "../src/core/pack-keys.js";
import { normalizeSettings } from "../src/core/settings.js";
import { PACK_FILES } from "../scripts/discourse-data.mjs";

const url = (p) => new URL(`../${p}`, import.meta.url);
const read = (p) => readFileSync(url(p), "utf8");
const json = (p) => JSON.parse(read(p));

test("the discourse data is signed by the project key and matches every shipped file", async () => {
  const pack = json("src/ext/discourse/discourse-data.pack.json");
  const v = await verifyPack(pack, [PROJECT_KEY]);
  assert.deepEqual(v.problems, []);
  assert.equal(v.trusted, true);
  assert.deepEqual(Object.keys(pack.manifest.files).sort(), [...PACK_FILES].sort());
  assert.deepEqual(await verifyFiles(pack, async (n) => readFileSync(url(`src/ext/discourse/${n}`))), [], "re-sign with `node scripts/discourse-data.mjs sign`");
});

test("every indexed text is in the public domain by its translator's death, and every listed finding cites an https source", () => {
  const texts = json("data/discourse/texts.json").texts, q = json("src/ext/discourse/quotes.json");
  for (const t of texts) {
    assert.ok(t.translatorDied < 1956, `${t.id}: translator died ${t.translatorDied}, before 1956 (life plus 70)`);
    assert.ok(t.year < 1931, `${t.id}: published ${t.year}, before 1931 (United States)`);
    assert.match(t.sha256, /^[0-9a-f]{64}$/);
  }
  assert.deepEqual(q.works.map((w) => w.id), texts.map((t) => t.id));
  for (const e of [...q.misattributed, ...q.attested]) assert.match(e.source, /^https:\/\//, e.id);
  assert.ok(!texts.some((t) => /mein kampf/i.test(t.title)), "texts still in copyright somewhere stay out");
});

test("the data stays small enough to ship", () => {
  assert.ok(statSync(url("src/ext/discourse/quotes.json")).size < 4_000_000);
  assert.ok(statSync(url("src/ext/discourse/persons.json")).size < 500_000);
});

test("the checks are off until the user turns them on", () => {
  assert.equal(normalizeSettings(null).discourse, false);
  assert.equal(normalizeSettings({ discourse: true }).discourse, true);
  assert.match(read("src/ext/options.js"), /switchRow\("Discourse checks"/);
});

test("the content scripts and the worker load the discourse bundle after the core bundle", () => {
  const m = json("src/ext/manifest.json");
  const content = m.content_scripts.find((c) => c.js.includes("content.js")).js;
  assert.equal(content.indexOf("discourse.bundle.js"), content.indexOf("core.bundle.js") + 1);
  assert.ok(content.indexOf("discourse.js") > content.indexOf("discourse.bundle.js") && content.indexOf("discourse.js") < content.indexOf("content.js"));
  const bg = m.background.scripts;
  assert.ok(bg.indexOf("discourse-bg.js") > bg.indexOf("discourse.bundle.js") && bg.indexOf("discourse.bundle.js") > bg.indexOf("core.bundle.js"));
  assert.match(read("src/ext/background.js"), /importScripts\([^)]*"discourse\.bundle\.js", "discourse-bg\.js"/);
  assert.match(read("src/ext/signals.js"), /PBDiscourse\.signs\(m, settings\)/);
});

test("no discourse code fetches anything but the extension's own files", () => {
  for (const f of ["src/ext/discourse.js", "src/ext/discourse-bg.js", ...["text", "quotes", "persona", "stats", "docclaim", "corrections", "cards"].map((n) => `src/core/discourse/${n}.js`)]) {
    const src = read(f);
    for (const m of src.matchAll(/fetch\(([^)]*)\)/g)) assert.match(m[1], /^url\(f$/, `${f} fetches ${m[1]}`);
    assert.doesNotMatch(src, /XMLHttpRequest|WebSocket|sendBeacon/, f);
  }
});
