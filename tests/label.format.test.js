// The labels file holds structure only (scripts/label/format.mjs), and the labelling page agrees
// with the format and has no way to send anything (scripts/label/label.html, label.js).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseLabels, CAMPAIGN, FAMILIES, EVIDENCE, PLATFORMS, AUDIENCE, TOPICS } from "../scripts/label/format.mjs";
import { run } from "../scripts/label/results.mjs";

const ROOT = join(import.meta.dirname, "..");
const ok = { format: "dc-label/1", kind: "label", case: "c001", labeller: "L1", campaign: "organic", families: { shape: "no", bios: "cannot-tell" }, strata: { platform: "x", audience: "10k-100k", topic: "tech", language: "en", region: "unstated" } };
const line = (o) => JSON.stringify(o);

test("a well-formed label row and lens row parse", () => {
  const r = parseLabels([line(ok), line({ format: "dc-label/1", kind: "lens", case: "c001", lens: "none" })].join("\n"));
  assert.equal(r.labels.length, 1);
  assert.equal(r.lens.length, 1);
});

test("post text, handles, names, bios and links are refused", () => {
  for (const key of ["text", "handle", "name", "bio", "url", "note"]) {
    assert.throws(() => parseLabels(line({ ...ok, [key]: "anything" })), /structure only/, key);
  }
  assert.throws(() => parseLabels(line({ ...ok, strata: { ...ok.strata, handle: "@someone" } })), /structure only/);
  assert.throws(() => parseLabels(line({ ...ok, families: { ...ok.families, comment: "looks bought" } })), /structure only/);
});

test("a case id or labeller id that could carry a handle or link is refused", () => {
  assert.throws(() => parseLabels(line({ ...ok, case: "https://x.com/someone/status/1" })), /opaque id/);
  assert.throws(() => parseLabels(line({ ...ok, case: "@someone" })), /opaque id/);
  assert.throws(() => parseLabels(line({ ...ok, labeller: "Jane Doe" })), /opaque id/);
});

test("values outside their sets are refused, and paid-undisclosed needs an outside evidence kind", () => {
  assert.throws(() => parseLabels(line({ ...ok, campaign: "bot" })), /campaign/);
  assert.throws(() => parseLabels(line({ ...ok, campaign: "paid-undisclosed" })), /evidence/);
  assert.doesNotThrow(() => parseLabels(line({ ...ok, campaign: "paid-undisclosed", evidence: "platform-notice" })));
  assert.throws(() => parseLabels(line({ ...ok, evidence: "platform-notice" })), /only for paid-undisclosed/);
  assert.throws(() => parseLabels(line({ ...ok, strata: { ...ok.strata, language: "English" } })), /ISO 639/);
});

test("the labelling page's sets match the format", () => {
  const js = readFileSync(join(ROOT, "scripts/label/label.js"), "utf8");
  const arr = (name) => JSON.parse(js.match(new RegExp(`var ${name} = (\\[[^\\]]*\\])`))[1].replace(/'/g, '"'));
  assert.deepEqual(arr("CAMPAIGN"), CAMPAIGN);
  assert.deepEqual(arr("EVIDENCE"), EVIDENCE);
  assert.deepEqual(arr("FAMILIES"), FAMILIES);
  for (const [k, set] of [["platform", PLATFORMS], ["audience", AUDIENCE], ["topic", TOPICS]]) {
    assert.deepEqual(JSON.parse(js.match(new RegExp(`${k}: (\\[[^\\]]*\\])`))[1]), set, k);
  }
});

test("the labelling page cannot send anything and never reads a lens verdict", () => {
  const html = readFileSync(join(ROOT, "scripts/label/label.html"), "utf8");
  const js = readFileSync(join(ROOT, "scripts/label/label.js"), "utf8");
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/);
  assert.doesNotMatch(js, /"lens"/, "the page writes label rows only");
  assert.doesNotMatch(html + js, /—/, "no em dash");
});

test("the command line tool writes a results file from a labels file", () => {
  const dir = mkdtempSync(join(tmpdir(), "dc-label-"));
  const rows = [line(ok), line({ ...ok, labeller: "L2" }), line({ format: "dc-label/1", kind: "lens", case: "c001", lens: "none" })];
  writeFileSync(join(dir, "labels.jsonl"), rows.join("\n") + "\n");
  const { r } = run([join(dir, "labels.jsonl"), "--out", join(dir, "results.json")]);
  assert.equal(r.cases, 1);
  assert.equal(JSON.parse(readFileSync(join(dir, "results.json"), "utf8")).format, "dc-label-results/1");
});
