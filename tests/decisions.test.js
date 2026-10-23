// The challenge route (catalogue/DECISIONS.md, scripts/decisions-check.mjs, .github/ISSUE_TEMPLATE/):
// the public log parses, every decision names a real entry and version, closed challenges need a
// final decision, and both templates land in the log under the "challenge" label.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDecisions, decisionProblems, issueProblems, knownRefs, check, GRACE_DAYS } from "../scripts/decisions-check.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const known = knownRefs();
const registry = JSON.parse(read("catalogue/signals.json"));
const block = (head, target, reasoning = "The official source quotes the text as the entry does.", change = "none") =>
  `## Decisions\n\n${head}\n- Target: ${target}\n- Reasoning: ${reasoning}\n- Change: ${change}\n`;

test("the published log parses with no problems", () => {
  const r = check();
  assert.deepEqual(r.problems, []);
});

test("a well-formed decision on a real entry passes", () => {
  const { decisions } = parseDecisions(block("### #7 2026-10-24 rejected", "entry x-paid-partnerships@1.0.0"));
  assert.equal(decisions.length, 1);
  assert.deepEqual(decisionProblems(decisions[0], known, registry), []);
});

test("controls: an unknown version, an unknown signal, a bad outcome and a one-word reason all fail", () => {
  const cases = [
    [block("### #1 2026-10-24 rejected", "entry x-paid-partnerships@9.9.9"), /not an entry and version/],
    [block("### #2 2026-10-24 rejected", "badge no-such-sign"), /not a signal/],
    [block("### #3 2026-10-24 ignored", "badge bio-template"), /outcome "ignored"/],
    [block("### #4 2026-10-24 accepted", "badge bio-template", "Fine."), /reasoning needs a sentence/],
    [block("### #5 2026-10-24 accepted", "something else"), /target must start/],
    ["## Decisions\n\n### #6 2026-10-24 accepted\n- Target: badge bio-template\n", /missing "- Reasoning:"/],
    ["## Decisions\n\n### 6 accepted\n", /heading must be/],
  ];
  for (const [md, re] of cases) {
    const { decisions } = parseDecisions(md);
    const p = decisions.flatMap((d) => decisionProblems(d, known, registry));
    assert.ok(p.some((x) => re.test(x)), `${re} in ${JSON.stringify(p)}`);
  }
});

test("every challenge issue gets a decision: closed needs final, open waits at most the grace period", () => {
  const now = Date.parse("2026-11-30T00:00:00Z");
  const { decisions } = parseDecisions([
    block("### #10 2026-11-01 under review", "badge bio-template", "Checking the template groups against the page capture."),
    "### #10 2026-11-05 rejected\n- Target: badge bio-template\n- Reasoning: The bios share a template on the page the filer linked.\n- Change: none",
    "### #11 2026-11-02 under review\n- Target: entry x-paid-partnerships@1.0.0\n- Reasoning: Rereading the policy page against the stored hash.\n- Change: none",
  ].join("\n"));
  const issues = [
    { number: 10, state: "CLOSED", createdAt: "2026-10-30T00:00:00Z" },
    { number: 11, state: "CLOSED", createdAt: "2026-10-30T00:00:00Z" },
    { number: 12, state: "OPEN", createdAt: "2026-10-01T00:00:00Z" },
    { number: 13, state: "OPEN", createdAt: new Date(now - (GRACE_DAYS - 1) * 86400000).toISOString() },
  ];
  const r = issueProblems(decisions, issues, now);
  assert.equal(r.problems.length, 2, JSON.stringify(r.problems));
  assert.ok(r.problems.some((p) => p.startsWith("#11 is closed")));
  assert.ok(r.problems.some((p) => p.startsWith("#12 has been open")));
  assert.deepEqual(r.pending, [13]);
});

test("both dispute templates carry the challenge label and the fields the badge links fill", () => {
  const ch = read(".github/ISSUE_TEMPLATE/challenge.yml"), fi = read(".github/ISSUE_TEMPLATE/dispute-finding.yml");
  for (const t of [ch, fi]) assert.match(t, /^labels: \[[^\]]*"challenge"/m);
  assert.match(ch, /^\s+id: entry$/m);
  assert.match(fi, /^\s+id: signal$/m);
  assert.match(fi, /^\s+id: page$/m);
  assert.match(fi, /private information/);
});

test("CI reads the challenge issues through a ci.mjs stage", async () => {
  const { STAGES } = await import("../scripts/ci.mjs");
  assert.ok(STAGES.decisions.some(([, , args]) => Array.isArray(args) && args.includes("--github")));
  assert.match(read(".github/workflows/test.yml"), /- run: node scripts\/ci\.mjs decisions/);
  assert.ok(STAGES.test.some(([, , args]) => Array.isArray(args) && args.join(" ") === "scripts/catalogue-data.mjs --check"));
});
