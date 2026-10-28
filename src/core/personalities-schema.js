// The evidence rule for documented backing of public media personalities (data/personalities-sources/,
// built into src/ext/personalities.json by scripts/personalities-build.mjs). One rule set for every
// person. Nothing here reads a person's name, country, outlet or political position:
// tests/personalities.symmetry.test.js checks that relabelling those never changes the result, and
// that this file names no person, outlet or side. Build-time only; the extension does not load it.

export const KINDS = [
  "employer", "outlet owner", "investor", "licensing deal", "network", "sponsor", "paid promotion",
  "government advertising", "grant", "nonprofit funding", "state funding", "public funding", "FARA filing",
  "court record", "sanction", "campaign finance", "lobbying", "platform label", "government label", "investigative reporting",
];
export const STATUSES = ["documented", "reported", "alleged"];
// Who wrote the source. Primary kinds are the backer's, the person's, a court's, a government's, a
// filing's or a platform's own words; "press" and "researcher" report on them.
export const SOURCE_KINDS = ["self", "company", "court", "government", "filing", "platform", "press", "researcher"];
export const PRIMARY = new Set(["self", "company", "court", "government", "filing", "platform"]);
export const PLATFORMS = ["x", "youtube", "tiktok", "instagram", "facebook", "bluesky", "threads", "podcast", "tv", "web"];
export const SELECTIONS = ["audience", "named in a primary record", "named in two independent reports"];
export const TOPICS = ["politics and current affairs", "lifestyle with political content"];
export const MAX_QUOTE_WORDS = 30;
export const MATCHED = new Set(["exact", "loose"]);

// Words CMMNS never uses about a person, even inside a quote, and words that turn association into a
// claim of backing.
export const LOADED = /\b(propagandists?|propaganda|shills?|bots?|trolls?|puppets?|stooges?|mouthpieces?|conspiracy theorists?)\b/i;
export const ASSOCIATION = /\b(appeared (?:on|at|with)|follows|followed by|met with|attended|spoke at|was seen with|is close to|ties to)\b/i;
// Fields that would carry private or personal data. None may appear on a person, a row or a source.
export const PRIVATE_KEYS = /^(address|street|home|phone|mobile|email|e-mail|salary|pay|income|networth|net_worth|netWorth|wealth|spouse|wife|husband|partner|children|child|kids|family|relatives|parents|birthdate|birthday|dob|dateOfBirth|age|ssn|passport|bank|iban)$/i;
// Money in CMMNS' own words is allowed only where a filing is the backing itself.
const MONEY = /[$€£₹]\s?\d|\b\d[\d,.]*\s?(million|billion|dollars|euros|pounds|rupees)\b/i;
const MONEY_OK = new Set(["FARA filing", "campaign finance", "lobbying", "court record", "grant", "nonprofit funding", "government advertising"]);

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9][a-z0-9-]{1,80}$/;
const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
const text = (v, min) => typeof v === "string" && v.trim().length >= min;
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };

// Keys anywhere in an object tree that name private data.
export function privateKeys(obj, path = "") {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj).flatMap(([k, v]) => [...(PRIVATE_KEYS.test(k) ? [`${path}${k}`] : []), ...privateKeys(v, `${path}${k}.`)]);
}

export function sourceProblems(s, where) {
  const out = [];
  if (!s || !/^https:\/\/\S+$/.test(s.url || "")) out.push(`${where}: url must be https`);
  if (!s || !text(s.publisher, 2)) out.push(`${where}: no publisher`);
  if (!s || !SOURCE_KINDS.includes(s.kind)) out.push(`${where}: kind must be one of ${SOURCE_KINDS.join(", ")}`);
  if (!s || !DAY.test(s.read || "")) out.push(`${where}: read must be the date the page was read (YYYY-MM-DD)`);
  if (s && s.date != null && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(s.date)) out.push(`${where}: date must be YYYY, YYYY-MM or YYYY-MM-DD`);
  if (!s || !text(s.quote, 2)) out.push(`${where}: no quote of the supporting sentence`);
  else if (words(s.quote) > MAX_QUOTE_WORDS) out.push(`${where}: quote over ${MAX_QUOTE_WORDS} words`);
  if (s && LOADED.test(s.quote || "")) out.push(`${where}: quote carries a word CMMNS never shows about a person`);
  return out;
}

