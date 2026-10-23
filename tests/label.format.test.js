// The labelling files hold structure only (scripts/label/format.mjs), and the labelling page agrees
// with the format and has no way to send anything (scripts/label/label.html, label.js).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseRows, CAMPAIGN, FAMILIES, EVIDENCE } from "../scripts/label/format.mjs";

const ROOT = join(import.meta.dirname, "..");
const H = "a".repeat(64);
const caseRow = { format: "dc-label/2", kind: "case", case: "c001", url: "https://x.com/i/status/1", archive: "https://web.archive.org/web/2026/https://x.com/i/status/1", capture: H, strata: { platform: "x", audience: "10k-100k", topic: "tech", language: "en", region: "unstated" } };
const labelRow = { format: "dc-label/2", kind: "label", case: "c001", labeller: "A", model: "claude-opus-5-5", campaign: "organic", families: { shape: "no", bios: "cannot-tell" } };
const line = (o) => JSON.stringify(o);

test("a case row needs the post URL, an archive copy, the capture hash and strata", () => {
  assert.equal(parseRows(line(caseRow), "case").length, 1);
  assert.throws(() => parseRows(line({ ...caseRow, archive: undefined }), "case"), /archive/);
  assert.throws(() => parseRows(line({ ...caseRow, archive: "https://example.org/copy" }), "case"), /archive copy/);
  assert.throws(() => parseRows(line({ ...caseRow, capture: "abc" }), "case"), /SHA-256/);
  assert.throws(() => parseRows(line({ ...caseRow, strata: { ...caseRow.strata, language: "English" } }), "case"), /ISO 639/);
});

test("post text, handles, names and bios are refused in every file", () => {
  for (const key of ["text", "handle", "name", "bio", "note"]) {
    assert.throws(() => parseRows(line({ ...caseRow, [key]: "anything" }), "case"), /structure only/, key);
    assert.throws(() => parseRows(line({ ...labelRow, [key]: "anything" }), "label"), /structure only/, key);
  }
  assert.throws(() => parseRows(line({ ...labelRow, url: "https://x.com/someone" }), "label"), /structure only/, "a label row carries no link");
  assert.throws(() => parseRows(line({ ...caseRow, strata: { ...caseRow.strata, handle: "@someone" } }), "case"), /structure only/);
});

test("labellers are A (Claude) or B (the open-weight model), each with a model id", () => {
  assert.throws(() => parseRows(line({ ...labelRow, labeller: "L1" }), "label"), /A \(Claude\) or B/);
  assert.throws(() => parseRows(line({ ...labelRow, model: undefined }), "label"), /model/);
  assert.equal(parseRows(line({ ...labelRow, labeller: "B", model: "qwen3:8b" }), "label")[0].model, "qwen3:8b");
});

test("a resolution needs a written reason, without handles or links", () => {
  const res = { format: "dc-label/2", kind: "resolution", case: "c001", final: "organic", reason: "The paid partnership label is absent and no outside evidence was found." };
  assert.equal(parseRows(line(res), "resolution").length, 1);
  assert.throws(() => parseRows(line({ ...res, reason: undefined }), "resolution"), /written reason/);
  assert.throws(() => parseRows(line({ ...res, reason: "organic" }), "resolution"), /written reason/);
  assert.throws(() => parseRows(line({ ...res, reason: "Same template as the quote from @someone in the list." }), "resolution"), /handle or a link/);
});

test("rows of the wrong kind, repeated cases and bad ids are refused", () => {
  assert.throws(() => parseRows(line(labelRow), "case"), /holds case rows/);
  assert.throws(() => parseRows([line(labelRow), line(labelRow)].join("\n"), "label"), /twice/);
  assert.throws(() => parseRows(line({ ...labelRow, case: "@someone" }), "label"), /opaque id/);
  assert.throws(() => parseRows(line({ ...labelRow, campaign: "paid-undisclosed" }), "label"), /evidence/);
});

test("the labelling page's sets match the format", () => {
  const js = readFileSync(join(ROOT, "scripts/label/label.js"), "utf8");
  const arr = (name) => JSON.parse(js.match(new RegExp(`var ${name} = (\\[[^\\]]*\\])`))[1]);
  assert.deepEqual(arr("CAMPAIGN"), CAMPAIGN);
  assert.deepEqual(arr("EVIDENCE"), EVIDENCE);
  assert.deepEqual(arr("FAMILIES"), FAMILIES);
  assert.match(js, /var FORMAT = "dc-label\/2"/);
});

test("the labelling page cannot send anything and never reads a detector verdict", () => {
  const html = readFileSync(join(ROOT, "scripts/label/label.html"), "utf8");
  const js = readFileSync(join(ROOT, "scripts/label/label.js"), "utf8");
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/);
  assert.doesNotMatch(js, /"lens"/, "the page writes label rows only");
  assert.doesNotMatch(html + js, /—/, "no em dash");
  assert.doesNotThrow(() => new Function(js), "the page script parses");
});
