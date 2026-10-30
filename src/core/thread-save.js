// Save the thread: a thread's replies as they were on screen, each with its time, its badges (the
// flags CMMNS showed, each with its evidence and what it does not prove), and its place in a
// same-text group or a timing burst. Two forms: one Markdown note to read, and JSON Lines for a
// study (one record per line, the thread first). Built on the user's click and written only to
// this computer, through the same save path as every other CMMNS save.
// Stance-neutral by construction: no rhetoric markers and no extremity score per reply. Extremity
// is a thread-level comparison only, and a saved file must not turn it into a label on a person.

import { DOES_NOT_PROVE } from "./flags.js";
import { replyTimeline, timelineSentence, TIMELINE_DOES_NOT_PROVE } from "./reply-timeline.js";

export const THREAD_SAVE_FORMAT = "cmmns.thread/1";
export const THREAD_SAVE_DOES_NOT_PROVE = "A badge is evidence to look at, not a finding about the person. These are the replies the page had loaded when this was saved, not the whole thread.";

const badge = (f) => ({ id: f.id, evidence: f.evidence || null, doesNotProve: f.doesNotProve || DOES_NOT_PROVE[f.id] || null });

function reply(r, flagsOf, clusterOf, burstOf) {
  return {
    type: "reply", id: String(r.id), author: r.author, display: r.display || null, posted: r.posted || null,
    timePrecision: r.timePrecision || null, text: r.text || "", url: r.url || null, domains: r.domains || [],
    badges: (flagsOf.get(r.id) || []).map(badge), sameTextGroup: clusterOf.get(r.id) ?? null, burst: burstOf(r) ?? null,
  };
}

// input: { site, page, savedAt, tool, root, replies: [{ id, author, display, posted, text, url, domains }],
// rows: [{ id, flags }], clusters: [{ ids }], bursts: [{ from, to, authors }] }.
// Returns { head, root, replies }: the records both formats are written from.
export function threadRecords(input) {
  const { site = "", page = "", savedAt = new Date().toISOString(), tool = "CMMNS", root = null, replies = [], rows = [], clusters = [], bursts = [] } = input || {};
  const flagsOf = new Map(rows.map((r) => [r.id, r.flags || []]));
  const clusterOf = new Map();
  clusters.forEach((c, i) => { for (const id of c.ids || []) clusterOf.set(id, i + 1); });
  const spans = bursts.map((b) => ({ a: Date.parse(b.from), b: Date.parse(b.to), who: new Set((b.authors || []).map((x) => String(x).toLowerCase())) }));
  const burstOf = (r) => {
    const t = Date.parse(r.posted), i = spans.findIndex((s) => t >= s.a && t <= s.b && s.who.has(String(r.author).toLowerCase()));
    return i < 0 ? null : i + 1;
  };
  const timeline = replyTimeline(replies, bursts);
  const head = {
    type: "thread", format: THREAD_SAVE_FORMAT, tool, site, page, savedAt, replies: replies.length,
    sameTextGroups: clusters.length, bursts: bursts.map((b, i) => ({ n: i + 1, from: b.from, to: b.to, accounts: (b.authors || []).length, p: b.p ?? null })),
    timeline: timeline ? { sentence: timelineSentence(timeline), precision: timeline.precision, bins: timeline.bins.map((x) => x.n), binMs: timeline.binMs } : null,
    doesNotProve: [THREAD_SAVE_DOES_NOT_PROVE, timeline ? TIMELINE_DOES_NOT_PROVE : null].filter(Boolean),
  };
  const post = root ? { type: "post", id: String(root.id), author: root.author, display: root.display || null, posted: root.posted || null, text: root.text || "", url: root.url || null } : null;
  return { head, root: post, replies: replies.map((r) => reply(r, flagsOf, clusterOf, burstOf)) };
}

// One JSON object per line: the thread, the post replied to (when there is one), then each reply.
export function threadJsonl(input) {
  const rec = threadRecords(input);
  return [rec.head, rec.root, ...rec.replies].filter(Boolean).map((x) => JSON.stringify(x)).join("\n") + "\n";
}

const quote = (t) => String(t || "").split(/\r?\n/).map((l) => `> ${l}`).join("\n");
const when = (t) => (t ? `${t.slice(0, 10)} ${t.slice(11, 19)} UTC` : "no time shown");

function replyMarkdown(r) {
  const tags = [r.sameTextGroup ? `same-text group ${r.sameTextGroup}` : null, r.burst ? `burst ${r.burst}` : null].filter(Boolean);
  const lines = [`### @${r.author}${r.display ? ` (${r.display})` : ""} · ${when(r.posted)}`, "", quote(r.text), ""];
  if (tags.length) lines.push(`In: ${tags.join(", ")}`, "");
  for (const b of r.badges) lines.push(`- ${b.id}: ${b.evidence || "shown"}${b.doesNotProve ? `. Does not prove: ${b.doesNotProve}` : ""}`);
  if (r.badges.length) lines.push("");
  return lines.join("\n");
}

// One note to read: the thread, the timeline in words, each reply with its badges, then the limits.
export function threadMarkdown(input) {
  const { head, root, replies } = threadRecords(input);
  const out = [`# Thread on ${head.site || "a page"}`, "", `- Page: ${head.page}`, `- Saved: ${when(head.savedAt)} by ${head.tool}`, `- Replies loaded: ${head.replies}`];
  if (head.timeline) out.push(`- Timeline: ${head.timeline.sentence}`);
  for (const b of head.bursts) out.push(`- Burst ${b.n}: ${b.accounts} accounts between ${when(b.from)} and ${when(b.to)}`);
  if (head.sameTextGroups) out.push(`- Same-text groups: ${head.sameTextGroups}`);
  out.push("");
  if (root) out.push(`## The post`, "", `@${root.author} · ${when(root.posted)}`, "", quote(root.text), "");
  out.push(`## Replies`, "", ...replies.map(replyMarkdown), `## What this does not prove`, "", ...head.doesNotProve.map((t) => `- ${t}`), "");
  return out.join("\n");
}
