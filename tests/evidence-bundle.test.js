// Signed evidence bundles (src/core/evidence-bundle.js): a bundle verifies offline, any change
// breaks it, full post text stays out unless asked for, and a thread bundle cannot be about one
// person. The schema checker is tested here too: it must reject what the schema forbids.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeThread, analyzeText } from "../src/core/api.js";
import { makeBundle, signBundle, verifyBundle, newBundleKey, publicKeyOf, dataLockOf, bundleConsistency } from "../src/core/evidence-bundle.js";
import { b64url, fromB64url } from "../src/core/sig.js";
import { validate } from "../bin/lib/jsonschema.mjs";

const SCHEMA = JSON.parse(readFileSync(new URL("../schema/evidence.v1.json", import.meta.url), "utf8"));
const THREAD = JSON.parse(readFileSync(new URL("./fixtures/integration/thread.json", import.meta.url), "utf8"));
const result = analyzeThread(THREAD, { now: Date.parse("2026-10-02T00:00:00Z") });
const texts = Object.fromEntries([THREAD.root, ...THREAD.replies].map((p) => [p.id, p.text]));
const LOCK = { alg: "SHA-256", of: "test", value: "0".repeat(64) };
const key = await newBundleKey();
const signed = async (opts = {}) => signBundle(makeBundle(result, { tool: "Radar test", dataLock: LOCK, texts, ...opts }).bundle, key);

test("a signed bundle verifies offline and fits the schema", async () => {
  const b = await signed();
  const v = await verifyBundle(b);
  assert.equal(v.ok, true, JSON.stringify(v.checks));
  assert.equal(v.keyId, (await publicKeyOf(key.publicKey)).keyId);
  assert.deepEqual(validate(SCHEMA, b), []);
  assert.equal(b.posts.length, 15);
  assert.equal(b.input.accounts, 14);
});

test("any change to the content, the key or the signature fails the check", async () => {
  const b = await signed();
  const edits = [
    (x) => { x.evidence[0].shows += " "; },
    (x) => { x.posts.pop(); },
    (x) => { x.savedAt = "2020-01-01T00:00:00.000Z"; },
    (x) => { x.signer.publicKey.x = b64url(new Uint8Array(32)); },
    (x) => { x.signature.value = x.signature.value.slice(0, -2) + (x.signature.value.endsWith("AA") ? "BB" : "AA"); },
  ];
  for (const edit of edits) {
    const copy = structuredClone(b);
    edit(copy);
    assert.equal((await verifyBundle(copy)).ok, false, edit.toString());
  }
  const other = await signBundle(makeBundle(result, { texts }).bundle, await newBundleKey());
  assert.equal((await verifyBundle(other, { keyId: b.signer.keyId })).ok, false, "a key other than the expected one fails");
  assert.equal((await verifyBundle({ kind: "something else" })).ok, false);
});

test("other people's full text stays out unless the user opts in", async () => {
  const plain = await signed();
  assert.equal(plain.textIncluded, false);
  assert.ok(plain.posts.every((p) => Object.keys(p).join() === "id"));
  for (const r of THREAD.replies) assert.ok(!JSON.stringify(plain).includes(r.text), "no full post text");
  const full = await signed({ includeText: true });
  assert.equal(full.posts.find((p) => p.id === "200").text, texts["200"]);
  const v = await verifyBundle(full);
  assert.equal(v.ok, true);
  assert.match(v.checks.find((c) => c.name === "consistency").text, /every span matches/);
});

test("a span that no longer matches the included text fails the consistency check", async () => {
  const full = await signed({ includeText: true });
  const copy = structuredClone(full);
  copy.posts.find((p) => p.id === "200").text = "something else entirely";
  assert.equal(bundleConsistency(copy).ok, false);
});

test("a thread bundle needs as many accounts as a thread card; a data export does not", () => {
  const small = analyzeThread({ replies: [{ id: "1", author: "a", text: "hi" }, { id: "2", author: "b", text: "yo" }] });
  const refused = makeBundle(small, {});
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /at least 5/);
  assert.equal(makeBundle(small, { source: "export" }).ok, true);
  assert.equal(makeBundle(analyzeText("hello"), {}).ok, true);
  assert.equal(makeBundle(null).ok, false);
});

test("the data lock is the same hash for the same files in any order", async () => {
  const a = [["b.json", new TextEncoder().encode("2")], ["a.json", new TextEncoder().encode("1")]];
  const one = await dataLockOf(a), two = await dataLockOf([...a].reverse());
  assert.equal(one.value, two.value);
  assert.match(one.value, /^[0-9a-f]{64}$/);
  assert.notEqual((await dataLockOf([["a.json", new TextEncoder().encode("x")]])).value, one.value);
});

test("base64url round-trips bytes", () => {
  const bytes = Uint8Array.from({ length: 70 }, (_, i) => (i * 37) & 255);
  assert.deepEqual(fromB64url(b64url(bytes)), bytes);
  assert.doesNotMatch(b64url(bytes), /[+/=]/);
});

test("the schema checker rejects what the schema forbids", () => {
  const good = analyzeText("As an AI language model I cannot help.");
  assert.deepEqual(validate(SCHEMA, good), []);
  const bad = [
    (x) => { delete x.evidence[0].doesNotProve; },
    (x) => { x.evidence[0].kind = "bot-account"; },
    (x) => { x.evidence[0].level = "red"; },
    (x) => { x.evidence[0].handle = "someone"; },
    (x) => { x.evidence[0].spans[0].start = -1; },
    (x) => { x.schema = "urn:radar:evidence:v2"; },
    (x) => { x.limits = []; },
    (x) => { x.evidence[0].shows = ""; },
  ];
  for (const edit of bad) {
    const copy = structuredClone(good);
    edit(copy);
    assert.notDeepEqual(validate(SCHEMA, copy), [], edit.toString());
  }
});
