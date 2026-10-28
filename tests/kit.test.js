// The offline kit (scripts/kit.mjs) and its single-file checker (docs/verify-offline.html,
// src/core/kit-verify.js). BACKLOG increment 2, acceptance tests 1 to 7; test 8 is
// tests/mirror-check.test.js. Every test feeds at least one input that must be refused.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { generateSigningKey, signingKeyId } from "../src/core/signing.js";
import { checkKit } from "../src/core/kit-verify.js";
import { buildPackages } from "../scripts/package.mjs";
import { cliZip } from "../scripts/cli-zip.mjs";
import { signDir } from "../scripts/release-lib.mjs";
import { writeHead } from "../scripts/head-lib.mjs";
import { writeKitExtras, kitExtras, buildKit, kitList, keyCard } from "../scripts/kit.mjs";
import { render, trustedSet } from "../scripts/verify-offline.mjs";
import { qrMatrix } from "../scripts/qr.mjs";
import { browserSkip, openChrome, goto, evaluate } from "./browser.js";

const K = await generateSigningKey(), OTHER = await generateSigningKey();
const named = async (jwk) => ({ ...jwk, keyId: await signingKeyId(jwk), label: "test key" });
const ROOT = mkdtempSync(join(tmpdir(), "radar-kit-"));
test.after(() => rmSync(ROOT, { recursive: true, force: true }));
const DAY = 86400000, iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

