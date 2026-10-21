// Shared by scripts/transparency.mjs and scripts/privacy.mjs: the page shell for Radar's public
// pages, a small Markdown reader for the subset the project's docs use, and the writer that puts
// each page both inside the extension (src/ext) and in docs/ for the public site.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const REPO = "https://github.com/HarperZ9/radar";
export const SITE = "https://harperz9.github.io/radar";

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

const CSS = `@font-face { font-family: "Hanken Grotesk"; src: url("fonts/hanken-grotesk.woff2") format("woff2"); font-weight: 100 900; font-display: swap; }
@font-face { font-family: "Conso"; src: url("fonts/conso-regular.woff2") format("woff2"); font-weight: 400; font-display: swap; }
:root { --ink: #14181c; --muted: #4f5b66; --line: #d9dcd6; --ground: #f7f6f2; --raised: #fffefb; --hot: #b93c0a;
  --sans: "Hanken Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif; --mono: "Conso", ui-monospace, "Cascadia Mono", Consolas, monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --ink: #e8e6e1; --muted: #a3acb5; --line: #2e3439; --ground: #111417; --raised: #181c20; --hot: #fb923c; } }
:root[data-theme="dark"] { --ink: #e8e6e1; --muted: #a3acb5; --line: #2e3439; --ground: #111417; --raised: #181c20; --hot: #fb923c; }
* { box-sizing: border-box; }
html, body { background: var(--ground); }
body { margin: 0; color: var(--ink); font: 400 16px/1.6 var(--sans); }
main { max-width: 960px; margin: 0 auto; padding: 48px 16px 64px; }
h1 { font-size: 2em; line-height: 1.15; margin: 0 0 8px; }
h2 { font-size: 1.3em; margin: 40px 0 12px; padding-top: 24px; border-top: 1px solid var(--line); }
h3 { font-size: 1.05em; margin: 24px 0 8px; }
p, li { max-width: 68ch; }
a { color: var(--ink); text-underline-offset: 3px; }
code, .mono { font-family: var(--mono); font-size: 0.92em; font-variant-numeric: tabular-nums; }
.lead { font-size: 1.15em; }
.muted { color: var(--muted); }
.hot { color: var(--hot); font-weight: 600; }
.scroll { overflow-x: auto; margin: 12px 0; }
table { border-collapse: collapse; width: 100%; font-size: 0.9em; }
th, td { text-align: left; vertical-align: top; padding: 8px 12px 8px 0; border-bottom: 1px solid var(--line); }
th { color: var(--muted); font-weight: 600; }
td.num { font-family: var(--mono); font-size: 0.92em; font-variant-numeric: tabular-nums; }
footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--line); color: var(--muted); font-size: 0.9em; }`;

export function page({ title, description, updated, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<style>
${CSS}
</style>
</head>
<body>
<main>
<h1>${esc(title)}</h1>
<p class="muted">Updated ${esc(updated)}.</p>
${body}
<footer>Radar. Evidence, not verdicts. Nothing leaves your browser. <a href="${REPO}">Source</a> · <a href="transparency.html">How Radar is measured</a> · <a href="privacy.html">Privacy</a></footer>
</main>
</body>
</html>
`;
}

// The same page goes inside the extension and in docs/ for the public site, with its fonts.
export const FONT_FILES = ["hanken-grotesk.woff2", "conso-regular.woff2", "OFL-hanken-grotesk.txt", "FONTS.md"];
export const TARGETS = [join(ROOT, "src", "ext"), join(ROOT, "docs")];
export function writePage(name, html) {
  for (const dir of TARGETS) {
    mkdirSync(join(dir, "fonts"), { recursive: true });
    writeFileSync(join(dir, name), html);
  }
  for (const f of FONT_FILES) copyFileSync(join(ROOT, "src", "ext", "fonts", f), join(ROOT, "docs", "fonts", f));
}
