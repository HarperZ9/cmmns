// daylight case, analysis side: claims and blind labels, origin and drift tracing, the timeline's
// flags, the network, leads, absences, redaction, rule and model extraction, and primary records.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initCase } from "../src/investigate/layout.js";
import { loadCase, addRow } from "../src/investigate/store.js";
import { addClaim, addLabel, labelAgreement } from "../src/investigate/claims.js";
import { traceClaim } from "../src/investigate/trace.js";
import { wordDiff, renderDiff, hopChanges, overlapSimilarity } from "../src/investigate/diff.js";
import { buildTimeline, datesInText } from "../src/investigate/timeline.js";
import { buildNetwork, networkHtml, checkEdge } from "../src/investigate/network.js";
import { rankLeads, checkLead, checkAbsence } from "../src/investigate/records.js";
import { makeRedactor } from "../src/investigate/redact.js";
import { ruleClaims, modelClaims, locate } from "../src/investigate/extract.js";
import { makeModel, jsonFrom } from "../src/investigate/models.js";
import { primaryKind, linksIn, leadFor } from "../src/investigate/primary.js";

const root = mkdtempSync(join(tmpdir(), "case-an-"));
test.after(() => rmSync(root, { recursive: true, force: true }));

function fixtureCase(name) {
  const dir = join(root, name);
  initCase(dir, name, "2026-10-23T00:00:00Z");
  for (const [origin, date] of [["Reuters", "2026-10-15"], ["Reuters", "2026-10-16"], [null, "2026-10-16"], [null, "2026-10-20"]]) addRow(dir, "sources", { kind: "web", url: `https://s${date}.test/${origin}`, origin, source_date: date });
  return dir;
}

test("a claim needs text, a known source and a rung; retells and corroborates name claims", () => {
  const dir = fixtureCase("claims"), d = () => loadCase(dir);
  assert.throws(() => addClaim(dir, d(), { text: "x", source: "S01", rung: "likely" }), /--rung must be one of/);
  assert.throws(() => addClaim(dir, d(), { text: "x", source: "S99", rung: "documented" }), /no source S99/);
  addClaim(dir, d(), { text: "The White House instructed the Pentagon to slow the service", source: "S01", rung: "inference" });
  assert.throws(() => addClaim(dir, d(), { text: "x", source: "S01", rung: "unproven", retells: "C09" }), /not a claim/);
  assert.equal(d().claims[0].id, "C01");
});

test("blind labels: no overwrite, and agreement with Cohen's kappa and each disagreement", () => {
  const dir = fixtureCase("labels");
  for (const t of ["a b c", "d e f", "g h i", "j k l"]) addClaim(dir, loadCase(dir), { text: t, source: "S01", rung: "unproven" });
  const pairs = [["C01", "documented", "documented"], ["C02", "unproven", "unproven"], ["C03", "inference", "unproven"], ["C04", "contradicted", "contradicted"]];
  for (const [c, a, b] of pairs) { addLabel(dir, loadCase(dir), { claim: c, labeller: "a", rung: a }); addLabel(dir, loadCase(dir), { claim: c, labeller: "b", rung: b }); }
  assert.throws(() => addLabel(dir, loadCase(dir), { claim: "C01", labeller: "a", rung: "unproven" }), /not overwritten/);
  const k = labelAgreement(loadCase(dir));
  assert.equal(k.n, 4);
  assert.equal(k.agreement, 0.75);
  assert.equal(k.kappa, 0.667);   // pe = 0.25: (0.75 - 0.25) / 0.75
  assert.deepEqual(k.disagreements.map((x) => x.claim), ["C03"]);
});

test("a word diff shows what a retelling added, and names numbers, certainty and dropped hedges", () => {
  const ops = wordDiff("The ministry reportedly sold 300 tons on October 9", "The ministry secretly sold 3 million tons");
  assert.equal(renderDiff(ops), "The ministry [-reportedly-] [+secretly+] sold [-300-] [+3 million+] tons [-on October 9-]");
  const c = hopChanges(ops);
  assert.deepEqual(c.numbers.added, ["3"]);
  assert.deepEqual(c.certaintyAdded, ["secretly"]);
  assert.deepEqual(c.hedgesDropped, ["reportedly"]);
  assert.ok(overlapSimilarity("They sold the harbour for $40 million and the council voted 7-2 on October 19", "Council votes 7-2 to sell harbour land for $4 million on October 19") >= 0.6);
});