// A signed release folder, then a kit copied from it. real: the actual packages and CLI zip.
async function kit(name, { signer = K, embed = K, real = false } = {}) {
  const rel = join(ROOT, name + "-release"), out = join(ROOT, name);
  mkdirSync(rel, { recursive: true });
  const files = real ? [...buildPackages().files, ["radar-cli-9.9.9.zip", cliZip()]] : [["radar-chrome-9.9.9.zip", Buffer.from("zip bytes")], ["radar-cli-9.9.9.zip", Buffer.from("cli bytes")]];
  for (const [n, d] of files) writeFileSync(join(rel, n), d);
  writeFileSync(join(rel, "release-key.json"), JSON.stringify(await named(signer.publicJwk)));
  writeKitExtras(rel, { version: "9.9.9", keys: [await named(embed.publicJwk)] });
  await signDir(rel, signer.privateJwk);
  await writeHead(rel, signer.privateJwk, { version: 9009009, time: iso(Date.now() - DAY), expires: iso(Date.now() + 90 * DAY), release: "9.9.9", catalogue: { version: "2026.10.22", sha256: "a".repeat(64) } });
  buildKit(rel, out);
  return out;
}
const read = (dir) => new Map(readdirSync(dir).map((n) => [n, new Uint8Array(readFileSync(join(dir, n)))]));
const trusted = async (jwk = K.publicJwk) => trustedSet([await named(jwk)]);
const texts = (r) => r.lines.map((l) => `${l.kind}: ${l.text}`).join("\n");
const flip = (dir, name) => { const b = readFileSync(join(dir, name)); b[Math.floor(b.length / 2)] ^= 1; writeFileSync(join(dir, name), b); };
const FORBIDDEN = [/http:\/\//, /https:\/\//, /fetch\(/, /XMLHttpRequest/, /import\(/, /<script[^>]*\bsrc\b/i, /<link\b/i, /@import/];
const scan = (html) => FORBIDDEN.filter((re) => re.test(html)).map(String);

test("1. with the network blocked, the built page loads in Chrome and verifies the real kit, and names a changed file", { skip: browserSkip, timeout: 120000 }, async () => {
  const good = await kit("real", { real: true });
  const bad = join(ROOT, "real-changed");
  cpSync(good, bad, { recursive: true });
  const pkg = readdirSync(good).find((n) => /^cmmns-chrome-.*\.zip$/.test(n));
  flip(bad, pkg);
  const cdp = await openChrome();
  await import("../scripts/offline-guard.mjs");   // from here the test process itself cannot reach the network
  await assert.rejects(() => fetch("https://example.org/"), /network access is blocked/);
  const requests = [];
  const keep = () => requests.push(...cdp.events.filter((e) => e.method === "Network.requestWillBeSent").map((e) => e.params.request.url));
  try {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    async function check(dir) {
      await goto(cdp, pathToFileURL(join(dir, "verify-offline.html")).href);
      const { root } = await cdp.send("DOM.getDocument");
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#kit-files" });
      await cdp.send("DOM.setFileInputFiles", { nodeId, files: readdirSync(dir).map((n) => join(dir, n)) });
      for (let i = 0; i < 400 && (await evaluate(cdp, "document.getElementById('kit-out').dataset.done")) !== "1"; i++) await new Promise((ok) => setTimeout(ok, 50));
      const out = await evaluate(cdp, "({ ok: document.getElementById('kit-out').dataset.ok, lines: [...document.querySelectorAll('#kit-out li')].map((l) => l.className + ': ' + l.textContent) })");
      keep();
      return out;
    }
    const ok = await check(good);
    assert.equal(ok.ok, "1", ok.lines.join("\n"));
    assert.ok(ok.lines.some((l) => /^good: Kit verified/.test(l)), ok.lines.join("\n"));
    const no = await check(bad);
    assert.equal(no.ok, "0");
    assert.ok(no.lines.some((l) => l.startsWith(`bad: ${pkg}: DOES NOT MATCH`)), no.lines.join("\n"));
  } finally { keep(); cdp.close(); }
  const remote = requests.filter((u) => !/^(file|data):/.test(u));
  assert.deepEqual(remote, [], "the page made a network request");
});

test("2. the offline page carries no address, fetch, request object, dynamic import or external script", async () => {
  const committed = readFileSync(new URL("../docs/verify-offline.html", import.meta.url), "utf8");
  assert.equal(committed.replace(/\r\n/g, "\n"), render(), "docs/verify-offline.html is stale: run node scripts/verify-offline.mjs");
  assert.deepEqual(scan(committed), []);
  assert.deepEqual(scan(kitExtras({ version: "9.9.9", keys: [await named(K.publicJwk)] })[0][1].toString("utf8")), []);
  assert.ok(scan(committed.replace("</script>", "fetch(location);</script>")).includes(String(/fetch\(/)), "the scan catches a planted fetch");
  assert.ok(scan(committed.replace("<head>", "<head><script src=x.js></script>")).length, "the scan catches an external script");
});

test("3. a kit with one byte changed in a package is refused and the file is named", async () => {
  const dir = await kit("changed");
  assert.equal((await checkKit(read(dir), { trusted: await trusted() })).ok, true);
  flip(dir, "radar-chrome-9.9.9.zip");
  const r = await checkKit(read(dir), { trusted: await trusted() });
  assert.equal(r.ok, false);
  assert.deepEqual(r.failed, ["radar-chrome-9.9.9.zip"]);
  assert.match(texts(r), /bad: radar-chrome-9\.9\.9\.zip: DOES NOT MATCH the signed list/);
});

test("4. a kit missing SHA256SUMS.sig is refused", async () => {
  const dir = await kit("nosig");
  rmSync(join(dir, "SHA256SUMS.sig"));
  const r = await checkKit(read(dir), { trusted: await trusted() });
  assert.equal(r.ok, false);
  assert.match(texts(r), /bad: SHA256SUMS\.sig is missing, so no file here is covered by a signature/);
  rmSync(join(dir, "HEAD.sig"));
  writeFileSync(join(dir, "SHA256SUMS.sig"), "");
  assert.equal((await checkKit(read(dir), { trusted: await trusted() })).ok, false, "an empty signature file");
});

test("5. an extra unlisted file is shown as not covered by the signature", async () => {
  const dir = await kit("extra");
  writeFileSync(join(dir, "install-me-too.exe"), "not signed");
  const r = await checkKit(read(dir), { trusted: await trusted() });
  assert.deepEqual(r.uncovered, ["install-me-too.exe"]);
  assert.match(texts(r), /bad: install-me-too\.exe: not in SHA256SUMS, so the signature does not cover it/);
  assert.match(texts(r), /Kit verified: every signed file present matches; 1 extra file is not covered/);
});

test("6. a kit signed by another key is refused, and the key id it found is shown", async () => {
  const dir = await kit("other", { signer: OTHER, embed: K });
  const r = await checkKit(read(dir), { trusted: await trusted(K.publicJwk) });
  assert.equal(r.ok, false);
  const found = await signingKeyId(OTHER.publicJwk);
  assert.equal(r.keyIdFound, found);
  assert.match(texts(r), new RegExp(`does not match the key built into this page\\. The kit names key ${found}`));
  assert.match(texts(r), new RegExp(`Key built into this page: ${await signingKeyId(K.publicJwk)}`));
});

test("7. the kit builds the same bytes twice, and one changed byte changes its list", async () => {
  const keys = [await named(K.publicJwk)];
  const a = kitExtras({ version: "9.9.9", keys }), b = kitExtras({ version: "9.9.9", keys });
  a.forEach(([n, d], i) => assert.ok(d.equals(b[i][1]), `${n} differs between two builds`));
  const dir = await kit("twice"), one = join(ROOT, "twice-1"), two = join(ROOT, "twice-2");
  const l1 = buildKit(dir, one), l2 = buildKit(dir, two);
  assert.equal(l1, l2);
  assert.equal(kitList(one), l1);
  flip(two, "KIT-GUIDE.txt");
  assert.notEqual(kitList(two), l1, "a changed byte must change the kit list");
});

test("the key card carries the key id and a QR copy that matches an independent encoder", async () => {
  const ref = JSON.parse(readFileSync(new URL("./fixtures/qr-reference.json", import.meta.url), "utf8")).codes;
  for (const [text, want] of Object.entries(ref)) {
    const got = qrMatrix(text, { mask: want.mask });
    assert.equal(got.version, want.version, text);
    assert.deepEqual(got.modules.map((r) => r.map((c) => (c ? 1 : 0)).join("")), want.rows, text);
  }
  const other = qrMatrix("0e5e19840565840c977e0f036c9ac022", { mask: 3 });
  assert.notDeepEqual(other.modules.map((r) => r.map((c) => (c ? 1 : 0)).join("")), ref["0e5e19840565840c977e0f036c9ac021"].rows, "one changed character changes the code");
  assert.throws(() => qrMatrix("x".repeat(43)), /42 bytes/);
  const card = keyCard({ version: "9.9.9", keys: [await named(K.publicJwk)] });
  assert.ok(card.includes((await signingKeyId(K.publicJwk))));
  assert.match(card, /<svg viewBox/);
  assert.deepEqual(scan(card), []);
});
