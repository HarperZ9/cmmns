// Cross-language repetition: one link, one upload or one fact-checked claim carried by replies in
// different languages from different accounts. RAND's "firehose" model and Rauch's account of
// flooding both describe one claim pushed through many channels at once; a campaign that reaches
// several language communities with the same material leaves this trace (project-docs/TECHNIQUES.md).
// Daylight Commons matches the material, never the wording: a translation of a claim matches only when a
// fact-checker reviewed the claim and both posts match that review. Language comes from the
// platform's own code (X's "lang"); without one, a distinct writing system stands in, and Latin
// text without a code counts as unknown. The rule is the same for every language and account.

import { normLink } from "./trail.js";

export const MIN_ACCOUNTS = 2;
export const CROSS_DOES_NOT_PROVE = "This shows the same material crossing languages. Multilingual people, translators, news agencies and diaspora communities share links and videos this way too.";

const SCRIPTS = [["Kore", /\p{Script=Hangul}/u], ["Jpan", /[\p{Script=Hiragana}\p{Script=Katakana}]/u], ["Hani", /\p{Script=Han}/u],
  ["Hebr", /\p{Script=Hebrew}/u], ["Arab", /\p{Script=Arabic}/u], ["Cyrl", /\p{Script=Cyrillic}/u], ["Deva", /\p{Script=Devanagari}/u],
  ["Thai", /\p{Script=Thai}/u], ["Grek", /\p{Script=Greek}/u], ["Beng", /\p{Script=Bengali}/u], ["Geor", /\p{Script=Georgian}/u], ["Armn", /\p{Script=Armenian}/u]];

// The first distinct writing system in the text, or null (Latin, digits, emoji, nothing).
export function scriptOf(text) {
  const s = String(text || "");
  for (const [code, re] of SCRIPTS) if (re.test(s)) return code;
  return null;
}

// Older codes Twitter still emits for Indonesian, Hebrew and Yiddish.
const OLD = { in: "id", iw: "he", ji: "yi" };
const code = (c) => { const x = String(c).toLowerCase(); return OLD[x] || x; };

// A reply's language: the platform's code, else "script:<code>", else null.
export function langOf(r) {
  if (r && r.lang) return code(r.lang);
  const sc = scriptOf(r && r.text);
  return sc ? "script:" + sc : null;
}

// The items a reply carries: [[kind, key]]. Media lifted from another post has no file key here.
function itemsOf(r) {
  const out = [];
  for (const u of r.links || []) { const k = normLink(u); if (k) out.push(["link", k]); }
  for (const m of r.media || []) if (m && m.url && !m.fromPost) out.push(["media", m.url]);
  for (const c of r.claims || []) if (c && c.url) out.push(["claim", c.url]);
  return out;
}

// Two different accounts writing in two different languages among the posts carrying one item. An
// account that carried the item in more than one language is a translator here, not a second
// community, so it does not count toward the crossing.
function crosses(posts) {
  const known = posts.filter((p) => p.lang);
  const platform = known.filter((p) => !p.lang.startsWith("script:"));
  const use = platform.length ? platform : known;
  const langsOf = new Map();
  for (const p of use) { if (!langsOf.has(p.author)) langsOf.set(p.author, new Set()); langsOf.get(p.author).add(p.lang); }
  const single = [...langsOf].filter(([, ls]) => ls.size === 1).map(([, ls]) => [...ls][0]);
  return new Set(single).size >= 2 ? { use, basis: platform.length ? "platform" : "script" } : null;
}

function summarise(kind, key, posts, hit) {
  const langs = [...new Set(hit.use.map((p) => p.lang))].sort();
  return { kind, key, langs, accounts: new Set(posts.map((p) => p.author)).size, ids: posts.map((p) => p.id), basis: hit.basis };
}

// rows: [{ id, author, lang, text, links, media, claims }]; root: the post replied to, or null.
// Returns the items carried in two or more languages, most accounts first. The root post's own
// links and uploads are set aside: replies in many languages carrying the post they answer are
// people reacting to it, and on ordinary threads that made 167 of 177 groups (EVALUATION.md).
export function crossLanguage(rows, { root = null } = {}) {
  const skip = new Set(root ? itemsOf(root).map(([kind, key]) => kind + "|" + key) : []);
  const by = new Map();
  for (const r of rows || []) {
    const lang = langOf(r), author = String(r.author || "").toLowerCase();
    for (const [kind, key] of itemsOf(r)) {
      const k = kind + "|" + key;
      if (skip.has(k)) continue;
      if (!by.has(k)) by.set(k, { kind, key, posts: [] });
      const g = by.get(k);
      if (!g.posts.some((p) => p.id === r.id)) g.posts.push({ id: r.id, author, lang });
    }
  }
  const out = [];
  for (const g of by.values()) {
    if (new Set(g.posts.map((p) => p.author)).size < MIN_ACCOUNTS) continue;
    const hit = crosses(g.posts);
    if (hit) out.push(summarise(g.kind, g.key, g.posts, hit));
  }
  return out.sort((a, b) => b.accounts - a.accounts || b.langs.length - a.langs.length);
}

// Across the threads the user viewed: the post's links and uploads whose spread in the trail log
// (src/core/trail.js) crosses languages. t: a tweet as tweetsIn() returns it.
export function acrossViewed(t, log) {
  if (!t) return [];
  const out = [];
  const tables = [["link", (log && log.links) || {}, (t.links || []).map(normLink)], ["media", (log && log.media) || {}, (t.media || []).filter((m) => m.url && !m.fromPost).map((m) => m.url)]];
  for (const [kind, table, keys] of tables) {
    for (const key of keys) {
      const s = key && table[key];
      if (!s) continue;
      const posts = s.posts.map((p) => ({ id: p.id, author: p.handle, lang: p.lang ? code(p.lang) : null }));
      const hit = new Set(posts.map((p) => p.author)).size >= MIN_ACCOUNTS && crosses(posts);
      if (hit) out.push({ ...summarise(kind, key, posts, hit), across: true });
    }
  }
  return out;
}
