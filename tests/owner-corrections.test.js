// Hand-kept owner corrections (data/owner-corrections.json, scripts/owner-corrections.mjs): every
// row is sourced and explained, the shipped table carries every correction, the window credits the
// correction instead of Wikidata, and the guard says when a correction can be retired.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCorrections, applyCorrections, correctionStatus } from "../scripts/owner-corrections.mjs";
import { correctionFlags } from "../scripts/upstream-guard.mjs";
import { setOwnerRows, ownerOfDomain, ownerSource } from "../src/core/owners.js";
import { setSiteTable, siteFacts, siteInfoRows } from "../src/core/sites.js";
import { siteEvidence } from "../src/core/api-site.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const corrections = loadCorrections();
const owners = JSON.parse(readFileSync(join(root, "src/ext/owners.json"), "utf8"));

test("every correction names its domain, owner, primary source, date checked and reason", () => {
  assert.ok(corrections.length >= 6);
  for (const c of corrections) {
    assert.match(c.domain, /^[a-z0-9.-]+\.[a-z]{2,}$/, c.domain);
    assert.ok(c.owner && c.reason.length > 40 && c.sourceSays, c.domain);
    assert.match(c.source, /^https:\/\//, c.domain);
    assert.doesNotMatch(c.source, /wikipedia\.org|wikidata\.org/, `${c.domain}: Wikipedia and Wikidata are pointers, not sources`);
    assert.match(c.checked, /^\d{4}-\d{2}-\d{2}$/);
    assert.doesNotMatch(JSON.stringify(c), /—/, "no em dashes in text users read");
  }
  assert.equal(new Set(corrections.map((c) => c.domain)).size, corrections.length);
});

test("the shipped owner table carries every correction, with what Wikidata said", () => {
  for (const c of corrections) {
    const row = owners.rows.find((r) => r.domain === c.domain);
    assert.ok(row, c.domain);
    assert.equal(row.owner, c.owner, c.domain);
    assert.equal(row.correction.source, c.source);
    assert.ok(row.correction.upstream && "owner" in row.correction.upstream, c.domain);
  }
  assert.deepEqual(correctionStatus(owners.rows, corrections).filter((s) => s.status !== "holds"), []);
});

test("applying corrections is idempotent and keeps the upstream value; a missing domain is reported", () => {
  const rows = [{ name: "Wrong item", domain: "a.example", owner: "Wrong owner", source: "Q1", via: "publisher" }, { name: "B", domain: "b.example", owner: "B Co", source: "Q2" }];
  const c = [{ domain: "a.example", owner: "Right owner", name: "A", via: "owner", source: "https://a.example/legal", checked: "2026-10-21", reason: "r", factsWrong: true }, { domain: "gone.example", owner: "X", source: "https://x", checked: "2026-10-21", reason: "r" }];
  const once = applyCorrections(rows, c), twice = applyCorrections(once.rows, c);
  assert.deepEqual(twice.rows, once.rows);
  assert.deepEqual(once.missing, ["gone.example"]);
  const a = once.rows[0];
  assert.equal(a.owner, "Right owner");
  assert.equal(a.name, "A");
  assert.ok(!("via" in a));
  assert.deepEqual(a.correction.upstream, { owner: "Wrong owner", via: "publisher", name: "Wrong item" });
  assert.equal(once.rows[1], rows[1]);
  assert.deepEqual(correctionStatus(once.rows, c).map((s) => s.status), ["holds", "missing"]);
  const agreed = applyCorrections([{ domain: "a.example", owner: "Right owner", source: "Q1" }], c);
  assert.equal(correctionStatus(agreed.rows, c)[0].status, "agrees");
});

test("the window credits the correction, not Wikidata, and hides facts from the wrong item", () => {
  setOwnerRows(owners.rows);
  setSiteTable({ facts: { "redeglobo.globo.com": ["RBS TV Porto Alegre", null, "Brazil", null, "Q536440"], "dw.com": ["Deutsche Welle", "1953", "Germany", "public broadcaster", "Q153770"] } });
  const globo = ownerOfDomain("redeglobo.globo.com");
  assert.match(ownerSource(globo), /^CMMNS correction, checked 2026-10-21: https:\/\/redeglobo\.globo\.com\/\. Wikidata said "O Diário de Mogi"/);
  assert.equal(siteFacts("redeglobo.globo.com"), null);
  assert.equal(siteFacts("dw.com").founded, "1953");
  const rows = siteInfoRows({ domain: "dw.com", owner: ownerOfDomain("dw.com"), facts: siteFacts("dw.com"), state: [] });
  assert.ok(rows.some(([h, v]) => h === "Owned by" && v === "Deutsche Welle, a public-law broadcaster under German federal law (CMMNS correction, checked 2026-10-21)"));
  const ev = siteEvidence("dw.com").find((e) => e.kind === "site-owner");
  assert.match(ev.source, /^CMMNS correction/);
  setOwnerRows([]); setSiteTable(null);
});

test("the guard says when Wikidata agrees with a correction, or changes under it", () => {
  const row = (up) => ({ domain: "a.example", owner: "Right owner", correction: { upstream: { owner: up, via: "owner" } } });
  assert.deepEqual(correctionFlags({ rows: [row("Wrong")] }, { rows: [row("Wrong")] }), []);
  assert.equal(correctionFlags({ rows: [row("Wrong")] }, { rows: [row("Right owner")] })[0].kind, "correction can be retired");
  assert.equal(correctionFlags({ rows: [row("Wrong")] }, { rows: [row("Other")] })[0].kind, "upstream changed under a correction");
});
