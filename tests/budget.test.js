// Performance budgets (project-docs/PRODUCTION-READINESS.md, "Performance"). The numbers on the
// author's machine (2026-10-23, Node 25, Windows): 0.26 ms of text work per post, 59 ms
// for the first thread pass over 500 replies and 48 to 49 ms for each later refresh of it (3.4.0: 60 ms). The
// budgets sit about three times above what a Windows CI runner took (445 ms for the first pass on
// 2026-10-23), so a breach means a change made the
// work grow faster than the thread, not that a machine was busy.
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadBundle, bench } from "../scripts/qa/bench-lib.mjs";

export const BUDGET = { perPostMs: 4, threadMs: 1500, refreshMs: 1500 };

test("scripting cost per post and per thread pass stays within budget", () => {
  const r = bench(loadBundle(fileURLToPath(new URL("../src/ext/core.bundle.js", import.meta.url))), { n: 500, runs: 3 });
  for (const k of Object.keys(BUDGET)) assert.ok(r[k] <= BUDGET[k], `${k} ${r[k]} ms is over its budget of ${BUDGET[k]} ms`);
});

test("the thread pass grows about linearly with the thread", () => {
  const PB = loadBundle(fileURLToPath(new URL("../src/ext/core.bundle.js", import.meta.url)));
  const small = bench(PB, { n: 125, runs: 3 }), big = bench(PB, { n: 500, runs: 3 });
  // Four times the replies may cost at most ten times the time (a quadratic step would cost sixteen).
  assert.ok(big.threadMs <= Math.max(40, small.threadMs * 10), `125 replies ${small.threadMs} ms, 500 replies ${big.threadMs} ms`);
});
