// The signed head (src/core/head.js): a small signed document that names a release's SHA256SUMS
// and the catalogue by hash, with a version that only goes up and an expiry. Every test here feeds
// at least one input that must be refused. BACKLOG increment 1, acceptance tests 1 to 9.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateSigningKey } from "../src/core/signing.js";
import { sha256Hex } from "../src/core/sig.js";
import { dataLockOf } from "../src/core/evidence-bundle.js";
import { makeHead, headText, signHead, sigFileText, parseHead, checkHead, headKeyId, freshness, refusalSentence, HEAD_MAX_BYTES } from "../src/core/head.js";
import { signDir } from "../scripts/release-lib.mjs";
import { writeHead, verifyRelease } from "../scripts/head-lib.mjs";

const K = await generateSigningKey(), OTHER = await generateSigningKey();
const SUMS = "1111111111111111111111111111111111111111111111111111111111111111  radar-chrome-9.9.9.zip\n";
const FILES = [["claims.json", new TextEncoder().encode("{\"claims\":[]}\n")], ["sites.json", new TextEncoder().encode("{}\n")]];
const LOCK = (await dataLockOf(FILES)).value;
const DAY = 86400000, T0 = Date.parse("2026-10-23T00:00:00Z");
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const base = async (over = {}) => ({
  version: 3002000, time: iso(T0), expires: iso(T0 + 90 * DAY),
  release: { name: "9.9.9", sums: await sha256Hex(SUMS) }, catalogue: { version: "2026.10.22", sha256: LOCK },
  signers: { k: 1, keys: [await headKeyId(K.publicJwk)] }, ...over,
});
async function signed(over = {}, key = K) {
  const head = makeHead(await base(over));
  return { head: headText(head), sig: sigFileText([await signHead(head, key.privateJwk)]) };
}
const check = (h, opts = {}) => checkHead({ ...h, trusted: [K.publicJwk], state: null, now: T0 + DAY, sums: SUMS, catalogue: LOCK, ...opts });

test("1. a validly signed head with a higher version and a future expiry is accepted", async () => {
  const first = await check(await signed());
  assert.equal(first.ok, true, first.sentence);
  assert.equal(first.status, "current");
  assert.equal(first.state.version, 3002000);
  const next = await check(await signed({ version: 3002001 }), { state: first.state });
  assert.equal(next.ok, true);
  assert.equal(next.state.version, 3002001);
  const lower = await check(await signed({ version: 3001999 }), { state: next.state });
  assert.equal(lower.ok, false, "a lower version after a higher one must be refused");
});

test("2. a validly signed head with a lower version is refused as rollback and the stored state does not change", async () => {
  const stored = (await check(await signed({ version: 3002005 }))).state;
  const before = structuredClone(stored);
  const r = await check(await signed({ version: 3002004 }), { state: stored });
  assert.equal(r.ok, false);
  assert.equal(r.rule, "rollback");
  assert.deepEqual(r.state, before);
  assert.deepEqual(stored, before, "the caller's state object is not touched");
  const fork = await check(await signed({ version: 3002005, expires: iso(T0 + 300 * DAY) }), { state: stored });
  assert.equal(fork.ok, false, "a different head under a version already accepted is refused");
  assert.equal(fork.rule, "fork");
});

test("3. a head or its signature with one flipped byte anywhere is refused", async () => {
  const good = await signed();
  assert.equal((await check(good)).ok, true);
  for (let i = 0; i < good.head.length; i++) {
    const head = good.head.slice(0, i) + String.fromCharCode(good.head.charCodeAt(i) ^ 1) + good.head.slice(i + 1);
    const r = await check({ head, sig: good.sig });
    assert.equal(r.ok, false, `head byte ${i} (${JSON.stringify(good.head[i])}) flipped and still accepted`);
  }
  const at = good.sig.indexOf("\"value\":\"") + 12;
  const sig = good.sig.slice(0, at) + String.fromCharCode(good.sig.charCodeAt(at) ^ 1) + good.sig.slice(at + 1);
  assert.equal((await check({ head: good.head, sig })).ok, false, "a flipped signature byte");
});

