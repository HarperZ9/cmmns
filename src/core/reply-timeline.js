// The reply timeline: when a thread's replies arrived, as a row of counts, with the stretches the
// timing-burst test marked (src/core/timing.js). Coordination often shows first as timing, and the
// strip lets a reader see a burst against the thread's own rhythm instead of as a bare number.
// A strip is never finer than the times behind it: replies whose times are good only to the hour
// are never spread across minutes (src/core/precision.js). Counts only; no account is named here.

import { timePrecision, PRECISION_MS, PRECISION_WORDS } from "./precision.js";

export const TIMELINE_BINS = 40;
export const TIMELINE_DOES_NOT_PROVE = "When replies arrived says nothing about who wrote them or why. A rush can follow a post being shared, a live event or a notification as easily as coordination.";

const iso = (t) => new Date(t).toISOString();

// replies: [{ posted, timePrecision? }]; bursts: [{ from, to }] from timingBursts().
// opts: { bins, precision } (precision: the thread's declared timePrecision).
// Returns null below two timed replies, else { from, to, timed, untimed, precision, binMs, peak,
// bursts, bins: [{ from, to, n, burst }] }.
export function replyTimeline(replies, bursts = [], opts = {}) {
  const list = replies || [];
  const pts = list.map((r) => Date.parse(r && r.posted)).filter(Number.isFinite).sort((a, b) => a - b);
  if (pts.length < 2) return null;
  const P = timePrecision(list, opts.precision);
  const unit = PRECISION_MS[P.precision] || 1000;
  const from = pts[0], span = Math.max(pts[pts.length - 1] - from, unit);
  const n = Math.max(1, Math.min(opts.bins || TIMELINE_BINS, Math.ceil(span / unit)));
  const w = span / n;
  const bins = Array.from({ length: n }, (_, i) => ({ a: from + i * w, b: from + (i + 1) * w, n: 0, burst: false }));
  for (const t of pts) bins[Math.min(n - 1, Math.floor((t - from) / w))].n++;
  const marks = (bursts || []).map((x) => [Date.parse(x.from), Date.parse(x.to)]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  for (const bin of bins) bin.burst = marks.some(([a, b]) => a < bin.b && b >= bin.a);
  return {
    from: iso(from), to: iso(from + span), timed: pts.length, untimed: list.length - pts.length,
    precision: P.precision, binMs: Math.round(w), peak: Math.max(...bins.map((x) => x.n)), bursts: marks.length,
    bins: bins.map((x) => ({ from: iso(x.a), to: iso(x.b), n: x.n, burst: x.burst })),
  };
}

// A length of time in words: "40 s", "12 min", "3 h 5 min", "2 days".
export function spanWords(ms) {
  const s = Math.round(ms / 1000);
  if (s < 90) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m} min`;
  const h = Math.floor(m / 60), rest = m % 60;
  if (h < 48) return rest ? `${h} h ${rest} min` : `${h} h`;
  return `${Math.round(h / 24)} days`;
}

// What the strip shows, in one sentence, for screen readers and for the saved thread.
export function timelineSentence(t) {
  if (!t) return null;
  const span = Date.parse(t.to) - Date.parse(t.from);
  const clock = (s) => s.slice(11, 16);
  const sameDay = t.from.slice(0, 10) === t.to.slice(0, 10);
  const when = sameDay ? `${t.from.slice(0, 10)}, ${clock(t.from)} to ${clock(t.to)} UTC` : `${t.from.slice(0, 10)} ${clock(t.from)} to ${t.to.slice(0, 10)} ${clock(t.to)} UTC`;
  const parts = [
    `${t.timed} repl${t.timed === 1 ? "y" : "ies"} over ${spanWords(span)} (${when})`,
    `each bar is ${spanWords(t.binMs)}, the busiest holds ${t.peak}`,
    t.bursts ? `${t.bursts} burst${t.bursts === 1 ? "" : "s"} marked` : "no burst marked",
  ];
  const tail = [t.untimed ? `${t.untimed} without a time` : null, t.precision ? `times ${PRECISION_WORDS[t.precision]}` : null].filter(Boolean).join("; ");
  return `${parts.join("; ")}.${tail ? ` ${tail[0].toUpperCase()}${tail.slice(1)}.` : ""}`;
}
