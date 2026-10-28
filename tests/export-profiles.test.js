// The four export profiles (src/core/export-profiles.js) and `radar export`. Controls that must
// fail: a tampered chain, post text, a private handle without a pseudonym, an unknown profile and
// a folder that is not empty are all refused. Every chain here is synthetic.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeReceipt, pseudonymFor, sha256Hex } from "../src/core/receipt.js";
import { appendSeal, emptySeal, exportSeal } from "../src/core/evidence-seal.js";
import { exportProfile, PROFILES } from "../src/core/export-profiles.js";
import { splitFor } from "../src/core/export-research.js";
import { VERDICT_WORDS } from "../src/core/definitions.js";
import { catalogueEntries } from "../bin/lib/export.mjs";

const ROOT = join(import.meta.dirname, "..");
const CLI = join(ROOT, "bin", "radar.mjs");
const DEMO = join(ROOT, "docs", "demo");
const DEF = "us-ftc-fake-social-media-indicators@1.0.1";
const dir = mkdtempSync(join(tmpdir(), "dc-export-"));
test.after(() => rmSync(dir, { recursive: true, force: true }));
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });

async function chainOf(extra = []) {
  const a = await makeReceipt({ kind: "domain-age", subject: "example.org", observed: { registered: "2026-09-30", daysBeforePost: 21 }, source: "RDAP", url: "https://rdap.example/domain/example.org", at: "2026-10-23T00:00:00Z", dnp: "A registration date says when the name was bought.", raw: { r: 1 } });
  const who = await pseudonymFor("salt-1", "someone");
  const b = await makeReceipt({ kind: "bio-template", subject: who, subjectKind: "private-pseudonym", observed: { groupSize: 12 }, source: "the page the user loaded", at: "2026-10-23T00:01:00Z", dnp: "A shared template is a pattern, not a person.", labeller: "L1", stratum: "en/tech" });
  const c = await makeReceipt({ kind: "finding", subject: "this launch", observed: { families: 2 }, source: "CMMNS campaign lens", at: "2026-10-23T00:02:00Z", dnp: "Two families agreeing is an inference.", cites: [a.hash, b.hash], catalogue: DEF });
  let seal = emptySeal();
  for (const r of [a, b, c, ...extra]) seal = await appendSeal(seal, r);
  return exportSeal(seal, { title: "test", at: "2026-10-23T00:03:00Z" });
}
const opts = { at: "2026-10-23T01:00:00Z", tool: "test", definitions: catalogueEntries() };

test("every profile exports a good chain and ships the chain unchanged", async () => {
  const chain = await chainOf();
  for (const p of PROFILES) {
    const r = await exportProfile(chain, p, opts);
    assert.equal(r.ok, true, `${p}: ${r.reason}`);
    assert.deepEqual(JSON.parse(r.files["evidence-chain.json"]), JSON.parse(JSON.stringify(chain)));
  }
});

test("controls: a tampered chain, post text, a raw private handle and an unknown profile are refused", async () => {
  const chain = await chainOf();
  const edited = structuredClone(chain);
  edited.seal.entries[0].receipt.observed.daysBeforePost = 900;
  assert.match((await exportProfile(edited, "legal", opts)).reason, /fails its own check/);
  const removed = structuredClone(chain);
  removed.seal.entries.splice(1, 1);
  assert.equal((await exportProfile(removed, "research", opts)).ok, false);
  const withText = await makeReceipt({ kind: "post", subject: "p1", observed: { text: "a post" }, source: "page", dnp: "x" });
  assert.match((await exportProfile(await chainOf([withText]), "research", opts)).reason, /carries "text"/);
  const raw = await makeReceipt({ kind: "account", subject: "@someone", subjectKind: "private-pseudonym", observed: { n: 1 }, source: "page", dnp: "x" });
  assert.match((await exportProfile(await chainOf([raw]), "journalistic", opts)).reason, /without a pseudonym/);
  assert.match((await exportProfile(chain, "pdf", opts)).reason, /unknown profile/);
});

