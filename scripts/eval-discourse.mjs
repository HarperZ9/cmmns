// Scores the quote finder on the hand-labelled set (tests/fixtures/discourse/quotes-eval.json) and
// writes project-docs/evidence/discourse-eval.json. Precision first: a wrong "found" sends a reader to
// the wrong source, which is worse than "not found".
//   node scripts/eval-discourse.mjs [--heldout] [--write]   (--heldout scores the held-out set)
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildIndex, lookupQuote } from "../src/core/discourse/quotes.js";
import { wilson } from "../src/core/discourse/stats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const json = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

export function evaluate(set = "quotes-eval.json") {
  const index = buildIndex(json("src/ext/discourse/quotes.json"));
  const cases = json(`tests/fixtures/discourse/${set}`).cases;
  const rows = cases.map((c) => {
    const r = lookupQuote(index, c.q, c.by);
    const placed = r.work ? `${r.work.id} | ${r.locator}` : r.entry ? r.entry.id : null;
    const at = (x) => r.work.id === x.work && r.locator.includes(x.at);
    const right = c.expect === "found" ? (r.status === "found" || r.status === "close") && [c, ...(c.alt || [])].some(at)
      : c.expect === "absent" ? r.status === "not-found" : r.status === c.expect;
    return { q: c.q.slice(0, 60), expect: c.expect, got: r.status, placed, right };
  });
  const claimed = rows.filter((x) => x.got === "found" || x.got === "close");
  const claimedRight = claimed.filter((x) => x.right).length;
  const shouldFind = rows.filter((x) => x.expect === "found");
  const absent = rows.filter((x) => x.expect === "absent");
  const listed = rows.filter((x) => x.expect === "misattributed" || x.expect === "attested");
  const ci = (k, n) => (n ? wilson(k, n).map((v) => Math.round(v * 1000) / 1000) : null);
  return {
    date: "2026-10-25", cases: rows.length,
    precision: { right: claimedRight, of: claimed.length, interval: ci(claimedRight, claimed.length) },
    recall: { right: shouldFind.filter((x) => x.right).length, of: shouldFind.length, interval: ci(shouldFind.filter((x) => x.right).length, shouldFind.length) },
    falseFoundOnAbsent: { wrong: absent.filter((x) => !x.right).length, of: absent.length },
    curatedLists: { right: listed.filter((x) => x.right).length, of: listed.length },
    rows,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const held = process.argv.includes("--heldout"), r = evaluate(held ? "quotes-heldout.json" : "quotes-eval.json");
  console.log(`precision ${r.precision.right}/${r.precision.of} ${JSON.stringify(r.precision.interval)}; recall ${r.recall.right}/${r.recall.of}; wrong on absent ${r.falseFoundOnAbsent.wrong}/${r.falseFoundOnAbsent.of}; curated lists ${r.curatedLists.right}/${r.curatedLists.of}`);
  for (const x of r.rows.filter((y) => !y.right)) console.log(`  miss: [${x.expect} -> ${x.got}] ${x.q} ${x.placed || ""}`);
  if (process.argv.includes("--write")) writeFileSync(join(ROOT, `project-docs/evidence/discourse-eval${held ? "-heldout" : ""}.json`), JSON.stringify(r, null, 1) + "\n");
}
