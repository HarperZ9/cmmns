// A small reader for news feeds: RSS 2.0, RSS 1.0 (RDF) and Atom. Daylight Commons' background worker has no
// DOMParser (Chrome's service workers do not offer one), so this reads the text itself. It takes
// only what Other coverage needs from each entry: the title, the link, the date and a short
// summary. Everything else in the feed is ignored. Nothing here touches the network.
//
// The reader is defensive by design: a feed is text from an outside server. Links must be https;
// markup inside titles and summaries is stripped; sizes are capped; anything unreadable gives an
// empty list, never an exception the caller has to catch.

export const FEED_MAX_BYTES = 3_000_000;
export const FEED_MAX_ITEMS = 200;
const SUMMARY_MAX = 400, TITLE_MAX = 300;

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "-", ndash: "-", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"' };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

// Text content of an element body: CDATA kept as text, tags removed, entities decoded once, then
// any markup the publisher escaped inside it removed as well.
export function plainText(raw) {
  const s = String(raw || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, c) => c.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  const once = decode(s.replace(/<[^>]*>/g, " "));
  return decode(once.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

// The body of the first <name>…</name> child (namespace prefixes allowed), or null.
function child(block, names) {
  for (const n of names) {
    const m = block.match(new RegExp(`<(?:[\\w-]+:)?${n}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${n}>`, "i"));
    if (m) return m[1];
  }
  return null;
}

const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i")); return m ? decode(m[2] ?? m[3]) : null; };

export function safeLink(u) {
  try {
    const url = new URL(String(u || "").trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

// Atom gives the link as <link href=... rel=...>; RSS as <link>text</link>, or a permalink <guid>.
function linkOf(block) {
  const tags = block.match(/<link\b[^>]*\/?>/gi) || [];
  const alt = tags.find((t) => attr(t, "href") && (!attr(t, "rel") || attr(t, "rel") === "alternate"));
  if (alt) return safeLink(attr(alt, "href"));
  const text = child(block, ["link"]);
  if (text && safeLink(plainText(text))) return safeLink(plainText(text));
  const guid = block.match(/<guid\b([^>]*)>([\s\S]*?)<\/guid>/i);
  if (guid && !/isPermaLink\s*=\s*["']false/i.test(guid[1])) return safeLink(plainText(guid[2]));
  const about = block.match(/^<item\b[^>]*\srdf:about\s*=\s*"([^"]+)"/i);
  return about ? safeLink(decode(about[1])) : null;
}

function dateOf(block) {
  const raw = child(block, ["pubDate", "published", "updated", "date", "issued"]);
  const t = raw ? Date.parse(plainText(raw)) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

// Feed text to { title, items: [{ title, link, published, summary }] }. kind is "rss", "atom" or
// null when the text is not a feed Daylight Commons can read.
export function parseFeed(text) {
  const src = String(text || "").slice(0, FEED_MAX_BYTES).replace(/<!--[\s\S]*?-->/g, "");
  const kind = /<feed\b[^>]*>/i.test(src) && !/<rss\b|<rdf:RDF\b/i.test(src) ? "atom" : /<rss\b|<rdf:RDF\b|<channel\b/i.test(src) ? "rss" : null;
  if (!kind) return { kind: null, title: null, items: [] };
  const re = kind === "atom" ? /<entry\b[^>]*>[\s\S]*?<\/entry>/gi : /<item\b[^>]*>[\s\S]*?<\/item>/gi;
  const items = [];
  for (const m of src.matchAll(re)) {
    if (items.length >= FEED_MAX_ITEMS) break;
    const block = m[0];
    const title = plainText(child(block, ["title"])).slice(0, TITLE_MAX);
    const link = linkOf(block);
    if (!title || !link) continue;
    const summary = plainText(child(block, ["description", "summary", "content", "encoded"])).slice(0, SUMMARY_MAX);
    items.push({ title, link, published: dateOf(block), summary });
  }
  const head = src.split(re)[0] || "";
  return { kind, title: plainText(child(head, ["title"])) || null, items };
}
