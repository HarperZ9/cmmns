// Evidence cards: one thread, as one viewer saw it, in a form to save or share. A card carries the
// thread report, fact-check matches, media and site context, where each part came from and what
// it does not prove, and a SHA-256 hash of its own content so a copy can be checked.
//
// A card is never about one person. It names no account, not even the original poster (an X link
// is rewritten to its /i/status/ form), and it is refused for a page that is not a thread or a
// thread with fewer than MIN_CARD_ACCOUNTS distinct reply accounts.

import { REPORT_DOES_NOT_PROVE } from "./report.js";
import { CLAIM_ATTRIBUTION, CLAIM_DOES_NOT_PROVE } from "./claims.js";
import { credentialState } from "./c2pa.js";
import { CREDENTIALS_DO_NOT_PROVE } from "./mediacheck.js";

export const MIN_CARD_ACCOUNTS = 5, CARD_VERSION = 1;
const r3 = (x) => Math.round(x * 1000) / 1000;
const ci = (c) => (Array.isArray(c) ? c.map(r3) : null);

// Keeps the thread's address and drops whatever names a person or tracks the visit.
export function cardPage(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const keep = ["v", "story_fbid", "id"];
  const q = new URLSearchParams([...u.searchParams].filter(([k]) => keep.includes(k)));
  let path = u.pathname;
  if (/^(www\.)?(x|twitter)\.com$/.test(u.hostname)) { const m = path.match(/\/status\/(\d+)/); if (m) path = `/i/status/${m[1]}`; }
  return `${u.origin}${path}${q.size ? "?" + q : ""}`;
}

// input: { tool, savedAt, site, page, thread, authors, report, sameText, claims, sites, media }
// media: the Content Credentials readings (src/core/c2pa.js) for files the user checked in this
// thread, or null. Only their states and AI-generation marks go on the card, never a signer's name.
// Returns { ok: true, card } or { ok: false, reason }.
export function evidenceCard(input) {
  if (!input || !input.thread) return { ok: false, reason: "Cards are made for threads only, not for profiles or feeds." };
  const accounts = new Set((input.authors || []).map((h) => String(h).toLowerCase())).size;
  if (accounts < MIN_CARD_ACCOUNTS) return { ok: false, reason: `This thread has ${accounts} reply account${accounts === 1 ? "" : "s"}. A card needs at least ${MIN_CARD_ACCOUNTS} accounts, so it cannot be about one person.` };
  const R = input.report || {}, U = R.upstream || {};
  const claims = dedupe(input.claims || []).slice(0, 5).map((c) => ({ claim: c.claim, rating: c.rating, checker: c.checker, url: c.url, date: c.date || null, overlap: c.coverage != null ? r3(c.coverage) : null }));
  const sites = (input.sites || []).slice(0, 8).map((s) => ({ domain: s.domain, posts: s.n, owner: s.owner || null, state: s.state || [] }));
  const card = {
    kind: "radar-thread-card", version: CARD_VERSION, tool: input.tool, savedAt: input.savedAt,
    thread: { site: input.site, page: cardPage(input.page), replyAccounts: accounts },
    report: {
      replies: R.replies, accountsRead: R.lookedUp, notRead: R.notLookedUp, verdict: R.verdict, sentence: R.sentence,
      extreme: R.extreme ? { n: R.extreme.n, flagged: R.extreme.flagged, ci: ci(R.extreme.ci) } : null,
      others: R.others ? { n: R.others.n, flagged: R.others.flagged, ci: ci(R.others.ci) } : null,
      timingBursts: (R.bursts || []).length, sameTextGroups: input.sameText || 0, machineSigns: R.machine ? R.machine.n : 0,
      returningPairs: (R.groups || []).length, persuasion: R.persuasion ? R.persuasion.sentence : null,
    },
    claims, sites,
    media: { uploads: U.uploads || 0, recycledUploads: U.recycled || 0, credentials: credentialSummary(input.media) },
  };
  card.sources = sourcesOf(card, input);
  card.doesNotProve = limitsOf(card);
  return { ok: true, card };
}

// { checked, unchanged, changed, unchecked, none, ai } over the files checked, or null.
export function credentialSummary(results) {
  if (!Array.isArray(results) || !results.length) return null;
  const out = { checked: results.length, unchanged: 0, changed: 0, unchecked: 0, none: 0, ai: 0 };
  for (const r of results) {
    const st = credentialState(r);
    out[st === "remote" ? "none" : st]++;
    if (r && (r.aiAnywhere || ((r.meta && r.meta.sourceTypes) || []).some((t) => t.kind === "ai"))) out.ai++;
  }
  return out;
}

function dedupe(claims) { const seen = new Set(); return claims.filter((c) => c && c.url && !seen.has(c.url) && seen.add(c.url)); }

