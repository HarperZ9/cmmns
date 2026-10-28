// The release checker on the install page. It reads the files the visitor picks, on their device,
// and checks SHA256SUMS.sig against CMMNS' public key, then every file's hash against SHA256SUMS.
// It sends nothing. signing.js is CMMNS' src/core/sig.js and src/core/signing.js joined (scripts/install-page.mjs).
import { verifySums, sha256Hex, parseSums, signingKeyId, SIGNATURE_DOES_NOT_PROVE } from "./signing.js";

const $ = (id) => document.getElementById(id);
const line = (text, cls) => { const li = document.createElement("li"); li.textContent = text; if (cls) li.className = cls; $("verify-out").append(li); };

async function check(files) {
  $("verify-out").replaceChildren();
  const byName = new Map([...files].map((f) => [f.name, f]));
  const sums = byName.get("SHA256SUMS"), sig = byName.get("SHA256SUMS.sig");
  if (!sums || !sig) { line("Pick SHA256SUMS and SHA256SUMS.sig together with the files to check.", "bad"); return; }
  const key = await (await fetch("release-key.json", { cache: "no-store" })).json();
  line(`Key id ${await signingKeyId(key)}. Compare it with one you got another way.`);
  const text = await sums.text();
  const ok = await verifySums(key, text, await sig.text());
  line(ok ? "Signature over SHA256SUMS: valid." : "Signature over SHA256SUMS: NOT valid. Do not install these files.", ok ? "good" : "bad");
  const listed = parseSums(text);
  if (!listed) { line("SHA256SUMS is not in the expected form.", "bad"); return; }
  for (const [name, want] of Object.entries(listed)) {
    const f = byName.get(name);
    if (!f) { line(`${name}: not picked, not checked.`); continue; }
    const got = await sha256Hex(new Uint8Array(await f.arrayBuffer()));
    line(`${name}: ${got === want ? "matches" : "DOES NOT MATCH"}.`, got === want ? "good" : "bad");
  }
  for (const name of byName.keys()) if (!(name in listed) && name !== "SHA256SUMS" && name !== "SHA256SUMS.sig") line(`${name}: not in SHA256SUMS, so the signature does not cover it.`, "bad");
  line(SIGNATURE_DOES_NOT_PROVE);
}

$("verify-files").addEventListener("change", (e) => check(e.target.files).catch((err) => line("The check failed: " + err.message, "bad")));