test("origins: shared wire origin counts once, a near-copy counts once, self-sourced counts for nothing", () => {
  const dir = fixtureCase("trace"), add = (o) => addClaim(dir, loadCase(dir), o);
  add({ text: "Officials say the White House ordered the slowdown of the service", source: "S01", rung: "inference" });
  add({ text: "The White House ordered the slowdown, officials told the wire", source: "S02", rung: "inference", corroborates: "C01" });
  add({ text: "Officials say the White House ordered the slowdown of the service last week", source: "S03", rung: "inference", corroborates: "C01" });
  add({ text: "We ordered nothing, says the White House", source: "S04", rung: "documented", corroborates: "C01", selfSourced: true });
  add({ text: "The White House secretly ordered the total shutdown of the service", source: "S04", rung: "unproven", retells: "C01" });
  const t = traceClaim(loadCase(dir), "C05");
  assert.equal(t.root, "C01");
  assert.equal(t.independentOrigins, 1);
  assert.deepEqual(t.notCounted.map((x) => x.claim), ["C04"]);
  assert.ok(t.origins[0].collapsed.some((w) => /C02: same origin/.test(w)));
  assert.ok(t.origins[0].collapsed.some((w) => /C03: near-copy/.test(w)));
  assert.match(t.hops[0].diff, /\[\+secretly\+\]/);
});

test("the timeline flags gaps, date conflicts and events dated after their source", () => {
  const dir = fixtureCase("timeline"), add = (o) => addClaim(dir, loadCase(dir), o);
  add({ text: "The cap began", source: "S01", rung: "documented", date: "2026-10-13", key: "cap" });
  add({ text: "The cap began", source: "S02", rung: "documented", date: "2026-10-14", key: "cap" });
  add({ text: "Talks end", source: "S01", rung: "unproven", date: "2026-10-30" });
  const t = buildTimeline(loadCase(dir), { gapDays: 3 });
  const kinds = t.flags.map((f) => f.kind);
  assert.ok(kinds.includes("date-conflict"));
  assert.ok(kinds.includes("gap"));
  assert.ok(t.flags.some((f) => f.kind === "after-source" && f.events[0] === "C03"));
  assert.deepEqual(datesInText("On October 9 and 10-14 Oct, then 2026-10-20", 2026).map((d) => d.day), ["2026-10-09", "2026-10-10", "2026-10-20"]);
});