function sourcesOf(card, input) {
  const day = String(input.savedAt || "").slice(0, 10);
  return [
    `Replies and posts as ${card.thread.site} showed them to this viewer on ${day}, read by Radar in this browser.`,
    "Account flags: what each platform discloses on profiles and About pages, read by Radar in this browser. Rules and measured error rates: Radar's EVALUATION.md.",
    card.claims.length ? CLAIM_ATTRIBUTION : null,
    card.sites.some((s) => s.owner) ? "Outlet owners: Radar's ownership table, built from Wikidata; each row links its Wikidata item." : null,
    card.sites.some((s) => s.state.length) ? "State links: Wikidata ownership chains, and the platform or government reports each link cites." : null,
    "Media: whether an upload was first posted by another account, from the posts this viewer's page loaded.",
    card.media.credentials ? "Content Credentials: C2PA manifests read and checked in this browser from files the viewer chose to check." : null,
  ].filter(Boolean);
}

function limitsOf(card) {
  return [
    "This card covers one thread as one viewer saw it, ranked by the platform. It names no account and judges no person.",
    REPORT_DOES_NOT_PROVE,
    card.claims.length ? CLAIM_DOES_NOT_PROVE : null,
    card.sites.some((s) => s.state.length) ? "A state link says a cited source ties the site to a state. It is not proof that a post is false." : null,
    card.media.credentials ? CREDENTIALS_DO_NOT_PROVE : null,
    card.media.recycledUploads ? "A recycled upload can be a fair repost or a correction; it shows where the file was first seen, not who made it." : null,
  ].filter(Boolean);
}

// JSON with sorted keys and no spacing, so the same content always gives the same bytes.
export function canonicalJSON(v) {
  if (Array.isArray(v)) return "[" + v.map(canonicalJSON).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canonicalJSON(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}

async function sha256(text) {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sealCard(card) {
  const { hash, ...body } = card;
  return { ...body, hash: { alg: "SHA-256", of: "canonical JSON of this card without the hash field (sorted keys, no spaces)", value: await sha256(canonicalJSON(body)) } };
}

export async function verifyCard(card) {
  if (!card || !card.hash) return false;
  const { hash, ...body } = card;
  return hash.value === (await sha256(canonicalJSON(body)));
}

const pc = (x) => `${Math.round(x * 100)}%`;

// The card as lines for the PNG: { kind: title | meta | head | body | small | limit | hash, text }.
export function cardLines(card) {
  const R = card.report, L = [];
  const push = (kind, text) => { if (text) L.push({ kind, text }); };
  push("title", "Radar thread card");
  push("meta", `${card.thread.site} thread · ${card.thread.page} · saved ${String(card.savedAt).slice(0, 16).replace("T", " ")} UTC`);
  push("head", "Thread report");
  push("body", R.sentence);
  push("body", `${R.replies} replies from ${card.thread.replyAccounts} accounts; ${R.accountsRead} accounts read.` + (R.verdict !== "too-few" && R.extreme && R.extreme.ci ? ` Extreme replies from flagged accounts: 95% interval ${pc(R.extreme.ci[0])} to ${pc(R.extreme.ci[1])}.` : ""));
  push("body", `Coordination signs: ${R.timingBursts} timing burst${R.timingBursts === 1 ? "" : "s"}, ${R.sameTextGroups} group${R.sameTextGroups === 1 ? "" : "s"} of near-identical replies, ${R.returningPairs} account pair${R.returningPairs === 1 ? "" : "s"} seen together before, ${R.machineSigns} repl${R.machineSigns === 1 ? "y" : "ies"} with machine-writing signs.`);
  push("body", R.persuasion);
  if (card.claims.length) { push("head", "Fact-checked claims"); for (const c of card.claims) push("body", `${c.checker} rated a similar claim "${c.rating}": ${c.claim} (${c.url})`); }
  if (card.sites.length) { push("head", "Sites linked"); push("body", card.sites.map((s) => [`${s.domain} (${s.posts})`, s.owner ? `owned by ${s.owner}` : null, ...s.state].filter(Boolean).join(", ")).join("; ")); }
  push("head", "Media");
  push("body", card.media.uploads ? `${card.media.recycledUploads} of ${card.media.uploads} uploads were first posted by another account.` : "No uploads were read in this thread.");
  const C = card.media.credentials;
  push("body", C ? `Content Credentials, ${C.checked} file${C.checked === 1 ? "" : "s"} checked: ${C.unchanged} signed and unchanged, ${C.changed} changed since signing, ${C.unchecked} not fully checked, ${C.none} with none found; ${C.ai} marked as made with generative AI (by credentials or IPTC metadata).` : "No file in this thread was checked for Content Credentials.");
  push("head", "Sources");
  for (const s of card.sources) push("small", s);
  push("head", "What this does not prove");
  for (const s of card.doesNotProve) push("limit", s);
  if (card.hash) push("hash", `${card.hash.alg} ${card.hash.value}. The JSON saved with this image holds the same content; hash it to check a copy.`);
  return L;
}
