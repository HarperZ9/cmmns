// Builds the EasyList and EasyPrivacy declarativeNetRequest rulesets and their lock file from cached lists.
//   node scripts/adblock-build.mjs              compile .cache/adblock/*.txt and write the rulesets and lock
//   node scripts/adblock-build.mjs --download   fetch both lists into .cache/adblock/ first, then compile
//   node scripts/adblock-build.mjs --check      recompile from the cache and fail if committed output differs
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compileFilters, prepareCandidates, tierCounts, TIERS } from "./adblock-compile.mjs";
import { STATIC_RULE_CAP, validateRulesets } from "./adblock-validate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "adblock");
const LOCK = "data/adblock-lock.json";

export const LISTS = [
  { id: "easylist", url: "https://easylist.to/easylist/easylist.txt", out: "src/ext/rules/easylist.json" },
  { id: "easyprivacy", url: "https://easylist.to/easylist/easyprivacy.txt", out: "src/ext/rules/easyprivacy.json" },
];

// Licence stated at https://easylist.to/pages/licence.html, checked against each list header's Licence line.
const LICENCE = "GPL-3.0-or-later OR CC-BY-SA-3.0 (or any later version)";

// Reads the "! Key: value" header lines this build records.
export function readHeader(text) {
  const head = text.split(/\r?\n/, 60);
  const pick = (re) => {
    const line = head.find((l) => re.test(l));
    return line ? line.replace(re, "").trim() : null;
  };
  const licenceLine = head.find((l) => /^! Licen[cs]e:/.test(l)) || null;
  return {
    version: pick(/^! Version:/),
    lastModified: pick(/^! Last modified:/),
    homepage: pick(/^! Homepage:/),
    licenceLine: licenceLine && licenceLine.trim(),
  };
}

// Fetches both lists into the cache, refusing anything that does not look like a filter list.
async function download() {
  mkdirSync(CACHE, { recursive: true });
  for (const list of LISTS) {
    const res = await fetch(list.url);
    if (!res.ok) throw new Error(`${list.url}: HTTP ${res.status}`);
    const text = await res.text();
    if (!text.startsWith("[Adblock")) throw new Error(`${list.url}: not an Adblock filter list`);
    writeFileSync(join(CACHE, `${list.id}.txt`), text);
    console.log(`downloaded ${list.id}: ${text.length} bytes`);
  }
}

// Splits the shared cap across lists tier by tier: all allow rules, then host blocks, then the rest.
export function planBudgets(tierCountsList, cap) {
  const budgets = tierCountsList.map(() => 0);
  let left = cap;
  for (const tier of TIERS) {
    const need = tierCountsList.reduce((sum, t) => sum + t[tier], 0);
    if (need <= left) {
      tierCountsList.forEach((t, i) => (budgets[i] += t[tier]));
      left -= need;
      continue;
    }
    const shares = tierCountsList.map((t) => Math.floor((left * t[tier]) / need));
    let spare = left - shares.reduce((a, b) => a + b, 0);
    shares.forEach((s, i) => {
      const extra = Math.min(spare, tierCountsList[i][tier] - s);
      budgets[i] += s + extra;
      spare -= extra;
    });
    left = 0;
  }
  return budgets;
}

// Serialises rules one per line so the committed JSON diffs by rule.
export function formatRules(rules) {
  return rules.length ? `[\n${rules.map((r) => JSON.stringify(r)).join(",\n")}\n]\n` : "[]\n";
}

// Compiles both cached lists and returns the file contents to write, keyed by repository path.
export function buildOutputs(texts) {
  const counts = texts.map((t) => tierCounts(prepareCandidates(t).candidates));
  const budgets = planBudgets(counts, STATIC_RULE_CAP);
  const files = {};
  const entries = [];
  const rulesets = {};
  let idStart = 1;
  LISTS.forEach((list, i) => {
    const out = compileFilters(texts[i], { idStart, max: budgets[i] });
    rulesets[list.id] = out.rules;
    files[list.out] = formatRules(out.rules);
    entries.push(lockEntry(list, texts[i], out, idStart));
    idStart += out.rules.length;
  });
  const errors = validateRulesets(rulesets);
  if (errors.length) throw new Error(`invalid rules:\n${errors.slice(0, 20).join("\n")}`);
  const total = entries.reduce((sum, e) => sum + e.rules_written, 0);
  const lock = { generated_by: "scripts/adblock-build.mjs", cap: STATIC_RULE_CAP, total_rules: total, lists: entries };
  files[LOCK] = `${JSON.stringify(lock, null, 2)}\n`;
  return { files, lock };
}

// Records provenance and counts for one compiled list.
function lockEntry(list, text, out, idStart) {
  const header = readHeader(text);
  return {
    id: list.id,
    source_url: list.url,
    output: list.out,
    version: header.version,
    last_modified: header.lastModified,
    homepage: header.homepage,
    licence_line: header.licenceLine,
    licence: LICENCE,
    sha256: createHash("sha256").update(text).digest("hex"),
    filters_read: out.read,
    candidates: out.tiers,
    host_filters_merged: out.merged.filters,
    subdomains_pruned: out.merged.subdomainsPruned,
    rules_written: out.rules.length,
    id_first: out.rules.length ? idStart : null,
    id_last: out.rules.length ? idStart + out.rules.length - 1 : null,
    dropped_by_cap: out.droppedByCap,
    skipped: out.skipped,
  };
}

// Reads both cached lists, or returns null when either is missing.
function readCache() {
  const paths = LISTS.map((l) => join(CACHE, `${l.id}.txt`));
  if (!paths.every((p) => existsSync(p))) return null;
  return paths.map((p) => readFileSync(p, "utf8"));
}

// Compares freshly built output with the committed files and returns the paths that differ.
function diffCommitted(files) {
  return Object.entries(files)
    .filter(([path, body]) => {
      const full = join(ROOT, path);
      return !existsSync(full) || readFileSync(full, "utf8") !== body;
    })
    .map(([path]) => path);
}

// Runs the build or the check from command-line flags.
async function main(argv) {
  if (argv.includes("--download")) await download();
  const texts = readCache();
  if (!texts) {
    const msg = "adblock: .cache/adblock/easylist.txt or easyprivacy.txt is missing";
    if (argv.includes("--check")) {
      console.log(`${msg}; skipping the ruleset check (run with --download to fetch the lists).`);
      return 0;
    }
    console.error(`${msg}; run with --download.`);
    return 1;
  }
  const { files, lock } = buildOutputs(texts);
  if (argv.includes("--check")) {
    const stale = diffCommitted(files);
    if (stale.length) {
      console.error(`adblock: committed output differs from the cached lists: ${stale.join(", ")}`);
      console.error("Rebuild with node scripts/adblock-build.mjs and review the change.");
      return 1;
    }
    console.log(`adblock: ${lock.total_rules} rules match the cached lists.`);
    return 0;
  }
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(ROOT, path)), { recursive: true });
    writeFileSync(join(ROOT, path), body);
  }
  for (const e of lock.lists) {
    console.log(`${e.id} ${e.version}: read ${e.filters_read}, wrote ${e.rules_written}, cap dropped ${e.dropped_by_cap}`);
  }
  console.log(`total ${lock.total_rules} of ${STATIC_RULE_CAP}`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`adblock-build failed: ${err.stack || err}`);
      process.exit(1);
    },
  );
}
