// Shared checks for each language's rhetoric markers. A language passes when every target gets
// the same markers from every template, controls and policy positions score 0, and accented
// words keep their boundaries. Each tests/rhetoric.<lang>.test.js supplies the sentences.
import test from "node:test";
import assert from "node:assert/strict";
import { score } from "../src/core/rhetoric.js";

export const families = (t) => score(t).markers.map((m) => m.family).sort().join(",");

// spec: { name, targets, templates: [[tpl, family]], cases: [[text, family]], policy: [text] }
export function languageSuite(spec) {
  assert.ok(spec.targets.length >= 14, `${spec.name}: at least 14 targets`);
  for (const [tpl, expected] of spec.templates) {
    test(`${spec.name}: same markers for every target: "${tpl}"`, () => {
      const differing = spec.targets.map((g) => [g, families(tpl.replace("{G}", g))]).filter(([, f]) => f !== expected);
      assert.deepEqual(differing, [], `targets scored differently from "${expected}"`);
    });
  }
  test(`${spec.name}: slogans, slurs, boundaries and fixed cases`, () => {
    for (const [t, expected] of spec.cases) assert.equal(families(t), expected, t);
  });
  test(`${spec.name}: policy positions are not markers`, () => {
    for (const t of spec.policy) assert.equal(score(t).score, 0, t);
  });
  for (const [a, b, fam] of spec.pairs || []) {
    test(`${spec.name}: coded pair scores alike: "${a}" / "${b}"`, () => {
      assert.equal(families(a), fam, a);
      assert.equal(families(b), fam, b);
      assert.equal(score(a).score, score(b).score);
    });
  }
}
