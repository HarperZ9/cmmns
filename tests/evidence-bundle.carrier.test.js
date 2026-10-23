// The carrier-safe evidence bundle profile (src/core/evidence-bundle.js, src/core/bundle-verify.js,
// bin/radar.mjs --carrier-safe, src/ext/signing.js): a fresh key per bundle that is never stored,
// the save time cut to the day, no page address unless the user typed one, and the tool's major
// version only, so two bundles from one install cannot be linked by their fields. BACKLOG
// increment 3, acceptance tests 1 to 8; test 9 is a review, recorded in project-docs/LIVE-CHECKS.md.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { analyzeThread } from "../src/core/api.js";
import { makeBundle, signBundle, signCarrierSafe, verifyBundle, newBundleKey, CARRIER_SAFE_NOTE } from "../src/core/evidence-bundle.js";
import { checkBundleFile } from "../src/core/kit-verify.js";
import { validate } from "../bin/lib/jsonschema.mjs";
import { browserSkip, openChrome, goto, evaluate } from "./browser.js";

const ROOT = join(import.meta.dirname, "..");
const SCHEMA = JSON.parse(readFileSync(join(ROOT, "schema", "evidence.v2.json"), "utf8"));
const THREAD = JSON.parse(readFileSync(join(ROOT, "tests", "fixtures", "integration", "thread.json"), "utf8"));
const result = analyzeThread(THREAD, { now: Date.parse("2026-10-02T00:00:00Z") });
const LOCK = { alg: "SHA-256", of: "test", value: "0".repeat(64) };
const PAGE = "https://x.com/someone/status/1234567890123456789";
const carrier = (opts = {}) => makeBundle(result, { profile: "carrier-safe", tool: "Daylight Commons 3.1.0 (CLI)", dataLock: LOCK, savedAt: "2026-10-23T14:05:09.123Z", page: PAGE, ...opts }).bundle;
const dir = mkdtempSync(join(tmpdir(), "radar-carrier-"));
test.after(() => rmSync(dir, { recursive: true, force: true }));
const cli = (args, env = {}) => spawnSync(process.execPath, [join(ROOT, "bin", "radar.mjs"), ...args], { encoding: "utf8", env: { ...process.env, ...env } });
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));

test("1. fifty carrier-safe bundles made in one run have fifty distinct key ids", async () => {
  const ids = [];
  for (let i = 0; i < 50; i++) ids.push((await signCarrierSafe(carrier())).signer.keyId);
  assert.equal(new Set(ids).size, 50, "a key id repeated");
  const reused = await newBundleKey();
  const twice = [await signBundle(carrier(), reused), await signBundle(carrier(), reused)].map((b) => b.signer.keyId);
  assert.equal(new Set([...ids, ...twice]).size, 51, "the check itself sees a repeated key id");
});

test("2. no carrier-safe bundle carries a time of day, anywhere in the file", async () => {
  const b = await signCarrierSafe(carrier({ includeText: true, texts: Object.fromEntries([THREAD.root, ...THREAD.replies].map((p) => [p.id, `${p.text} posted 2026-10-01T09:30:00Z`])) }));
  const text = JSON.stringify(b, null, 2);
  assert.doesNotMatch(text, /T\d\d:\d\d/);
  assert.doesNotMatch(text, /\b\d{1,2}:\d{2}(?::\d{2})?\s?(?:UTC|GMT|Z|am|pm)\b|\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}/i, "no clock time anywhere, including inside findings (\"at 12:10 UTC\")");
  const verse = await signCarrierSafe(carrier({ includeText: true, texts: { [THREAD.root.id]: "John 3:16 at 9:05 pm" } }));
  assert.equal(verse.posts.find((p) => p.id === THREAD.root.id).text, "John 3:16 at " + " ".repeat("9:05 pm".length), "a clock time is blanked to its length; a verse number is not a time");
  assert.equal(b.savedAt, "2026-10-23");
  assert.equal(b.tool, "Daylight Commons 3");
  assert.equal(b.profile, "carrier-safe");
  assert.deepEqual(validate(SCHEMA, b), [], "a day-only savedAt fits the schema");
  const ordinary = makeBundle(result, { tool: "Daylight Commons 3.1.0", dataLock: LOCK, savedAt: "2026-10-23T14:05:09.123Z" }).bundle;
  assert.match(JSON.stringify(ordinary), /T\d\d:\d\d/, "the ordinary profile still keeps the exact time");
});

