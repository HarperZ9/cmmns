// Time precision (src/core/precision.js). Times worked out from rounded ages shown on screen ("14h",
// "1d") put many replies on the same second, and before 3.2.1 the burst test read that as a burst
// with p < 0.000001. The fixtures in tests/fixtures/coarse-times keep the timing of the three real
// runs where that happened (two feed tests and a case study), with the text replaced and the accounts
// renamed. None may fire; a genuine second-precise burst still must.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { analyzeThread } from "../src/core/api.js";
import { importFile } from "../src/core/imports.js";
import { makeBundle } from "../src/core/evidence-bundle.js";
import { inferPrecision, timePrecision, observable, NOT_OBSERVABLE } from "../src/core/precision.js";
import { timingBursts, burstCheck } from "../src/core/timing.js";
import { swarmSign } from "../src/core/swarming.js";
import { recordThread, activity } from "../src/core/network.js";
import { postingPattern } from "../src/core/pattern.js";
import { flagsFor } from "../src/core/flags.js";
import { validate } from "../bin/lib/jsonschema.mjs";

const ROOT = join(import.meta.dirname, "..");
const DIR = join(ROOT, "tests", "fixtures", "coarse-times");
const SCHEMA = JSON.parse(readFileSync(join(ROOT, "schema", "evidence.v2.json"), "utf8"));
const NOW = Date.parse("2026-10-23T18:00:00Z");
const CASES = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
const kinds = (r) => r.evidence.map((e) => e.kind);
const analyseFile = (f) => {
  const imp = importFile(f, readFileSync(join(DIR, f)));
  assert.equal(imp.ok, true, f);
  return analyzeThread(imp.input, { now: NOW });
};

// 20 replies over ten hours and 5 accounts inside 8 seconds, with ordinary second-level times.
const T0 = Date.parse("2026-10-18T08:00:00Z");
const at = (s) => new Date(T0 + s * 1000).toISOString();
function burstThread(extra = {}) {
  const replies = Array.from({ length: 20 }, (_, i) => ({ id: "u" + i, author: "u" + i, text: "An ordinary reply number " + i, posted: at(i * 1800 + ((i * 17) % 59) + 1) }));
  for (let i = 0; i < 5; i++) replies.push({ id: "b" + i, author: "b" + i, text: "A reply in the burst, " + i, posted: at(15013 + i * 2) });
  return { site: "X", root: { id: "r", author: "root", text: "The post", posted: at(0) }, replies, ...extra };
}

test("the three real coarse-time runs are all here and fire no timing burst", () => {
  assert.deepEqual(CASES, ["case-study-t01.json", "feed-test-1-t22.json", "feed-test-1-t23.json", "feed-test-1-t24.json", "feed-test-2-t01.json"]);
  for (const f of CASES) {
    const r = analyseFile(f);
    assert.deepEqual(validate(SCHEMA, r), [], f);
    assert.ok(!kinds(r).includes("timing-burst"), `${f}: no timing burst`);
    assert.ok(!kinds(r).includes("swarming"), `${f}: no swarming`);
    assert.doesNotMatch(JSON.stringify(r), /replied within \d+ s/, f);
    const off = r.evidence.find((e) => e.kind === "timing-not-observable");
    assert.ok(off, `${f}: says the timing signals are not observable`);
    assert.equal(off.level, "info");
    assert.deepEqual(off.data.signals, ["timing-burst", "swarming"], f);
    assert.match(off.shows, new RegExp(NOT_OBSERVABLE));
    assert.match(off.shows, /given to the hour/);
    assert.deepEqual(r.posts.timePrecision, { value: "hour", basis: "inferred" }, f);
  }
});

test("the case-study run, as a bundle, carries no burst either", () => {
  const r = analyseFile("case-study-t01.json");
  const built = makeBundle(r, { tool: "CMMNS test", dataLock: null, source: "thread" });
  assert.equal(built.ok, true, built.reason);
  assert.ok(!built.bundle.evidence.some((e) => e.kind === "timing-burst"));
  assert.ok(built.bundle.evidence.some((e) => e.kind === "timing-not-observable"));
});

