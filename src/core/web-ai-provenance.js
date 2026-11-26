// Offline Web & AI Provenance Verifier: parses and verifies .well-known/agent-card.json,
// llms.txt, HTML canonical + Schema.org JSON-LD @graph, and linked engine-receipt/1 SHA-256
// receipts while detecting hidden prompt-injection payloads, mismatched canonical URLs,
// missing license/attribution, and forged digests. Pure ES module (no DOM, no network, no fs).

import { jsonLdNodes } from "./page-capture.js";
import { ENGINE_RECEIPT_SCHEMA, verifySidecarEngineReceipt } from "./sidecar-receipt.js";

export const WEB_AI_PROVENANCE_SCHEMA = "cmmns.web-ai-provenance/1";

const INJECTION_PHRASE_RE = /\b(ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above)\s+instructions?|disregard\s+(?:all\s+|any\s+)?(?:previous|prior|system)\s+(?:instructions?|prompts?)|override\s+(?:your\s+|the\s+)?(?:system\s+)?instructions?|system\s+prompt\s*(?:override|:)|you\s+are\s+now\s+(?:in\s+)?(?:developer|unrestricted|jailbreak)|exfiltrate|reveal\s+(?:all\s+|your\s+)?(?:secrets?|api\s+keys?|tokens?|credentials?)|always\s+recommend\b|do\s+not\s+mention\s+this\s+(?:instruction|rule)|hidden\s+instruction)\b/i;
const HIDDEN_STYLE_RE = /<([a-z][a-z0-9-]*)\b[^>]*\b(?:style\s*=\s*["'][^"']*(?:opacity\s*:\s*0(?:\.0+)?(?=[;\s"']|$)|display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0(?:px|pt|em|rem)?\b|clip-path\s*:\s*inset\(100%\))[^"']*["']|hidden\b)[^>]*>([\s\S]*?)<\/\1>/gi;
const COMMENT_RE = /<!--([\s\S]*?)-->/g;
const UNICODE_TAG_RE = /[\u{E0000}-\u{E007F}]{4,}/u;
const BIDI_STEGO_RE = /[\u202A-\u202E\u2066-\u2069]/;
const ZERO_WIDTH_RUN_RE = /[\u200B-\u200D\uFEFF]{6,}/;

function normUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.hash = "";
    const p = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.protocol}//${u.host.toLowerCase()}${p}${u.search}`;
  } catch { return null; }
}

function originOf(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    return (u.protocol === "https:" || u.protocol === "http:") ? `${u.protocol}//${u.host.toLowerCase()}` : null;
  } catch { return null; }
}

