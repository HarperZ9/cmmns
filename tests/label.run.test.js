// A whole labelling run on synthetic cases: the ledger's order and hashes, A and B joined with
// Claude's resolutions, the method statement, the optional spot-check and labeller B's parsing.
// No real post is used and nothing is labelled.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { entryFor, readLedger, sha256 } from "../scripts/label/ledger.mjs";
import { run } from "../scripts/label/results.mjs";
import { results, statement, METHOD, DOES_NOT_PROVE } from "../scripts/label/stats.mjs";
import { parseAnswer, labelAll } from "../scripts/label/labeller-b.mjs";

const F = "dc-label/2";
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
const strata = (language = "en") => ({ platform: "x", audience: "10k-100k", topic: "tech", language, region: "unstated" });
const ids = ["c1", "c2", "c3", "c4"];
const cases = ids.map((id) => ({ format: F, kind: "case", case: id, url: `https://x.com/i/status/${id.slice(1)}`, archive: `https://web.archive.org/web/2026/x/${id}`, capture: sha256(id), strata: strata() }));
const lab = (who, model, labels) => ids.map((id, i) => ({ format: F, kind: "label", case: id, labeller: who, model, campaign: labels[i], families: {} }));
const A = lab("A", "claude-opus-5-5", ["paid-disclosed", "organic", "organic", "unsure"]);
const B = lab("B", "qwen3:8b", ["paid-disclosed", "organic", "paid-disclosed", "unsure"]);
const RES = [{ format: F, kind: "resolution", case: "c3", final: "organic", reason: "No partnership label on the post or its quotes, and no outside evidence of payment." }];
const LENS = ["strong", "none", "strong", "none"].map((lens, i) => ({ format: F, kind: "lens", case: ids[i], lens }));

function writeRun(order = ["cases", "labels-A", "labels-B", "resolution", "lens"]) {
  const dir = mkdtempSync(join(tmpdir(), "dc-run-"));
  const files = { cases: jsonl(cases), "labels-A": jsonl(A), "labels-B": jsonl(B), resolution: jsonl(RES), lens: jsonl(LENS) };
  const paths = {};
  for (const [ev, text] of Object.entries(files)) writeFileSync((paths[ev] = join(dir, `${ev}.jsonl`)), text);
  const ledger = join(dir, "ledger.jsonl");
  writeFileSync(ledger, "");
  for (const ev of order) appendFileSync(ledger, JSON.stringify(entryFor(readFileSync(ledger, "utf8"), ev, files[ev])) + "\n");
  const argv = ["--ledger", ledger, "--cases", paths.cases, "--a", paths["labels-A"], "--b", paths["labels-B"], "--resolution", paths.resolution, "--lens", paths.lens];
  return { dir, paths, ledger, argv };
}

test("the method statement is built exactly, and never says human-labelled", () => {
  assert.equal(statement(0.712, 60), "Labelled by Claude, cross-checked by an independent open-weight model (kappa = 0.71), 60 cases.");
  for (const k of [null, -0.2, 0, 1]) assert.doesNotMatch(statement(k, 3), /human/i);
  const { r, json } = run(writeRun().argv);
  assert.equal(r.statement, `${METHOD} (kappa = ${r.agreement.kappa.toFixed(2)}), 4 cases.`);
  assert.doesNotMatch(json, /human[- ]?label/i);
  assert.match(r.doesNotProve, /consistency, not truth/);
  assert.match(DOES_NOT_PROVE, /Claude helped write the detector rules/);
});

test("a full run scores the final labels: A, with Claude's resolution where A and B differ", () => {
  const { r } = run(writeRun().argv);
  assert.equal(r.cases, 4);
  assert.equal(r.disagreements, 1);
  assert.equal(r.counts.organic, 2);
  assert.deepEqual([r.organicFalsePositive.k, r.organicFalsePositive.n], [1, 2], "c3 resolved organic and the lens said strong");
  assert.deepEqual([r.precision.k, r.precision.n], [1, 2]);
  assert.equal(r.spotCheck.done, false);
});

test("scoring refuses a disagreement with no resolution", () => {
  assert.throws(() => results({ cases, a: A, b: B, resolution: [], lens: LENS }), /c3: A says organic, B says paid-disclosed, and there is no resolution/);
});

test("scoring refuses a resolution for a case where A and B agree", () => {
  const extra = [...RES, { ...RES[0], case: "c1", final: "organic" }];
  assert.throws(() => results({ cases, a: A, b: B, resolution: extra, lens: LENS }), /agree/);
});

test("scoring refuses a labels file recorded after the detector output was joined", () => {
  assert.throws(() => writeRun(["cases", "labels-A", "labels-B", "resolution", "lens", "labels-B"]), /already recorded|after the detector/);
  assert.throws(() => writeRun(["cases", "labels-A", "lens"]), /lens cannot be recorded before labels-B/);
  assert.throws(() => writeRun(["labels-A"]), /labels-A cannot be recorded before cases/);
});

test("scoring refuses a file that changed after its hash was recorded", () => {
  const w = writeRun();
  writeFileSync(w.paths["labels-B"], jsonl(B.map((r) => ({ ...r, campaign: r.case === "c3" ? "organic" : r.campaign }))));
  assert.throws(() => run(w.argv), /labels-B file does not match the hash recorded/);
});

test("scoring refuses a ledger whose chain was edited", () => {
  const w = writeRun();
  const lines = readFileSync(w.ledger, "utf8").trim().split("\n");
  [lines[1], lines[2]] = [lines[2], lines[1]];
  assert.throws(() => readLedger(lines.join("\n")), /seq|chain/);
});

test("the author spot-check is optional, never a gate, and reported when done", () => {
  const base = { cases, a: A, b: B, resolution: RES, lens: LENS };
  assert.equal(results(base, { boot: 10 }).spotCheck.done, false);
  const r = results({ ...base, spotCheck: { done: true, checked: 2, agreed: 1 } }, { boot: 10 });
  assert.equal(r.spotCheck.text, "The author spot-checked 2 of 4 cases and agreed with 1.");
  assert.equal(r.cases, 4, "a low spot-check agreement does not block the results");
  assert.throws(() => results({ ...base, spotCheck: { done: true, checked: 9, agreed: 1 } }), /checked/);
});

test("labeller B: the reply is parsed into a label, and anything else becomes unsure", () => {
  assert.deepEqual(parseAnswer('<think>hm</think>{"campaign":"organic","families":{"shape":"no","bios":"maybe"}}'), { campaign: "organic", families: { shape: "no" } });
  assert.equal(parseAnswer("I think it is organic."), null);
  assert.deepEqual(parseAnswer('{"campaign":"paid-undisclosed"}'), { campaign: "unsure", families: {} }, "no outside evidence kind, no paid-undisclosed");
  const dir = mkdtempSync(join(tmpdir(), "dc-cap-"));
  for (const id of ids) writeFileSync(join(dir, `${id}.txt`), id);
  const { rows, unreadable } = labelAll({ cases, captures: dir, model: "qwen3:8b", ask: (p) => (p.endsWith("c2.txt") ? "no idea" : '{"campaign":"organic","families":{}}') });
  assert.equal(rows.length, 4);
  assert.equal(unreadable, 1);
  assert.equal(rows[1].campaign, "unsure");
  writeFileSync(join(dir, "c1.txt"), "changed");
  assert.throws(() => labelAll({ cases, captures: dir, model: "m", ask: () => "" }), /does not match the hash/);
});
