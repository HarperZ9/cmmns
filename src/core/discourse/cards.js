// The window's signs for the discourse checks, in the shape src/ext/signals.js draws: { label, fam,
// level, cat, rows }. All are info level: these checks are new and not yet measured on real threads
// (project-docs/DISCOURSE.md), so none of them raises a warning.
import { QUOTE_DOES_NOT_PROVE } from "./quotes.js";
import { ARGUMENT_GATE } from "./argument-measured.js";
import { countRows, STATS_DOES_NOT_PROVE } from "./stats.js";
import { docRows } from "./docclaim.js";
import { correctionRows } from "./corrections.js";

const sign = (label, fam, cat, rows) => ({ label, fam, level: "info", cat, rows });
const workLine = (w) => `${w.title}, ${w.author}${w.translator ? `, translated by ${w.translator}` : ""}${w.year ? ` (${w.year})` : ""}`;
const link = (w) => (w.link ? [["Read it", { links: [[w.link.replace(/^https?:\/\//, "").slice(0, 48), w.link]] }]] : []);

// One quote lookup's rows.
function quoteRows(r) {
  const q = ["Quote", `"${r.quote.length > 160 ? r.quote.slice(0, 160) + " …" : r.quote}"${r.by ? `, credited to ${r.by}` : ""}`];
  if (r.status === "found" || r.status === "close") {
    return [q, ["Found", r.status === "found" ? `In ${workLine(r.work)}, ${r.locator}.` : `A close paraphrase of ${workLine(r.work)}, ${r.locator}. The wording differs; about ${Math.round(r.share * 100)}% of its meaning words are in the passage.`],
      ["The passage", r.passage], ...(r.otherAuthor ? [["Credited to", `The post credits ${r.by}; the passage is from ${r.work.author}.`]] : []), ...link(r.work)];
  }
  if (r.status === "misattributed") {
    const e = r.entry;
    return [q, ["Listed as misattributed", `Commonly credited to ${e.creditedTo}. ${e.finding}`], ["Source", { links: [[e.sourceTitle, e.source]] }]];
  }
  if (r.status === "attested") {
    const e = r.entry;
    return [q, ["Attested", `${e.finding} The work is not in the index, so the wording shown is from the cited source.`], ["Source", { links: [[e.sourceTitle, e.source]] }]];
  }
  const s = r.searched || {};
  return [q, ["Not found", `Not in the ${s.works || 0} works the index holds${s.byPerson && s.byPerson.length ? `, including ${s.byPerson.slice(0, 3).join("; ")}` : r.by ? `, none of them by ${r.by}` : ""}. This proves nothing: most of what anyone wrote is not in the index.`]];
}

const STATUS = { found: "quote found", close: "close paraphrase", misattributed: "quote listed as misattributed", attested: "quote attested", "not-found": "quote not found in the index" };

export function quoteSigns(results, list) {
  const out = (results || []).map((r) => sign(STATUS[r.status], "quote-source", "sources", [...quoteRows(r), ["What it shows", QUOTE_DOES_NOT_PROVE]]));
  if (list && list.lines >= 3) {
    out.push(sign(`${list.lines} lines credited to names, ${list.sourced} sourced`, "quote-list", "sources", [
      ["What CMMNS sees", `${list.lines} lines each credit a named person${list.named ? ` (${list.named} of them names CMMNS knows)` : ""}. ${list.sourced === 0 ? "None gives" : `${list.sourced} give`} a source.`],
      ...(list.short ? [["Too short to look up", `${list.short} ${list.short === 1 ? "line is" : "lines are"} under five words, too short to find in any text.`]] : []),
      ["What it shows", "A list of one-line sayings without sources is a common format for misattributed quotes. Some lines may still be fair summaries of a person's view."],
    ]));
  }
  return out;
}

export function personaSign(p) {
  return p ? [sign(p.label, "persona", "account", p.rows)] : [];
}

export function countSigns(counts, fromImage = false) {
  if (!counts || !counts.length) return [];
  return [sign(`${counts.length === 1 ? "a count" : counts.length + " counts"} with ${counts.length === 1 ? "its" : "their"} sample size${fromImage ? " (in image)" : ""}`, "sample-size", "sources",
    [...countRows(counts), ...(fromImage ? [["Read from", "the image, by CMMNS' own text recogniser"]] : []), ["What it shows", STATS_DOES_NOT_PROVE]])];
}

export function docSign(r) {
  if (!r) return [];
  const label = r.absent.length ? `${r.absent.length} of the post's terms not on the pages shown` : "the post's terms are on the pages shown";
  return [sign(label, "doc-claim", "sources", docRows(r))];
}

export function correctionSign(ranked) {
  if (!ranked || !ranked.length) return [];
  return [sign(`${ranked.length} ${ranked.length === 1 ? "reply brings a source or names" : "replies bring a source or name"} an error`, "correction-replies", "sources", correctionRows(ranked))];
}


// A sign's rows as plain text for a study note: "Heading: value", links as their addresses, and
// buttons left out. The sidecar keeps these under "## Analysis: <label>" (project-docs/SIDECAR-FORMAT.md).
function rowText([h, v]) {
  if (v && typeof v === "object") return v.links ? `${h ? h + ": " : ""}${v.links.map(([t, u]) => `${t} (${u})`).join("; ")}` : null;
  return h ? `${h}: ${v}` : String(v);
}

// The discourse signs of one post as study notes and the ids of the analyses they carry.
export function studyNotes(signs) {
  const keep = (signs || []).filter((s) => s && s.fam && s.rows && !s.rows.some(([, v]) => v && typeof v === "object" && v.action));
  return {
    notes: keep.map((s) => ({ label: `Analysis: ${s.label}`, text: s.rows.map(rowText).filter(Boolean).join("\n") })),
    analysis: [...new Set(keep.map((s) => s.fam))],
  };
}

// The argument lens's gate (project-docs/ARGUMENT-LENS.md): a role shows by default only when its own
// held-out precision is 0.8 or more, from at least 3 hits, against two annotators' agreement. No role
// has been measured yet, so every role is shown as a plain segment unless "Every argument role" is on.
export const roleShown = (role, all, gate = ARGUMENT_GATE) => all || !!(gate[role] && gate[role].precision >= 0.8 && gate[role].hits >= 3);

export function argumentSign(r, { all = false, gate = ARGUMENT_GATE } = {}) {
  if (!r || r.segments.length < 2 || !r.segments.some((s) => s.opener)) return [];
  const rows = r.segments.map((s, i) => [roleShown(s.role, all, gate) ? `${i + 1}. ${s.role}` : `${i + 1}. segment`, `${s.opener ? `[${s.opener.form}] ` : ""}${s.text.length > 140 ? s.text.slice(0, 140) + " …" : s.text}`]);
  const moves = r.units.map((u) => u.movement);
  return [sign(`argument: ${r.segments.length} segments, ${r.units.length} ${r.units.length === 1 ? "movement" : "movements"}`, "argument-structure", "language", [
    ...rows,
    ["Movements", moves.join(", ")],
    ["Language", r.lang],
    ["Roles", all ? "Every role is shown, measured or not; none has passed its held-out gate yet." : "Roles show once their held-out precision passes; until then each part reads as a segment."],
    ["What it shows", "A connective is what the author says links two claims. The lens shows that the author marks a part as following; it does not show that it follows."],
  ])];
}

export function claimTypeSign(types) {
  if (!types || !types.length) return [];
  const kinds = [...new Set(types.map((t) => t.type))];
  return [sign(`claims: ${kinds.join(", ")}`, "claim-type", "language", [
    ...types.slice(0, 8).map((t) => [t.type, `"${t.text.length > 120 ? t.text.slice(0, 120) + " …" : t.text}" (${t.cue})`]),
    ...types.flatMap((t) => t.labels || []).filter((h) => h.status === "label").slice(0, 5).map((h) => [`label (${h.kind})`, `"${h.text}": the epithet "${h.epithet}", ${h.severity} ${h.severity === 1 ? "word" : "words"}`]),
    ["What it shows", "A claim type is read from wording cues, so a sentence can carry two kinds, and irony or quotation can mislead the cue. It says what kind of claim the words make, not whether the claim is true."],
  ])];
}

export function gapSign(gaps) {
  if (!gaps || !gaps.length) return [];
  return [sign(`${gaps.length} inference ${gaps.length === 1 ? "gap" : "gaps"}`, "inference-gap", "language", [
    ...gaps.slice(0, 5).map((g) => [g.kind === "mind" ? `about someone's mind ("${g.cue}")` : `conclusion ("${g.cue}")`, `${g.why} "${g.text.length > 120 ? g.text.slice(0, 120) + " …" : g.text}"`]),
    ["What it shows", "An inference can be sound even when its words are new, and a claim about someone's intent can be right. The marker shows where the post goes beyond what it states; it does not say the conclusion is wrong."],
  ])];
}

export function reframingSign(r, rows) {
  return r ? [sign(`reframes ${r.shared.length} named parts of its sources`, "reframing", "sources", rows(r))] : [];
}
