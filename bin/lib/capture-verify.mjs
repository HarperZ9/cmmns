// `cmmns capture verify <folder>`: checks every evidence capture (daylight.capture/1) under a
// folder. For each: the saved files and the page picture still have the hashes the capture recorded,
// the record itself is the one its custody line names, and the line's own hash is intact. Across
// captures: the lines found form one chain, and any line not in the folder is named by number.
// Reads local files only.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, relative } from "node:path";
import { captureCanonical, sha256Text, verifyCustody, CAPTURE_FORMAT } from "../../src/core/capture.js";

const sha = (b) => createHash("sha256").update(b).digest("hex");

function* records(dir, depth = 0) {
  if (depth > 8) return;
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) yield* records(p, depth + 1);
    else if (name.endsWith(".capture.json")) yield p;
  }
}

// { checked, problems: [{ file, problem }], chain: { ok, lines, gaps: [seq], broken_at, reason } }
export async function verifyCaptures(dir) {
  const problems = [], lines = [];
  let checked = 0;
  for (const p of records(dir)) {
    let rec;
    try { rec = JSON.parse(readFileSync(p, "utf8")); } catch (e) { problems.push({ file: relative(dir, p), problem: `not readable: ${e.message}` }); continue; }
    if (rec.format !== CAPTURE_FORMAT) continue;
    checked++;
    const where = dirname(p), file = relative(dir, p), line = rec.custody;
    for (const a of rec.artifact || []) {
      const f = join(where, a.name);
      if (!existsSync(f)) problems.push({ file, problem: `${a.name} is not beside the record` });
      else if (sha(readFileSync(f)) !== a.saved_sha256) problems.push({ file, problem: `${a.name} has changed since it was captured` });
    }
    if (rec.screenshot) {
      const f = join(where, rec.screenshot.name);
      if (!existsSync(f)) problems.push({ file, problem: `${rec.screenshot.name} is not beside the record` });
      else if (sha(readFileSync(f)) !== rec.screenshot.sha256) problems.push({ file, problem: `${rec.screenshot.name} has changed since it was captured` });
    }
    if (!line) { problems.push({ file, problem: "no custody line" }); continue; }
    const { custody, ...body } = rec;
    const recordHash = await sha256Text(captureCanonical({ ...body, custody: null }));
    if (!(line.hashes || []).includes(recordHash)) problems.push({ file, problem: "the record was changed after its custody line was written" });
    lines.push(line);
  }
  lines.sort((a, b) => a.seq - b.seq);
  // A folder may hold only some captures of the chain: check each run of consecutive lines, name the gaps.
  const gaps = [], runs = [];
  for (const l of lines) {
    const last = runs.length && runs[runs.length - 1][runs[runs.length - 1].length - 1];
    if (last && l.seq === last.seq + 1) runs[runs.length - 1].push(l);
    else { if (last) for (let s = last.seq + 1; s < l.seq; s++) gaps.push(s); runs.push([l]); }
  }
  let broken = { ok: true, broken_at: null, reason: null };
  for (const run of runs) {
    // A run from line 1 is checked whole; a later run's first line cannot be checked against a line
    // that is not here, but its own hash and every link after it still are.
    const r = run[0].seq === 1 ? await verifyCustody(run) : await verifyFrom(run);
    if (!r.ok) { broken = r; break; }
  }
  return { checked, problems, chain: { ok: broken.ok && !problems.length, lines: lines.length, gaps, broken_at: broken.broken_at, reason: broken.reason } };
}

// Checks a run whose first line follows a line not present: each line's hash, and each later line's link.
async function verifyFrom(run) {
  const [first, ...rest] = run;
  const { hash, ...body } = first;
  if ((await sha256Text(captureCanonical(body))) !== hash) return { ok: false, broken_at: first.seq, reason: "this line was changed after it was written" };
  let prev = first;
  for (const l of rest) {
    const { hash: h, ...b } = l;
    if ((await sha256Text(captureCanonical(b))) !== h) return { ok: false, broken_at: l.seq, reason: "this line was changed after it was written" };
    if (l.prev !== prev.hash) return { ok: false, broken_at: l.seq, reason: "the line before it was changed" };
    prev = l;
  }
  return { ok: true, broken_at: null, reason: null };
}

export function verifyLines(r) {
  const out = [`Checked ${r.checked} captures and ${r.chain.lines} custody lines.`];
  for (const p of r.problems) out.push(`Problem  ${p.file}: ${p.problem}`);
  if (r.chain.broken_at) out.push(`The custody chain breaks at line ${r.chain.broken_at}: ${r.chain.reason}.`);
  if (r.chain.gaps.length) out.push(`Lines not in this folder: ${r.chain.gaps.join(", ")} (captures saved elsewhere, or removed).`);
  if (r.chain.ok) out.push("Every file matches its capture and the custody lines found are intact.");
  return out.join("\n") + "\n";
}
