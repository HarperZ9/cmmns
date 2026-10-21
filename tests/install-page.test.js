// The install page (scripts/install-page.mjs) is generated from INSTALL.md with the release key's id,
// its checker loads an exact copy of src/core/signing.js, and it carries no local path or em dash.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { render, signingForPage } from "../scripts/install-page.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").split("\r\n").join("\n");

test("the committed install page matches a fresh build", () => {
  assert.equal(read("docs/install.html"), render(), "run `npm run pages`");
});

test("the page's checker uses the same signing code as Radar", () => {
  assert.equal(read("docs/signing.js"), signingForPage(), "run `npm run pages`");
  assert.ok(read("docs/signing.js").includes(read("src/core/sig.js")), "the page carries sig.js unchanged");
  assert.match(read("docs/verify.js"), /from "\.\/signing\.js"/);
});

test("the page's copy signs and verifies like Radar's own, with no imports", async () => {
  assert.doesNotMatch(read("docs/signing.js"), /^import /m);
  const page = await import("../docs/signing.js");
  const core = await import("../src/core/signing.js");
  const { privateJwk, publicJwk } = await core.generateSigningKey();
  const sig = await core.signSums(privateJwk, "sums");
  assert.equal(await page.verifySums(publicJwk, "sums", sig), true);
  assert.equal(await page.verifySums(publicJwk, "sums!", sig), false);
  assert.equal(await page.signingKeyId(publicJwk), await core.signingKeyId(publicJwk));
  assert.equal(await page.sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("the page names the key id, both browser makers' limits, and what it does not prove", () => {
  const html = render(), key = JSON.parse(read("docs/release-key.json"));
  assert.ok(html.includes(key.keyId));
  for (const s of ["Developer mode", "ExtensionInstallForcelist", "Mozilla has signed", "What this does not prove", "git clone"]) assert.ok(html.includes(s), s);
  assert.doesNotMatch(html, /\b[A-Z]:[\/]|—|TODO/);
});
