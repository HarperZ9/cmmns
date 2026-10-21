// Applies data/owner-corrections.json to the ownership table. A correction wins over Wikidata; the
// row keeps what Wikidata said in `correction.upstream`, so a later fetch can show whether upstream
// now agrees and the correction can be retired. Idempotent: applying twice gives the same bytes.
// No network access.
//   node scripts/owner-corrections.mjs           apply to src/ext/owners.json and report
//   node scripts/owner-corrections.mjs --check   report only; exit 1 if a correction is stale
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CORRECTIONS = join(ROOT, "data/owner-corrections.json");
const OWNERS = join(ROOT, "src/ext/owners.json");
const sortOwners = (o) => String(o || "").split("; ").sort().join("; ");

export const loadCorrections = (path = CORRECTIONS) => JSON.parse(readFileSync(path, "utf8")).rows;

// What Wikidata said for a row, whether or not a correction was applied before.
export function upstreamOf(row) {
  if (row.correction) return row.correction.upstream;
  return { owner: row.owner, via: row.via || "owner", name: row.name };
}

// rows: owners.json rows. Returns { rows, missing }: missing lists corrections with no row.
export function applyCorrections(rows, corrections) {
  const byDomain = new Map(corrections.map((c) => [c.domain, c])), seen = new Set();
  const out = rows.map((row) => {
    const c = byDomain.get(row.domain);
    if (!c) return row;
    seen.add(c.domain);
    const up = upstreamOf(row), { correction, via, ...rest } = row;
    return {
      ...rest, name: c.name || up.name, owner: c.owner, ...(c.via && c.via !== "owner" ? { via: c.via } : {}),
      correction: { source: c.source, checked: c.checked, reason: c.reason, ...(c.factsWrong ? { factsWrong: true } : {}), upstream: up },
    };
  });
  return { rows: out, missing: corrections.filter((c) => !seen.has(c.domain)).map((c) => c.domain) };
}

// For each correction: "holds" (upstream still differs), "agrees" (upstream now says the same
// owner and heading: retire the correction) or "missing" (upstream dropped the domain).
export function correctionStatus(rows, corrections) {
  const byDomain = new Map(rows.map((r) => [r.domain, r]));
  return corrections.map((c) => {
    const row = byDomain.get(c.domain);
    if (!row) return { domain: c.domain, status: "missing" };
    const up = upstreamOf(row);
    const agrees = sortOwners(up.owner) === sortOwners(c.owner) && (up.via || "owner") === (c.via || "owner");
    return { domain: c.domain, status: agrees ? "agrees" : "holds", upstream: up.owner };
  });
}

export function statusLines(status) {
  return status.map((s) => (s.status === "agrees" ? `retire  ${s.domain}: Wikidata now says "${s.upstream}", the same as the correction`
    : s.status === "missing" ? `missing ${s.domain}: no row for this domain upstream; review the correction`
      : `holds   ${s.domain}: Wikidata still says "${s.upstream}"`));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const text = readFileSync(OWNERS, "utf8"), table = JSON.parse(text), corrections = loadCorrections();
  const { rows, missing } = applyCorrections(table.rows, corrections);
  const status = correctionStatus(rows, corrections);
  for (const l of statusLines(status)) console.log(l);
  if (!process.argv.includes("--check")) {
    writeFileSync(OWNERS, JSON.stringify({ ...table, rows }) + (text.endsWith("\n") ? "\n" : ""));
    console.log(`owners.json: ${corrections.length - missing.length} corrections applied`);
  }
  if (missing.length || status.some((s) => s.status !== "holds")) process.exitCode = 1;
}
