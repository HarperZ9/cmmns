// Text tools for the launch campaign lens (project-docs/CAMPAIGN-LENS.md): bio and quote skeletons,
// template groups, stock-persona cues, topic families and the promo-template provider interface.
//
// Banned features: nothing here reads the language or script of a text, a place, or a name's
// origin. A skeleton masks capitalised words (names, places), numbers, cashtags and runs of
// non-Latin letters, so two bios cut from one template group together whatever place or script
// fills their slots, and a bio naming a country is treated exactly like one naming any other.

// Runs of letters in non-Latin scripts become the same slot token as a capitalised word, so a slot
// filled in any script reads the same and the template's fixed words carry the match.
const NON_LATIN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Thai}\p{Script=Cyrillic}\p{Script=Greek}]+/gu;

// A bio or quote -> its skeleton tokens. A token with no Latin letter is a slot, whatever its
// script (this also catches marks such as the katakana length mark, which belong to no one script).
// Known limit: a template whose fixed words are not in Latin script is not grouped. That lowers
// recall for those bios and is reported per stratum in the fairness audit (EVALUATION.md).
export function skeleton(text) {
  const s = String(text || "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\$[A-Za-z]{2,10}\b/g, " TOKEN ")
    .replace(/@\w+/g, " HANDLE ")
    .replace(NON_LATIN, " WORD ")
    .replace(/\d+/g, " NUM ");
  const toks = s.match(/[\p{L}\p{N}]+/gu) || [];
  return toks.map((t) => (t === "TOKEN" || t === "HANDLE" || t === "NUM" ? t : t === "WORD" || !/\p{Script=Latin}/u.test(t) || /^\p{Lu}/u.test(t) ? "SLOT" : t.toLowerCase()));
}

// Word 3-shingles of a skeleton; slot-only shingles are dropped, so two bios match on the
// template's fixed words, not on the slots they share by chance.
const SLOTS = new Set(["TOKEN", "HANDLE", "NUM", "SLOT"]);
export function skeletonShingles(text, k = 3) {
  const t = skeleton(text), out = new Set();
  for (let i = 0; i + k <= t.length; i++) {
    const g = t.slice(i, i + k);
    if (g.some((w) => !SLOTS.has(w))) out.add(g.join(" "));
  }
  return out;
}

export function jaccardSets(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export const TEMPLATE_JACCARD = 0.5, TEMPLATE_MIN_GROUP = 3, TEMPLATE_MIN_SHINGLES = 3;

// items: [{ id, text }] -> groups of ids whose skeletons share a template: [{ ids, size }],
// largest first. Single linkage over pairs at TEMPLATE_JACCARD or more.
export function templateGroups(items, { min = TEMPLATE_MIN_GROUP, jaccard = TEMPLATE_JACCARD } = {}) {
  const xs = (items || []).map((it) => ({ id: it.id, sh: skeletonShingles(it.text) })).filter((x) => x.sh.size >= TEMPLATE_MIN_SHINGLES);
  const parent = xs.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) if (jaccardSets(xs[i].sh, xs[j].sh) >= jaccard) parent[find(i)] = find(j);
  const by = new Map();
  xs.forEach((x, i) => { const r = find(i); by.set(r, [...(by.get(r) || []), x.id]); });
  return [...by.values()].filter((ids) => ids.length >= min).map((ids) => ({ ids, size: ids.length })).sort((a, b) => b.size - a.size);
}

// Stock-persona cue families (English phrases). A bio in another language matches none of them,
// which lowers recall and never raises suspicion.
export const PERSONA_CUES = {
  age: /\b(?:age\s*\d{2}|\d{2}\s*(?:years?|yrs?)[\s-]*old|\d{2}\s*y\/?o)\b/i,
  passion: /\b(?:passionate about|obsessed with|in love with|addicted to|enthusiast|lover of)\b/i,
  crypto: /\$[A-Za-z]{2,10}\b|\b(?:crypto(?:currency)? is the future|hodl(?:ing|er)?|stacking (?:sats|[A-Z]{2,6})|web3|degen|to the moon|wbtc|btc|eth|nft)\b/i,
  pet: /\b(?:cat|dog) (?:person|lover|mom|dad|parent)\b/i,
  filler: /\b(?:here for the memes|like a pro|chasing dreams|still young at heart|enjoying life|living my best life|just vibing|dreamer|hustling)\b/i,
};
export const PERSONA_MIN_FAMILIES = 3;

export function personaCues(bio) {
  const s = String(bio || "");
  return Object.keys(PERSONA_CUES).filter((k) => PERSONA_CUES[k].test(s));
}

// Topic families a bio or post can be dominated by. "unknown" when none matches: the lens never
// counts an unknown topic as a mismatch.
export const CAMPAIGN_TOPICS = {
  crypto: /\$[A-Za-z]{2,10}\b|\b(?:crypto|bitcoin|btc|eth|wbtc|solana|memecoin|airdrop|defi|web3|nft|token|hodl)\b/i,
  gambling: /\b(?:casino|betting|slots|jackpot|sportsbook)\b/i,
  adult: /\b(?:onlyfans|18\+|nsfw|spicy content)\b/i,
  tech: /\b(?:ai|llm|model|coding|developer|software|open[- ]source|gpu|benchmark|agent|startup|api|machine learning|data)\b/i,
};

export function topicsOf(text) {
  const s = String(text || "");
  return Object.keys(CAMPAIGN_TOPICS).filter((k) => CAMPAIGN_TOPICS[k].test(s));
}

// Promo-template cues. A provider maps a text to { cues: [{ id, match, source }] }. Articulate's
// promo-template detector is expected to ship its list as a JSON pack (providerFromPack); without
// one, LOCAL_PROMO runs.
export const LOCAL_PROMO = [
  ["sir-opener", /^\s*sir\s*(?:\.{2,}|…)/i],
  ["just-dropped", /\b(?:they|[A-Z]\w+) just (?:dropped|released|launched|shipped)\b/i],
  ["changes-everything", /\b(?:this|it) changes everything\b/i],
  ["game-changer", /\bgame[- ]?changer\b/i],
  ["is-insane", /\b(?:is|are|looks) (?:insane|wild|unreal|crazy)\b/i],
  ["need-to-try", /\byou (?:need|have) to try\b/i],
  ["not-talking-enough", /\bnobody is talking about\b|\bwhy is no ?one talking about\b/i],
];

export function localProvider(text) {
  const s = String(text || "");
  return { cues: LOCAL_PROMO.map(([id, re]) => { const m = s.match(re); return m ? { id, match: m[0].trim(), source: "radar-local" } : null; }).filter(Boolean) };
}

// A JSON pack { version, templates: [{ id, pattern, flags?, source? }] } -> a provider. Patterns
// that do not compile are skipped and listed, never thrown, so one bad entry cannot stop the lens.
export function providerFromPack(pack) {
  const bad = [], list = [];
  for (const t of (pack && pack.templates) || []) {
    try { list.push([String(t.id), new RegExp(t.pattern, String(t.flags || "i").replace(/[^imsu]/g, "")), String(t.source || "articulate")]); } catch (e) { bad.push(t && t.id); }
  }
  const fn = (text) => { const s = String(text || ""); return { cues: list.map(([id, re, source]) => { const m = s.match(re); return m ? { id, match: m[0].trim(), source } : null; }).filter(Boolean) }; };
  fn.skipped = bad;
  return fn;
}

let provider = null;
export function setPromoTemplateProvider(fn) { provider = typeof fn === "function" ? fn : null; }
export function promoCues(text) {
  if (provider) {
    try { return provider(text).cues || []; } catch (e) { console.error("[cmmns] promo-template provider failed; using the local list", e); }
  }
  return localProvider(text).cues;
}

// Articulate's campaign detectors (HarperZ9/articulate PR #40, `articulate campaign FILE --platform x
// --json`, report format articulate-campaign-report/1, first in the release after 0.12.0). Articulate
// is Python and does not run in the browser, so the route is by file, on the user's machine:
// articulateInput() writes the input list (texts only, no handles), Articulate writes the report,
// and providerFromReport() turns it into a promo-template provider. Without a report, LOCAL_PROMO runs.
export const ARTICULATE_REPORT_FORMAT = "articulate-campaign-report/1";

// quotes: [{ id, text }], bios: [string] -> the schema's input list.
export function articulateInput({ quotes = [], bios = [] } = {}, platform = "x") {
  return [
    ...quotes.filter((q) => q && q.text).map((q) => ({ id: `q:${q.id}`, text: String(q.text), kind: "post", platform })),
    ...bios.filter(Boolean).map((b, i) => ({ id: `b:${i}`, text: String(b), kind: "bio", platform })),
  ];
}

// report: the parsed Articulate report; input: the list it was run on. Returns a provider keyed by
// exact text, with .personaTemplates (bio items Articulate scored as templates) and .clusters, or
// throws on a report of another format so a mismatch is never read silently.
export function providerFromReport(report, input) {
  if (!report || report.format !== ARTICULATE_REPORT_FORMAT) throw new Error(`expected ${ARTICULATE_REPORT_FORMAT}, got ${report && report.format}`);
  const textOf = new Map((input || []).map((x) => [String(x.id), x.text]));
  const byText = new Map();
  for (const it of report.items || []) {
    const t = textOf.get(String(it.id));
    if (t == null) continue;
    const cues = (it.findings || []).filter((f) => f.category === "promo").map((f) => ({ id: f.rule_id || f.label, match: f.match, source: "articulate", tier: f.tier }));
    byText.set(t, cues);
  }
  const fn = (text) => ({ cues: byText.get(String(text)) || localProvider(text).cues });
  fn.personaTemplates = (report.items || []).filter((it) => it.kind === "bio" && it.template).length;
  fn.clusters = (report.clusters || []).map((c) => ({ size: c.size, kind: c.kind, skeleton: c.skeleton }));
  fn.doesNotProve = report.does_not_prove || null;
  return fn;
}
