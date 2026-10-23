// `case timeline`: dated events from the case, in order, with gaps and contradictions flagged.
// Events come from three places: rows in events.jsonl, the publication date of each source, and
// claims that carry a date. Flags:
//   gap            more than --gap days between two neighbouring events
//   date-conflict  two events with the same key and different dates
//   after-source   an event dated after the source that reports it was published
//   rung-conflict  two claims with the same key, one documented and one contradicted
import { byId } from "./store.js";

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const DAY = 86400000;

// A date as YYYY-MM-DD from ISO text, or null. Times are kept only when given.
export function dayOf(s) {
  const m = String(s || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// Dates written in prose ("October 9", "9 Oct 2026", "Oct 10-14"), resolved against a default
// year. Returns [{ day, text, index }]; a range gives its first day.
export function datesInText(text, year) {
  const out = [], s = String(text || "");
  for (const m of s.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) out.push({ day: `${m[1]}-${m[2]}-${m[3]}`, text: m[0], index: m.index });
  const mon = "(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\.?";
  const pats = [new RegExp(`\\b${mon}\\s+(\\d{1,2})(?:\\s*[-–]\\s*\\d{1,2})?(?:,?\\s+(\\d{4}))?\\b`, "gi"), new RegExp(`\\b(\\d{1,2})(?:\\s*[-–]\\s*\\d{1,2})?\\s+${mon}(?:\\s+(\\d{4}))?\\b`, "gi")];
  pats.forEach((re, k) => {
    for (const m of s.matchAll(re)) {
      const [mo, d, y] = k === 0 ? [m[1], m[2], m[3]] : [m[2], m[1], m[3]];
      const month = MONTHS[mo.toLowerCase().slice(0, mo.toLowerCase().startsWith("sept") ? 4 : 3)], day = Number(d), yr = Number(y || year);
      if (!month || !yr || day < 1 || day > 31) continue;
      out.push({ day: `${yr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, text: m[0], index: m.index });
    }
  });
  return out.sort((a, b) => a.index - b.index);
}

export function collectEvents(data) {
  const ev = [];
  for (const e of data.events) if (dayOf(e.date)) ev.push({ id: e.id, day: dayOf(e.date), when: e.date, text: e.text, source: e.source || null, key: e.key || null, from: "event" });
  for (const s of data.sources) if (dayOf(s.source_date)) ev.push({ id: s.id, day: dayOf(s.source_date), when: s.source_date, text: `${s.title || s.what || s.kind} published${s.author && !String(s.title || "").includes(s.author) ? " by " + s.author : ""}`, source: s.id, key: null, from: "source" });
  for (const c of data.claims) if (c.status !== "rejected" && dayOf(c.date)) ev.push({ id: c.id, day: dayOf(c.date), when: c.date, text: c.text, source: c.source.split(",")[0], key: c.key || null, from: "claim", rung: c.rung });
  return ev.sort((a, b) => (a.when < b.when ? -1 : a.when > b.when ? 1 : a.id < b.id ? -1 : 1));
}

// Gaps count only inside the case window: from a month before the first dated source to the last
// event. Background dates in the text (a 1939 law, a 2024 contract) are listed but not gap-checked.
function windowStart(data) {
  const days = data.sources.map((s) => dayOf(s.source_date)).filter(Boolean).sort();
  return days.length ? new Date(Date.parse(days[Math.floor(days.length / 10)]) - 30 * DAY).toISOString().slice(0, 10) : "0000";
}

function flagsFor(all, data, gapDays) {
  const flags = [], sources = byId(data.sources), from = windowStart(data), ev = all.filter((e) => e.day >= from);
  for (let i = 1; i < ev.length; i++) {
    const d = (Date.parse(ev[i].day) - Date.parse(ev[i - 1].day)) / DAY;
    if (d > gapDays) flags.push({ kind: "gap", between: [ev[i - 1].id, ev[i].id], days: d, text: `${d} days with no dated event between ${ev[i - 1].day} and ${ev[i].day}` });
  }
  const byKey = new Map();
  for (const e of all) if (e.key) byKey.set(e.key, [...(byKey.get(e.key) || []), e]);
  for (const [key, list] of byKey) {
    const days = [...new Set(list.map((e) => e.day))];
    if (days.length > 1) flags.push({ kind: "date-conflict", key, events: list.map((e) => e.id), text: `"${key}" is dated ${days.join(" and ")} by ${list.map((e) => `${e.id} (${e.source || "no source"})`).join(", ")}` });
    const rungs = new Set(list.map((e) => e.rung).filter(Boolean));
    if (rungs.has("documented") && rungs.has("contradicted")) flags.push({ kind: "rung-conflict", key, events: list.map((e) => e.id), text: `"${key}" has a documented claim and a contradicted one` });
  }
  for (const e of all) {
    const s = e.from !== "source" && e.source ? sources.get(e.source) : null;
    if (s && dayOf(s.source_date) && e.day > dayOf(s.source_date)) flags.push({ kind: "after-source", events: [e.id], text: `${e.id} is dated ${e.day}, after its source ${s.id} was published (${dayOf(s.source_date)})` });
  }
  return flags;
}

export function buildTimeline(data, { gapDays = 3 } = {}) {
  const events = collectEvents(data);
  return { events, flags: flagsFor(events, data, gapDays), undated: data.sources.filter((s) => !dayOf(s.source_date)).map((s) => s.id),
    doesNotProve: "A timeline orders what the sources say happened and when. A date in a source can be wrong, and order is not cause." };
}

export function timelineLines(t) {
  const L = t.events.map((e) => `${e.when.length > 10 ? e.when.slice(0, 16).replace("T", " ") : e.day}  ${e.id.padEnd(4)} ${e.text}${e.source && e.source !== e.id ? ` [${e.source}]` : ""}`);
  L.push("", t.flags.length ? `Flags (${t.flags.length}):` : "No gaps or contradictions flagged.");
  for (const f of t.flags) L.push(`  ${f.kind}: ${f.text}`);
  if (t.undated.length) L.push("", `Sources with no date: ${t.undated.join(", ")}`);
  L.push("", `Does not prove: ${t.doesNotProve}`);
  return L.join("\n") + "\n";
}
