// The generic save: what any page says about itself, for a page CMMNS has no site reader for.
// The page side (src/ext/page-capture.js) hands over plain values it read from the page: the meta
// tags, the JSON-LD blocks, the canonical link, the text of the selection or the main block, and
// the media elements inside it. This file turns them into the raw record postMeta takes
// (src/core/media-meta.js), with the adapter that produced it, and into the sidecar's lines.
// Nothing here makes a request, and nothing here reads beyond what the page stated.

// Site readers that write their own record. Every other save is "article" or "generic".
export const SITE_ADAPTERS = Object.freeze(["x", "reddit", "youtube", "instagram"]);
export const adapterOf = (site, adapter = null) => (adapter ? String(adapter).slice(0, 40) : SITE_ADAPTERS.includes(site) ? site : "generic");

const ARTICLE_TYPES = /^(Article|NewsArticle|BlogPosting|ScholarlyArticle|Report|TechArticle|OpinionNewsArticle|ReportageNewsArticle|AnalysisNewsArticle|LiveBlogPosting|SocialMediaPosting)$/;
const cut = (s, n) => (s == null || s === "" ? null : String(s).replace(/\s+/g, " ").trim().slice(0, n) || null);
const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const nameOf = (v) => (typeof v === "string" ? cut(v, 200) : v && typeof v === "object" ? cut(v.name || v.alternateName, 200) : null);

// One JSON-LD node as the few fields a library indexes. Unknown fields are left in the page.
function ldNode(n) {
  const type = list(n["@type"]).map(String)[0] || null;
  if (!type) return null;
  const out = { type, name: cut(n.headline || n.name, 400), author: list(n.author).map(nameOf).filter(Boolean).slice(0, 20), published: cut(n.datePublished || n.uploadDate || n.dateCreated, 40),
    modified: cut(n.dateModified, 40), publisher: nameOf(n.publisher), description: cut(n.description, 600), url: cut(n.url || (n.mainEntityOfPage && n.mainEntityOfPage["@id"]) || n["@id"], 600),
    duration: cut(n.duration, 40), language: cut(n.inLanguage, 20) };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)));
}

// Every node of the page's JSON-LD blocks (a block may hold one node, a list, or an @graph).
export function jsonLdNodes(blocks) {
  const out = [];
  const walk = (v, depth) => {
    if (!v || typeof v !== "object" || depth > 4 || out.length >= 20) return;
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
    if (Array.isArray(v["@graph"])) walk(v["@graph"], depth + 1);
    const n = ldNode(v);
    if (n) out.push(n);
  };
  for (const b of blocks || []) { try { walk(typeof b === "string" ? JSON.parse(b) : b, 0); } catch { /* a block the page wrote wrongly is skipped */ } }
  return out;
}

// The page's meta tags by family. metas: [{ key, content }] where key is the property, name or
// itemprop as the page wrote it. citation_* tags may repeat (authors), so each is a list.
export function pageMetadata({ metas = [], jsonld = [], canonical = null, lang = null } = {}) {
  const og = {}, twitter = {}, citation = {}, article = {}, other = {};
  for (const m of (metas || []).slice(0, 400)) {
    const key = String((m && m.key) || "").trim().toLowerCase(), content = cut(m && m.content, 1000);
    if (!key || !content) continue;
    if (key.startsWith("og:")) { if (!(key.slice(3) in og)) og[key.slice(3)] = content; }
    else if (key.startsWith("twitter:")) { if (!(key.slice(8) in twitter)) twitter[key.slice(8)] = content; }
    else if (key.startsWith("article:")) { if (!(key.slice(8) in article)) article[key.slice(8)] = content; }
    else if (/^(citation_|dc\.|dcterms\.)/.test(key)) (citation[key] = citation[key] || []).push(content);
    else if (/^(author|description|date|datepublished|keywords|publisher)$/.test(key) && !(key in other)) other[key] = content;
  }
  const keep = (o) => (Object.keys(o).length ? o : null);
  return { canonical: cut(canonical, 1000), lang: /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(String(lang || "")) ? String(lang) : null,
    openGraph: keep(og), twitter: keep(twitter), article: keep(article), citation: keep(citation), meta: keep(other), jsonLd: jsonLdNodes(jsonld) };
}

// The title, author and date the page states, most specific source first: citation tags, then
// JSON-LD for an article, then Open Graph and article tags, then the plain meta tags.
export function pagePicks(meta) {
  const c = meta.citation || {}, og = meta.openGraph || {}, art = meta.article || {}, o = meta.meta || {}, first = (k) => (c[k] || [])[0] || null;
  const ld = (meta.jsonLd || []).find((n) => ARTICLE_TYPES.test(n.type)) || (meta.jsonLd || []).find((n) => n.name && (n.published || (n.author || []).length)) || {};
  const authors = (c.citation_author || []).length ? c.citation_author : (ld.author || []).length ? ld.author : [/^https?:/i.test(art.author || "") ? null : art.author, o.author, first("dc.creator")].filter(Boolean).slice(0, 1);
  return { title: first("citation_title") || ld.name || og.title || first("dc.title") || null,
    author: authors.length ? authors.slice(0, 8).join(", ") : null,
    published: first("citation_publication_date") || first("citation_date") || first("citation_online_date") || ld.published || art.published_time || o.datepublished || o.date || first("dc.date") || null,
    description: og.description || o.description || ld.description || null,
    isArticle: !!((c.citation_title || []).length || ARTICLE_TYPES.test(ld.type || "") || /^article$/i.test(og.type || "")) };
}

