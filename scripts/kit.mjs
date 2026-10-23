// The offline kit: one folder that passes by USB stick, SD card or local network and can be checked
// with no network and no install. scripts/release.mjs writes the kit's own files into every release
// before SHA256SUMS is signed, so the signature covers them too:
//   verify-offline.html  the single-file checker with the trusted key inside (scripts/verify-offline.mjs)
//   KEY-CARD.html        a printable card with the key id and a QR copy of it
//   KIT-GUIDE.txt        plain-language guidance, a draft that has not had a security partner's review
// A kit is then a copy of the whole release folder: packages, CLI, git bundle, SHA256SUMS, its
// signature, the signed head and the key file.
//   node scripts/kit.mjs <release folder> --out <kit folder>
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, copyFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { render as renderPage, trustedSet } from "./verify-offline.mjs";
import { qrSvg } from "./qr.mjs";
import { esc } from "./site/page.mjs";

export const KIT_EXTRAS = ["verify-offline.html", "KEY-CARD.html", "KIT-GUIDE.txt"];
const sha = (b) => createHash("sha256").update(b).digest("hex");

export function keyCard({ version, keys }) {
  const rows = trustedSet(keys).map((t) => `<section><p class="label">${esc(t.label)}</p><p class="key">${esc(t.keyId.match(/.{1,4}/g).join(" "))}</p>${qrSvg(t.keyId, 176)}</section>`).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Daylight Commons key card</title>
<style>
body{margin:0;background:#fff;color:#000;font:400 16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:34rem;margin:0 auto;padding:1.5rem 1rem}h1{font-size:1.5rem;margin:0 0 .5rem}
section{border:1px solid #000;padding:1rem;margin:1rem 0;break-inside:avoid}.label{margin:0;font-weight:600}
.key{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:1.35rem;letter-spacing:.04em;margin:.5rem 0 1rem;word-break:break-word}
ol{padding-left:1.25rem}@media print{main{padding:0}}
</style>
</head>
<body>
<main>
<h1>Daylight Commons key card</h1>
<p>Release ${esc(version)}. Print this, or copy the key id by hand, and keep it apart from the kit.</p>
${rows}
<ol>
<li>Open <code>verify-offline.html</code> from the kit in any browser. It needs no network.</li>
<li>Check that the key it shows matches this card, character by character.</li>
<li>Pick the kit folder. Install only if it says "Kit verified".</li>
</ol>
<p>A card that came with the kit proves nothing on its own. Compare it with one from a second source: a person you trust, or a different website.</p>
</main>
</body>
</html>
`;
}

export const GUIDE = `DAYLIGHT COMMONS: USING IT WITHOUT THE INTERNET

Draft guidance. A security partner has not reviewed it yet. The kit and its
checker have had no independent security audit.

WHAT DAYLIGHT COMMONS DOES WHEN THE INTERNET IS DOWN
It keeps working on what it already has: it checks posts against its stored
catalogue and shows how old that catalogue is. It cannot fetch new data until
you reconnect or someone gives you an update.

CHECK WHAT YOU INSTALL
1. Open verify-offline.html from this kit in a browser. It needs no network.
2. Compare the key id it shows with one from a second source: a person you
   trust, a printed card, a different website. A key that arrives in the same
   download as the files proves nothing.
3. Pick the kit folder. If it does not say "Kit verified", do not install.
4. The checker shows the release, the head version and the date it expires.
   If you have seen a newer version before, this kit is older. Keep the newer.

SHARE UPDATES THE SAFE WAY
Copy the whole kit folder to a stick or card. Hand it over. Ask the receiver
to run the checker before installing. You never need to trust the person who
gave it to you. You trust the signatures, and the key you compared.

WHAT THIS TOOL CANNOT PROTECT
- If someone takes your phone and you are made to open it, they can read what
  is on it.
- If your phone or computer has been hacked, the tool cannot help.
- If someone forces you to reveal a contact or a file, no software can stop
  that.
- Having a privacy tool on your device can itself be noticed. In some places
  that is risky. Know the law where you are before you install or carry
  anything.

IF YOU HOLD INFORMATION THAT COULD PUT YOU AT RISK
- Do not send it through Daylight Commons. It does not run a secure channel.
- Use a newsroom's SecureDrop, or a GlobaLeaks site, reached through Tor
  Browser. If you can, use Tails on a device that is not your usual one.
- Remove hidden data first: photo location, document author names, tracked
  changes. Do not copy a file from your work account.
- Writing style can identify you. Paraphrase with care.
- Legal protections differ by country. The tool does not promise any.

WHAT A PASSING CHECK SHOWS
The files match what the holder of the key signed, at the time the head
names. It does not show the files are safe, and it does not show the key is
right if the checker itself came from someone you do not trust. The card and
a second source are the defence.
`;

// The kit's own files for a release: [[name, Buffer]], the same bytes for the same commit and key.
export function kitExtras({ version, keys }) {
  return [["verify-offline.html", Buffer.from(renderPage({ keys }))], ["KEY-CARD.html", Buffer.from(keyCard({ version, keys }))], ["KIT-GUIDE.txt", Buffer.from(GUIDE)]];
}
export function writeKitExtras(dir, opts) { for (const [n, b] of kitExtras(opts)) writeFileSync(join(dir, n), b); }

// Copies a release folder into a fresh kit folder; returns the kit's file list "<sha256>  <name>".
export function buildKit(releaseDir, outDir) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const names = readdirSync(releaseDir).filter((n) => statSync(join(releaseDir, n)).isFile()).sort();
  for (const n of names) copyFileSync(join(releaseDir, n), join(outDir, n));
  return kitList(outDir);
}
export const kitList = (dir) => readdirSync(dir).sort().map((n) => `${sha(readFileSync(join(dir, n)))}  ${n}`).join("\n") + "\n";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), src = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--out");
  const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
  if (!src || !out || !existsSync(src)) { console.error("usage: node scripts/kit.mjs <release folder> --out <kit folder>"); process.exit(2); }
  const missing = KIT_EXTRAS.filter((n) => !existsSync(join(src, n)));
  if (missing.length) console.warn(`this release has no ${missing.join(", ")}; releases before 3.2.0 carry no kit files`);
  const list = buildKit(src, out);
  console.log(list.trimEnd());
  console.log(`kit written to ${out}; kit list sha256 ${sha(list)}`);
}
