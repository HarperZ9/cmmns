// Badge families: every kind of signal the window can show, which area of the strip it sits in, and
// what sort of evidence it is. A detector is Radar's own rule and can be measured for precision; a
// platform family repeats the site's own label; a table family is a match against a cited table.
// measuredLine() gives the line the window and the options page show for a family.

import { MEASURED } from "./measured.js";
import { TECHNIQUES, techniqueStatus } from "./persuasion.js";

const D = "detector", P = "platform", T = "table", F = "file";
export const FAMILIES = [
  ["slur", "Slur or coded hate term", "language", D], ["stereotype", "Group stereotype", "language", D],
  ["dehumanise", "Dehumanising language", "language", D], ["violence", "Call for violence", "language", D],
  ["vigilante", "Call for vigilantes", "language", D], ["conspiracy-theory", "Named conspiracy theory", "language", D], ["leaked-ai", "Leaked AI text", "language", D],
  ["machine-writing", "Machine-writing signs", "language", D], ["spam-pattern", "Spam pattern", "language", D],
  ["x-spam", "X: probable spam", "language", P], ["hate-symbol-name", "Hate symbol in name", "language", D],
  ["old-media", "Media older than the post", "media", D], ["lifted-media", "Media from another post", "media", P],
  ["same-upload", "Same upload, many accounts", "coordination", D], ["duplicates", "Same text as other replies", "coordination", D],
  ["copied-elsewhere", "Same words in other threads", "coordination", D],
  ["cross-language", "Same link or upload in several languages", "coordination", D],
  ["laundered", "Material passed through other accounts", "sources", D],
  ["community-note", "Community Note", "sources", P], ["fact-check", "Fact-checked claim", "sources", D], ["ad", "Ad label", "sources", P],
  ["state-link", "State link", "sources", T], ["named-in-report", "Named in a published report", "sources", T],
  ["lookalike-domain", "Look-alike news address", "sources", D], ["owner", "Outlet owner", "sources", T], ["site-record", "Site facts and fact-check record", "sources", T],
  ["client", "Posting app", "posting", P], ["written-in", "Written in another language", "place", P],
  ["mismatch", "Speaks as local, labelled elsewhere", "place", D], ["store-elsewhere", "App store elsewhere", "place", D],
  ["flag-elsewhere", "Flag of another country", "place", D], ["profile-location-elsewhere", "Profile says elsewhere", "place", D],
  ["hours-elsewhere", "Active hours fit elsewhere", "place", D],
  ["fast-replier", "Replies within a minute", "posting", D], ["automation-app", "Posts through an automation app", "posting", D],
  ["no-sleep-gap", "Posts around the clock", "posting", D], ["repost-only", "Almost only reposts", "posting", D],
  ["high-volume", "Very high post rate", "posting", D],
  ["new-account", "New account", "account", D], ["name-changes", "Renamed", "account", D],
  ["default-handle", "Sign-up handle", "account", D], ["follow-pattern", "Follows many, few follow back", "account", D],
  ["low-karma", "Low karma for its age", "account", D], ["brand-lookalike", "Name borrows a brand", "account", D],
  ["c2pa", "Content Credentials", "media", F], ["c2pa-changed", "Credentials do not match", "media", F],
  ["ai-metadata", "AI-generation metadata", "media", F],
].map(([id, name, area, kind]) => ({ id, name, area, kind }));
// Persuasion techniques sit in the Language area. Their measured line comes from techniqueStatus.
const TECH = "technique";
for (const [id, t] of Object.entries(TECHNIQUES)) FAMILIES.push({ id, name: `Persuasion: ${t.name.toLowerCase()}`, area: "language", kind: TECH });

const BY_ID = new Map(FAMILIES.map((f) => [f.id, f]));
const FLAG_FAMILY = { "based-elsewhere": "mismatch", "same-text": "duplicates" };

// kind: "flag" (an account flag id from flags.js), "marker" (a rhetoric family) or "family".
export function familyOf(kind, id) {
  const f = kind === "flag" ? FLAG_FAMILY[id] || id : id;
  return BY_ID.has(f) ? f : null;
}

const pc = (x) => Math.round(x * 100);
const valid = (r) => r && Number.isFinite(r.precision) && r.precision >= 0 && r.precision <= 1 && Number.isInteger(r.n) && r.n > 0;

// { measured, text } for one family. A row without a sample size is not shown as a measurement.
export function measuredLine(id, table = MEASURED) {
  const f = BY_ID.get(id);
  if (f && f.kind === P) return { measured: false, text: "the site's own label, not a Radar detector" };
  if (f && f.kind === F) return { measured: false, text: "what the file itself declares; Radar checks the signature, not the claim" };
  if (f && f.kind === T) return { measured: false, text: "a match against a cited table; the source link is the evidence" };
  if (f && f.kind === TECH) { const st = techniqueStatus(id); return { measured: st.shown, text: st.text }; }
  const r = (table || {})[id];
  if (!valid(r)) return { measured: false, text: "not measured yet" };
  const ci = Number.isFinite(r.low) && Number.isFinite(r.high) ? ` (95% interval ${pc(r.low)} to ${pc(r.high)}%)` : "";
  const split = r.split === "test" ? ", held-out test set" : r.split ? `, ${r.split} set` : "";
  return { measured: true, text: `precision ${pc(r.precision)}%${ci}, ${r.n} badges checked${split}` };
}