test("4. a head signed by a key outside the trusted set is refused", async () => {
  const r = await check(await signed({ signers: { k: 1, keys: [await headKeyId(OTHER.publicJwk)] } }, OTHER));
  assert.equal(r.ok, false);
  assert.equal(r.rule, "untrusted");
  const head = makeHead(await base());
  const forged = { keyId: await headKeyId(K.publicJwk), value: (await signHead(head, OTHER.privateJwk)).value };
  const r2 = await check({ head: headText(head), sig: sigFileText([forged]) });
  assert.equal(r2.ok, false, "another key's signature filed under the trusted key id");
  assert.equal(r2.rule, "signature");
});

test("5. a head past its expiry is accepted as Expired, and the line keeps the catalogue date", async () => {
  const r = await check(await signed({ expires: iso(T0 + 10 * DAY) }), { now: T0 + 40 * DAY });
  assert.equal(r.ok, true, "expiry never refuses a head");
  assert.equal(r.status, "expired");
  assert.equal(r.state.version, 3002000);
  const f = freshness(r.state, { now: T0 + 40 * DAY, catalogue: { version: "2026.10.22", date: "2026-10-22" } });
  assert.equal(f.status, "expired");
  assert.equal(f.label, "Expired");
  assert.match(f.line, /^Catalogue dated 2026-10-22\. Newer campaigns may be missing\./);
  const aging = freshness((await check(await signed())).state, { now: T0 + 45 * DAY, catalogue: { version: "2026.10.22", date: "2026-10-22" } });
  assert.equal(aging.label, "Aging");
  const none = freshness(null, { now: T0, catalogue: { version: "2026.10.22", date: "2026-10-22" } });
  assert.equal(none.status, "none");
  assert.match(none.line, /Catalogue dated 2026-10-22\. No signed head checked on this device yet\./);
});

test("6. with the clock 10 years ahead or behind, the highest seen time rules and a lower version is never accepted", async () => {
  const ahead = T0 + 3650 * DAY, behind = T0 - 3650 * DAY;
  const a = await check(await signed({ version: 3002010 }), { now: ahead });
  assert.equal(a.ok, true);
  assert.equal(a.status, "expired", "ten years on, the head has expired");
  assert.equal(a.state.maxTime, iso(T0), "the device clock never raises the highest seen time");
  assert.equal((await check(await signed({ version: 3002009 }), { state: a.state, now: ahead })).rule, "rollback");
  const b = await check(await signed({ version: 3002011, time: iso(T0 + 2 * DAY) }), { state: a.state, now: behind });
  assert.equal(b.ok, true);
  assert.equal(b.status, "current", "a clock ten years behind uses the highest signed time seen");
  assert.equal(b.state.maxTime, iso(T0 + 2 * DAY));
  assert.equal((await check(await signed({ version: 3002010 }), { state: b.state, now: behind })).rule, "rollback");
  const f = freshness(b.state, { now: behind, catalogue: { version: "2026.10.22", date: "2026-10-22" } });
  assert.equal(f.status, "current");
});

test("7. a head listing a catalogue hash that differs from the shipped tables is refused, as is a wrong SHA256SUMS", async () => {
  assert.equal((await check(await signed())).ok, true, "the shipped tables' dataLockOf value matches");
  const other = (await dataLockOf([...FILES, ["owners.json", new TextEncoder().encode("[]\n")]])).value;
  const r = await check(await signed({ catalogue: { version: "2026.10.22", sha256: other } }));
  assert.equal(r.ok, false);
  assert.equal(r.rule, "catalogue");
  const s = await check(await signed(), { sums: SUMS.replace("9.9.9", "9.9.8") });
  assert.equal(s.ok, false);
  assert.equal(s.rule, "sums");
});