// The status a row's sources allow: a court record is an allegation until a verdict; anything else is
// documented when a primary source carries it and reported when only the press or researchers do.
export function statusAllowed(row) {
  if (row.kind === "court record") return ["alleged"];
  const primary = (row.sources || []).some((s) => PRIMARY.has(s.kind));
  return primary ? ["documented", "reported", "alleged"] : ["reported", "alleged"];
}

export function rowProblems(row, where) {
  const out = [];
  if (!row || !ID.test(row.id || "")) out.push(`${where}: row without an id`);
  if (!KINDS.includes(row.kind)) out.push(`${where}: kind must be one of ${KINDS.join(", ")}`);
  if (!STATUSES.includes(row.status)) out.push(`${where}: status must be one of ${STATUSES.join(", ")}`);
  else if (!statusAllowed(row).includes(row.status)) out.push(`${where}: status ${row.status} is stronger than its sources allow`);
  for (const k of ["who", "summary", "doesNotProve"]) if (!text(row[k], k === "who" ? 2 : 20)) out.push(`${where}: no ${k}`);
  for (const k of ["who", "summary", "doesNotProve"]) if (LOADED.test(row[k] || "")) out.push(`${where}: ${k} carries a word CMMNS never uses about a person`);
  if (ASSOCIATION.test(row.summary || "")) out.push(`${where}: summary infers backing from association`);
  if (MONEY.test(row.summary || "") && !MONEY_OK.has(row.kind)) out.push(`${where}: summary states an amount; amounts appear only where a filing is the backing`);
  if (!Array.isArray(row.sources) || !row.sources.length) out.push(`${where}: no source`);
  else row.sources.forEach((s, i) => out.push(...sourceProblems(s, `${where} source ${i}`)));
  if (row.kind === "investigative reporting" && new Set((row.sources || []).filter((s) => s.kind === "press").map((s) => host(s.url))).size < 2) out.push(`${where}: investigative reporting needs two independent outlets`);
  if (row.outlet != null && (!ID.test(row.outlet) || typeof row.current !== "boolean")) out.push(`${where}: an outlet reference needs an outlet id and current: true or false`);
  return out;
}

export function personProblems(p) {
  const where = (p && p.id) || "?";
  const out = privateKeys(p).map((k) => `${where}: private field ${k}`);
  if (!ID.test(p.id || "")) out.push(`${where}: bad id`);
  if (!text(p.name, 2) || !text(p.role, 3)) out.push(`${where}: needs a public name and a public role`);
  if (LOADED.test(p.role || "")) out.push(`${where}: role carries a word CMMNS never uses about a person`);
  if (!SELECTIONS.includes(p.selection)) out.push(`${where}: selection must be one of ${SELECTIONS.join(", ")}`);
  if (!TOPICS.includes(p.topic)) out.push(`${where}: topic must be one of ${TOPICS.join(", ")}`);
  for (const a of p.accounts || []) {
    if (!PLATFORMS.includes(a.platform) || !text(a.handle, 1)) out.push(`${where}: account needs a platform and a handle`);
  }
  for (const r of p.backing || []) out.push(...rowProblems(r, `${where}/${r.id}`));
  for (const l of p.leads || []) if (!text(l.claim, 5) || !text(l.result, 5)) out.push(`${where}: a lead needs its claim and why it stays unverified`);
  return out;
}

// Confidence, from the sources and the quote check alone (never from who the person is):
// high when a primary source's quote was found on its page, moderate when quotes were found on two
// sites, low otherwise.
export function confidenceOf(row, checks) {
  const ok = row.sources.filter((s, i) => MATCHED.has(checks[i]));
  if (ok.some((s) => PRIMARY.has(s.kind))) return "high";
  if (new Set(ok.map((s) => host(s.url))).size >= 2) return "moderate";
  return "low";
}
// A row ships only when at least one of its quotes was found on its page by the quote check, and when
// every kind of record it rests on (a court record, a filing, a government or platform document) is
// confirmed by at least one source of that kind whose quote was found. A row whose filing could not
// be read is held back, even when a press report about it could.
const RECORD_KINDS = new Set(["court", "filing", "government", "platform"]);
export function shippable(row, checks) {
  if (!row.sources.some((s, i) => MATCHED.has(checks[i]))) return false;
  const cited = new Set(row.sources.filter((s) => RECORD_KINDS.has(s.kind)).map((s) => s.kind));
  return [...cited].every((k) => row.sources.some((s, i) => s.kind === k && MATCHED.has(checks[i])));
}