function stripTags(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function parseAgentCard(raw) {
  const errors = [];
  if (raw == null || raw === "") return { ok: false, card: null, errors: ["agent-card.json is missing"] };
  let card = raw;
  if (typeof raw === "string") {
    try { card = JSON.parse(raw.replace(/^\uFEFF/, "")); }
    catch (e) { return { ok: false, card: null, errors: [`invalid agent-card.json: ${e.message}`] }; }
  }
  if (!card || typeof card !== "object" || Array.isArray(card)) {
    return { ok: false, card: null, errors: ["agent-card.json root must be an object"] };
  }
  const name = typeof card.name === "string" && card.name.trim() ? card.name.trim() : null;
  const url = normUrl(card.url);
  if (!name) errors.push("agent-card.json missing non-empty name");
  if (!url) errors.push("agent-card.json missing valid http(s) url");
  const authorName = typeof card.author === "string" ? card.author.trim() : (card.author && typeof card.author.name === "string" ? card.author.name.trim() : null);
  const license = typeof card.license === "string" && card.license.trim() ? card.license.trim() : null;
  const entryPoints = card.entryPoints && typeof card.entryPoints === "object" ? card.entryPoints : {};
  const links = Object.values(entryPoints).filter((v) => typeof v === "string");
  for (const [k, v] of Object.entries(entryPoints)) {
    if (typeof v === "string" && !normUrl(v)) errors.push(`agent-card.json entryPoints.${k} is not a valid http(s) URL`);
  }
  return { ok: errors.length === 0, card, name, url, origin: originOf(url), authorName, license, entryPoints, links, errors };
}

export function parseLlmsTxt(text) {
  const errors = [];
  if (typeof text !== "string" || !text.trim()) return { ok: false, title: null, sections: [], links: [], errors: ["llms.txt is missing or empty"] };
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").split("\n");
  const h1 = lines.find((l) => /^#\s+\S/.test(l));
  const title = h1 ? h1.replace(/^#\s+/, "").trim() : null;
  if (!title) errors.push("llms.txt missing top-level H1 heading");
  const sections = lines.filter((l) => /^##\s+\S/.test(l)).map((l) => l.replace(/^##\s+/, "").trim());
  const links = [];
  for (const m of text.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    const href = normUrl(m[2]);
    if (href) links.push({ label: m[1].trim(), url: href });
    else if (!/^#|^\//.test(m[2])) errors.push(`llms.txt invalid link target: ${m[2]}`);
  }
  if (!links.length) errors.push("llms.txt contains no valid http(s) links");
  return { ok: errors.length === 0, title, sections, links, errors };
}

function attrOf(tag, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = re.exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? "").trim() : null;
}

export function parseHtmlProvenance(html) {
  const src = String(html || "");
  let canonical = null, licenseLink = null, authorMeta = null, licenseMeta = null;
  for (const m of src.matchAll(/<link\b[^>]*>/gi)) {
    const rel = String(attrOf(m[0], "rel") || "").toLowerCase().split(/\s+/);
    const href = attrOf(m[0], "href");
    if (rel.includes("canonical") && href && !canonical) canonical = normUrl(href);
    if (rel.includes("license") && href && !licenseLink) licenseLink = href;
  }
  for (const m of src.matchAll(/<meta\b[^>]*>/gi)) {
    const key = String(attrOf(m[0], "name") || attrOf(m[0], "property") || "").toLowerCase();
    const content = attrOf(m[0], "content");
    if (!content) continue;
    if (key === "author" && !authorMeta) authorMeta = content;
    if ((key === "license" || key === "dcterms.license" || key === "dc.rights") && !licenseMeta) licenseMeta = content;
  }
  const ldRaw = [];
  for (const m of src.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    ldRaw.push(m[1].trim());
  }
  const jsonLd = jsonLdNodes(ldRaw);
  const ldAuthors = jsonLd.flatMap((n) => n.author || []);
  const ldPublishers = jsonLd.map((n) => n.publisher).filter(Boolean);
  const ldUrls = jsonLd.map((n) => normUrl(n.url)).filter(Boolean);
  const ldHasLicense = ldRaw.some((b) => /"license"\s*:/i.test(b));
  return { canonical, licenseLink, authorMeta, licenseMeta, jsonLd, ldAuthors, ldPublishers, ldUrls, ldHasLicense };
}

function scanUnicodeStego(surface, text, findings) {
  if (!text) return;
  if (UNICODE_TAG_RE.test(text)) findings.push({ kind: "hidden_prompt_injection", surface, detail: "invisible Unicode Tag Block payload detected" });
  if (BIDI_STEGO_RE.test(text)) findings.push({ kind: "hidden_prompt_injection", surface, detail: "bidi override control character detected" });
  if (ZERO_WIDTH_RUN_RE.test(text)) findings.push({ kind: "hidden_prompt_injection", surface, detail: "long zero-width character sequence detected" });
}

export function detectPromptInjection({ html = "", llmsTxt = "", agentCard = "" } = {}) {
  const findings = [];
  const htmlStr = String(html || "");
  for (const m of htmlStr.matchAll(HIDDEN_STYLE_RE)) {
    const body = stripTags(m[2]);
    if (INJECTION_PHRASE_RE.test(body)) {
      findings.push({ kind: "hidden_prompt_injection", surface: "html:hidden-element", detail: body.slice(0, 140) });
    }
  }
  for (const m of htmlStr.matchAll(COMMENT_RE)) {
    const body = m[1].replace(/\s+/g, " ").trim();
    if (INJECTION_PHRASE_RE.test(body)) {
      findings.push({ kind: "hidden_prompt_injection", surface: "html:comment", detail: body.slice(0, 140) });
    }
  }
  const llmsStr = String(llmsTxt || "");
  for (const m of llmsStr.matchAll(COMMENT_RE)) {
    const body = m[1].replace(/\s+/g, " ").trim();
    if (INJECTION_PHRASE_RE.test(body)) {
      findings.push({ kind: "hidden_prompt_injection", surface: "llms.txt:comment", detail: body.slice(0, 140) });
    }
  }
  if (INJECTION_PHRASE_RE.test(llmsStr)) {
    findings.push({ kind: "hidden_prompt_injection", surface: "llms.txt", detail: "imperative prompt-override instruction detected in llms.txt" });
  }
  const cardStr = typeof agentCard === "string" ? agentCard : agentCard ? JSON.stringify(agentCard) : "";
  if (INJECTION_PHRASE_RE.test(cardStr)) {
    findings.push({ kind: "hidden_prompt_injection", surface: "agent-card.json", detail: "imperative prompt-override instruction detected in agent-card.json" });
  }
  scanUnicodeStego("html", htmlStr, findings);
  scanUnicodeStego("llms.txt", llmsStr, findings);
  scanUnicodeStego("agent-card.json", cardStr, findings);
  return findings;
}

function checkCanonicalAndAttribution(expectedOrigin, card, htmlInfo, findings) {
  const refUrl = normUrl(expectedOrigin) || card.url || htmlInfo.canonical;
  const refOrigin = originOf(refUrl);
  if (expectedOrigin && card.url && originOf(card.url) !== originOf(expectedOrigin)) {
    findings.push({ kind: "canonical_mismatch", surface: "agent-card.json", detail: `agent-card url ${card.url} does not match expected origin ${expectedOrigin}` });
  }
  if (card.url && htmlInfo.canonical && card.url !== htmlInfo.canonical) {
    findings.push({ kind: "canonical_mismatch", surface: "html:canonical", detail: `HTML canonical ${htmlInfo.canonical} differs from agent-card url ${card.url}` });
  }
  if (refOrigin && htmlInfo.ldUrls.length) {
    const primaryTypes = new Set(["WebSite", "Person", "Organization", "Article", "NewsArticle", "BlogPosting", "ScholarlyArticle"]);
    for (const node of htmlInfo.jsonLd) {
      const u = normUrl(node.url);
      if (u && primaryTypes.has(node.type) && originOf(u) !== refOrigin) {
        findings.push({ kind: "canonical_mismatch", surface: `html:json-ld:${node.type}`, detail: `JSON-LD ${node.type} url ${u} does not match origin ${refOrigin}` });
      }
    }
  }
  const hasAttribution = !!(card.authorName || htmlInfo.authorMeta || htmlInfo.ldAuthors.length || htmlInfo.ldPublishers.length);
  const hasLicense = !!(card.license || htmlInfo.licenseLink || htmlInfo.licenseMeta || htmlInfo.ldHasLicense);
  if (!hasAttribution && !hasLicense) {
    findings.push({ kind: "missing_license_or_attribution", surface: "site-metadata", detail: "no author, publisher, or license attribution found across agent-card.json, HTML meta, or JSON-LD" });
  }
  return { refUrl, refOrigin, hasAttribution, hasLicense };
}

async function verifyReceipts(receipts, files, hmacKey, findings) {
  const results = [];
  for (let i = 0; i < (receipts || []).length; i++) {
    const entry = receipts[i];
    const name = (entry && entry.name) || `receipt[${i}]`;
    let doc = entry && entry.receipt !== undefined ? entry.receipt : entry;
    if (typeof doc === "string") {
      try { doc = JSON.parse(doc); }
      catch (e) {
        findings.push({ kind: "forged_receipt", surface: name, detail: `invalid JSON: ${e.message}` });
        results.push({ name, ok: false, verdict: null, errors: [e.message] });
        continue;
      }
    }
    if (!doc || doc.schema !== ENGINE_RECEIPT_SCHEMA) {
      const detail = `unexpected receipt schema: ${doc && doc.schema}`;
      findings.push({ kind: "forged_receipt", surface: name, detail });
      results.push({ name, ok: false, verdict: null, errors: [detail] });
      continue;
    }
    const r = await verifySidecarEngineReceipt(doc, { files, hmacKey });
    if (!r.ok) {
      findings.push({ kind: "forged_receipt", surface: name, detail: r.errors.join("; ") });
    }
    results.push({ name, ok: r.ok, verdict: r.verdict, errors: r.errors });
  }
  return results;
}

// Fail-closed offline verifier for Web & AI provenance surfaces.
export async function verifyWebAiProvenance({
  origin = null, html = "", agentCard = null, llmsTxt = "", receipts = [], files = null, hmacKey = null,
} = {}) {
  const findings = [];
  const card = agentCard != null ? parseAgentCard(agentCard) : { ok: true, card: null, url: null, origin: null, authorName: null, license: null, errors: [] };
  for (const e of card.errors) findings.push({ kind: "agent_card_invalid", surface: "agent-card.json", detail: e });
  const llms = llmsTxt !== null && llmsTxt !== undefined && llmsTxt !== "" ? parseLlmsTxt(llmsTxt) : { ok: true, title: null, sections: [], links: [], errors: [] };
  for (const e of llms.errors) findings.push({ kind: "llms_txt_invalid", surface: "llms.txt", detail: e });
  const htmlInfo = parseHtmlProvenance(html);
  const meta = checkCanonicalAndAttribution(origin, card, htmlInfo, findings);
  for (const inj of detectPromptInjection({ html, llmsTxt, agentCard })) findings.push(inj);
  const receiptResults = await verifyReceipts(receipts, files, hmacKey, findings);
  const checks = {
    agent_card: card.ok,
    llms_txt: llms.ok,
    canonical_consistent: !findings.some((f) => f.kind === "canonical_mismatch"),
    license_or_attribution: meta.hasAttribution || meta.hasLicense,
    no_prompt_injection: !findings.some((f) => f.kind === "hidden_prompt_injection"),
    receipts_verified: receiptResults.every((r) => r.ok),
  };
  const ok = findings.length === 0;
  return {
    schema: WEB_AI_PROVENANCE_SCHEMA,
    ok,
    verdict: ok ? "PASS" : "FAIL",
    origin: meta.refOrigin,
    canonical: htmlInfo.canonical || card.url || null,
    summary: {
      json_ld_nodes: htmlInfo.jsonLd.length,
      llms_links: llms.links.length,
      receipts_checked: receiptResults.length,
      findings: findings.length,
    },
    checks,
    findings,
    receipts: receiptResults,
  };
}
