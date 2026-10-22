// The upstream-change guard (scripts/upstream-guard.mjs) on synthetic snapshots: a quiet refresh
// raises nothing; a bulk edit, a mass removal, a flipped label on a high-reach site, a state label
// change and a vanished fact-checker are each flagged for a person to read.
import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { guard, formatReport } from "../scripts/upstream-guard.mjs";
import { detectKind } from "../scripts/upstream-views.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reach = new Set(["bignews.example"]);
const owners = (n, edit = (r) => r) => ({ rows: Array.from({ length: n }, (_, i) => edit({ name: `Outlet ${i}`, domain: `outlet${i}.example`, owner: `Owner ${i}`, source: `Q${i}` }, i)) });
const kinds = (r) => r.flags.map((f) => `${f.level}:${f.kind}`);

test("a refresh that only reorders rows and owners raises nothing", () => {
  const before = { rows: [...owners(100).rows, { name: "Big", domain: "bignews.example", owner: "A Corp; B Trust", source: "Q9" }] };
  const after = { rows: [{ name: "Big", domain: "bignews.example", owner: "B Trust; A Corp", source: "Q9" }, ...owners(100).rows.reverse()] };
  const r = guard(before, after, { kind: "owners", reach });
  assert.deepEqual(r.flags, []);
  assert.equal(r.high, 0);
  assert.match(formatReport(r), /nothing flagged/);
});

test("an owner flipped on a high-reach site is flagged high; elsewhere it is listed, not flagged", () => {
  const before = { rows: [...owners(100).rows, { name: "Big", domain: "bignews.example", owner: "A Corp", source: "Q9" }] };
  const after = { rows: [...owners(100, (r, i) => (i === 3 ? { ...r, owner: "Someone else" } : r)).rows, { name: "Big", domain: "bignews.example", owner: "Government of X", source: "Q9" }] };
  const r = guard(before, after, { kind: "owners", reach });
  assert.deepEqual(kinds(r), ["high:high-reach label flip"]);
  assert.match(r.flags[0].detail, /bignews\.example: owner "A Corp" -> "Government of X"/);
  assert.equal(r.changed.length, 2);
});

test("a high-reach site dropped from the table is flagged", () => {
  const before = { rows: [...owners(10).rows, { name: "Big", domain: "news.bignews.example", owner: "A", source: "Q9" }] };
  const r = guard(before, owners(10), { kind: "owners", reach });
  assert.deepEqual(kinds(r), ["high:high-reach removal"]);
});

test("mass removal and bulk edits are flagged by share", () => {
  const removed = guard(owners(1000), owners(950), { kind: "owners", reach });
  assert.ok(kinds(removed).includes("high:mass removal"));
  const edited = guard(owners(1000), owners(1000, (r, i) => (i < 80 ? { ...r, owner: "New owner" } : r)), { kind: "owners", reach });
  assert.ok(kinds(edited).includes("high:bulk edit"));
  const small = guard(owners(1000), owners(1000, (r, i) => (i < 10 ? { ...r, owner: "New owner" } : r)), { kind: "owners", reach });
  assert.deepEqual(small.flags, []);
});

test("state labels added, changed or removed are always listed", () => {
  const before = { rows: [{ domain: "a.example", state: "Country A", basis: "state-owned", name: "A" }, { domain: "b.example", state: "Country B", basis: "state-owned", name: "B" }] };
  const after = { rows: [{ domain: "a.example", state: "Country C", basis: "state-owned", name: "A" }, { x: "acct", state: "Country D", basis: "named-in-report", name: "D" }] };
  const r = guard(before, after, { reach });
  assert.equal(r.kind, "state");
  assert.deepEqual(kinds(r).sort(), ["medium:state label added", "medium:state label change", "medium:state label removed"]);
});

test("a fact-checker whose rows all vanish is flagged; a changed rating is listed", () => {
  const rows = (who, n, rating = "False") => Array.from({ length: n }, (_, i) => [`claim ${who} ${i}`, rating, who, `https://c${who}.example/${i}`, "2026-01-01", "en", null]);
  const before = { checkers: ["One", "Two"], rows: [...rows(0, 30), ...rows(1, 30)] };
  const after = { checkers: ["One", "Two"], rows: [...rows(0, 29), ...rows(0, 1, "True").map((r) => [...r.slice(0, 3), "https://c0.example/29", ...r.slice(4)].map((x, j) => (j === 0 ? "claim 0 29" : x)))] };
  const r = guard(before, after, { reach });
  assert.equal(r.kind, "claims");
  assert.ok(kinds(r).includes("high:fact-checker vanished"));
  assert.ok(r.changed.some((c) => c.field === "rating" && c.from === "False" && c.to === "True"));
});

test("confusables, sites and ops tables are read by shape", () => {
  assert.equal(detectKind("0410 ;\t0041 ;\tMA\t# x"), "confusables");
  assert.equal(detectKind({ factFields: [], facts: {} }), "sites");
  assert.equal(detectKind({ docs: [], ops: [], indicators: [] }), "ops");
  const r = guard("0410 ;\t0041 ;\tMA\n0430 ;\t0061 ;\tMA\n", "0410 ;\t0042 ;\tMA\n", {});
  assert.equal(r.removed.length, 1);
  assert.equal(r.changed[0].to, "0042");
  const sites = guard({ factFields: ["name", "founded", "country", "ownerType", "wikidata"], facts: { "bignews.example": ["Big", "1990", "A", "commercial", "Q1"] } },
    { factFields: ["name", "founded", "country", "ownerType", "wikidata"], facts: { "bignews.example": ["Big", "1990", "B", "state media", "Q1"] } }, { reach });
  assert.equal(sites.high, 2);
});

test("the command line exits 1 on a high flag and 0 on a quiet diff", () => {
  const dir = mkdtempSync(join(tmpdir(), "radar-guard-"));
  try {
    const put = (n, t) => { writeFileSync(join(dir, n), JSON.stringify(t)); return join(dir, n); };
    const a = put("a.json", { rows: [{ name: "Twitter", domain: "x.com", owner: "Owner A", source: "Q1" }] });
    const b = put("b.json", { rows: [{ name: "Twitter", domain: "x.com", owner: "Owner B", source: "Q1" }] });
    const run = (o, n) => spawnSync(process.execPath, [join(root, "scripts/upstream-guard.mjs"), "--old", o, "--new", n], { encoding: "utf8" });
    const flagged = run(a, b);
    assert.equal(flagged.status, 1);
    assert.match(flagged.stdout, /\[high\] high-reach label flip: x\.com/);
    assert.equal(run(a, a).status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
