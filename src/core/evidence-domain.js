// Domain facts for the evidence layer (project-docs/EVIDENCE-LAYER.md): registration date from RDAP
// (rdap.org forwards to the registry's own RDAP server) and the first Internet Archive capture
// (Wayback CDX). Checked 2026-10-22: both answer without a login and send
// Access-Control-Allow-Origin: *. Rechecked 2026-10-23: rdap.org still does; the Wayback CDX no
// longer sends it, so the extension asks for access to web.archive.org when the user turns
// evidence lookups on (src/ext/options.js), and without it reports the archive as not asked.

export const RDAP_BASE = "https://rdap.org/domain/";
export const CDX_BASE = "https://web.archive.org/cdx/search/cdx";
export const DOMAIN_DOES_NOT_PROVE = "A registration date is when the current registration began. Domains are bought, sold and re-registered, and a young domain can front an old company.";
export const WAYBACK_DOES_NOT_PROVE = "The Internet Archive captures sites unevenly, so a late first capture means the archive found the site late.";

// Hosting services that give each customer a subdomain. The service's own registration says nothing
// about a customer's site, so such a host is kept whole and RDAP is not asked about it.
export const HOSTING_SUFFIXES = ["github.io", "gitlab.io", "netlify.app", "vercel.app", "pages.dev", "web.app", "firebaseapp.com", "herokuapp.com", "blogspot.com", "wordpress.com", "substack.com", "medium.com", "notion.site", "carrd.co", "framer.website", "webflow.io", "glitch.me", "replit.app", "onrender.com", "fly.dev", "azurewebsites.net", "cloudfront.net", "s3.amazonaws.com"];
export function hostedOn(host) {
  const h = String(host || "").toLowerCase().replace(/^www\./, "");
  return HOSTING_SUFFIXES.find((s) => h.endsWith("." + s) && h.length > s.length + 1) || null;
}

// The registrable part of a host, roughly: the last two labels, or three under a two-letter
// second-level such as co.uk; a site on a hosting service stays whole. Good enough to pick what to
// ask RDAP about; RDAP itself says no if wrong.
export function registrable(host) {
  const parts = String(host || "").toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  if (parts.length < 2) return null;
  if (hostedOn(parts.join("."))) return parts.join(".");
  const sld = parts[parts.length - 2];
  return (parts.length >= 3 && /^(?:co|com|org|net|ac|gov|edu)$/.test(sld) && parts[parts.length - 1].length === 2 ? parts.slice(-3) : parts.slice(-2)).join(".");
}

export const rdapUrl = (domain) => RDAP_BASE + encodeURIComponent(domain);
export const cdxUrl = (domain) => `${CDX_BASE}?url=${encodeURIComponent(domain)}&limit=1&output=json&fl=timestamp,original,statuscode`;

// RDAP domain JSON -> { domain, registered, expires, lastChanged, registrar }. The registrar is an
// organisation; people named in RDAP contacts are never read.
export function rdapFacts(json) {
  if (!json || json.objectClassName !== "domain") return null;
  const ev = (a) => ((json.events || []).find((e) => e.eventAction === a) || {}).eventDate || null;
  const reg = (json.entities || []).find((e) => (e.roles || []).includes("registrar"));
  const fn = reg && Array.isArray(reg.vcardArray) ? ((reg.vcardArray[1] || []).find((x) => x[0] === "fn") || [])[3] || null : null;
  return { domain: String(json.ldhName || "").toLowerCase(), registered: ev("registration"), expires: ev("expiration"), lastChanged: ev("last changed"), registrar: fn };
}

// Wayback CDX JSON ([[header...], [timestamp, original, status]]) -> { first, url } or null.
export function waybackFirst(json) {
  const row = Array.isArray(json) && json.length > 1 ? json[1] : null;
  if (!row || !/^\d{14}$/.test(row[0])) return null;
  const t = row[0];
  return { first: `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}Z`, url: `https://web.archive.org/web/${t}/${row[1]}` };
}

// Days between a date and a later moment (the post), or null.
export function daysBefore(iso, atIso) {
  const a = Date.parse(iso), b = Date.parse(atIso);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.floor((b - a) / 86400000) : null;
}
