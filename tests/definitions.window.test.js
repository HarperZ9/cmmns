// Element tables in the campaign window (src/ext/definitions-view.js): every applicable
// jurisdiction's tables, in a fixed order, each element matched, not matched or not observable, each
// table linked to its catalogue entry at its version. Runs the built bundle and the view in node.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { loadCatalogue } from "./fixtures/catalogue.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
runInThisContext(read("src/ext/core.bundle.js"));
runInThisContext(read("src/ext/definitions-view.js"));
const { PB, PBDefinitionsView: V } = globalThis;
const { list } = loadCatalogue();

// A launch with three campaign signs and the posters' own paid label on some quotes.
const LENS = { status: "strong", platform: "x", actor: null, launch: true,
  indicators: [{ id: "undisclosed-lookalike", text: "t" }, { id: "bio-template", text: "t" }, { id: "join-cluster", text: "t" }],
  context: [{ id: "disclosed-paid", text: "t" }] };
const QUIET = { ...LENS, status: "one", indicators: [], context: [] };

test("with no jurisdiction known, every jurisdiction the catalogue covers is shown", () => {
  const m = V.model(LENS);
  const codes = new Set(list.map((e) => e.jurisdiction.code));
  assert.deepEqual(new Set(m.groups.map((g) => g.code)), codes);
  assert.ok(m.notes.includes(V.ALL_NOTE));
  assert.equal(m.groups.reduce((n, g) => n + g.tables.length, 0), list.filter((e) => e.status === "active" && e.verification === "verified").length);
});

test("a multi-jurisdiction case shows each applicable jurisdiction with why, and no other", () => {
  const m = V.model(LENS, { actor: "US", audience: "UK" });
  const codes = m.groups.map((g) => g.code);
  assert.ok(codes.includes("platform:x") && codes.includes("US") && codes.some((c) => c.startsWith("UK")), codes.join(","));
  assert.ok(!codes.some((c) => c.startsWith("EU")), "EU is not applicable here");
  for (const g of m.groups.filter((x) => x.code === "US" || x.code === "platform:x")) assert.ok(g.why, g.code);
  assert.ok(!m.notes.includes(V.ALL_NOTE));
});

test("the order never depends on how damning a table looks", () => {
  const order = (m) => m.groups.flatMap((g) => g.tables.map((t) => t.catalogue));
  assert.deepEqual(order(V.model(LENS)), order(V.model(QUIET)));
});

test("every element is matched, not matched or not observable; unobservable is never matched", () => {
  for (const g of V.model(LENS).groups) for (const t of g.tables) for (const r of t.rows) {
    assert.ok(PB.STATUSES.includes(r.status), r.status);
    if (r.observable_from === "not-observable") assert.equal(r.status, "not-observable", `${t.catalogue} ${r.id}`);
  }
  const x = V.model(LENS).groups.find((g) => g.code === "platform:x").tables.find((t) => t.entry === "x-paid-partnerships");
  assert.deepEqual(x.matched, ["A", "B", "C"]);
});

test("each table links to its catalogue entry at the current version and to the challenge template", () => {
  const current = new Map(list.map((e) => [e.id, e.version]));
  for (const g of V.model(LENS).groups) for (const t of g.tables) {
    assert.equal(t.catalogue, `${t.entry}@${current.get(t.entry)}`);
    assert.equal(t.url, PB.entryUrl(t.entry));
    assert.ok(t.challengeUrl.endsWith(`entry=${encodeURIComponent(t.catalogue)}`));
  }
});

test("the card rows name every element's status and carry no verdict words", () => {
  const m = V.model(LENS), rows = V.rows(m);
  const n = m.groups.reduce((k, g) => k + g.tables.reduce((j, t) => j + t.rows.length, 0), 0);
  assert.equal(rows.filter(([label]) => /^Element /.test(label)).length, n);
  for (const [, v] of rows.filter(([label]) => /^Element /.test(label))) assert.match(v, /^(matched|not matched|not observable): /);
  const text = rows.map(([a, b]) => `${a} ${typeof b === "string" ? b : ""}`).join("\n");
  assert.deepEqual(PB.verdictHits(text), []);
  assert.ok(rows.some(([, v]) => v && v.links && v.links[0][0] === "x-paid-partnerships@1.0.0"));
});

test("the window section draws one block per jurisdiction and one table per definition", () => {
  const made = [];
  const node = (tag) => { const e = { tag, children: [], className: "", textContent: "", append(...xs) { this.children.push(...xs); } }; made.push(e); return e; };
  globalThis.document = { createElement: node };
  const parent = node("section"), m = V.model(LENS, { actor: "US", audience: "UK" });
  V.section(parent, m);
  assert.equal(made.filter((e) => e.tag === "details").length, m.groups.length);
  assert.equal(made.filter((e) => e.tag === "table").length, m.groups.reduce((k, g) => k + g.tables.length, 0));
  assert.ok(made.filter((e) => e.tag === "a").every((a) => a.rel === "noopener noreferrer" && a.target === "_blank"));
  delete globalThis.document;
});

test("the extension loads the view before the card and the panel, and both call it", () => {
  const js = JSON.parse(read("src/ext/manifest.json")).content_scripts.find((c) => c.js.includes("panel.js")).js;
  assert.ok(js.indexOf("definitions-view.js") < js.indexOf("card.js") && js.indexOf("definitions-view.js") < js.indexOf("panel.js"));
  assert.match(read("src/ext/panel.js"), /PBDefinitionsView\.section\(s, PBDefinitionsView\.model\(c\)\)/);
  assert.match(read("src/ext/card.js"), /PBDefinitionsView\.rows\(PBDefinitionsView\.model\(m\.campaign\)\)/);
  assert.match(read("src/ext/campaign.js"), /platform: "x", actor: PB\.actorOf\(reading\)/);
});
