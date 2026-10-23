// Organic baselines (src/core/baselines.js, scripts/baselines.mjs): the window's "what normal looks
// like" line, and the two changes the baselines led to: quoted text and the root post's wording
// no longer count as a copied reply, and bursts are tested against the thread's local pace.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BASELINES } from "../src/core/baselines-data.js";
import { baselineFor, baselineLine, pairsLine, BASELINE_SOURCE } from "../src/core/baselines.js";
import { SIZE_BINS, VIEW_BINS } from "../src/core/baselines-bins.js";
import { duplicateClusters, ownWords } from "../src/core/similarity.js";
import { timingBursts } from "../src/core/timing.js";
import { fingerprint } from "../src/core/network.js";

const results = JSON.parse(readFileSync(new URL("../project-docs/evidence/baseline-results.json", import.meta.url), "utf8"));

test("the bundled baselines match the committed measurement, with source, licence and hash", () => {
  for (const k of ["same", "burst", "burstDecayNull", "together", "togetherNull", "pairs3", "echo"]) assert.deepEqual(BASELINES[k], results[k], k);
  assert.equal(results.source.licence, "CC BY 4.0");
  assert.match(results.source.sha256, /^[0-9a-f]{64}$/);
  assert.ok(results.source.threads > 6000);
  for (const b of SIZE_BINS) assert.ok(results.same[b.id].n >= 50 && results.burst[b.id].n >= 50, b.id);
  for (const v of VIEW_BINS) assert.ok(results.together[v.id].n >= 1000, v.id);
});

test("the window's line names the bin, the rate, its interval and the count", () => {
  const line = baselineLine("same-text", { replies: 30 });
  const r = BASELINES.same["20-49"];
  assert.ok(line.startsWith("In ordinary threads with 20 to 49 replies,"), line);
  assert.ok(line.includes(`${r.n.toLocaleString("en")} threads`), line);
  assert.match(line, /95% interval/);
  assert.match(baselineLine("burst", { replies: 500 }), /100 or more replies/);
  assert.match(baselineLine("together", { viewed: 150 }), /about 100 threads on one news story/);
  assert.match(baselineLine("copied-elsewhere", { viewed: 3 }), /replies of 8 words or more/);
  assert.equal(baselineLine("burst", { replies: 3 }), null, "threads under 5 replies have no baseline");
  assert.equal(baselineFor("hate-symbol-name", { replies: 30 }), null, "only coordination signs carry one");
  assert.match(BASELINE_SOURCE, /PHEME/);
  assert.match(BASELINE_SOURCE, /from an earlier X/);
  assert.match(pairsLine(40), /median of \d+ such pair/);
});

test("quoting a post is not writing the same reply", () => {
  const quoted = "“@newsdesk: Police confirm the road is closed after the crash near the station”";
  assert.equal(ownWords(quoted).trim(), "");
  assert.equal(ownWords("Scary stuff RT @newsdesk: Police confirm the road is closed").trim(), "Scary stuff");
  const replies = [
    { id: "1", author: "a", text: quoted + " stay safe" },
    { id: "2", author: "b", text: "RT @newsdesk: Police confirm the road is closed after the crash near the station" },
    { id: "3", author: "c", text: quoted },
  ];
  assert.deepEqual(duplicateClusters(replies), []);
  assert.equal(fingerprint(quoted), null, "a quote alone has no wording of its own to fingerprint");
});

test("repeating the post being answered is not copying another reply", () => {
  const root = { text: "Breaking: the bridge on the north road has closed after the storm damage tonight" };
  const replies = [
    { id: "1", author: "a", text: "the bridge on the north road has closed after the storm damage tonight wow" },
    { id: "2", author: "b", text: "the bridge on the north road has closed after the storm damage tonight ugh" },
  ];
  assert.equal(duplicateClusters(replies).length, 1, "without the root, these look copied");
  assert.deepEqual(duplicateClusters(replies, { root }), []);
  // A real copy campaign still shows, root or not.
  const msg = "The council is hiding the real cost of the bridge and the press will never report it";
  const camp = ["a", "b", "c"].map((u, i) => ({ id: String(i), author: u, text: msg }));
  assert.equal(duplicateClusters(camp, { root }).length, 1);
});

test("the rush after a post is not a burst, and a burst inside a quiet stretch still is", () => {
  const t0 = Date.parse("2026-10-21T12:00:00Z");
  // 40 replies in the first two minutes, then one every few minutes for an hour.
  const rush = Array.from({ length: 40 }, (_, i) => ({ author: "r" + i, posted: new Date(t0 + i * 3000).toISOString() }));
  const tail = Array.from({ length: 20 }, (_, i) => ({ author: "t" + i, posted: new Date(t0 + 180000 + i * 180000).toISOString() }));
  assert.deepEqual(timingBursts([...rush, ...tail]), []);
  const quiet = Array.from({ length: 30 }, (_, i) => ({ author: "q" + i, posted: new Date(t0 + i * 120000).toISOString() }));
  const burst = ["x", "y", "z", "w", "v"].map((a, i) => ({ author: a, posted: new Date(t0 + 1830000 + i * 2000).toISOString() }));
  assert.equal(timingBursts([...quiet, ...burst], { precision: "second" }).length, 1, "synthetic times, exact to the second");
});
