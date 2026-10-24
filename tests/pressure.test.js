// The pressure family of the reading lens (src/core/reading-pressure.js): off by default behind its
// own switch, names no group or side, marks the five sock-puppet messages it was seeded from, leaves
// a quoted pressure phrase alone, and matches the held-out scores recorded in the evidence file.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lensOn, readPost, readingOn } from "../src/core/reading.js";
import { PRESSURE_IDS, PRESSURE_TECHNIQUES } from "../src/core/reading-pressure.js";
import { normalizeSettings } from "../src/core/settings.js";
import { NATIONS, TARGET_GROUPS } from "../src/core/reading-lists.js";
import { loadSet, score, cueHash } from "../scripts/eval-pressure.mjs";

const shown = (text) => new Set(readPost(text, { on: new Set(PRESSURE_IDS) }).filter((f) => f.shown).map((f) => f.technique));

test("off by default, on only with its own switch or with every technique", () => {
  const s = normalizeSettings(null);
  assert.equal(s.pressureLens, false);
  for (const id of PRESSURE_IDS) assert.equal(lensOn(s).has(id), false, id);
  for (const id of PRESSURE_IDS) assert.equal(readingOn().has(id), false, `${id} never ships on by measurement alone`);
  assert.ok(PRESSURE_IDS.every((id) => lensOn({ pressureLens: true }).has(id)));
  assert.ok(PRESSURE_IDS.every((id) => lensOn({ lensAll: true }).has(id)));
});

test("the seed email carries urgency, a shrunk ask and deflection by label", () => {
  const email = "Hi, it's me again. Sorry to push, but our rollout is blocked on the multi-route fix and I could really use your help. Three quick steps, ~5 minutes. Re the malware claim in the thread: the quoted line is not in the diff. Judge the code, not the noise.";
  assert.deepEqual([...shown(email)].sort(), ["deflection-by-label", "shrinking-ask", "urgency"]);
  assert.deepEqual([...shown("Chiming in as a user. I can't find any download/exec logic in the diff")], ["manufactured-consensus"]);
  assert.ok(shown("Credit to the outside developer for catching what the rest of us missed, and to the uploader for owning it").has("false-even-handedness"));
  assert.ok(shown("the line you're quoting does not exist in this PR - check the Files tab yourself.").has("burden-shifting"));
});

test("ordinary messages stay clear, and a quoted or reported pressure phrase is a mention", () => {
  for (const t of ["Thanks, merged. This will ship in 2.4.1.", "You can verify the download yourself: the SHA-256 is listed on the releases page.",
    "This should take about five minutes: run the migration, restart the worker, and confirm the queue drains.", "Friendly ping on this when you have time."]) assert.equal(shown(t).size, 0, t);
  assert.equal(shown('He wrote "sorry to push" in the email, which is a known script.').size, 0);
});

test("no cue names a people, nation, party or side", () => {
  const cues = PRESSURE_TECHNIQUES.flatMap(([, , , c]) => c).join(" ").toLowerCase();
  const words = new Set(cues.split(/[^a-z']+/));
  for (const w of [...NATIONS, ...TARGET_GROUPS].filter((x) => x.length > 4 && !x.includes(" "))) assert.ok(!words.has(w.toLowerCase()), w);
});

test("the recorded held-out scores are reproduced by the frozen cues on the hashed test set", () => {
  const rec = JSON.parse(readFileSync(new URL("../project-docs/evidence/pressure-results.json", import.meta.url), "utf8"));
  const set = loadSet("test");
  assert.equal(set.sha256, rec.input.sha256, "the test set changed since it was scored");
  assert.equal(cueHash(), rec.cues.sha256, "the cues changed after the held-out score: run a new round with a fresh test set");
  assert.deepEqual(score(set.rows).overall, rec.withInflection.overall);
});
