// Posts from a page the user saved (File > Save page as). No DOM: a few tolerant string readers,
// so the CLI and the extension's offline analyser read a page the same way. Supported: X threads
// (article elements with tweetText), new Reddit threads (shreddit-post and shreddit-comment), and
// any other page as one block of text with its links. Scripts and styles are never run or read.

const ENT = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", "#39": "'" };

// Entities decoded, tags dropped, line breaks kept where blocks end.
export function htmlText(html) {
  return String(html || "")
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(p|div|li|h\d|blockquote)\b[^>]*>/gi, "\n")
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/gi, " $1 ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (m, e) => {
      if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
      return ENT[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

// The inner HTML of the element whose opening tag starts at `at`, matched on its tag name.
export function innerAt(html, at) {
  const open = html.slice(at).match(/^<([a-z][\w-]*)\b[^>]*>/i);
  if (!open) return "";
  const tag = open[1].toLowerCase(), re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = at + open[0].length;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (!depth) return html.slice(at + open[0].length, m.index);
  }
  return html.slice(at + open[0].length);
}

const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`, "i")); return m ? htmlText(m[1]) : null; };
const hrefs = (html) => [...String(html).matchAll(/<a\b[^>]*\bhref="(https?:\/\/[^"]+)"/gi)].map((m) => htmlText(m[1]));
const isoOrNull = (s) => { const t = Date.parse(s || ""); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

// X posts, read by layers so a markup change does not blind the reader (RADAR-VISION,
// "Independence in perpetuity"): the post box is an <article> or anything with role="article"
// (the accessibility tree), the author and id come from the post's own status link, and the text
// is X's tweetText box or, when test ids are renamed or gone, the first block X marks with a
// language (lang plus dir="auto"). Class names and test ids are never required.
const POST_BOX = /<(?:article\b[^>]*|[a-z][\w-]*\b[^>]*\brole="article"[^>]*)>/gi;
const STATUS = /href="(?:https:\/\/(?:x|twitter)\.com)?\/([A-Za-z0-9_]{1,15})\/status\/(\d+)"[^>]*>\s*<time\b/;
const TEXT_BOX = [/<div\b[^>]*data-testid="tweetText"/i, /<div\b(?=[^>]*\blang="[a-z]{2,3}(?:-[A-Za-z]+)?")(?=[^>]*\bdir="auto")[^>]*>/i];

function xPosts(html) {
  const out = [], seen = new Set();
  for (const m of html.matchAll(POST_BOX)) {
    const body = innerAt(html, m.index);
    const status = body.match(STATUS);
    if (!status || seen.has(status[2])) continue;
    const textAt = TEXT_BOX.map((re) => body.search(re)).find((i) => i >= 0);
    if (textAt === undefined) continue;
    seen.add(status[2]);
    const text = innerAt(body, textAt);
    out.push({ id: status[2], author: status[1], text: htmlText(text), posted: isoOrNull((body.match(/<time\b[^>]*datetime="([^"]+)"/i) || [])[1]), links: hrefs(text).filter((u) => !/^https?:\/\/(x|twitter)\.com\//.test(u)) });
  }
  return out;
}

function redditPosts(html) {
  const out = [];
  const post = html.match(/<shreddit-post\b[^>]*>/i);
  if (post) {
    const at = html.search(/<div\b[^>]*\bid="t3_[^"]*-post-rtjson-content"/i), body = at >= 0 ? htmlText(innerAt(html, at)) : "";
    out.push({ id: attr(post[0], "id") || "post", author: attr(post[0], "author") || "unknown", text: [attr(post[0], "post-title"), body].filter(Boolean).join("\n"), posted: isoOrNull(attr(post[0], "created-timestamp")), links: [attr(post[0], "content-href")].filter((u) => u && /^https?:/.test(u)) });
  }
  for (const m of html.matchAll(/<shreddit-comment\b[^>]*>/gi)) {
    const id = attr(m[0], "thingid");
    if (!id) continue;
    const at = html.indexOf(`id="${id}-comment-rtjson-content"`), start = at >= 0 ? html.lastIndexOf("<", at) : -1;
    const inner = start >= 0 ? innerAt(html, start) : "";
    out.push({ id, author: attr(m[0], "author") || "unknown", text: htmlText(inner), posted: isoOrNull(attr(m[0], "created")), links: hrefs(inner) });
  }
  return out;
}

// Returns { site, root, replies, kind } for a thread, or { site: null, root: null, replies: [one
// page post], kind: "page" } for any other page.
export function postsFromHtml(html) {
  const s = String(html || "");
  const site = /<meta\b[^>]*content="(?:X|Twitter)"|https:\/\/(?:x|twitter)\.com\//i.test(s) && (/data-testid="tweetText"/.test(s) || STATUS.test(s)) ? "X" : /<shreddit-(?:post|comment)\b/i.test(s) ? "Reddit" : null;
  const posts = site === "X" ? xPosts(s) : site === "Reddit" ? redditPosts(s) : [];
  if (posts.length) return { site, root: posts[0], replies: posts.slice(1), kind: "thread" };
  const title = htmlText((s.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  const main = s.match(/<(main|article)\b[^>]*>/i), body = main ? innerAt(s, main.index) : s.replace(/^[\s\S]*?<body\b[^>]*>/i, "");
  return { site: null, root: null, replies: [{ id: "page", author: "page", text: [title, htmlText(body)].filter(Boolean).join("\n").slice(0, 20000), posted: null, links: hrefs(body).slice(0, 200) }], kind: "page" };
}
