// Organic rates for the framing signs and the two new persuasion cues on ordinary threads: how often
// a reply or a root post reads as a person-story, a structural explanation or both, and how often the
// hidden-motive and just-asking cues fire. No labels: these are rates, not precision.
//   node scripts/framing-baselines.mjs [--data <dir>]   (default: $RADAR_DATA or ../radar-data)
// Input: <data>/pheme/prepared/pheme-threads.jsonl from scripts/eval/prep-pheme.py (PHEME, Zubiaga
// et al., CC BY 4.0). Writes project-docs/evidence/framing-results.json. Only counts leave.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { framingOf } from "../src/core/framing.js";
import { techniqueSpans } from "../src/core/persuasion.js";
import { wilson } from "../src/core/report.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DATA = arg("--data", process.env.RADAR_DATA || "../radar-data");
const FILE = join(DATA, "pheme", "prepared", "pheme-threads.jsonl");
const RAW = join(DATA, "pheme", "PHEME_veracity.tar.bz2");
const rate = (k, n) => ({ k, n, share: n ? Math.round((k / n) * 10000) / 10000 : null, ci: n ? wilson(k, n).map((x) => Math.round(x * 10000) / 10000) : null });

export function tally(texts) {
  const c = { posts: 0, read: 0, "person-story": 0, structural: 0, mixed: 0, motive: 0, asking: 0 };
  for (const t of texts) {
    c.posts++;
    const f = framingOf(t);
    if (f.frame) { c.read++; c[f.frame]++; } else if (f.words >= 12) c.read++;
    const kinds = new Set(techniqueSpans(t).map((h) => h.technique));
    if (kinds.has("motive-attribution")) c.motive++;
    if (kinds.has("just-asking")) c.asking++;
  }
  return { posts: c.posts, longEnough: c.read, personStory: rate(c["person-story"], c.read), structural: rate(c.structural, c.read), mixed: rate(c.mixed, c.read),
    motive: rate(c.motive, c.posts), justAsking: rate(c.asking, c.posts) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!existsSync(FILE)) { console.error(`missing ${FILE}: run python -I scripts/eval/prep-pheme.py <data>/pheme`); process.exit(1); }
  const threads = readFileSync(FILE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const out = { generated: "2026-10-21",
    source: { name: "PHEME rumour and non-rumour threads (Zubiaga et al.)", url: "https://doi.org/10.6084/m9.figshare.6392078.v1", licence: "CC BY 4.0", years: "2014 to 2015", site: "Twitter", threads: threads.length, sha256: existsSync(RAW) ? createHash("sha256").update(readFileSync(RAW)).digest("hex") : null },
    note: "Rates on unlabelled posts. Not precision: nobody checked whether a person-story read is one.",
    roots: tally(threads.map((t) => (t.root && t.root.text) || "")), replies: tally(threads.flatMap((t) => t.replies.map((r) => r.text || ""))) };
  writeFileSync(join(root, "project-docs/evidence/framing-results.json"), JSON.stringify(out, null, 1) + "\n");
  console.log(JSON.stringify(out, null, 1));
}
