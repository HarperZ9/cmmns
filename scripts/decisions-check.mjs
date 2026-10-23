// Checks catalogue/DECISIONS.md, the public log of challenge decisions.
//   node scripts/decisions-check.mjs                  the log's structure and every entry it names
//   node scripts/decisions-check.mjs --issues f.json  also: each challenge issue in f.json has a decision
//   node scripts/decisions-check.mjs --github         the same, reading the issues with `gh issue list`
// f.json is the output of: gh issue list --label challenge --state all --json number,state,createdAt
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const OUTCOMES = ["accepted", "rejected", "partly accepted", "withdrawn", "under review"];
export const FINAL = OUTCOMES.filter((o) => o !== "under review");
export const GRACE_DAYS = 14;
const HEAD = /^### #(\d+) (\d{4}-\d{2}-\d{2}) (.+)$/;
const FIELD = /^- (Target|Reasoning|Change): (.*)$/;

// Every "### #n" block under "## Decisions", with its fields and line number.
export function parseDecisions(md) {
  const lines = String(md).replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((l) => l === "## Decisions");
  const out = [];
  if (start < 0) return { decisions: out, problems: ["no \"## Decisions\" section"] };
  let cur = null;
  lines.slice(start + 1).forEach((l, i) => {
    const line = start + 2 + i, h = l.match(HEAD), f = l.match(FIELD);
    if (h) { cur = { issue: Number(h[1]), date: h[2], outcome: h[3].trim(), line, fields: {} }; out.push(cur); }
    else if (l.startsWith("### ")) { cur = null; out.push({ bad: l, line }); }
    else if (f && cur) cur.fields[f[1].toLowerCase()] = f[2].trim();
  });
  return { decisions: out, problems: [] };
}

// Problems with one decision. known: Set of "id@version" the catalogue has had.
export function decisionProblems(d, known, registry) {
  if (d.bad) return [`line ${d.line}: heading must be "### #<issue> <YYYY-MM-DD> <outcome>": ${d.bad}`];
  const p = [], at = `#${d.issue} (line ${d.line})`;
  if (!OUTCOMES.includes(d.outcome)) p.push(`${at}: outcome "${d.outcome}" is not one of ${OUTCOMES.join(", ")}`);
  if (Number.isNaN(Date.parse(d.date))) p.push(`${at}: date ${d.date} is not a date`);
  for (const k of ["target", "reasoning", "change"]) if (!d.fields[k]) p.push(`${at}: missing "- ${k[0].toUpperCase() + k.slice(1)}:" line`);
  if (d.fields.reasoning && d.fields.reasoning.split(/\s+/).length < 5) p.push(`${at}: reasoning needs a sentence, not a word`);
  const t = d.fields.target || "", m = t.match(/^(entry|badge|finding|missing) (.+)$/);
  if (t && !m) p.push(`${at}: target must start with entry, badge, finding or missing`);
  if (m && m[1] === "entry" && !known.has(m[2])) p.push(`${at}: ${m[2]} is not an entry and version the catalogue has had`);
  if (m && m[1] === "badge" && !((registry && registry.signals) || []).some((s) => s.id === m[2])) p.push(`${at}: ${m[2]} is not a signal in catalogue/signals.json`);
  return p;
}

// Problems with the issues against the log. A closed issue needs a final decision; an open one needs
// a line once it is older than GRACE_DAYS. Younger open issues are listed as pending.
export function issueProblems(decisions, issues, now = Date.now()) {
  const latest = new Map();
  for (const d of decisions) if (!d.bad && (!latest.has(d.issue) || latest.get(d.issue).date <= d.date)) latest.set(d.issue, d);
  const p = [], pending = [];
  for (const i of issues) {
    const d = latest.get(i.number), closed = String(i.state).toUpperCase() === "CLOSED";
    const age = (now - Date.parse(i.createdAt)) / 86400000;
    if (closed && (!d || !FINAL.includes(d.outcome))) p.push(`#${i.number} is closed with no final decision in catalogue/DECISIONS.md`);
    else if (!closed && !d && age > GRACE_DAYS) p.push(`#${i.number} has been open ${Math.floor(age)} days with no line in catalogue/DECISIONS.md`);
    else if (!closed && !d) pending.push(i.number);
  }
  return { problems: p, pending };
}

// Every "id@version" the catalogue has had: the current entries and every one its changelog names.
export function knownRefs(root = ROOT) {
  const dir = join(root, "catalogue", "definitions"), refs = new Set();
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) { const e = JSON.parse(readFileSync(join(dir, f), "utf8")); refs.add(`${e.id}@${e.version}`); }
  for (const m of readFileSync(join(root, "catalogue", "CHANGELOG.md"), "utf8").matchAll(/`([a-z0-9-]+@\d+\.\d+\.\d+)`/g)) refs.add(m[1]);
  return refs;
}

export function check({ root = ROOT, md = null, issues = null, now = Date.now() } = {}) {
  const { decisions, problems } = parseDecisions(md != null ? md : readFileSync(join(root, "catalogue", "DECISIONS.md"), "utf8"));
  const known = knownRefs(root), registry = JSON.parse(readFileSync(join(root, "catalogue", "signals.json"), "utf8"));
  for (const d of decisions) problems.push(...decisionProblems(d, known, registry));
  const iss = issues ? issueProblems(decisions, issues, now) : { problems: [], pending: [] };
  return { decisions: decisions.length, problems: [...problems, ...iss.problems], pending: iss.pending };
}

function githubIssues() {
  const repo = process.env.GITHUB_REPOSITORY || "HarperZ9/daylight-commons";
  const out = execFileSync("gh", ["issue", "list", "-R", repo, "--label", "challenge", "--state", "all", "--limit", "1000", "--json", "number,state,createdAt"], { encoding: "utf8" });
  return JSON.parse(out);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2), i = a.indexOf("--issues");
  let issues = null;
  try { issues = i >= 0 ? JSON.parse(readFileSync(a[i + 1], "utf8")) : a.includes("--github") ? githubIssues() : null; }
  catch (e) { console.error(`could not read the challenge issues: ${e.message.split("\n")[0]}`); process.exit(2); }
  const r = check({ issues });
  for (const p of r.problems) console.error(p);
  if (r.pending.length) console.log(`open, inside the ${GRACE_DAYS}-day window: ${r.pending.map((n) => "#" + n).join(", ")}`);
  console.log(`${r.decisions} decisions${issues ? `, ${issues.length} challenge issues` : ""}, ${r.problems.length} problems`);
  process.exit(r.problems.length ? 1 : 0);
}
