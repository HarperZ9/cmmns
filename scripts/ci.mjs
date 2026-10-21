// Radar's checks, run the same way on any machine: GitHub Actions runs exactly these stages
// (.github/workflows/test.yml calls this file), so the project can verify itself without GitHub.
//   npm run ci                 the "test" stage: every test, then the bundle freshness check
//   node scripts/ci.mjs c2pa   the Content Credentials reference stage (fetches pinned fixtures)
//   node scripts/ci.mjs all    both
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const C2PA_REPO = "https://github.com/contentauth/c2pa-rs.git";
export const C2PA_COMMIT = "60f7cbdc69ab7a2554fcc87eb4df77050814b2cf";
const C2PA_DIR = join(ROOT, ".cache", "c2pa-rs");

// [label, command, args, options]. The commands are what a person would type.
export const STAGES = {
  test: [
    ["every test", process.execPath, ["--test", "tests/*.test.js"]],
    ["fresh build", process.execPath, ["scripts/build.mjs"]],
    ["bundle matches a fresh build", "git", ["diff", "--exit-code", "--ignore-cr-at-eol", "--", "src/ext/core.bundle.js", "src/ext/ocr.bundle.js"]],
  ],
  c2pa: [
    ["fetch the c2pa-rs fixtures at the pinned commit", null, fetchC2pa],
    ["property test against the reference verdicts", process.execPath, ["--test", "tests/c2pa.reference.test.js"], { env: { C2PA_FIXTURES: join(C2PA_DIR, "sdk", "tests", "fixtures") } }],
  ],
};

// The pinned fixtures, fetched into .cache (git-ignored) and never committed.
function fetchC2pa() {
  const git = (...a) => execFileSync("git", a, { cwd: C2PA_DIR, stdio: "inherit" });
  const ref = JSON.parse(readFileSync(join(ROOT, "tests", "fixtures", "c2pa-reference.json"), "utf8"));
  if (!existsSync(join(C2PA_DIR, ".git"))) { mkdirSync(C2PA_DIR, { recursive: true }); git("init", "-q"); git("remote", "add", "origin", C2PA_REPO); }
  git("fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", C2PA_COMMIT);
  git("sparse-checkout", "set", "--no-cone", ...Object.keys(ref.files).map((f) => "/sdk/tests/fixtures/" + f));
  git("checkout", "-q", "FETCH_HEAD");
}

export function run(names) {
  for (const name of names) {
    for (const [label, cmd, args, opts = {}] of STAGES[name]) {
      console.log(`\n== ${name}: ${label}`);
      if (typeof args === "function") { args(); continue; }
      // Node expands the test glob itself on every platform, so no shell is needed.
      execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...(opts.env || {}) } });
    }
  }
  console.log(`\nall ${names.join(" and ")} checks passed`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const want = process.argv[2] || "test";
  const names = want === "all" ? ["test", "c2pa"] : [want];
  if (!names.every((n) => STAGES[n])) { console.error(`unknown stage ${want}; use test, c2pa or all`); process.exit(2); }
  try { run(names); } catch (e) { console.error(`\nfailed: ${e.message.split("\n")[0]}`); process.exit(1); }
}
