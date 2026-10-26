// Checks on a claim and its sources, for the claim sheet (a claim drawn over its sources) and the
// evidence board. Pure; no network.
// - corroboration: how many of a claim's other sources come from a different origin (another site
//   or another account); its opacity is the provenance layer's opacity on the sheet.
// - headlineMetamer: the same headline over different sourcing. The readout matches; the sources
//   do not, so the match says nothing about whether the two rest on the same evidence.
// - clippedQuote: a quote cut from its source so that a nearby negation or qualifier falls away.
//   The same words in a different arrangement give a different meaning.

// An origin is a site and, where the address names one, the account: x.com/<handle>/status/...,
// bsky.app/profile/<handle>/..., reddit.com/user/<name>/... A news site's origin is the site.
const ACCOUNT = { "x.com": 0, "bsky.app": 1, "reddit.com": 1, "youtube.com": 0, "tiktok.com": 0, "instagram.com": 0 };
function originOf(s) {
  let site = "", parts = [];
  try { const u = new URL(String((s && (s.url || s.post)) || "")); site = u.hostname.toLowerCase().replace(/^(www|mobile|old|m)\./, "").replace("twitter.com", "x.com"); parts = u.pathname.split("/").filter(Boolean); } catch { /* not an address */ }
  const at = ACCOUNT[site];
  const handle = (s && s.handle) || (at != null && parts[at] && !(site === "reddit.com" && parts[0] !== "user") ? parts[at] : "");
  return `${site}|${String(handle).replace(/^@/, "").toLowerCase()}`;
}

// Opacity from the count of independent corroborating sources: faint alone, full at three or more.
export const corroborationOpacity = (k) => Math.round((0.25 + 0.75 * Math.min(Math.max(k, 0), 3) / 3) * 100) / 100;

// sources: [{ id, url, handle? }]. -> [{ id, origin, corroborated_by, opacity }]
export function corroboration(sources) {
  const origins = sources.map(originOf);
  return sources.map((s, i) => {
    const k = new Set(origins.filter((o, j) => j !== i && o !== origins[i])).size;
    return { id: s.id, origin: origins[i], corroborated_by: k, opacity: corroborationOpacity(k) };
  });
}

const norm = (t) => String(t || "").normalize("NFKC").toLowerCase().replace(/[‘’“”"']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const addr = (u) => String(u || "").replace(/^https?:\/\/(www\.|mobile\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();

// a, b: { headline, sources: [url] }. -> { metamer, same_headline, shared, only_a, only_b }
export function headlineMetamer(a, b) {
  const same = norm(a.headline) !== "" && norm(a.headline) === norm(b.headline);
  const sa = new Set((a.sources || []).map(addr)), sb = new Set((b.sources || []).map(addr));
  const shared = [...sa].filter((x) => sb.has(x)), onlyA = [...sa].filter((x) => !sb.has(x)), onlyB = [...sb].filter((x) => !sa.has(x));
  return { metamer: same && (onlyA.length > 0 || onlyB.length > 0), same_headline: same, shared, only_a: onlyA, only_b: onlyB };
}

const TURNS = /\b(not|no|never|none|nor|neither|without|false|untrue|denied|denies|deny|but|however|although|though|unless|except|if|whether|allegedly|reportedly|claimed|claims|rumou?r)\b|n't\b/i;

// quote: the words as quoted; source: the full text they came from. window: words kept either side.
// -> { found, clipped, turns: [words], before, after }
export function clippedQuote(quote, source, window = 6) {
  const q = norm(quote), s = norm(source);
  const i = q ? s.indexOf(q) : -1;
  if (i < 0) return { found: false, clipped: false, turns: [], before: null, after: null };
  const before = s.slice(0, i).trim().split(" ").filter(Boolean).slice(-window).join(" ");
  const after = s.slice(i + q.length).trim().split(" ").filter(Boolean).slice(0, window).join(" ");
  const turns = [...`${before} ${after}`.matchAll(new RegExp(TURNS.source, "gi"))].map((m) => m[0].toLowerCase());
  return { found: true, clipped: turns.length > 0, turns: [...new Set(turns)], before: before || null, after: after || null };
}

// Origin collapse: many items that relay one upstream source. items: [{ id, url, cites: [url] }].
// An item that cites exactly one upstream counts toward that upstream; the readout is the number of
// independent upstreams behind the items, against the number of items. -> { items, upstreams,
// collapsed: [{ upstream, relays: [id] }] } where collapsed lists upstreams relayed by three or more.
export function originCollapse(items, least = 3) {
  const by = new Map(), own = [];
  for (const it of items) {
    const cites = [...new Set((it.cites || []).map(addr))];
    if (cites.length === 1) { if (!by.has(cites[0])) by.set(cites[0], []); by.get(cites[0]).push(it.id); }
    else own.push(it.id);
  }
  const collapsed = [...by].filter(([, ids]) => ids.length >= least).map(([upstream, relays]) => ({ upstream, relays }));
  return { items: items.length, upstreams: by.size + own.length, collapsed };
}
