// Finding the primary record behind a claim, for `case run`. Deterministic first: links in the
// claim's own source that point at a primary-record host (court, filing, contract, legislative,
// official post), and the post an X post quotes or answers. Where none is found, the claim gets a
// lead that names the kind of record, its likely holder, and a public search address that
// `case watch` re-checks. A configured model may propose more records; those stay proposed.
import { jsonFrom, PROMPTS } from "./models.js";

export const PRIMARY_HOSTS = [
  [/(^|\.)(courtlistener\.com|pacer\.gov|uscourts\.gov|supremecourt\.gov|justia\.com)$/, "court record", "the court clerk"],
  [/(^|\.)sec\.gov$/, "securities filing", "the SEC (EDGAR)"],
  [/(^|\.)(congress\.gov|govinfo\.gov|federalregister\.gov|clerk\.house\.gov|senate\.gov|house\.gov)$/, "legislative or regulatory record", "Congress or the issuing agency"],
  [/(^|\.)(usaspending\.gov|sam\.gov|fpds\.gov)$/, "federal contract or award record", "the awarding agency"],
  [/(^|\.)(truthsocial\.com|x\.com|twitter\.com|bsky\.app)$/, "original post", "the platform"],
  [/(^|\.)(gov|gov\.uk|europa\.eu|un\.org)$|\.gov$/, "government record", "the issuing government body"],
];

const SOCIAL = /(^|\.)(truthsocial\.com|x\.com|twitter\.com|bsky\.app)$/;
const POST_PATH = /\/status(es)?\/\d+|\/@[^/]+\/\d+|\/post\/[a-z0-9]+/i;

export function primaryKind(url) {
  let host = "", path = "";
  try { const u = new URL(url); host = u.hostname.toLowerCase(); path = u.pathname; } catch { return null; }
  if (SOCIAL.test(host) && !POST_PATH.test(path)) return null;   // profiles and share buttons are not records
  for (const [re, kind, holder] of PRIMARY_HOSTS) if (re.test(host)) return { kind, holder, host };
  return null;
}

// Absolute links in captured bytes: href attributes in HTML, expanded URLs in an X record.
export function linksIn(bytes) {
  const s = Buffer.isBuffer(bytes) ? bytes.toString("utf8") : String(bytes || "");
  const out = new Set();
  try { const j = JSON.parse(s); for (const u of (j.entities && j.entities.urls) || []) if (u.expanded_url) out.add(u.expanded_url); return [...out]; } catch { /* HTML or text */ }
  for (const m of s.matchAll(/href\s*=\s*["'](https?:\/\/[^"'#\s]+)["']/gi)) out.add(m[1].replace(/&amp;/g, "&"));
  return [...out];
}

const STOP = new Set(["The", "A", "An", "On", "In", "At", "It", "He", "She", "They", "We", "This", "That", "But", "And", "Or", "If", "As", "For", "To", "Of", "By"]);
export function searchTerms(text, n = 6) {
  const w = String(text).match(/\b(\p{Lu}[\p{L}'’.-]+|\d[\d,.$%]*)/gu) || [];
  return [...new Set(w.filter((x) => !STOP.has(x)))].slice(0, n).join(" ");
}

const KINDS = [
  [/\b(court|judge|lawsuit|indict|charged|warrant|ruling|docket|plaintiff|prosecut)/i, "court record", "the court clerk", (q) => `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(q)}`],
  [/\b(filing|10-[QK]|8-K|S-1|shares|stock|IPO|earnings|SEC)\b/, "securities filing", "the SEC (EDGAR)", (q) => `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${q}"`)}`],
  [/\b(contract|award|task order|procure|Pentagon|DoD|agency|grant)\b/i, "federal contract or award record", "the awarding agency", (q) => `https://www.federalregister.gov/api/v1/documents.json?conditions[term]=${encodeURIComponent(q)}`],
  [/\b(Congress|Senate|House of Representatives|congressional)\b/, "legislative record", "Congress", (q) => `https://www.congress.gov/search?q=${encodeURIComponent(JSON.stringify({ source: "all", search: q }))}`],
  [/\b(bill|vote|voted|votes|council|parliament|assembly|amendment|hearing|minutes)\b/i, "legislative or council record (minutes, votes)", "the legislature or council named in the claim", null],
];

// A lead for a claim with no primary record in hand.
export function leadFor(claim) {
  const q = searchTerms(claim.text);
  const k = KINDS.find(([re]) => re.test(claim.text));
  const [, kind, holder, url] = k || [null, "original statement or document", "the person or body quoted", null];
  return { question: `What primary record settles ${claim.id}: "${claim.text.slice(0, 160)}"?`, record: kind, holder, access: url ? "public" : k ? "request" : "unknown", decisive: claim.rung === "unproven" ? 4 : 3, claims: [claim.id], path: url ? "public search, re-checked by case watch" : "ask the holder", check_url: url ? url(q) : null, search_terms: q, status: "open" };
}

// Model-proposed records for one claim: [{ record, holder, query }], or [] when the reply is not usable.
export async function modelQueries(model, claim) {
  const reply = jsonFrom(await model.complete(PROMPTS.queries(claim.text)));
  return (Array.isArray(reply) ? reply : []).filter((x) => x && typeof x.record === "string").slice(0, 5).map((x) => ({ record: x.record, holder: typeof x.holder === "string" ? x.holder : null, query: typeof x.query === "string" ? x.query : null }));
}
