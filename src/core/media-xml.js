// A small XML reader for DASH manifests (MPD). A service worker has no DOMParser, so this reads
// elements, attributes and text into a plain tree: { name, attrs, children, text }. It skips the
// prolog, comments, processing instructions and DOCTYPE, decodes the five XML entities and numeric
// references, and drops namespace prefixes from names ("cenc:pssh" stays as written in attrs).

const ENTITY = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
  if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENTITY[e] !== undefined ? ENTITY[e] : m;
});
const local = (name) => name.includes(":") ? name.slice(name.indexOf(":") + 1) : name;

function attrsOf(src) {
  const out = {};
  for (const m of src.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1]] = decode(m[3] !== undefined ? m[3] : m[4]);
  return out;
}

// The root element of an XML document, or null when there is none. Never throws on bad markup;
// unclosed elements close at the end of the text.
export function readXml(text) {
  const s = String(text || "");
  const root = { name: "#document", attrs: {}, children: [], text: "" };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<!DOCTYPE[^>]*>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/gy;
  let m;
  while ((m = re.exec(s))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2]) { const at = stack.map((e) => e.name).lastIndexOf(local(m[2])); if (at > 0) stack.length = at; }
    else if (m[3]) {
      const el = { name: local(m[3]), attrs: attrsOf(m[4] || ""), children: [], text: "" };
      top.children.push(el);
      if (!m[5]) stack.push(el);
    } else if (m[6] !== undefined) top.text += decode(m[6]);
    if (re.lastIndex >= s.length) break;
  }
  return root.children[0] || null;
}

// Every descendant (or the element itself) named `name`.
export function xmlAll(el, name, out = []) {
  if (!el) return out;
  if (el.name === name) out.push(el);
  for (const c of el.children) xmlAll(c, name, out);
  return out;
}

// The first direct child named `name`, or null.
export const xmlChild = (el, name) => (el && el.children.find((c) => c.name === name)) || null;
export const xmlChildren = (el, name) => (el ? el.children.filter((c) => c.name === name) : []);