test("the command line reports the six-account false alarm as not observable", () => {
  const out = spawnSync(process.execPath, [join(ROOT, "bin", "radar.mjs"), "analyze", join(DIR, "feed-test-1-t24.json"), "--json", "--no-claims"], { encoding: "utf8" });
  assert.equal(out.status, 0, out.stderr);
  const r = JSON.parse(out.stdout);
  assert.ok(!kinds(r).includes("timing-burst"));
  assert.ok(kinds(r).includes("timing-not-observable"));
});

test("a genuine second-precise burst still fires, declared or inferred", () => {
  for (const input of [burstThread(), burstThread({ timePrecision: "second" }), burstThread({ timePrecision: "exact" })]) {
    const r = analyzeThread(input, { now: NOW });
    assert.deepEqual(validate(SCHEMA, r), []);
    const burst = r.evidence.find((e) => e.kind === "timing-burst");
    assert.ok(burst, `fires at ${input.timePrecision || "inferred"} precision`);
    assert.deepEqual(burst.posts, ["b0", "b1", "b2", "b3", "b4"]);
    assert.ok(!kinds(r).includes("timing-not-observable"));
  }
  assert.deepEqual(analyzeThread(burstThread(), { now: NOW }).posts.timePrecision, { value: "second", basis: "inferred" });
});

test("minute precision suppresses a signal that needs seconds, and says so", () => {
  const r = analyzeThread(burstThread({ timePrecision: "minute" }), { now: NOW });
  assert.ok(!kinds(r).includes("timing-burst"));
  const off = r.evidence.find((e) => e.kind === "timing-not-observable");
  assert.deepEqual(off.data.signals, ["timing-burst"], "swarming can be read at minute precision");
  assert.match(off.shows, /^Timing bursts are not observable at this time precision\./);
  assert.match(off.shows, /given to the minute, and timing bursts need times to the second/);
  assert.equal(off.data.basis, "declared");
  // One post given to the minute makes the thread's times as coarse as that post.
  const one = burstThread();
  one.replies[22].timePrecision = "minute";
  const r2 = analyzeThread(one, { now: NOW });
  assert.ok(!kinds(r2).includes("timing-burst"));
  assert.equal(r2.posts.timePrecision.value, "minute");
  assert.equal(r2.posts.timePrecision.basis, "declared and inferred");
  const rows = burstThread().replies;
  assert.equal(timingBursts(rows, { precision: "minute" }).length, 0);
  assert.equal(timingBursts(rows, { precision: "second" }).length, 1);
  assert.equal(burstCheck(rows, { precision: "minute" }).observable, false);
});

test("precision is inferred from the times, and typed times are not taken as seconds without evidence", () => {
  const ms = (iso) => Date.parse(iso);
  const hourly = ["01:10", "02:10", "02:10", "04:10", "06:10"].map((h) => ms(`2026-10-23T${h}:00Z`));
  assert.equal(inferPrecision(hourly), "hour");
  assert.equal(inferPrecision(["15 Aug", "07 Oct", "09 Oct"].map((d) => ms(`${d} 2026 00:00:00 UTC`))), "day");
  assert.equal(inferPrecision(["12:01", "12:07", "12:43", "13:02"].map((m) => ms(`2026-10-23T${m}:00Z`))), "minute");
  assert.equal(inferPrecision(["12:01:07", "12:07:41", "12:43:13"].map((s) => ms(`2026-10-23T${s}Z`))), "second");
  assert.equal(inferPrecision([1, 2345, 67891, 123457].map((x) => T0 + x)), "exact");
  assert.equal(inferPrecision([T0, T0 + 1000]), null, "two times cannot show a unit");
  assert.equal(inferPrecision([T0, T0, T0, T0]), null, "one time repeated says nothing about the unit");
  assert.deepEqual(timePrecision([{ posted: null }]), { precision: null, basis: "unknown", timed: 0 });
  assert.equal(observable("second", "timing-burst"), true);
  assert.equal(observable("minute", "timing-burst"), false);
  assert.equal(observable("minute", "swarming"), true);
  assert.equal(observable("day", "active-hours"), false);
  assert.equal(observable(null, "swarming"), false);
});

