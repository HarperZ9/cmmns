// The "How Daylight Commons works" diagram, drawn in the author's site canon: ink line-work on the
// site's paper and void grounds, Hanken Grotesk for words and the mono face for code, square
// corners, and one hot mark per view (the signal colour, on the check that passes). Writes a light
// and a dark SVG with the font embedded, so each file stands alone.
//   node scripts/demo/diagram.mjs <out dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FONT = readFileSync(join(ROOT, "src/ext/fonts/hanken-grotesk.woff2")).toString("base64");
const MONO = readFileSync(join(ROOT, "src/ext/fonts/jetbrains-mono-regular.woff2")).toString("base64");
// The site's tokens (system/doc.css, reading.css on the author's site): paper and void grounds.
export const THEMES = {
  light: { ground: "#ebe5d8", ink: "#16130f", soft: "#57524a", rule: "#b9b1a2", hot: "#1b5f6e", sunk: "#e2dbcc" },
  dark: { ground: "#0b070a", ink: "#eaf5f6", soft: "#94afb4", rule: "#36474b", hot: "#8ee3f2", sunk: "#140d11" },
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function box(t, x, y, w, h, title, lines, { hot = false, dashed = false, mono = [] } = {}) {
  const stroke = hot ? t.hot : t.ink;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${t.ground}" stroke="${stroke}" stroke-width="${hot ? 2 : 1.25}"${dashed ? ' stroke-dasharray="5 5"' : ""}/>`;
  s += `<text x="${x + 18}" y="${y + 34}" class="h" fill="${hot ? t.hot : t.ink}">${esc(title)}</text>`;
  lines.forEach((l, i) => { s += `<text x="${x + 18}" y="${y + 62 + i * 24}" class="${mono.includes(i) ? "m" : "b"}" fill="${t.soft}">${esc(l)}</text>`; });
  return s;
}
const arrow = (t, x1, y1, x2, y2, { dashed = false } = {}) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${t.ink}" stroke-width="1.25"${dashed ? ' stroke-dasharray="5 5"' : ""} marker-end="url(#a)"/>`;
const label = (t, x, y, text, cls = "s") => `<text x="${x}" y="${y}" class="${cls}" fill="${t.soft}">${esc(text)}</text>`;

export function diagram(theme) {
  const t = THEMES[theme];
  const parts = [];
  // The device boundary.
  parts.push(`<rect x="40" y="96" width="1020" height="640" fill="${t.sunk}" stroke="${t.rule}" stroke-width="1"/>`);
  parts.push(label(t, 60, 128, "Your browser. Everything inside this line stays on your device.", "k"));
  parts.push(box(t, 80, 160, 290, 170, "1. The page you read", ["Replies on X, Reddit, YouTube,", "Bluesky, Mastodon and more,", "as the site already shows them."]));
  parts.push(box(t, 430, 160, 290, 170, "2. The reader", ["Reads the replies and what the", "site discloses about accounts.", "No IP addresses, no hidden data."]));
  parts.push(box(t, 780, 160, 250, 170, "3. The rules", ["Place, coordination, language,", "sources, launch campaigns.", "Side is never an input."]));
  parts.push(box(t, 780, 400, 250, 196, "4. The window", ["Each sign beside the reply,", "with its source, its measured", "precision or \"not measured", "yet\", and what it does not", "prove. No verdicts."]));
  parts.push(box(t, 430, 400, 290, 196, "5. Receipts", ["Each fact a lookup returns,", "hashed and appended to a chain", "on this device, with a Merkle", "root and a proof per receipt."]));
  parts.push(box(t, 80, 400, 290, 196, "6. Save evidence chain", ["One file holds the receipts,", "the chain and the proofs.", "radar-evidence-chain/1"], { mono: [2] }));
  parts.push(arrow(t, 370, 245, 428, 245), arrow(t, 720, 245, 778, 245), arrow(t, 905, 330, 905, 398), arrow(t, 428, 498, 372, 498));
  // Outside the device: only on the user's click, off by default.
  parts.push(box(t, 1120, 160, 440, 250, "On your click, off by default", ["Evidence lookups send a post's linked", "repository names and web domains to", "GitHub, rdap.org and the Internet Archive.", "Other coverage reads the news feeds of", "outlets you chose and sends nothing", "from the page."], { dashed: true }));
  parts.push(arrow(t, 1032, 520, 1196, 413, { dashed: true }), label(t, 1112, 500, "your click"));
  parts.push(`<polyline points="1118,300 1080,300 1080,366 575,366 575,396" fill="none" stroke="${t.ink}" stroke-width="1.25" stroke-dasharray="5 5" marker-end="url(#a)"/>`, label(t, 600, 356, "answers, as receipts"));
  parts.push(arrow(t, 225, 596, 225, 778));
  parts.push(box(t, 80, 780, 640, 150, "7. Anyone checks it offline", ["radar verify evidence-chain.json", "or open it on the Analyse a file page.", "Pass: no receipt was changed, removed or reordered. One edit: it fails."], { hot: true, mono: [0] }));
  parts.push(label(t, 780, 830, "No server of ours, no account, no analytics.", "k"));
  parts.push(label(t, 780, 860, "A receipt shows what a source said and when.", "k"));
  parts.push(label(t, 780, 890, "It does not show that the source was right.", "k"));
  parts.push(`<text x="40" y="58" class="t" fill="${t.ink}">How Daylight Commons works</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 970" width="1600" height="970" role="img" aria-labelledby="dt dd">
<title id="dt">How Daylight Commons works</title>
<desc id="dd">The page you read goes to the reader, then the rules, then the window beside the reply, all inside your browser. Evidence lookups and Other coverage leave the browser only on your click. Looked-up facts become hashed receipts in a chain on your device; you can save the chain, and anyone can check it offline.</desc>
<defs><style>@font-face{font-family:"DC Hanken";src:url(data:font/woff2;base64,${FONT}) format("woff2");font-weight:100 900}
@font-face{font-family:"DC Mono";src:url(data:font/woff2;base64,${MONO}) format("woff2")}
text{font-family:"DC Hanken","Hanken Grotesk",system-ui,sans-serif}
.t{font-size:34px;font-weight:700}.h{font-size:21px;font-weight:650}.b{font-size:17px}.s{font-size:15px}.k{font-size:16px;font-weight:500}
.m{font-family:"DC Mono","JetBrains Mono",ui-monospace,Consolas,monospace;font-size:15px}</style>
<marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 1 L9 5 L0 9" fill="none" stroke="${t.ink}" stroke-width="1.4"/></marker></defs>
<rect width="1600" height="970" fill="${t.ground}"/>
${parts.join("\n")}
</svg>
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2];
  if (!out) { console.error("usage: node scripts/demo/diagram.mjs <out dir>"); process.exit(2); }
  mkdirSync(out, { recursive: true });
  for (const theme of Object.keys(THEMES)) writeFileSync(join(out, `how-it-works-${theme}.svg`), diagram(theme));
  console.log(`wrote how-it-works-light.svg and how-it-works-dark.svg to ${out}`);
}