test("3. a carrier-safe bundle leaves out the page address unless the user typed one", async () => {
  const b = await signCarrierSafe(carrier());
  assert.equal(JSON.stringify(b).includes(PAGE), false, "the page address the tab showed is in the bundle");
  assert.equal(JSON.stringify(b).includes("someone"), false);
  assert.equal(b.input.page, null);
  const typed = await signCarrierSafe(carrier({ typedPage: "https://example.org/what-I-chose" }));
  assert.equal(typed.input.page, "https://example.org/what-I-chose");
  assert.equal(makeBundle(result, { page: PAGE }).bundle.input.page, PAGE, "the ordinary profile is unchanged");
});

test("4. a carrier-safe bundle verifies with radar verify and with the offline page", { timeout: 120000 }, async () => {
  const b = await signCarrierSafe(carrier());
  const v = await verifyBundle(b);
  assert.equal(v.ok, true, JSON.stringify(v.checks));
  assert.ok(v.checks.some((c) => c.name === "profile" && c.text === CARRIER_SAFE_NOTE));
  assert.equal(CARRIER_SAFE_NOTE, "carrier-safe: the signature proves the bundle is unchanged; it says nothing about who made it");
  const file = join(dir, "carrier.json");
  writeFileSync(file, JSON.stringify(b, null, 2));
  const r = cli(["verify", file]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /says nothing about who made it/);
  const page = await checkBundleFile(new Uint8Array(readFileSync(file)));
  assert.equal(page.ok, true, page.lines.map((l) => l.text).join("\n"));
  assert.ok(page.lines.some((l) => l.text.includes("says nothing about who made it")));
  if (browserSkip) return;
  const cdp = await openChrome();
  try {
    await goto(cdp, pathToFileURL(join(ROOT, "docs", "verify-offline.html")).href);
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#bundle-file" });
    await cdp.send("DOM.setFileInputFiles", { nodeId, files: [file] });
    for (let i = 0; i < 200 && (await evaluate(cdp, "document.getElementById('kit-out').dataset.done")) !== "1"; i++) await new Promise((ok) => setTimeout(ok, 50));
    const out = await evaluate(cdp, "({ ok: document.getElementById('kit-out').dataset.ok, text: document.getElementById('kit-out').textContent })");
    assert.equal(out.ok, "1", out.text);
    assert.match(out.text, /says nothing about who made it/);
  } finally { cdp.close(); }
});

test("5. a carrier-safe bundle with any byte changed is refused", async () => {
  const b = await signCarrierSafe(carrier());
  const text = JSON.stringify(b, null, 2), file = join(dir, "changed.json");
  const day = text.indexOf("\"2026-10-23\"") + 10;
  const changed = text.slice(0, day) + "4" + text.slice(day + 1);
  writeFileSync(file, changed);
  assert.equal((await verifyBundle(JSON.parse(changed))).ok, false);
  assert.equal(cli(["verify", file]).status, 1);
  assert.equal((await checkBundleFile(new TextEncoder().encode(changed))).ok, false);
  const flipped = JSON.parse(text);
  flipped.profile = "ordinary";
  assert.equal((await verifyBundle(flipped)).ok, false, "the profile name is signed too");
});

