// The argument lens, the claim-type marker (F7), the inference-gap marker (F9) and the reframing marker.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const createHashSync = (b) => createHash("sha256").update(b).digest("hex");
import { readArgument, findConnectives, boundaries } from "../src/core/discourse/argument.js";
import { claimTypes, inferenceGaps } from "../src/core/discourse/claimtype.js";
import { reframing } from "../src/core/discourse/isomer.js";
import { score } from "../scripts/eval-argument.mjs";

// Summa Theologiae I q.2 a.2, objections 1 to 3, Latin (public domain), and the 7 boundaries Aliocha
// marked inside them (the reference library's study of 2026-10-25).
const SUMMA = "Deum enim esse est articulus fidei. Sed ea quae sunt fidei, non sunt demonstrabilia: quia demonstratio facit scire, fides autem de non apparentibus est, ut patet per Apostolum, Hb 11,1. Ergo Deum esse non est demonstrabile. Praeterea, medium demonstrationis est quod quid est. Sed de Deo non possumus scire quid est, sed solum quid non est, ut dicit Damascenus. Ergo non possumus demonstrare Deum esse. Praeterea, si demonstraretur Deum esse, hoc non esset nisi ex effectibus eius. Sed effectus eius non sunt proportionati ei: cum ipse sit infinitus et effectus finiti; finiti autem ad infinitum non est proportio. Cum ergo causa non possit demonstrari per effectum sibi non proportionatum, videtur quod Deum esse non possit demonstrari.";
const GOLD = ["Sed ea quae", "Ergo Deum esse non", "Sed de Deo", "Ergo non possumus", "Sed effectus", "finiti autem", "Cum ergo causa"];
const STARTS = ["Praeterea, medium", "Praeterea, si"];

test("regression: all 7 of Aliocha's breaks in Summa I q.2 a.2, and the 3 'sed' as minor premises", () => {
  const r = readArgument(SUMMA);
  assert.equal(r.lang, "la");
  const cuts = new Set(boundaries(r));
  for (const g of [...GOLD, ...STARTS]) assert.ok(cuts.has(SUMMA.indexOf(g)), `break at "${g}"`);
  assert.equal(cuts.size, GOLD.length + STARTS.length, "no break she did not mark");
  const sed = r.segments.filter((s) => s.opener && s.opener.form === "sed");
  assert.equal(sed.length, 3);
  assert.ok(sed.every((s) => s.role === "minor premise"));
  assert.deepEqual(r.segments.filter((s) => s.role === "conclusion").length, 3);
  assert.deepEqual(r.units.map((u) => u.movement), ["argument", "list", "list"]);
});

test("connectives in each language: the role list, clause-start forms and postpositive particles", () => {
  assert.deepEqual(findConnectives("Ele se lembra. Ora, todo homem é mortal; logo, Sócrates é mortal.", "pt").map((c) => c.form), ["ora", "logo"]);
  assert.deepEqual(findConnectives("Todo hombre es mortal. Ahora bien, Sócrates es hombre. Por lo tanto, es mortal.", "es").map((c) => c.form), ["ahora bien", "por lo tanto"]);
  assert.deepEqual(findConnectives("Tout homme est mortel. Or Socrate est un homme. Donc Socrate est mortel.", "fr").map((c) => c.form), ["or", "donc"]);
  assert.deepEqual(findConnectives("All men are mortal. Now Socrates is a man. Therefore he is mortal.", "en").map((c) => c.form), ["now", "therefore"]);
  const syl = readArgument("All men are mortal. Now Socrates is a man. Therefore Socrates is mortal.");
  assert.deepEqual(syl.segments.map((s) => s.role), ["premise", "minor premise", "conclusion"]);
  const turn = readArgument("The plan is cheap. However, nobody has tested it.");
  assert.equal(turn.segments[1].role, "turn");
});

test("F7 and F9 on the labelled sets: no labeller-agreed miss beyond the recorded ones", () => {
  const have = JSON.parse(readFileSync(new URL("../project-docs/evidence/argument-eval.json", import.meta.url), "utf8"));
  const now = { dev: score("claims-dev.json"), heldout: score("claims-heldout2.json") };
  for (const k of ["dev", "heldout"]) assert.deepEqual({ t: now[k].typeAccuracy, p: now[k].gapPrecision, r: now[k].gapRecall }, { t: have[k].typeAccuracy, p: have[k].gapPrecision, r: have[k].gapRecall }, "rerun node scripts/eval-argument.mjs --write");
  assert.ok(now.heldout.typeAccuracy.right / now.heldout.typeAccuracy.of >= 0.85);
});

// Political and group terms traded for their counterparts: every marker must read the same.
const PAIRS = [["socialist", "nationalist"], ["communist", "fascist"], ["left", "right"], ["Democrats", "Republicans"], ["progressives", "conservatives"], ["Musk", "Soros"], ["Kushner", "Clinton"], ["Israel", "Iran"], ["union", "company"]];
const swap = (s) => s.replace(new RegExp(`\\b(${PAIRS.flat().join("|")})\\b`, "g"), (w) => { for (const [a, b] of PAIRS) { if (w === a) return b; if (w === b) return a; } return w; });
const POSTS = [
  "Hitler was a far left socialist. Literally in the name of his party!",
  "The Democrats secretly want the war to continue. It's all about the money.",
  "Musk absolutely knows the history. It's a calculated lie designed to fool people.",
  "The union lost the vote. So the progressives must have rigged it with foreign cash.",
  "Kushner hired a hitman to kill the journalist who was investigating his ties to Israel.",
];

