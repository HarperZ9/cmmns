// The label marker (src/core/discourse/labels.js): planted labels of every shape fire with their spans,
// and every control class (neutral descriptors, proper nouns, negation, self-description, quotation and
// reported speech) gives no applied label. Every name is invented.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { labelsIn, appliedLabels } from "../src/core/discourse/labels.js";
import { claimTypes } from "../src/core/discourse/claimtype.js";
import { claimTypeSign } from "../src/core/discourse/cards.js";
import { evaluate } from "../scripts/eval-labels.mjs";

const planted = JSON.parse(readFileSync(new URL("./fixtures/argument/labels-planted.json", import.meta.url), "utf8"));

test("every planted label fires once, with its shape and severity", () => {
  const kinds = new Set();
  for (const p of planted.positives) {
    const hits = appliedLabels(p.text);
    assert.equal(hits.length, p.labels, p.text);
    assert.deepEqual([hits[0].kind, hits[0].severity], [p.kind, p.severity], p.text);
    kinds.add(p.kind);
  }
  assert.deepEqual([...kinds].sort(), ["appositive-after", "appositive-before", "naming", "predicate"]);
});

test("the study's two missed shapes fire, with spans that cover the label", () => {
  const a = "On the panel, Democrat, communist Jane Talbot spoke first.";
  const [h] = appliedLabels(a);
  assert.equal(a.slice(h.start, h.end), "Democrat, communist Jane Talbot");
  assert.deepEqual([h.kind, h.epithet, h.target], ["appositive-before", "communist", "Jane Talbot"]);
  const b = "Look at her. This woman is a liar.";
  const [g] = appliedLabels(b);
  assert.equal(b.slice(g.start, g.end), "This woman is a liar");
  assert.deepEqual([g.kind, g.epithet, g.target], ["predicate", "liar", "This woman"]);
});

test("compounds count each pejorative word; intensifiers and plain adjectives do not", () => {
  assert.equal(appliedLabels("He is a radical-left lunatic.")[0].severity, 2);
  assert.equal(appliedLabels("He is a radical left lunatic.")[0].severity, 2);
  assert.equal(appliedLabels("She is a far-right extremist.")[0].severity, 2);
  assert.equal(appliedLabels("You are a lying, corrupt crook.")[0].severity, 3);
  assert.equal(appliedLabels("He is a total, complete fraud.")[0].severity, 1);
  assert.equal(appliedLabels("He is a shameless hypocrite.")[0].severity, 1);
});

test("the -ist forms the old rule caught still type as classification", () => {
  for (const s of ["Rory Vance is a socialist.", "She was a Marxist.", "They are extremists."]) assert.equal(claimTypes(s)[0].type, "classification", s);
  assert.equal(claimTypes("She is a pianist.")[0].type, "classification", "the shape rule still reads any -ist category");
  assert.equal(appliedLabels("She is a pianist.").length, 0, "but a category is not an epithet");
});

test("no control applies a label, and each is marked with the status its class decides", () => {
  for (const c of planted.controls) {
    const hits = labelsIn(c.text);
    assert.equal(hits.filter((h) => h.status === "label").length, 0, c.text);
    if (c.status) assert.ok(hits.some((h) => h.status === c.status), `${c.text}: ${c.status}`);
    else assert.deepEqual(hits, [], c.text);
  }
});

test("a negated, self, quoted or reported label does not make a sentence a classification", () => {
  assert.equal(claimTypes("Jane Talbot is not a liar.")[0].type !== "classification", true);
  assert.equal(claimTypes("Pat Doe denied being a crook.")[0].labels[0].status, "reported");
  assert.equal(claimTypes("Democrat, communist Jane Talbot wants your guns.")[0].type, "classification");
  assert.match(claimTypes("This woman is a liar.")[0].cue, /applies an epithet .*"This woman is a liar"/);
});

test("the author's own report applies the label; someone else's is reported", () => {
  assert.equal(labelsIn("I think she is a crook.")[0].status, "label");
  assert.equal(labelsIn("Critics think she is a crook.")[0].status, "reported");
  assert.equal(labelsIn("We call them traitors.")[0].status, "label");
  assert.equal(labelsIn("They call them traitors.")[0].status, "reported");
});

test("the claim card lists applied labels with their epithet and severity", () => {
  const [s] = claimTypeSign(claimTypes("Pat Doe is a far-right extremist. Ana Ruiz is not a liar."));
  const rows = s.rows.filter(([k]) => /^label/.test(k));
  assert.equal(rows.length, 1);
  assert.match(rows[0][1], /"extremist", 2 words/);
});

test("precision and recall on the planted and round-1 sets, and the shuffled-lexicon control", () => {
  const r = evaluate(), have = JSON.parse(readFileSync(new URL("../project-docs/evidence/labels-eval.json", import.meta.url), "utf8"));
  assert.deepEqual([r.planted.precision, r.planted.recall], [1, 1]);
  assert.ok(r.round1.precision === 1 && r.round1.recall >= 0.95);
  for (const k of ["planted", "round1"]) assert.deepEqual([r[k].tp, r[k].fp, r[k].fn], [have.current[k].tp, have.current[k].fp, have.current[k].fn], "rerun node scripts/eval-labels.mjs --write");
  for (const k of ["planted", "round1"]) {
    assert.ok(r.shuffled[k].mean < 0.25, `${k}: shuffled mean recall ${r.shuffled[k].mean}`);
    assert.ok(r.shuffled[k].max < 0.6, `${k}: shuffled max recall ${r.shuffled[k].max}`);
  }
  assert.equal(have.firstScore.recall, 0.86, "the first blind score is kept as it was");
});
