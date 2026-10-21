// Timing bursts: several different accounts replying within a few seconds of each other, more
// tightly than the thread's own pace would explain. A busy thread gets many replies a minute by
// chance, so a burst only counts when a Poisson model at the thread's average rate makes it very
// unlikely (P below MAX_P). Scheduled or coordinated posting shows up this way; so can a post
// going viral at one moment, which is why this is a sign to look at, not a finding.
// The expected rate is the higher of the thread's average and its local pace in the LOCAL_SEC
// around the window. Replies rush in after a post and then thin out; tested against the average
// alone, that rush fired the sign on 12% of ordinary Twitter threads and on 39% of threads with
// 50 or more replies. Against the local pace it fired on 1.6% (project-docs/EVALUATION.md).

export const WINDOW_SEC = 20, MIN_ACCOUNTS = 3, MAX_P = 0.001, LOCAL_SEC = 120;

// The expected count in one window from the replies around it (not in it), per window length.
function localLambda(pts, i, j, windowSec) {
  const lo = pts[i].t - LOCAL_SEC * 1000, hi = pts[j].t + LOCAL_SEC * 1000;
  let around = 0;
  for (let k = 0; k < pts.length; k++) if ((k < i || k > j) && pts[k].t >= lo && pts[k].t <= hi) around++;
  const from = Math.max(lo, pts[0].t), to = Math.min(hi, pts[pts.length - 1].t);
  const seconds = Math.max(1, (to - from - (pts[j].t - pts[i].t)) / 1000);
  return (around / seconds) * windowSec;
}

// P(X >= k) for X ~ Poisson(lambda).
export function poissonTail(k, lambda) {
  if (k <= 0) return 1;
  let term = Math.exp(-lambda), cdf = term;
  for (let i = 1; i < k; i++) { term *= lambda / i; cdf += term; }
  return Math.max(0, 1 - cdf);
}

// rows: [{ author, posted }]. Returns [{ from, to, authors, p }], tightest first, not overlapping.
export function timingBursts(rows, windowSec = WINDOW_SEC, minAccounts = MIN_ACCOUNTS) {
  const pts = rows.map((r) => ({ a: String(r.author).toLowerCase(), t: Date.parse(r.posted) })).filter((x) => Number.isFinite(x.t)).sort((x, y) => x.t - y.t);
  if (pts.length < minAccounts + 2) return [];
  const span = (pts[pts.length - 1].t - pts[0].t) / 1000;
  if (span <= windowSec) return [];
  // Windows are tested at every reply, so correct for the number of starting points (Bonferroni).
  const lambda = (pts.length * windowSec) / span, tests = pts.length;
  const found = [];
  for (let i = 0; i < pts.length; i++) {
    let j = i;
    while (j + 1 < pts.length && pts[j + 1].t - pts[i].t <= windowSec * 1000) j++;
    const authors = [...new Set(pts.slice(i, j + 1).map((x) => x.a))];
    if (authors.length < minAccounts) continue;
    const p = Math.min(1, poissonTail(authors.length, Math.max(lambda, localLambda(pts, i, j, windowSec))) * tests);
    if (p < MAX_P) found.push({ from: new Date(pts[i].t).toISOString(), to: new Date(pts[j].t).toISOString(), authors, p, end: j });
  }
  found.sort((x, y) => x.p - y.p);
  const used = new Set(), out = [];
  for (const b of found) {
    if (b.authors.some((a) => used.has(a))) continue;
    b.authors.forEach((a) => used.add(a));
    delete b.end;
    out.push(b);
  }
  return out;
}
