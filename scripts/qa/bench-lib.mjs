// The scripting-cost benchmark behind the performance budgets (tests/budget.test.js and
// project-docs/PRODUCTION-READINESS.md). It runs the text work the content script does for each post
// (src/ext/content.js analyse(), the reading lens, the feed frame) and the thread-level pass over a
// long thread, on the shipped bundle, with invented posts only. No browser and no network.
import { readFileSync } from "node:fs";

// The bundle as the extension loads it: one classic script, run in this realm (a vm context runs
// the same code several times slower, which would measure the sandbox), that sets globalThis.PB.
export function loadBundle(path) {
  (0, eval)(readFileSync(path, "utf8"));
  return globalThis.PB;
}

const TOPICS = ["the vote", "the budget", "the bridge", "the school plan", "the rail line", "the clinic", "the park", "the port deal"];
const HARD = [
  "Why is no one talking about who funded this? Ask yourself who benefits. Follow the money!!",
  "They always do this, typical of them, every single time, it is the worst decision in history.",
  "Funny how the numbers changed overnight. What a coincidence. This proves the whole thing was rigged.",
  "I read the report and the figures in table 4 do not match the summary on page 2; see the appendix.",
];

// n invented replies of mixed length: plain views, repeats, and posts that set off many cues.
export function posts(n = 500) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const text = i % 9 === 0 ? HARD[i % HARD.length] : i % 5 === 0 && i > 7 ? out[i - 7].text
      : `Reply ${i}: on ${TOPICS[i % TOPICS.length]}, I think it needs ${i % 3 ? "more time" : "a public meeting"} before anyone signs. ${"More detail here. ".repeat(i % 4)}`;
    out.push({ id: String(1000 + i), author: `reader${i}`, text, posted: new Date(Date.UTC(2026, 9, 22, 15, 0, i * 7)).toISOString() });
  }
  return out;
}

const now = () => Number(process.hrtime.bigint()) / 1e6;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// Per post: what content.js does for each post the first time it sees it.
function perPost(PB, p, on) {
  PB.score(p.text);
  PB.persuasion(p.text);
  PB.machineSigns(p.text);
  PB.compare(p.text, "France");
  PB.feedFrame(p.text);
  PB.readPost(p.text, { on });
}

// The thread-level pass content.js refresh() makes over every reply.
function threadPass(PB, batch, on) {
  PB.duplicateClusters(batch, { root: null });
  PB.threadReport(batch.map((p) => ({ id: p.id, author: p.author, text: p.text, extreme: false, techniques: [], flags: [] })));
  PB.timingBursts(batch, { precision: "second" });
  PB.readThread(batch.map((p) => ({ ...p, role: "reply" })), { on });
}

// Returns { perPostMs, threadMs, refreshMs, n }: the median over runs of the mean per-post cost, and of one
// thread-level pass (clusters, report, timing, reading) over all n replies.
export function bench(PB, { n = 500, runs = 5 } = {}) {
  const ps = posts(n), on = PB.lensOn({ lensAll: true }), per = [], thread = [], again = [];
  for (let r = 0; r < runs; r++) {
    // Fresh text every run, so no cache inside the bundle can carry over.
    const batch = ps.map((p) => ({ ...p, text: `${p.text} (${r})` }));
    let t = now();
    for (const p of batch) perPost(PB, p, on);
    per.push((now() - t) / n);
    t = now();
    threadPass(PB, batch, on);
    thread.push(now() - t);
    t = now();
    threadPass(PB, batch, on);   // the next refresh of the same thread, as a scroll triggers
    again.push(now() - t);
  }
  return { n, runs, perPostMs: Number(median(per).toFixed(3)), threadMs: Number(median(thread).toFixed(1)), refreshMs: Number(median(again).toFixed(1)) };
}