test("6. after signing, no carrier-safe private key is stored: no file for the CLI, nothing in IndexedDB for the extension", async () => {
  const home = mkdtempSync(join(dir, "home-"));
  const out = join(dir, "cli-carrier.json");
  const r = cli(["analyze", join(ROOT, "tests", "fixtures", "integration", "thread.json"), "--no-claims", "--bundle", out, "--carrier-safe"], { HOME: home, USERPROFILE: home });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(walk(home), [], "a file was written in the home folder");
  assert.equal(JSON.parse(readFileSync(out, "utf8")).profile, "carrier-safe");
  assert.match(r.stderr, /one-time key/);
  const keyPath = join(dir, "never.jwk");
  assert.equal(cli(["analyze", join(ROOT, "tests", "fixtures", "integration", "thread.json"), "--no-claims", "--bundle", out, "--carrier-safe", "--key", keyPath]).status, 0);
  assert.throws(() => statSync(keyPath), /ENOENT/, "--carrier-safe ignores --key and writes no key file");

  const idb = await extensionSigning();
  const c = await idb.PBSign.signCarrierSafe(carrier());
  assert.equal(idb.puts.length, 0, "the carrier-safe key went into IndexedDB");
  const o = await idb.PBSign.sign(carrier());
  assert.equal(idb.puts.length, 1, "the ordinary key is stored once, as before");
  const stored = [...idb.store.values()].map((p) => p.publicKey);
  const { publicKeyOf } = await import("../src/core/evidence-bundle.js");
  for (const k of stored) assert.notEqual((await publicKeyOf(k)).keyId, c.signer.keyId, "a stored key matches the carrier-safe bundle");
  assert.equal((await publicKeyOf(stored[0])).keyId, o.signer.keyId);
});

test("7. ordinary bundles from one install still share a key id", async () => {
  const key = join(dir, "install.jwk"), a = join(dir, "o1.json"), b = join(dir, "o2.json");
  for (const out of [a, b]) assert.equal(cli(["analyze", join(ROOT, "tests", "fixtures", "integration", "thread.json"), "--no-claims", "--bundle", out, "--key", key]).status, 0);
  const [ka, kb] = [a, b].map((f) => JSON.parse(readFileSync(f, "utf8")).signer.keyId);
  assert.equal(ka, kb);
  const idb = await extensionSigning();
  const one = await idb.PBSign.sign(carrier()), two = await idb.PBSign.sign(carrier());
  assert.equal(one.signer.keyId, two.signer.keyId);
  assert.notEqual(one.signer.keyId, (await idb.PBSign.signCarrierSafe(carrier())).signer.keyId);
});

test("8. the privacy page names the carrier-safe profile and its limit, in both copies", () => {
  for (const f of ["PRIVACY.md", "docs/privacy.html", "src/ext/privacy.html"]) {
    const t = readFileSync(join(ROOT, f), "utf8");
    assert.match(t, /carrier-safe/i, f);
    assert.match(t, /says nothing about who made it/, f);
    assert.match(t, /from one connection/, `${f} must say the profile cannot hide two bundles sent from one connection`);
  }
});

// src/ext/signing.js in node with an in-memory IndexedDB that records every write.
async function extensionSigning() {
  const store = new Map(), puts = [];
  const req = (result) => { const r = { result }; queueMicrotask(() => r.onsuccess && r.onsuccess()); return r; };
  const db = { createObjectStore: () => {}, transaction: () => ({ objectStore: () => ({ get: (id) => req(store.get(id)), put: (v, id) => { puts.push(id); store.set(id, v); return req(id); } }) }) };
  globalThis.indexedDB = { open: () => { const r = { result: db }; queueMicrotask(() => { r.onupgradeneeded && r.onupgradeneeded(); r.onsuccess && r.onsuccess(); }); return r; } };
  globalThis.chrome = { runtime: { getURL: (p) => p, getManifest: () => ({ version: "3.1.0" }) } };
  if (!globalThis.PB) await import("../src/ext/core.bundle.js");
  delete globalThis.PBSign;
  const src = readFileSync(join(ROOT, "src", "ext", "signing.js"), "utf8");
  new Function(src)();
  return { PBSign: globalThis.PBSign, store, puts };
}
