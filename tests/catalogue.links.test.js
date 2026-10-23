// Every badge links to its catalogue entry and version (src/core/catalogue-links.js), the extension's
// copy of the catalogue matches catalogue/, and the campaign window and card render the links.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCatalogue } from "./fixtures/catalogue.js";
import { badgeLinks, badgeLine, entriesCiting, challengeUrl, findingUrl, entryUrl } from "../src/core/catalogue-links.js";
import { CATALOGUE_ENTRIES, SIGNAL_REGISTRY } from "../src/core/catalogue-data.js";
import { catalogueSource, OUT } from "../scripts/catalogue-data.mjs";

const { list, registry } = loadCatalogue();
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the extension's catalogue copy is current with catalogue/", () => {
  assert.equal(readFileSync(OUT, "utf8").replace(/\r\n/g, "\n"), catalogueSource());
  assert.deepEqual(CATALOGUE_ENTRIES, [...list].sort((a, b) => a.id.localeCompare(b.id)));
  assert.deepEqual(SIGNAL_REGISTRY, registry);
});

test("every signal that can evidence an element links to an existing entry at its current version", () => {
  const current = new Map(list.map((e) => [e.id, e.version]));
  for (const s of registry.signals) {
    const b = badgeLinks(s.id, list, registry);
    assert.ok(b.registered, s.id);
    if (s.context_only) { assert.equal(b.entries.length, 0, `${s.id} is context only and must cite nothing`); continue; }
    assert.ok(b.entries.length >= 1, `${s.id} links to no catalogue entry`);
    for (const e of b.entries) {
      assert.equal(e.version, current.get(e.id), e.ref);
      assert.equal(e.url, entryUrl(e.id));
      assert.ok(b.links.some(([label, href]) => label === e.ref && href === e.url), e.ref);
    }
  }
});

test("each cited entry really cites the signal in one of its elements", () => {
  for (const s of registry.signals) for (const e of entriesCiting(s.id, list)) {
    const entry = list.find((x) => x.id === e.id);
    assert.ok(entry.elements.some((el) => el.signals.includes(s.id)), `${e.ref} cites ${s.id}`);
  }
});

test("every badge, cited or not, links to the dispute template with its signal filled in", () => {
  for (const id of [...registry.signals.map((s) => s.id), "sample", "shape-baseline"]) {
    const b = badgeLinks(id, list, registry);
    assert.deepEqual(b.links.at(-1), ["Dispute this badge", findingUrl(id)]);
    assert.match(badgeLine(b), /\.$/);
  }
  assert.match(challengeUrl("x-paid-partnerships@1.0.0"), /template=challenge\.yml&entry=x-paid-partnerships%401\.0\.0$/);
  const ctx = badgeLinks("random-suffix", list, registry);
  assert.ok(badgeLine(ctx).includes(`No catalogue entry cites this sign; it is listed in signals.json@${registry.version}`), badgeLine(ctx));
  assert.match(badgeLine(badgeLinks("sample", list, registry)), /context and cites no catalogue entry/);
});

test("an inactive entry is never linked as citing a signal", () => {
  const draft = { ...list.find((e) => e.id === "x-paid-partnerships"), status: "draft" };
  assert.ok(!entriesCiting("disclosed-paid", [draft]).length);
});

test("the campaign window and the card render the catalogue links and the decisions log", () => {
  const panel = read("src/ext/panel.js"), signals = read("src/ext/signals.js");
  for (const src of [panel, signals]) {
    assert.match(src, /PB\.badgeLinks\(\w+\.?\w*, PB\.CATALOGUE_ENTRIES, PB\.SIGNAL_REGISTRY\)/);
    assert.match(src, /PB\.DECISIONS_URL/);
  }
  assert.match(panel, /for \(const x of c\.indicators\) \{.*catalogue\(s, x\.id\)/);
  assert.match(panel, /for \(const x of c\.context\) \{.*catalogue\(s, x\.id\)/);
  assert.match(panel, /rel = "noopener noreferrer"/);
});