test("the network needs a source per edge and its HTML loads nothing from elsewhere", () => {
  const dir = fixtureCase("net");
  assert.match(checkEdge({ from: "@a", to: "@b", type: "like", source: "S01" }, new Map([["S01", {}]])), /--type/);
  for (const [f, t, ty] of [["@a", "@b", "quote"], ["@b", "@a", "reply"], ["@a", "@b", "quote"]]) addRow(dir, "edges", { from: f, to: t, type: ty, source: "S01" });
  const n = buildNetwork(loadCase(dir));
  assert.equal(n.edges.find((e) => e.type === "quote").n, 2);
  assert.deepEqual(n.mutual, [["@a", "@b"]]);
  const html = networkHtml(n, "t");
  assert.doesNotMatch(html, /<script|src=["']?https?:|href=["']?https?:/i);
  assert.match(html, /<svg/);
});

test("leads rank by decisiveness, open claims settled and reach; absences need a known status", () => {
  const dir = fixtureCase("leads");
  addClaim(dir, loadCase(dir), { text: "a b c", source: "S01", rung: "unproven" });
  assert.match(checkLead({ question: "q", record: "r", decisive: 7, access: "public" }, new Map()), /1 to 5/);
  addRow(dir, "leads", { question: "low", record: "r", decisive: 2, access: "public", claims: [] });
  addRow(dir, "leads", { question: "high", record: "r", decisive: 4, access: "legal", claims: ["C01"] });
  addRow(dir, "leads", { question: "done", record: "r", decisive: 5, access: "public", claims: [], status: "settled" });
  assert.deepEqual(rankLeads(loadCase(dir)).map((l) => [l.question, l.score]), [["high", 3], ["low", 2], ["done", 0]]);
  assert.match(checkAbsence({ what: "x", status: "lost" }, new Map()), /--status/);
});

test("redaction: private handles and profile addresses become salted pseudonyms; public figures stay", () => {
  const r = makeRedactor([{ handle: "@pub", public_figure: true }, { handle: "@priv", name: "Pat Private", public_figure: false }], "salt");
  const out = r.text("@pub replied to @priv (Pat Private) at https://x.com/priv/status/1 and https://x.com/pub/status/2");
  assert.match(out, /^@pub replied to \[acct-[0-9a-f]{10}\]/);
  assert.doesNotMatch(out, /priv|Pat Private/i);
  assert.match(out, /x\.com\/pub\/status\/2/);
  assert.notEqual(makeRedactor([], "a").text("@x"), makeRedactor([], "b").text("@x"));
});

test("rule extraction keeps checkable sentences with exact spans and skips boilerplate", () => {
  const text = "Subscribe to our newsletter for 3 free issues today. The council voted 7-2 on October 19 to sell the land. Nice weather?";
  const got = ruleClaims("S01", text, { year: 2026 });
  assert.equal(got.length, 1);
  const sp = got[0].spans[0];
  assert.equal(text.slice(sp.start, sp.end), got[0].text);
  assert.equal(got[0].date, "2026-10-19");
});

test("model steps are pluggable, and a model's claim is kept only with a quote found in the text", async () => {
  assert.equal(makeModel({ provider: "none" }), null);
  assert.throws(() => makeModel({ provider: "http", url: "u", model: "m", keyEnv: "NOPE_KEY" }, { env: {} }), /NOPE_KEY/);
  const cmd = makeModel({ provider: "command", command: "x" }, { spawnFn: () => ({ status: 0, stdout: '[{"claim":"The council sold the land","quote":"voted  7-2"},{"claim":"made up","quote":"not in text"}]' }) });
  const r = await modelClaims(cmd, "S01", "The council voted 7-2 on Monday.", { year: 2026 });
  assert.equal(r.claims.length, 1);
  assert.equal(r.dropped, 1);
  assert.equal(r.claims[0].spans[0].text, "voted 7-2");
  let body = null;
  const http = makeModel({ provider: "http", url: "https://llm.test/v1/chat/completions", model: "m", keyEnv: "K" }, { env: { K: "secret" }, fetchFn: async (u, o) => { body = JSON.parse(o.body); return { ok: true, json: async () => ({ choices: [{ message: { content: "[]" } }] }) }; } });
  assert.equal(await http.complete("hi"), "[]");
  assert.equal(body.temperature, 0);
  assert.deepEqual(jsonFrom("text [1,2] more"), [1, 2]);
  assert.deepEqual(locate("a  b c", "a b"), { start: 0, end: 4 });
});

test("primary records: hosts by kind, links from pages and posts, leads for claims without one", () => {
  assert.equal(primaryKind("https://www.sec.gov/Archives/x.htm").kind, "securities filing");
  assert.equal(primaryKind("https://council.example.gov/minutes").kind, "government record");
  assert.equal(primaryKind("https://x.com/kyivindependent"), null);
  assert.equal(primaryKind("https://x.com/a/status/123").kind, "original post");
  assert.deepEqual(linksIn(Buffer.from('<a href="https://a.test/x">x</a>')), ["https://a.test/x"]);
  assert.deepEqual(linksIn(Buffer.from(JSON.stringify({ entities: { urls: [{ expanded_url: "https://b.test/" }] } }))), ["https://b.test/"]);
  const l = leadFor({ id: "C01", text: "A judge unsealed the warrant against Example Corp", rung: "unproven" });
  assert.equal(l.record, "court record");
  assert.match(l.check_url, /courtlistener\.com/);
});