test("swarming needs times to the minute", () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ author: "n" + i, posted: at(i * 37) }));
  const markOf = () => ({ new: true, flagged: false });
  assert.ok(swarmSign(rows, markOf, { precision: "second" }));
  assert.equal(swarmSign(rows, markOf, { precision: "hour" }), null);
});

test("fast replies count only from threads timed to the second, active hours only to the hour", () => {
  const day = 86400000, rootAt = (d) => new Date(T0 + d * day).toISOString();
  const rows = (d) => [{ author: "quick", posted: new Date(T0 + d * day + 20000).toISOString() }, { author: "other", posted: new Date(T0 + d * day + 3600000).toISOString() }];
  let fine = {}, coarse = {};
  for (let d = 0; d < 3; d++) {
    fine = recordThread(fine, "t" + d, rows(d), rootAt(d), NOW, "second");
    coarse = recordThread(coarse, "t" + d, rows(d), rootAt(d), NOW, "minute");
  }
  const fast = (log) => flagsFor({ handle: "quick" }, { activity: activity(log, "quick") }).map((f) => f.id).includes("fast-replier");
  assert.equal(fast(fine), true);
  assert.equal(fast(coarse), false, "a minute-precise delay of 20 s could be 79 s");
  assert.equal(activity(coarse, "quick").coarseThreads, 3);
  // Entries written before 3.2.1 carry no precision; the extension took them from datetime attributes.
  const legacy = { threads: Object.fromEntries(Object.entries(fine.threads).map(([k, t]) => { const { prec, ...rest } = t; return [k, rest]; })) };
  assert.equal(fast(legacy), true);
  const daily = { threads: { a: { at: NOW, prec: "day", authors: { q: null }, posts: { q: Array.from({ length: 30 }, (_, i) => T0 + i * 3 * 3600000) } } } };
  assert.equal(activity(daily, "q").activeHours, null);
  daily.threads.a.prec = "second";
  assert.ok(activity(daily, "q").activeHours, "the same posts timed to the second do show active hours");
});

test("a posting pattern from day-precise times shows no hours and no round-the-clock flag", () => {
  const posts = Array.from({ length: 60 }, (_, i) => ({ id: "p" + i, posted: new Date(T0 + i * 3600000).toISOString(), client: "Web App" }));
  const byDay = postingPattern(posts, { precision: "day" });
  assert.equal(byDay.activeUtcHours, null);
  assert.equal(byDay.hourHist, null);
  assert.match(byDay.timeNotObservable, /hours of the day and gaps between posts: not observable/);
  assert.ok(!flagsFor({ handle: "a", pattern: byDay }).some((f) => f.id === "no-sleep-gap"));
  const bySecond = postingPattern(posts, { precision: "second" });
  assert.equal(bySecond.activeUtcHours, 24);
  assert.ok(flagsFor({ handle: "a", pattern: bySecond }).some((f) => f.id === "no-sleep-gap"));
});

test("platform formats carry their own precision; CMMNS' own shape keeps what it is given", () => {
  const fx = (f) => importFile(f, readFileSync(join(ROOT, "tests", "fixtures", "integration", f)));
  assert.equal(fx("x-saved.html").input.timePrecision, "second");
  assert.equal(fx("thread.json").input.timePrecision, "second");
  const typed = importFile("t.json", JSON.stringify({ site: "X", replies: [{ text: "a", posted: "2026-10-23T05:27:00Z" }] }));
  assert.equal(typed.input.timePrecision, undefined, "no precision is assumed for typed input");
});
