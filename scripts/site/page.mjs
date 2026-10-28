// Shared by scripts/transparency.mjs and scripts/privacy.mjs: the page shell for CMMNS' public
// pages, a small Markdown reader for the subset the project's docs use, and the writer that puts
// each page both inside the extension (src/ext) and in docs/ for the public site.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const REPO = "https://github.com/HarperZ9/cmmns";
export const SITE = "https://harperz9.github.io/cmmns";

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Inline Markdown: **bold**, `code`, [text](url). Input is escaped first.
export function inline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

function table(lines) {
  const cells = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const [head, , ...rows] = lines;
  const th = cells(head).map((c) => `<th scope="col">${inline(c)}</th>`).join("");
  const tr = rows.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("\n");
  return `<div class="scroll"><table><thead><tr>${th}</tr></thead><tbody>\n${tr}\n</tbody></table></div>`;
}

// Block Markdown: headings (## and ###), paragraphs, "- " lists with indented continuations, tables.
export function markdown(src, { skipTitle = true } = {}) {
  const out = [];
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const h = l.match(/^(#{1,3}) (.*)$/);
    if (h) { if (!(skipTitle && h[1] === "#")) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (l.startsWith("|")) { const t = []; while (i < lines.length && lines[i].startsWith("|")) t.push(lines[i++]); out.push(table(t)); continue; }
    if (l.startsWith("- ")) {
      const items = [];
      while (i < lines.length && (lines[i].startsWith("- ") || /^ {2,}\S/.test(lines[i]))) {
        if (lines[i].startsWith("- ")) items.push(lines[i].slice(2)); else items[items.length - 1] += " " + lines[i].trim();
        i++;
      }
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join("\n")}</ul>`);
      continue;
    }
    const p = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||- )/.test(lines[i])) p.push(lines[i++].trim());
    out.push(`<p>${inline(p.join(" "))}</p>`);
  }
  return out.join("\n");
}

// The pages carry the shared tokens (src/ext/canon.css) inline, without its comments, then their
// own layout, so docs/ needs no stylesheet beside the fonts.
const CANON = readFileSync(join(ROOT, "src", "ext", "canon.css"), "utf8").replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\/\n?/g, "").trim();
const CSS = `${CANON}
main { max-width: 60rem; margin: 0 auto; padding: var(--s-7) var(--gutter) var(--s-8); }
h1 { font-size: var(--t-display); margin: 0 0 var(--s-3); }
h2 { font-size: clamp(1.4rem, 1.1rem + 1vw, 1.9rem); margin: var(--s-7) 0 var(--s-3); }
h2:not(.bare) { position: relative; padding-top: var(--s-5); background: linear-gradient(var(--line), var(--line)) top left / 100% 1px no-repeat; }
h2:not(.bare)::before { content: ""; position: absolute; top: -7px; left: -7px; width: 15px; height: 15px; pointer-events: none;
  background: linear-gradient(var(--ink), var(--ink)) center / 1px 100% no-repeat, linear-gradient(var(--ink), var(--ink)) center / 100% 1px no-repeat; }
h3 { font-size: var(--t-h3); margin: var(--s-5) 0 var(--s-2); }
p, li { max-width: var(--measure); }
code { font-size: .92em; }
.lead { font-size: var(--t-dek); }
.muted { color: var(--soft); }
.scroll { overflow-x: auto; margin: var(--s-3) 0; }
table { font-size: .92em; }
td.num { font-size: .92em; text-align: left; }
footer { margin-top: var(--s-7); padding-top: var(--s-4); border-top: 1px solid var(--line); color: var(--soft); font-size: var(--t-meta); }`;

export function page({ title, description, updated, body, css = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<style>
${CSS}${css ? "\n" + css : ""}
</style>
</head>
<body>
<main>
<h1>${esc(title)}</h1>
<p class="muted">Updated ${esc(updated)}.</p>
${body}
<footer>CMMNS reads the site you are on. Other coverage and evidence lookups reach further once you turn them on. <a href="${REPO}">Source</a> · <a href="transparency.html">How CMMNS is measured</a> · <a href="privacy.html">Privacy</a> · <a href="https://harperz9.github.io/">Zain Dana Harper</a></footer>
</main>
</body>
</html>
`;
}

// The public site's copy of a page (docs/, served under harperz9.github.io/cmmns/). It is
// set in the author's site canon: the site's own document cascade (/system/doc.css, with its
// Hanken Grotesk and Conso), its navigation (/system/nav.js), its light and dark grounds, the mast
// and the heading rail. The extension cannot load those, so its copy keeps page() above.
const SITE_CSS = `.sheet{--soft:var(--ink-muted);--line:var(--rule);--line-strong:var(--rule-strong);--raised:var(--page-sunk);--s-1:.25rem;--s-2:.5rem;--s-4:1rem;--s-6:2rem;--t-dek:1.12rem;--t-meta:.875rem}
.dc-updated{color:var(--ink-muted);font-size:.9rem}
.dc-local{display:flex;flex-wrap:wrap;gap:.35rem 1.15rem;margin:0 0 1.6rem;font-size:.9rem}
.dc-local a[aria-current="page"]{color:var(--ink);border-color:var(--ink)}
.scroll{overflow-x:auto;margin:.4rem 0 .9rem}
.sheet p,.sheet li{max-width:var(--measure)}
.dc-foot{margin-top:2.4rem;padding-top:1rem;border-top:1px solid var(--rule);color:var(--ink-muted);font-size:.9rem}`;
export const SITE_PAGES = [["how-it-works.html", "How it works"], ["install.html", "Install"], ["privacy.html", "Privacy"], ["transparency.html", "How it is measured"], ["catalogue.html", "Catalogue"]];

// Wraps each h2 and what follows it in a section, so the site's heading rail can place it.
export function sections(html) {
  const parts = html.split(/(?=<h2>)/);
  return parts.map((p) => {
    const m = p.match(/^<h2>(.*?)<\/h2>/);
    if (!m) return p;
    const id = m[1].replace(/<[^>]+>/g, "").toLowerCase().replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    // A heading that names the product kept its old id before the CMMNS rename; an empty anchor
    // with that id keeps old deep links (#what-daylight-commons-reads) landing on the same section.
    const old = id.includes("cmmns") ? `<span id="${id.replace(/cmmns/g, "daylight-commons")}"></span>
` : "";
    return `<section aria-labelledby="${id}">
${old}${p.replace(/^<h2>/, `<h2 id="${id}">`).trim()}
</section>
`;
  }).join("");
}

export function sitePage({ file, title, role, description, updated, body, css = "" }) {
  const local = SITE_PAGES.map(([f, label]) => `<a href="${f}"${f === file ? ' aria-current="page"' : ""}>${esc(label)}</a>`).join(" ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<title>${esc(title)} | CMMNS</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}/${file}">
<link rel="preload" href="/system/fonts/hanken-grotesk.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/system/doc.css">
<link rel="stylesheet" href="/system/art.css">
<style>
${SITE_CSS}${css ? "\n" + css : ""}
</style>
</head>
<body class="doc">
<a class="skip-link" href="#main">Skip to content</a>
<div id="site-nav" class="site-nav"></div>
<noscript><nav class="site-nav" aria-label="Primary"><a href="/index.html">Home</a> <a href="/research.html">Research</a> <a href="/hire.html">Work</a></nav></noscript>
<script type="module" src="/system/nav.js"></script>
<main id="main">
<article class="sheet doc-rail">
<header class="mast">
<h1>${esc(title)}</h1>
<p class="role">${esc(role || description)}</p>
</header>
<nav class="dc-local" aria-label="CMMNS">${local} <a href="${REPO}">Source</a></nav>
<p class="dc-updated">Updated ${esc(updated)}.</p>
${sections(body.replace(/<table>/g, '<table class="data data--wide">'))}
<p class="dc-foot">CMMNS reads the site you are on. It contacts anything else only when you turn on Other coverage or evidence lookups and click. Free and open source under the AGPL-3.0.</p>
</article>
</main>
</body>
</html>
`;
}

// The same page goes inside the extension and in docs/ for the public site, with its fonts.
export const FONT_FILES = ["hanken-grotesk.woff2", "jetbrains-mono-regular.woff2", "OFL-jetbrains-mono.txt", "OFL-hanken-grotesk.txt", "FONTS.md"];
export const TARGETS = [join(ROOT, "src", "ext"), join(ROOT, "docs")];
// render(target): "ext" for the extension's copy, "site" for the public site's.
export function writePage(name, render) {
  for (const dir of TARGETS) {
    mkdirSync(join(dir, "fonts"), { recursive: true });
    writeFileSync(join(dir, name), render(dir.endsWith("docs") ? "site" : "ext"));
  }
  for (const f of FONT_FILES) copyFileSync(join(ROOT, "src", "ext", "fonts", f), join(ROOT, "docs", "fonts", f));
}
