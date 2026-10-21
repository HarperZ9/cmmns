// Learn: the path from a badge to its lesson, the pages a content script may ask the worker to
// open, and the first-week tour. The lessons themselves are local pages in src/ext/learn/.
// The tour has three tips, shown once each over the first uses, at most one per hour, only in the
// first week after the first tip, and never again after "No more tips". Nothing here touches the
// network or the DOM.

export const TOUR_KEY = "pb.tour";
export const LEARN_KEY = "pb.learn.v1";
export const TOUR_DAYS = 7;
export const TOUR_GAP_MS = 60 * 60 * 1000;
const DAY_MS = 86400000;

const ID = /^[a-z][a-z0-9-]{1,40}$/;
const PAGES = new Set(["learn.html", "quiz.html"]);

// The lesson page for a sign family, or null for an id that cannot be a lesson.
export function lessonPath(fam) {
  return typeof fam === "string" && ID.test(fam) ? `learn.html#${fam}` : null;
}

// A content script asks the worker to open one of Radar's own pages. Only these pages, with an
// optional lesson id, pass; anything else is refused, so a page cannot be made to open other URLs.
export function safePage(path) {
  if (typeof path !== "string") return null;
  const [page, hash, extra] = path.split("#");
  if (extra !== undefined || !PAGES.has(page)) return null;
  if (hash === undefined || hash === "") return page;
  return ID.test(hash) ? `${page}#${hash}` : null;
}

// The three tips, in order. `where` is the surface that may show the tip.
export const TIPS = [
  { id: "hover", where: "window", step: 1,
    text: "Tip 1 of 3. This window opens when you rest the pointer on a post. The dots at the top are areas. Click one to open its evidence." },
  { id: "report", where: "panel", step: 2,
    text: "Tip 2 of 3. The Radar button opens a report on the whole thread. It compares the harshest replies with the rest and shows the interval." },
  { id: "lesson", where: "window", step: 3,
    text: "Tip 3 of 3. Every sign has a Learn link. Each lesson takes about a minute and shows how to spot the move yourself." },
];

export function normalizeTour(raw) {
  const s = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const ok = new Set(TIPS.map((t) => t.id));
  return {
    off: s.off === true,
    start: Number.isFinite(s.start) ? s.start : null,
    lastAt: Number.isFinite(s.lastAt) ? s.lastAt : null,
    shown: Array.isArray(s.shown) ? [...new Set(s.shown.filter((x) => ok.has(x)))] : [],
  };
}

// The tip this surface may show now, or null. ctx.hasSignal: the window holds at least one sign
// (the lesson tip points at one).
export function nextTip(raw, where, now, ctx = {}) {
  const s = normalizeTour(raw);
  if (s.off) return null;
  if (s.start != null && now - s.start > TOUR_DAYS * DAY_MS) return null;
  if (s.lastAt != null && now - s.lastAt < TOUR_GAP_MS) return null;
  const tip = TIPS.find((t) => !s.shown.includes(t.id));
  if (!tip || tip.where !== where) return null;
  if (tip.id === "lesson" && !ctx.hasSignal) return null;
  return tip;
}

// The state after a tip is shown. A shown tip is done, whether or not the user clicks it.
export function markShown(raw, id, now) {
  const s = normalizeTour(raw);
  return { ...s, start: s.start ?? now, lastAt: now, shown: s.shown.includes(id) ? s.shown : [...s.shown, id] };
}

// "No more tips": off for good.
export function stopTips(raw) {
  return { ...normalizeTour(raw), off: true };
}

// Self-check answers: { answers: { [questionId]: { at, said } } }, the latest answer per question.
// `said` is true when the user answered "leans on a move".
export function normalizeLearn(raw) {
  const a = raw && typeof raw === "object" && raw.answers && typeof raw.answers === "object" ? raw.answers : {};
  const answers = {};
  for (const [k, v] of Object.entries(a)) {
    if (ID.test(k) && v && typeof v.said === "boolean" && Number.isFinite(v.at)) answers[k] = { at: v.at, said: v.said };
  }
  return { answers };
}

export function recordAnswer(raw, id, said, now) {
  const s = normalizeLearn(raw);
  if (!ID.test(id)) return s;
  return { answers: { ...s.answers, [id]: { at: now, said: !!said } } };
}

// Inverse of the standard normal CDF (Acklam's rational approximation, error below 1.2e-9).
function probit(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - lo) return -probit(1 - p);
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

// Discernment over the answered items, scored the way the replication studies ask: hits (a
// leaning post called leaning) against false alarms (a fair post called leaning), never by how
// many fakes were caught. Calling every post leaning gives d' near 0, however many fakes it catches.
// items: [{ id, leans }]. Returns null until there is at least one answer of each kind.
// d' and c use the log-linear correction (Hautus 1995), so 0 and 100% rates stay finite.
export function discernment(items, raw) {
  const { answers } = normalizeLearn(raw);
  let signal = 0, noise = 0, hits = 0, falseAlarms = 0;
  for (const it of items) {
    const a = answers[it.id];
    if (!a) continue;
    if (it.leans) { signal++; if (a.said) hits++; } else { noise++; if (a.said) falseAlarms++; }
  }
  if (!signal || !noise) return null;
  const H = (hits + 0.5) / (signal + 1), F = (falseAlarms + 0.5) / (noise + 1);
  const zH = probit(H), zF = probit(F);
  return { signal, noise, hits, falseAlarms, hitRate: hits / signal, falseAlarmRate: falseAlarms / noise,
    difference: hits / signal - falseAlarms / noise, dPrime: zH - zF, bias: -(zH + zF) / 2 };
}
