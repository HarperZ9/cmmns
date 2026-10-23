// Prints the scripting-cost numbers for one bundle as JSON (scripts/qa/bench-lib.mjs).
//   node scripts/qa/bench.mjs [path to core.bundle.js] [--n 500] [--runs 7]
import { loadBundle, bench } from "./bench-lib.mjs";
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const path = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : new URL("../../src/ext/core.bundle.js", import.meta.url).pathname.replace(/^\/([a-z]:)/i, "$1");
console.log(JSON.stringify(bench(loadBundle(path), { n: arg("--n", 500), runs: arg("--runs", 7) })));