test("technical: every receipt is a PROV entity with its activity, agent, derivations and chain membership", async () => {
  const chain = await chainOf();
  const prov = JSON.parse((await exportProfile(chain, "technical", opts)).files["provenance.json"]);
  const hashes = chain.seal.entries.map((e) => e.receipt.hash);
  for (const h of hashes) assert.ok(prov.entity[`dc:receipt-${h}`]["prov:generatedAtTime"]);
  assert.equal(Object.keys(prov.wasGeneratedBy).length, hashes.length);
  assert.equal(Object.keys(prov.hadMember).length, chain.size);
  // PROV-JSON has no null; the W3C schema and prov 3.3 reject one.
  const nulls = Object.values(prov).filter((s) => s && typeof s === "object").flatMap((s) => Object.values(s)).flatMap((n) => Object.entries(n || {})).filter(([, v]) => v === null);
  assert.deepEqual(nulls, []);
  assert.deepEqual(Object.values(prov.wasDerivedFrom).map((d) => d["prov:usedEntity"]).sort(), [hashes[0], hashes[1]].map((h) => `dc:receipt-${h}`).sort());
});

test("research: splits are fixed by hash, recorded with hashes, and Croissant points at the rows by SHA-256", async () => {
  const chain = await chainOf();
  const files = (await exportProfile(chain, "research", opts)).files;
  const rows = files["rows.jsonl"].trim().split("\n").map((l) => JSON.parse(l));
  for (const r of rows) assert.equal(r.split, await splitFor("daylight-export-1", r.id));
  assert.equal(rows.every((r) => r.lineage.root === chain.root && r.lineage.proof), true);
  const splits = JSON.parse(files["splits.json"]).splits;
  assert.equal(Object.values(splits).reduce((a, s) => a + s.rows, 0), rows.length);
  const cr = JSON.parse(files["croissant.json"]);
  assert.equal(cr.conformsTo, "http://mlcommons.org/croissant/1.0");
  // mlcroissant reads @language and the cr: terms from the standard context.
  assert.equal(cr["@context"]["@language"], "en");
  for (const k of ["recordSet", "field", "source", "extract", "fileObject", "column", "dataType", "citeAs"]) assert.ok(cr["@context"][k], k);
  assert.ok(cr.citeAs && cr.version);
  assert.equal(cr.distribution[0].sha256, await sha256Hex(files["rows.jsonl"]));
  assert.match(files["DATASHEET.md"], /1 rows carry a labeller; strata present: en\/tech/);
  const again = (await exportProfile(chain, "research", { ...opts, at: "2027-01-01T00:00:00Z" })).files["splits.json"];
  assert.equal(again, files["splits.json"]);
});

test("legal: exhibits, custody log, the cited definition's elements, limits and verifier steps", async () => {
  const md = (await exportProfile(await chainOf(), "legal", opts)).files["DOSSIER.md"];
  for (const h of ["## Exhibits", "### Exhibit 3", "## Chain of custody", "## Definitions cited", "## Limits", "## How to verify", "radar.mjs verify evidence-chain.json"]) assert.ok(md.includes(h), h);
  for (const e of opts.definitions[DEF].elements) assert.ok(md.includes(`| ${e.id} |`), `element ${e.id}`);
});

test("authored wording in the written profiles never states a verdict", async () => {
  const chain = await exportSeal(emptySeal(), { at: "2026-10-23T00:00:00Z" });
  for (const p of ["legal", "journalistic"]) {
    const r = await exportProfile(chain, p, opts);
    const text = Object.entries(r.files).filter(([n]) => n.endsWith(".md")).map(([, t]) => t).join("\n");
    assert.equal(VERDICT_WORDS.test(text), false, `${p}: ${text.match(VERDICT_WORDS)}`);
  }
});

test("radar export writes a folder, refuses a non-empty one, and refuses the edited demo chain", () => {
  const out = join(dir, "legal");
  const ok = run("export", join(DEMO, "demo-evidence-chain.json"), "--profile", "legal", "--out", out);
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(readdirSync(out).sort(), ["DOSSIER.md", "evidence-chain.json"]);
  assert.equal(run("verify", join(out, "evidence-chain.json")).status, 0);
  assert.notEqual(run("export", join(DEMO, "demo-evidence-chain.json"), "--profile", "legal", "--out", out).status, 0);
  const bad = run("export", join(DEMO, "demo-evidence-chain-edited.json"), "--profile", "technical", "--out", join(dir, "bad"));
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /export refused/);
  const reply = join(dir, "reply.json");
  writeFileSync(reply, JSON.stringify([{ party: "Example Co", asked: "2026-10-23", channel: "email", response: "declined" }]));
  mkdirSync(join(dir, "j"));
  const j = run("export", join(DEMO, "demo-evidence-chain.json"), "--profile", "journalistic", "--out", join(dir, "j"), "--reply", reply);
  assert.equal(j.status, 0, j.stderr);
  assert.match(readFileSync(join(dir, "j", "WRITE-UP.md"), "utf8"), /\| Example Co \| 2026-10-23 \| email \| declined \|/);
});
