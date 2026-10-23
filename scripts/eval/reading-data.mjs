// Feed-test sets for the reading lens (scripts/eval-reading.mjs). The sets stay on the author's
// machine: they hold other people's posts, so only counts are committed.
// Each set folder has posts.jsonl and, once labelled, labels-A.jsonl and labels-B.jsonl
// (feed-label/1). Set 1 is "2026-10-23-feed-test", set n is "2026-10-23-feed-test-n".

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Round 1 (commit dac81a7, 0a80e52 before the rebase) fitted on 1 to 5 and was scored once on 6 to 11
// (project-docs/evidence/reading-results-round1.json). Round 2 read the misses in 6 to 9, so 6 to 9
// joined the dev sets; 10 and 11, labelled blind after round 1 was frozen, are the held-out sets.
export const DEV_SETS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const HELDOUT_SETS = [10, 11];
export const setDir = (data, n) => join(data, n === 1 ? "2026-10-23-feed-test" : `2026-10-23-feed-test-${n}`);
const rows = (p) => (existsSync(p) ? readFileSync(p, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l)) : []);
const sha = (p) => (existsSync(p) ? createHash("sha256").update(readFileSync(p)).digest("hex") : null);

// One set: { n, posts: [{ id, thread, author, role, text, labels: { A, B } }], threads: Map, inputs }.
export function loadSet(data, n) {
  const dir = setDir(data, n), files = ["posts.jsonl", "labels-A.jsonl", "labels-B.jsonl"];
  const labels = { A: new Map(), B: new Map() };
  for (const L of ["A", "B"]) for (const r of rows(join(dir, `labels-${L}.jsonl`))) labels[L].set(r.case, r);
  const posts = rows(join(dir, "posts.jsonl")).map((p) => ({ id: p.case, thread: `${n}:${p.thread}`, author: p.handle || p.display || "", role: p.role,
    text: String(p.text || "").replace(/^\[(?:not captured|no text shown[^\]]*|gap:[^\]]*)\]$/i, ""), labels: { A: labels.A.get(p.case) || null, B: labels.B.get(p.case) || null } }));
  const threads = new Map();
  for (const p of posts) { if (!threads.has(p.thread)) threads.set(p.thread, []); threads.get(p.thread).push(p); }
  return { n, posts, threads, labelled: labels.A.size > 0 && labels.B.size > 0, inputs: files.map((f) => ({ file: `set ${n}/${f}`, sha256: sha(join(dir, f)) })) };
}

// Ground truth per technique, fixed before any held-out run: a labeller supports a technique when
// it marks one of the mapped families "yes" or names a matching technique. Consensus: both do.
const TRUTH = {
  "nation-denial": [["dehumanise"], /nation|countr|denial|no man/i],
  "dehumanising": [["dehumanise"], /dehumani|vermin|parasit|animalis/i],
  "punitive-annexation": [["violence", "dehumanise"], /annex|eliminat|violen|penal|remigrat|collective punish|deport/i],
  "strongman": [[], /strong ?man|authoritarian|dictator|iron fist|strong leader|caudillo/i],
  "question-insinuation": [["conspiracy"], /question|insinuat|just asking|innuendo/i],
  "true-leap": [["conspiracy"], /leap|true.?item|juxtapos|kernel of truth|true (?:general )?premise|non.?sequitur|unsupported (?:causal|conclusion)/i],
  "case-to-group": [["stereotype"], /generali[sz]|case.to.group|sweeping/i],
  "essentialism": [["stereotype"], /essential/i],
  "coded-term": [["slur"], /coded|dog.?whistle|euphemis/i],
  "replacement": [["conspiracy", "stereotype"], /replace|blood libel|ritual|demographic/i],
  "secret-coercion": [["conspiracy"], /coerc|blackmail|compromis|secret control|puppet/i],
  "election-theft": [["conspiracy"], /election|fraud|rigg|stolen/i],
  "metaphor": [["dehumanise"], /metaphor|analog|imagery|simile/i],
  "hyperbole": [[], /hyperbol|superlative|overstat|exaggerat|catastrophi/i],
  "irony": [[], /irony|ironic|sarcas|mock|ridicul|joke/i],
  "allusion": [[], /allusion|analog|reference|reductio|nazi|historical/i],
  "dog-whistle": [["slur"], /dog.?whistle|coded|vague referent|vague_referent|noticing/i],
};
export const TRUTH_TECHNIQUES = Object.keys(TRUTH);

export function supports(label, technique) {
  if (!label) return false;
  const [fams, re] = TRUTH[technique];
  if (fams.some((f) => label[f] === "yes")) return true;
  return (label.techniques || []).some((t) => re.test(String(t)));
}
export const consensus = (post, technique) => supports(post.labels.A, technique) && supports(post.labels.B, technique);
export const either = (post, technique) => supports(post.labels.A, technique) || supports(post.labels.B, technique);

// The families the 3.2.2 held-out report counted (conspiracy, stereotype, violence, dehumanise,
// slur): a post is a consensus positive when both labellers say yes to any one of them.
const HARM = ["slur", "stereotype", "dehumanise", "violence", "conspiracy"];
export const harmPositive = (post) => HARM.some((f) => post.labels.A && post.labels.B && post.labels.A[f] === "yes" && post.labels.B[f] === "yes");