test("8. a head over 4 KB is refused by the parser before any signature work", async () => {
  const good = await signed();
  const big = good.head.replace("\"name\":\"9.9.9\"", `"name":"${"9".repeat(HEAD_MAX_BYTES)}"`);
  assert.equal(parseHead(big).ok, false);
  assert.equal(parseHead(big).rule, "size");
  const subtle = globalThis.crypto.subtle, calls = { n: 0 };
  const spy = new Proxy(subtle, { get: (t, p) => (p === "verify" || p === "importKey" ? (...a) => { calls.n++; return t[p](...a); } : typeof t[p] === "function" ? t[p].bind(t) : t[p]) });
  Object.defineProperty(globalThis.crypto, "subtle", { value: spy, configurable: true });
  try {
    const r = await check({ head: big, sig: good.sig });
    assert.equal(r.rule, "size");
    assert.equal(calls.n, 0, "no key import or signature check on an oversize head");
    await check(good);
    assert.ok(calls.n > 0, "the spy sees signature work on a normal head");
  } finally { Object.defineProperty(globalThis.crypto, "subtle", { value: subtle, configurable: true }); }
  assert.equal(parseHead("{\"kind\":\"daylight-head/1\"}").rule, "form");
  assert.equal(parseHead("not json").rule, "form");
});

test("9. each refusal is named in one plain sentence, and the release verifier prints it", async () => {
  assert.deepEqual({
    size: refusalSentence("size"), form: refusalSentence("form"), signature: refusalSentence("signature"),
    untrusted: refusalSentence("untrusted"), threshold: refusalSentence("threshold", { valid: 1, needed: 2 }),
    rollback: refusalSentence("rollback", { version: 4, stored: 5 }), fork: refusalSentence("fork", { version: 5 }),
    sums: refusalSentence("sums"), catalogue: refusalSentence("catalogue"), missing: refusalSentence("missing"),
  }, {
    size: "Refused: the head is larger than 4 KB, so it was not read.",
    form: "Refused: the head is not in the expected form.",
    signature: "Refused: a signature does not match the head, so it changed after signing or was signed with another key.",
    untrusted: "Refused: the head is not signed by a key this device trusts.",
    threshold: "Refused: the head carries 1 valid signature and needs 2.",
    rollback: "Refused (rollback): this head is version 4, older than version 5 already accepted here.",
    fork: "Refused: a different head with version 5 was already accepted here.",
    sums: "Refused: SHA256SUMS does not match the hash the head lists.",
    catalogue: "Refused: the catalogue here does not match the hash the head lists.",
    missing: "Refused (rollback): this release has no signed head, and a signed head was already accepted here.",
  });
  for (const s of Object.values({ a: refusalSentence("rollback", { version: 1, stored: 2 }) })) assert.equal(s.split(/\.\s/).length, 1, "one sentence");

  const dir = mkdtempSync(join(tmpdir(), "radar-head-")), statePath = join(dir, "..", `head-state-${process.pid}.json`);
  try {
    writeFileSync(join(dir, "radar-chrome-9.9.9.zip"), "zip bytes");
    await signDir(dir, K.privateJwk);
    await writeHead(dir, K.privateJwk, { version: 3002002, time: iso(T0), expires: iso(T0 + 90 * DAY), release: "9.9.9", catalogue: { version: "2026.10.22", sha256: LOCK } });
    const ok = await verifyRelease(dir, { key: K.publicJwk, statePath, now: T0 + DAY });
    assert.equal(ok.ok, true, ok.lines.join("\n"));
    assert.ok(ok.lines.some((l) => /^head      version 3002002, signed 2026-10-23, valid until 2027-01-21, 1 of 1 signature \(single-signer release\)$/.test(l)), ok.lines.join("\n"));
    await writeHead(dir, K.privateJwk, { version: 3002001, time: iso(T0), expires: iso(T0 + 90 * DAY), release: "9.9.9", catalogue: { version: "2026.10.22", sha256: LOCK } });
    const old = await verifyRelease(dir, { key: K.publicJwk, statePath, now: T0 + DAY });
    assert.equal(old.ok, false);
    assert.ok(old.lines.includes("Refused (rollback): this head is version 3002001, older than version 3002002 already accepted here."), old.lines.join("\n"));
    assert.equal(JSON.parse(readFileSync(statePath, "utf8")).version, 3002002, "the state file keeps the higher version");
    rmSync(join(dir, "HEAD.json")); rmSync(join(dir, "HEAD.sig"));
    const bare = await verifyRelease(dir, { key: K.publicJwk, statePath, now: T0 + DAY });
    assert.equal(bare.ok, false, "a release with no head after a head was accepted is a rollback");
    assert.ok(bare.lines.includes(refusalSentence("missing")));
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(statePath, { force: true }); }
});
