// Checks that every commit in a range carries a Developer Certificate of Origin sign-off that matches
// its author: a "Signed-off-by: Name <email>" line with the author's own name and email. Merge
// commits are skipped; the commits they bring in are each checked on their own pull request.
//   node scripts/dco-check.mjs [base] [head]     default: origin/main and HEAD
//   DCO_BASE and DCO_HEAD set the range in CI (.github/workflows/dco.yml through scripts/ci.mjs dco).
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const FIELD = "\x1f";
const RECORD = "\x1e";
export const LOG_FORMAT = `%H${FIELD}%an${FIELD}%ae${FIELD}%B${RECORD}`;
const SIGN_OFF = /^Signed-off-by:[ \t]*(.+?)[ \t]*<([^<>\s]+)>[ \t]*$/gim;

// Parses `git log --format=LOG_FORMAT` output into { sha, name, email, body } records.
export function parseLog(text) {
  return text.split(RECORD).map((r) => r.replace(/^\s+/, "")).filter(Boolean).map((r) => {
    const [sha, name, email, body = ""] = r.split(FIELD);
    return { sha, name, email, body };
  });
}

export function signOffs(body) {
  return [...String(body).matchAll(SIGN_OFF)].map((m) => ({ name: m[1].trim(), email: m[2].trim() }));
}

const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

// Returns null when the commit is signed off by its author, or the reason it is not.
export function checkCommit({ name, email, body }) {
  const lines = signOffs(body);
  if (!lines.length) return "no Signed-off-by line";
  if (lines.some((s) => same(s.name, name) && same(s.email, email))) return null;
  return `signed off as ${lines.map((s) => `${s.name} <${s.email}>`).join(", ")}, but the author is ${name} <${email}>`;
}

export function checkRange(base, head, cwd = process.cwd()) {
  const out = execFileSync("git", ["log", "--no-merges", `--format=${LOG_FORMAT}`, `${base}..${head}`], { cwd, encoding: "utf8" });
  const commits = parseLog(out);
  return { commits, failures: commits.map((c) => ({ ...c, reason: checkCommit(c) })).filter((c) => c.reason) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2] || process.env.DCO_BASE || "origin/main";
  const head = process.argv[3] || process.env.DCO_HEAD || "HEAD";
  const { commits, failures } = checkRange(base, head);
  for (const f of failures) console.error(`${f.sha.slice(0, 12)} ${f.reason}`);
  if (failures.length) {
    console.error(`\n${failures.length} of ${commits.length} commits lack a matching sign-off. Fix the branch with:\n  git rebase --signoff ${base}\nthen push it again. CONTRIBUTING.md explains the sign-off.`);
    process.exit(1);
  }
  console.log(`all ${commits.length} commits in ${base}..${head} are signed off by their authors`);
}
