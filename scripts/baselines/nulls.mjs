// Null models and the browsing simulation for scripts/baselines.mjs.
//   decayTimes: independent posting at the thread's own pace. Each reply time is drawn on its own
//     from the thread's reply delays (a smoothed bootstrap: one observed delay, jittered by a
//     log-normal factor), so the thread keeps its rush after the post and loses any synchrony.
//   uniformTimes: independent posting at a constant rate over the thread's span, the model the
//     burst test itself assumes.
//   browse: a viewer opens W threads on one news event. On the real threads and on a shuffle that
//     keeps every account's number of threads and every thread's number of accounts but places
//     accounts independently (the same activity, no ties between accounts).
import { fingerprint } from "../../src/core/network.js";

export function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5) / 2 ** 32; }; }
const gauss = (next) => Math.sqrt(-2 * Math.log(next())) * Math.cos(2 * Math.PI * next());
const iso = (t) => new Date(t * 1000).toISOString();

export function decayTimes(delays, rootT, next) {
  return delays.map((_, i) => ({ author: "n" + i, posted: iso(rootT + delays[Math.floor(next() * delays.length)] * Math.exp(0.3 * gauss(next))) }));
}

export function uniformTimes(n, rootT, span, next) {
  return Array.from({ length: n }, (_, i) => ({ author: "u" + i, posted: iso(rootT + next() * span) }));
}

export function viewed(list, w, next) {
  const a = [...list];
  for (let i = 0; i < w; i++) { const j = i + Math.floor(next() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, w);
}

// Threads with a pair of accounts seen together in at least `min` other threads (as
// returningGroups in src/core/network.js), and pairs together in at least three threads.
function coappear(sets, min = 2) {
  const where = new Map();
  sets.forEach((s, i) => { for (const u of s) { if (!where.has(u)) where.set(u, []); where.get(u).push(i); } });
  let hit = 0;
  sets.forEach((s, i) => {
    const busy = [...s].filter((u) => where.get(u).length - 1 >= min);
    for (let x = 0, found = false; x < busy.length && !found; x++) for (let y = x + 1; y < busy.length; y++) {
      const A = new Set(where.get(busy[x])), shared = where.get(busy[y]).filter((t) => t !== i && A.has(t)).length;
      if (shared >= min) { hit++; found = true; break; }
    }
  });
  const pairs = new Map();
  for (const s of sets) {
    const busy = [...s].filter((u) => where.get(u).length >= 3).sort();
    for (let x = 0; x < busy.length; x++) for (let y = x + 1; y < busy.length; y++) { const k = busy[x] + "|" + busy[y]; pairs.set(k, (pairs.get(k) || 0) + 1); }
  }
  return { hit, n: sets.length, pairs3: [...pairs.values()].filter((v) => v >= 3).length };
}

function shuffled(sets, next) {
  const slots = sets.flatMap((s, i) => [...s].map((u) => [i, u]));
  const users = slots.map(([, u]) => u);
  for (let i = users.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [users[i], users[j]] = [users[j], users[i]]; }
  const out = sets.map(() => new Set());
  slots.forEach(([i], k) => out[i].add(users[k]));
  return out;
}

// Replies whose wording (8 words or more) turns up in another thread the viewer opened.
function echoes(sample) {
  const fps = sample.map((t) => t.replies.map((r) => fingerprint(r.text)));
  const seen = new Map();
  fps.forEach((list, i) => { for (const f of list) if (f) { if (!seen.has(f)) seen.set(f, new Set()); seen.get(f).add(i); } });
  let hit = 0, n = 0;
  fps.forEach((list) => { for (const f of list) if (f) { n++; if (seen.get(f).size > 1) hit++; } });
  return { hit, n };
}

export function browse(sample, next) {
  const sets = sample.map((t) => new Set(t.replies.map((r) => r.user)));
  return { real: coappear(sets), shuffled: coappear(shuffled(sets, next)), echo: echoes(sample) };
}