test("symmetry: claim types, gaps and argument roles are identical with the sides swapped", () => {
  for (const p of POSTS) {
    const q = swap(p);
    assert.notEqual(q, p);
    assert.deepEqual(claimTypes(q).map((t) => t.type), claimTypes(p).map((t) => t.type), p);
    assert.deepEqual(inferenceGaps(q).map((g) => g.kind), inferenceGaps(p).map((g) => g.kind), p);
    assert.deepEqual(readArgument(q).segments.map((s) => s.role), readArgument(p).segments.map((s) => s.role), p);
  }
});

test("reframing: the worked example's claim names its sources' parts and adds what they state only to deny", () => {
  const claim = "Jared Kushner hired a hitman to kill Jamal Khashoggi who was actively investigating his ties to MBS at the time of his murder";
  const source = "The claim is false. There is no credible evidence that Jared Kushner hired a hitman to kill Jamal Khashoggi, nor that Khashoggi was actively investigating Kushner's ties to MBS. What is established: Jamal Khashoggi was killed on October 2, 2018, inside the Saudi consulate in Istanbul. U.S. intelligence concluded that MBS approved an operation to capture or kill Khashoggi. Kushner had a close relationship with MBS.";
  const r = reframing(claim, [{ text: source }]);
  assert.deepEqual(r.shared, ["Jared Kushner", "Jamal Khashoggi", "MBS"]);
  for (const w of ["hired", "hitman"]) assert.ok(r.denied.includes(w), w);
  assert.equal(reframing(claim, [{ text: "An unrelated note about the weather this weekend in another country entirely." }]), null);
  const swapped = reframing(swap(claim), [{ text: swap(source) }]);
  assert.deepEqual([swapped.denied, swapped.added], [r.denied, r.added], "the same reading with the names swapped");
});

test("the inference gap reads the study's Kushner-letter post as a leap and the 'he knows' post as mind-reading", () => {
  const leap = inferenceGaps("Jared Kushner does not have any security clearances.\n\nSo his claim about divulging classified information, would mean he is admitting to illegal access of classified information.");
  assert.equal(leap[0].kind, "leap");
  assert.ok(leap[0].fresh.includes("illegal"));
  assert.equal(inferenceGaps("Let's be clear: Elon Musk absolutely knows the history.")[0].kind, "mind");
  assert.deepEqual(inferenceGaps("The Principia was published in 1687."), []);
});

test("the gold scorer: agreement, boundary precision and recall, and a role gate from two annotation files", async () => {
  const { evaluate } = await import("../scripts/eval-argument-gold.mjs");
  const text = "All men are mortal. Now Socrates is a man. Therefore Socrates is mortal.";
  const passages = [{ id: "en-x", lang: "en", split: "heldout", text }];
  const at = (s) => text.indexOf(s);
  const ann = (who, cuts, roles) => ({ format: "daylight.argument-annotation/1", annotator: who, passages: { "en-x": { boundaries: cuts.map(at), roles } } });
  const r = evaluate(passages, [ann("A", ["Now", "Therefore"], ["premise", "minor premise", "conclusion"]), ann("B", ["Now", "Therefore"], ["premise", "minor premise", "conclusion"])]);
  assert.equal(r.boundaryAgreement, 1);
  assert.deepEqual([r.langs.en.precision, r.langs.en.recall], [1, 1]);
  assert.equal(r.roles["minor premise"].hits, 1);
  assert.equal(r.roles["minor premise"].pass, false, "one hit is not enough to pass");
});

test("the 60 gold passages are fixed: 12 per language, 6 held out each, every text public domain and hashed", async () => {
  const { createHash } = await import("node:crypto");
  const d = JSON.parse(readFileSync(new URL("../data/argument/passages.json", import.meta.url), "utf8"));
  assert.equal(d.passages.length, 60);
  for (const l of ["la", "en", "fr", "es", "pt"]) {
    const p = d.passages.filter((x) => x.lang === l);
    assert.equal(p.length, 12, l);
    assert.equal(p.filter((x) => x.split === "heldout").length, 6, l);
  }
  for (const p of d.passages) { assert.equal(createHash("sha256").update(p.text).digest("hex"), p.sha256, p.id); assert.match(p.licence, /public domain/); }
  assert.deepEqual(JSON.parse(readFileSync(new URL("../docs/annotate/passages.json", import.meta.url), "utf8")), d, "the annotation page reads the same set");
});

test("the calibration case list is preregistered: fixed, both outcome kinds, and no forecast fields", () => {
  const raw = readFileSync(new URL("../data/calibration/cases.json", import.meta.url));
  const d = JSON.parse(raw.toString("utf8"));
  assert.equal(d.fixed, "2026-10-26");
  assert.ok(d.cases.some((c) => c.outcome === "atrocity") && d.cases.some((c) => c.outcome === "tension-no-atrocity"));
  for (const c of d.cases) assert.ok(!("risk" in c) && !("score" in c) && !("forecast" in c), c.id);
  assert.equal(createHashSync(raw.toString("utf8").split(String.fromCharCode(13)).join("")), "1cbc5694dc94e4271ba6b6557ed190c30c1ae6628436faf4a00f5be04c27456f", "the case list changed after it was fixed; record why in project-docs/CALIBRATION-STUDY.md");
});
