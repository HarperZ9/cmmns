// "This was wrong" and "This was right" marks on the window's signs, kept in this browser only.
// Each mark holds the sign id, the badge family, the thread key, the verdict and the time. The post
// text is kept only when the user ticks "include the text". The store lives under FEEDBACK_KEY in
// chrome.storage.local as { entries: { [signId]: entry } }; every function here returns a new object.
// Calibration is the user's own count, shown beside the measured figure and never in its place.

export const FEEDBACK_KEY = "pb.feedback.v1";
export const CALIBRATION_MIN = 10;   // marks on one family before "Your feedback" shows
export const MAX_ENTRIES = 2000;     // oldest marks are dropped past this
export const TEXT_MAX = 1000;        // characters of post text kept when the user includes it
const VERDICTS = new Set(["right", "wrong"]);

// FNV-1a, 32-bit, as 8 hex digits: a short stable id for a sign's label.
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

// One id per sign per post: the family, the post id and a hash of the sign's label.
export const signId = (sign, postId) => `${sign.fam}:${postId || ""}:${fnv(String(sign.label || ""))}`;

export function makeEntry({ sign, postId, threadKey, verdict, at = Date.now(), text, includeText = false }) {
  if (!sign || !sign.fam || !VERDICTS.has(verdict)) return null;
  const e = { id: signId(sign, postId), family: sign.fam, threadKey: threadKey || null, verdict, at };
  if (includeText && typeof text === "string" && text) e.text = text.slice(0, TEXT_MAX);
  return e;
}

const entriesOf = (store) => (store && store.entries && typeof store.entries === "object" ? store.entries : {});

export function addFeedback(store, entry) {
  if (!entry) return { entries: { ...entriesOf(store) } };
  const all = { ...entriesOf(store), [entry.id]: entry };
  const ids = Object.keys(all);
  if (ids.length > MAX_ENTRIES) {
    ids.sort((a, b) => all[a].at - all[b].at);
    for (const id of ids.slice(0, ids.length - MAX_ENTRIES)) delete all[id];
  }
  return { entries: all };
}

export function removeFeedback(store, id) {
  const all = { ...entriesOf(store) };
  delete all[id];
  return { entries: all };
}

export const verdictOf = (store, id) => (entriesOf(store)[id] || {}).verdict || null;

function counts(store) {
  const by = {};
  for (const e of Object.values(entriesOf(store))) {
    if (!e || !e.family || !VERDICTS.has(e.verdict)) continue;
    const c = by[e.family] || (by[e.family] = { right: 0, wrong: 0 });
    c[e.verdict]++;
  }
  return by;
}

// { right, total } for a family once it has CALIBRATION_MIN marks, else null.
export function calibration(store, family, min = CALIBRATION_MIN) {
  const c = counts(store)[family];
  if (!c) return null;
  const total = c.right + c.wrong;
  return total >= min ? { right: c.right, total } : null;
}

export function calibrationAll(store, min = CALIBRATION_MIN) {
  const out = {};
  for (const family of Object.keys(counts(store))) { const c = calibration(store, family, min); if (c) out[family] = c; }
  return out;
}

export function calibrationLine(store, family, min = CALIBRATION_MIN) {
  const c = calibration(store, family, min);
  return c ? `Your feedback: ${c.right} of ${c.total} right` : null;
}

export const FEEDBACK_ABOUT = "Your marks on Daylight Commons' signs, saved from this browser. This file is not sent anywhere by Daylight Commons. You choose whether to send it, for example as an attachment to an issue on Daylight Commons' repository. Post text appears only for marks where you ticked \"include the text\".";

// The opt-in export: a JSON object the options page saves as a file when the user clicks.
export function buildExport(store, { version = null, now = Date.now() } = {}) {
  const entries = Object.values(entriesOf(store)).sort((a, b) => a.at - b.at)
    .map((e) => ({ ...e, at: new Date(e.at).toISOString() }));
  return { format: "radar-feedback/1", radarVersion: version, exported: new Date(now).toISOString(), about: FEEDBACK_ABOUT, byFamily: counts(store), entries };
}
