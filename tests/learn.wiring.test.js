// Link wiring: every sign in the window carries a Learn link to its own lesson, the window turns
// it into a button the worker opens, the worker opens only Radar's pages, and the pages are local.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lesson } from "../src/ext/learn/index.js";

await import("../src/ext/core.bundle.js");
await import("../src/ext/signals.js");
const { PBSignals, PB } = globalThis;
const read = (p) => readFileSync(new URL(`../src/ext/${p}`, import.meta.url), "utf8");
const X = { id: "x", name: "X", hasLocation: true };

// A post that trips many families at once.
const model = {
  site: X, handle: "a", markers: PB.score("Migrants are vermin").markers,
  persuasion: [{ technique: "loaded-language", name: "Loaded language", definition: "d", match: "disgraceful", lang: "en" }],
  machine: PB.machineSigns("As an AI language model I cannot do that"), xSpam: true, paid: true,
  tweet: { posted: "2026-10-18T10:00:00.000Z", client: "BulkPoster 3000", note: "Context", media: [{ type: "video", url: "u", uploaded: "2019-05-02T00:00:00.000Z" }] },
  flags: ["new-account", "based-elsewhere", "same-text", "default-handle", "fast-replier", "hours-elsewhere"].map((id) => ({ id, evidence: "e", doesNotProve: "d" })),
};

test("every sign in the window links to the lesson for its own family", () => {
  const sig = PBSignals.all(model);
  assert.ok(sig.length >= 10, `only ${sig.length} signs`);
  for (const s of sig) {
    const row = s.rows.find(([h]) => h === "Learn");
    assert.ok(row, `${s.label} has no Learn row`);
    const path = row[1].open[1];
    assert.equal(path, `learn.html#${s.fam}`, s.label);
    assert.equal(PB.safePage(path), path, "the worker accepts the path");
    assert.ok(lesson(s.fam), `${s.label}: no lesson for ${s.fam}`);
  }
});

test("the Learn row comes last, after the measured line and any feedback", () => {
  for (const s of PBSignals.all(model)) {
    const heads = s.rows.map(([h]) => h);
    assert.equal(heads.at(-1), "Learn", s.label);
    assert.ok(heads.indexOf("Measured") >= 0 && heads.indexOf("Measured") < heads.length - 1, s.label);
  }
});

test("the window renders an open row as a button that asks the worker, and tips have a way out", () => {
  const pop = read("pop.js");
  assert.match(pop, /t\.open\) \{\s*row\.append\(openButton/);
  assert.match(pop, /type: "pb-open-page", path/);
  assert.match(pop, /"No more tips"/);
  assert.match(pop, /PBTour\.stop\(\)/);
});

test("the worker checks every path with safePage before opening a tab", () => {
  const life = read("lifecycle.js");
  assert.match(life, /msg\.type === "pb-open-page"/);
  assert.match(life, /const path = PB\.safePage\(msg\.path\);\s*if \(path\) chrome\.tabs\.create/);
});

test("the tour script loads after the bundle and before the window, the panel and the UI", () => {
  const m = JSON.parse(read("manifest.json"));
  const js = m.content_scripts.find((c) => c.js.includes("ui.js")).js;
  const at = (f) => js.indexOf(f);
  assert.ok(at("tour.js") > at("core.bundle.js"));
  for (const f of ["pop.js", "panel.js", "ui.js"]) assert.ok(at("tour.js") < at(f), f);
});

test("the window and panel take tips from the tour, the thread tip links its lesson", () => {
  assert.match(read("ui.js"), /PBTour\.take\("window"/);
  assert.match(read("panel.js"), /PBTour\.take\("panel"\)/);
  assert.equal(PB.safePage("learn.html#thread-report"), "learn.html#thread-report");
  assert.ok(lesson("thread-report"));
});

test("the lesson and self-check pages load only local files", () => {
  for (const page of ["learn.html", "quiz.html"]) {
    const html = read(page);
    assert.match(html, /<script src="core\.bundle\.js"><\/script>/, page);
    assert.match(html, /<script type="module" src="(learn|quiz)-page\.js"><\/script>/, page);
    assert.doesNotMatch(html, /(src|href)="(https?:)?\/\//, page);
  }
  for (const js of ["learn-page.js", "quiz-page.js"]) {
    assert.doesNotMatch(read(js), /fetch\(|XMLHttpRequest|innerHTML/, js);
  }
});
