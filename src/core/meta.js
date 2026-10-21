// Account context Meta shows the viewer on Facebook and Instagram, read from the text the site
// renders when the viewer opens it. Radar makes no request of its own for it.
// - Instagram: "About this account" (profile menu): date joined, "Account based in", former
//   usernames, verified. Layout checked live 2026-10-21: each label on its own line, then its value.
// - Facebook: "Page transparency" on a Page: creation date, name changes, and the countries of the
//   people who manage the Page. Wording from Meta's public description; live check open.

import { parseAbout, parseJoined } from "./about.js";

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const MON = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
const iso = (y, m, d) => new Date(Date.UTC(+y, MONTHS[m.slice(0, 3).toLowerCase()], +d)).toISOString().slice(0, 10);
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== false && v !== ""));
const linesOf = (text) => String(text || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);

// "February 8, 2009" or "8 February 2009"; falls back to month and year ("March 2019").
export function parseFullDate(s) {
  const t = String(s || "");
  let m = t.match(new RegExp(MON + "\\s+(\\d{1,2}),?\\s+(\\d{4})", "i"));
  if (m) return iso(m[3], m[1], m[2]);
  m = t.match(new RegExp("(\\d{1,2})\\s+" + MON + ",?\\s+(\\d{4})", "i"));
  if (m) return iso(m[3], m[2], m[1]);
  return parseJoined(t);
}

const IG_LABEL = /^(?:date joined|account based in|verified|former usernames?|accounts? with shared followers|close|about this account)$/i;

// text: the dialog's innerText. handle: the account, when known from the page; otherwise the line
// under the dialog's title.
export function igAbout(text, handle) {
  const lines = linesOf(text);
  const top = lines.findIndex((l) => /^about this account$/i.test(l));
  if (top < 0) return null;
  const who = handle || (lines[top + 1] && /^[A-Za-z0-9._]{1,30}$/.test(lines[top + 1]) ? lines[top + 1] : null);
  const a = parseAbout(lines.join("\n"), who);
  const hidden = /^not shared$/i.test(a.basedIn || "");
  let former;
  const f = lines.findIndex((l) => /^former usernames?\b/i.test(l));
  if (f >= 0) {
    const n = lines[f].match(/(\d+)/);
    if (n) former = +n[1];
    else { former = 0; for (let i = f + 1; i < lines.length && !IG_LABEL.test(lines[i]); i++) if (/^@?[A-Za-z0-9._]{1,30}$/.test(lines[i])) former++; }
  }
  const r = compact({ handle: who, joinDate: a.joinDate, basedIn: hidden ? null : a.basedIn, basedInHidden: hidden,
    nameChanges: former, verified: lines.some((l) => /^verified$/i.test(l)), labelSource: "Instagram", aboutRead: true });
  return r.joinDate || r.basedIn || hidden ? r : null;
}

// The value on a label's line ("Page created - May 3, 2015") or on the next line.
function valueAfter(lines, re) {
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    const rest = lines[i].replace(re, "").replace(/^[\s:·\-–—]+/, "").trim();
    return rest || lines[i + 1] || null;
  }
  return null;
}

// "Exampleland (4)" entries after the managers' heading, on one line or one per line.
function managers(lines) {
  const at = lines.findIndex((l) => /location for (?:the )?people who manage this page/i.test(l));
  if (at < 0) return [];
  const out = [];
  const take = (s) => { for (const m of s.matchAll(/([^,():]+?)\s*\((\d+)\)/g)) out.push({ country: m[1].replace(/^.*includes\s*/i, "").trim(), people: +m[2] }); };
  take(lines[at].replace(/^.*?:/, ""));
  for (let i = at + 1; i < lines.length && /\(\d+\)\s*$/.test(lines[i]); i++) take(lines[i]);
  return out.filter((x) => x.country);
}

export function pageTransparency(text, handle) {
  const lines = linesOf(text);
  if (!lines.some((l) => /^page transparency$/i.test(l))) return null;
  const created = valueAfter(lines, /^(?:page created|creation date|created)\b/i);
  const renames = lines.filter((l) => /^changed name to\b/i.test(l)).length;
  const noRename = lines.some((l) => /(?:has not|hasn't|never) changed its name|^no name changes/i.test(l));
  const from = managers(lines);
  const ads = lines.some((l) => /\bcurrently running ads\b/i.test(l) && !/\bnot currently running\b/i.test(l));
  const r = compact({ handle, joinDate: parseFullDate(created), nameChanges: renames || (noRename ? 0 : null),
    managedFrom: from.length ? from : null, basedIn: from.length === 1 ? from[0].country : null, runningAds: ads,
    labelSource: "Facebook Page transparency", aboutRead: true });
  return r.joinDate || r.managedFrom || r.nameChanges != null ? r : null;
}

// Paths on facebook.com that are not people or Pages.
const NOT_ACCOUNT = /^(?:groups|watch|reel|reels|photo|photos|posts|events|marketplace|gaming|stories|story\.php|permalink\.php|photo\.php|hashtag|search|share|login|help|policies|privacy|settings|notifications|messages|friends|bookmarks|pages|l\.php|ads|business)$/i;

// A stable key for the account a Facebook profile link points to: the vanity name, or "id.<n>".
export function fbKey(href) {
  let u;
  try { u = new URL(href); } catch (_) { return null; }
  if (!/(^|\.)facebook\.com$/.test(u.hostname) || /^l\./.test(u.hostname)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts[0] === "profile.php") return /^\d+$/.test(u.searchParams.get("id") || "") ? "id." + u.searchParams.get("id") : null;
  if (parts[0] === "people" && /^\d+$/.test(parts[2] || "")) return "id." + parts[2];
  if (parts.length !== 1 || NOT_ACCOUNT.test(parts[0]) || !/^[A-Za-z0-9.]{3,50}$/.test(parts[0])) return null;
  return parts[0].toLowerCase();
}

// The profile URL for a key from fbKey.
export function fbProfile(key) {
  return key && key.startsWith("id.") ? `https://www.facebook.com/profile.php?id=${key.slice(3)}` : `https://www.facebook.com/${key}`;
}
