// The window's signs for the discourse checks, in the shape src/ext/signals.js draws: { label, fam,
// level, cat, rows }. All are info level: these checks are new and not yet measured on real threads
// (project-docs/DISCOURSE.md), so none of them raises a warning.
import { QUOTE_DOES_NOT_PROVE } from "./quotes.js";
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
      ["What Daylight Commons sees", `${list.lines} lines each credit a named person${list.named ? ` (${list.named} of them names Daylight Commons knows)` : ""}. ${list.sourced === 0 ? "None gives" : `${list.sourced} give`} a source.`],
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
    [...countRows(counts), ...(fromImage ? [["Read from", "the image, by Daylight Commons' own text recogniser"]] : []), ["What it shows", STATS_DOES_NOT_PROVE]])];
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

