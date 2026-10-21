// The technique signs carry their organic baseline (scripts/techniques-baselines.mjs on PHEME), and
// the technique map documents every technique with a signal, a status and a target.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TECHNIQUE_BASELINES } from "../src/core/techniques-data.js";
import { baselineLine } from "../src/core/baselines.js";
import { SIZE_BINS } from "../src/core/baselines-bins.js";

const results = JSON.parse(readFileSync(new URL("../project-docs/evidence/technique-baselines.json", import.meta.url), "utf8"));
const map = readFileSync(new URL("../project-docs/TECHNIQUES.md", import.meta.url), "utf8");

test("the bundled technique baselines match the committed measurement", () => {
  for (const k of ["flood", "cross", "multilingual"]) assert.deepEqual(TECHNIQUE_BASELINES[k], results[k], k);
  assert.equal(results.source.licence, "CC BY 4.0");
  assert.match(results.source.sha256, /^[0-9a-f]{64}$/);
  for (const b of SIZE_BINS) assert.ok(results.flood[b.id].n >= 50, b.id);
});

test("flood and cross-language lines read against ordinary threads", () => {
  assert.match(baselineLine("flood", { replies: 30 }), /^In ordinary threads with 20 to 49 replies, a flood of replies from very high-rate accounts showed up in [\d.]+% of threads \(95% interval/);
  assert.match(baselineLine("cross-language", { replies: 8 }), /different languages showed up in [\d.]+% of threads/);
  assert.equal(baselineLine("flood", { replies: 2 }), null);
});

test("the technique map covers every technique with signal, status, gap and target", () => {
  for (const t of ["Flooding", "Laundering", "Cloned or imitation outlets", "Coordinated amplification", "Repetition across languages", "Just asking questions", "Demoralisation", "Swarming"]) assert.ok(map.includes(t), t);
  for (const s of ["Signal", "Radar measures", "Missing", "Precision target"]) assert.ok(map.includes(s), s);
  assert.match(map, /Paul and Matthews/);
  assert.match(map, /DISARM/);
  assert.match(map, /CC BY-SA 4\.0/);
  assert.doesNotMatch(map, /—/, "no em dashes");
});

test("the technique lessons say what the badges say", async () => {
  const { lesson } = await import("../src/ext/learn/index.js");
  const { CROSS_DOES_NOT_PROVE } = await import("../src/core/crosslang.js");
  const { CHAIN_DOES_NOT_PROVE } = await import("../src/core/chain.js");
  assert.equal(lesson("cross-language").dnp, CROSS_DOES_NOT_PROVE);
  assert.equal(lesson("laundered").dnp, CHAIN_DOES_NOT_PROVE);
});
