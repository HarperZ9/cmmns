// Builds docs/verify-offline.html: one file that checks an offline kit with no network. The trusted
// key set, Daylight Commons' own signing code (src/core/sig.js, signing.js, head.js, bundle-verify.js,
// kit-verify.js),
// the styles and the Hanken Grotesk font are all inside it. No fetch, no external script, no
// external font, no address of any kind, so it works from a USB stick with the network off.
// scripts/kit.mjs puts a copy in every release before SHA256SUMS is signed.
//   node scripts/verify-offline.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, esc } from "./site/page.mjs";

const MODULES = ["sig.js", "signing.js", "head.js", "bundle-verify.js", "kit-verify.js"];
const ident = (f) => "M_" + f.replace(/\.js$/, "").replace(/-/g, "_");

// Each module in its own scope, imports read from the modules before it, as scripts/build.mjs does.
export function inlineModules(files = MODULES) {
  let body = "";
  for (const f of files) {
    let src = readFileSync(join(ROOT, "src", "core", f), "utf8").replace(/\r\n/g, "\n");
    src = src.replace(/^import \{([^}]*)\} from "\.\/([\w-]+\.js)";$/gm, (_, names, dep) => `const {${names}} = ${ident(dep)};`);
    if (/^import /m.test(src)) throw new Error(`${f} imports something the offline page cannot carry`);
    const exported = [];
    src = src.replace(/^export (const|async function|function|let|class) ([A-Za-z_$][\w$]*)/gm, (_, kind, name) => { exported.push(name); return `${kind} ${name}`; });
    src = src.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
    body += `const ${ident(f)} = (() => {\n${src}\nreturn { ${exported.join(", ")} };\n})();\n`;
  }
  return body;
}

// The trusted key set from public JWKs: [{ keyId, label, jwk }], only public members.
export function trustedSet(keys) {
  return keys.map((k) => ({ keyId: String(k.keyId).replace(/\s/g, ""), label: k.label || "Daylight Commons project key", jwk: { kty: k.kty, crv: k.crv, x: k.x, y: k.y } }));
}

const UI = `const { checkKit, checkBundleFile } = M_kit_verify;
const $ = (id) => document.getElementById(id);
function show(r) {
  const out = $("kit-out");
  out.replaceChildren();
  for (const l of r.lines) { const li = document.createElement("li"); li.textContent = l.text; li.className = l.kind; out.append(li); }
  out.dataset.ok = r.ok ? "1" : "0";
  out.dataset.done = "1";
}
async function run(list) {
  $("kit-out").dataset.done = "";
  $("kit-out").replaceChildren(Object.assign(document.createElement("li"), { textContent: "Reading the files on this device..." }));
  const files = new Map();
  for (const f of list) files.set(f.name, new Uint8Array(await f.arrayBuffer()));
  show(await checkKit(files, { trusted: TRUSTED }));
}
const fail = (e) => { console.error("[daylight-commons] kit check failed", e); show({ ok: false, lines: [{ kind: "bad", text: "The check could not run: " + e.message }] }); };
for (const id of ["kit-files", "kit-folder"]) $(id).addEventListener("change", (e) => run(e.target.files).catch(fail));
$("bundle-file").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (f) f.arrayBuffer().then((b) => checkBundleFile(new Uint8Array(b))).then(show).catch(fail);
});`;

const CSS = `:root{color-scheme:light;--paper:#ebe5d8;--panel:#e2dac9;--ink:#16130f;--soft:#4a443b;--line:#c9bfab;--drift:#8f3a19;--verified:#0a6b61;--sans:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--mono:ui-monospace,"Cascadia Mono",Consolas,monospace}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--paper:#060608;--panel:#111114;--ink:#ece5d6;--soft:#b8b0a0;--line:#29282c;--drift:#e29472;--verified:#63d4ce}}
*{box-sizing:border-box}html{background:var(--paper)}body{margin:0;background:var(--paper);color:var(--ink);font:400 1.0625rem/1.55 var(--sans)}
main{max-width:44rem;margin:0 auto;padding:2rem 1rem 3rem}h1{font-size:clamp(1.8rem,1.2rem + 2.4vw,2.6rem);line-height:1.1;margin:0 0 .75rem;font-weight:600}
h2{font-size:1.25rem;margin:2rem 0 .5rem;font-weight:600}p,li{max-width:38rem}code,.key{font-family:var(--mono)}
.key{display:block;font-size:clamp(1.1rem,.9rem + 1.2vw,1.5rem);letter-spacing:.04em;padding:.75rem 1rem;border:1px solid var(--line);background:var(--panel);margin:.5rem 0 1rem;word-break:break-word}
label{display:block;margin:.75rem 0 .25rem;font-weight:600}input[type=file]{font:inherit;max-width:100%}
#kit-out{list-style:none;padding:0;margin:1rem 0}#kit-out li{padding:.4rem 0;border-top:1px solid var(--line)}
#kit-out .bad{color:var(--drift);font-weight:600}#kit-out .good{color:var(--ink)}#kit-out .note{color:var(--soft)}.muted{color:var(--soft)}`;

export function render({ keys = [JSON.parse(readFileSync(join(ROOT, "docs", "release-key.json"), "utf8"))] } = {}) {
  const trusted = trustedSet(keys);
  const font = readFileSync(join(ROOT, "src", "ext", "fonts", "hanken-grotesk.woff2")).toString("base64");
  const ids = trusted.map((t) => `<span class="key">${esc(t.keyId.match(/.{1,4}/g).join(" "))}</span>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Check a Daylight Commons kit</title>
<style>
@font-face{font-family:"Hanken Grotesk";src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:100 900;font-display:swap}
${CSS}
</style>
</head>
<body>
<main>
<h1>Check a Daylight Commons kit</h1>
<p>This page checks the files in a Daylight Commons kit on this device. It needs no network and sends nothing. The key below is built into this file.</p>
${ids}
<p>Compare that key with the printed card or a second source, such as a person you trust or a different website. A key that came in the same download as the files can be swapped along with them. If the two differ, stop.</p>
<h2>Pick the kit</h2>
<label for="kit-folder">The whole kit folder</label>
<input type="file" id="kit-folder" webkitdirectory multiple>
<label for="kit-files">Or every file in it</label>
<input type="file" id="kit-files" multiple>
<h2>Or check one evidence bundle</h2>
<label for="bundle-file">A signed bundle saved by Daylight Commons</label>
<input type="file" id="bundle-file" accept=".json,application/json">
<ul id="kit-out" aria-live="polite"></ul>
<h2>What a pass shows</h2>
<p class="muted">A pass means these are the files the holder of the built-in key signed. The signed head gives their release, version and expiry. The signature tells you who signed them, so give the files the same care as any download before you run them. The key is only as good as the place this page came from. No independent security audit has reviewed this page yet.</p>
</main>
<script>
"use strict";
(() => {
const TRUSTED = ${JSON.stringify(trusted)};
${inlineModules()}
${UI}
})();
</script>
</body>
</html>
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(join(ROOT, "docs", "verify-offline.html"), render());
  console.log("wrote docs/verify-offline.html");
}