// Why a media element's file was or was not saved, by what the page offered for it. A plain file
// address (http or https, not a playlist) can be saved; a stream, a player's in-memory source or
// protected media cannot be saved as a plain file, and the record says which.
export function mediaOffer(m = {}) {
  const url = String(m.url || "");
  if (m.protected) return { plain: false, reason: "the page plays it through Encrypted Media Extensions (DRM)" };
  if (/\.(m3u8|mpd)(?:$|[?#])/i.test(url) || m.stream) return { plain: false, reason: "the page delivers it as a segmented stream, with no plain file address" };
  if (/^blob:/i.test(url) || m.noUrl || (!url && m.kind !== "image")) return { plain: false, reason: "the page plays it from memory, with no plain file address" };
  if (!/^https?:/i.test(url)) return { plain: false, reason: "the page gives no file address for it" };
  return { plain: true, reason: null };
}

// The sidecar's media_file value for a save: "saved", or "not saved (reason)".
export function mediaFileLine(items) {
  const xs = (items || []).filter(Boolean);
  if (!xs.length) return null;
  const saved = xs.filter((i) => i.file && !/^not saved/.test(i.file)).length;
  if (saved === xs.length) return "saved";
  const why = [...new Set(xs.filter((i) => /^not saved \(/.test(i.file || "")).map((i) => i.file.slice(11, -1)))];
  return saved ? `${saved} of ${xs.length} saved; ${xs.length - saved} not saved (${why.join("; ") || "not asked for"})` : `not saved (${why.join("; ") || "not asked for"})`;
}

// The raw record for postMeta from what the page side read. s: { url, host, title, text, textFrom,
// selection, metas, jsonld, canonical, lang, media: [{ kind, url, alt, width, height, file }], links }.
export function pageRaw(s = {}) {
  const page = pageMetadata(s), pick = pagePicks(page);
  const site = String(s.host || "").replace(/^www\./, "") || null;
  const article = pick.isArticle || s.textFrom === "article";
  return { site, kind: "text", adapter: article ? "article" : "generic", selection: !!s.selection,
    title: pick.title || cut(s.title, 400), text: s.text || pick.description || null, textComplete: s.textCut ? false : true,
    authorName: pick.author, postedAt: pick.published, pageUrl: s.url || null, links: (s.links || []).slice(0, 200),
    items: (s.media || []).slice(0, 60), page: { ...page, textFrom: s.textFrom || null }, mediaFile: mediaFileLine(s.media) };
}

// The "Page metadata" lines of the .md sidecar: what the page said about itself, by family.
export function pageLines(page) {
  if (!page) return [];
  const rows = [["Canonical address", page.canonical], ["Language", page.lang], ["Text read from", page.textFrom ? `the page's ${page.textFrom}` : null]];
  for (const [label, o] of [["Open Graph", page.openGraph], ["Article", page.article], ["Citation", page.citation], ["Meta", page.meta]]) {
    for (const [k, v] of Object.entries(o || {}).slice(0, 30)) rows.push([`${label} ${k}`, Array.isArray(v) ? v.join("; ") : v]);
  }
  for (const n of page.jsonLd || []) rows.push([`JSON-LD ${n.type}`, [n.name, (n.author || []).join(", "), n.published, n.publisher, n.url].filter(Boolean).join(" | ") || null]);
  const out = rows.filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`);
  return out.length ? ["## Page metadata", "", ...out, ""] : [];
}

// The caption tracks a YouTube player response lists (the page's own data): language, name and
// whether YouTube made it by speech recognition. A list of what exists, never the captions' text.
export function captionTracks(json) {
  const found = [], seen = new Set(), stack = [json];
  for (let n = 0; stack.length && n < 50000; n++) {
    const v = stack.pop();
    if (!v || typeof v !== "object") continue;
    if (Array.isArray(v.captionTracks)) for (const t of v.captionTracks) {
      const lang = t && t.languageCode ? String(t.languageCode) : null, key = `${lang}|${t && t.kind}`;
      if (!lang || seen.has(key)) continue;
      seen.add(key);
      found.push({ lang, name: cut((t.name && (t.name.simpleText || ((t.name.runs || [])[0] || {}).text)) || null, 80), auto: t.kind === "asr" });
    }
    for (const k in v) if (v[k] && typeof v[k] === "object") stack.push(v[k]);
  }
  return found;
}
export const captionTrackLines = (tracks) => (tracks || []).map((t) => `${t.lang}${t.name ? ` (${t.name})` : ""}${t.auto ? ", made by speech recognition" : ""}`);
