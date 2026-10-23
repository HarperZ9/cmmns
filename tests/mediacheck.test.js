// The words a media check shows, the "First seen" line, and the stripped-file controls.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readCredentials, credentialState } from "../src/core/c2pa.js";
import { credentialRows, credentialSignals, NO_CREDENTIALS } from "../src/core/mediacheck.js";
import { firstSeen, recordSpread } from "../src/core/trail.js";
import { jpegSegments, pngChunks, riffChunks, bmffBoxes, C2PA_BMFF_UUID } from "../src/core/jumbf.js";
import { keyframeTimes } from "../src/core/keyframes.js";

const load = (f) => new Uint8Array(readFileSync(new URL(`./fixtures/c2pa/${f}`, import.meta.url)));
const text = (rows) => rows.map((r) => r.join(": ")).join("\n");
const cut = (b, ranges) => { const keep = []; let p = 0; for (const [s, e] of ranges) { keep.push(...b.subarray(p, s)); p = e; } keep.push(...b.subarray(p)); return Uint8Array.from(keep); };

// What a platform does on upload: the credential container is removed and the rest kept.
function strip(f) {
  const b = load(f);
  if (f.endsWith(".jpg")) return cut(b, jpegSegments(b).filter((s) => s.marker === 0xeb).map((s) => [s.start, s.end]));
  if (f.endsWith(".png")) return cut(b, pngChunks(b).filter((c) => c.type === "caBX").map((c) => [c.start, c.end]));
  if (f.endsWith(".webp")) return cut(b, riffChunks(b).filter((c) => c.type === "C2PA").map((c) => [c.start, c.end]));
  return cut(b, bmffBoxes(b).filter((x) => x.uuid === C2PA_BMFF_UUID).map((x) => [x.start, x.end]));
}

test("stripped files: no credentials, no AI signal, never a pass (0 false positives)", async () => {
  for (const f of ["ai.jpg", "ai.png", "ai.webp", "ai.mp4", "edited.jpg", "camera-v1.jpg", "camera-ps256.jpg"]) {
    const r = await readCredentials(strip(f));
    assert.equal(r.found, false, f);
    assert.equal(credentialState(r), "none", f);
    assert.deepEqual(credentialSignals(r), [], f);
    assert.match(text(credentialRows(r)), /platforms often strip them/, f);
  }
});

test("the words never call a file authentic or fake", async () => {
  for (const f of ["ai.jpg", "tampered.jpg", "camera-v1.jpg", "plain.jpg", "xmp-ai.jpg", "edited.jpg"]) {
    const r = await readCredentials(load(f));
    const all = text(credentialRows(r)) + JSON.stringify(credentialSignals(r));
    assert.doesNotMatch(all, /authentic|genuine|\bfake\b|\breal\b|verified as true/i, f);
  }
});

test("an AI credential: a warn signal with signer and does-not-prove line", async () => {
  const r = await readCredentials(load("ai.jpg"));
  const [s] = credentialSignals(r);
  assert.equal(s.fam, "c2pa");
  assert.equal(s.level, "warn");
  assert.match(JSON.stringify(s.rows), /made with generative AI/);
  assert.ok(s.rows.some((x) => x[0] === "What it shows"));
  const rows = text(credentialRows(r));
  assert.match(rows, /is unchanged since it was signed/);
  assert.match(rows, /the certificate's own claim/);
});

test("tampered: a flag naming the failed check, no pass wording", async () => {
  const r = await readCredentials(load("tampered.jpg"));
  const fams = credentialSignals(r).map((s) => s.fam);
  assert.ok(fams.includes("c2pa-changed"));
  assert.doesNotMatch(text(credentialRows(r)), /has not changed/);
  assert.match(text(credentialRows(r)), /bytes changed after signing/);
});

test("XMP-only AI label: a metadata flag that says metadata is unsigned", async () => {
  const r = await readCredentials(load("xmp-ai.jpg"));
  const s = credentialSignals(r);
  assert.deepEqual(s.map((x) => x.fam), ["ai-metadata"]);
  assert.match(JSON.stringify(s[0].rows), /unsigned/);
  assert.match(text(credentialRows(r)), new RegExp(NO_CREDENTIALS.slice(0, 20)));
});

test("First seen: the earliest post Daylight Commons saw with the same upload, and X's From credit", () => {
  const vid = { type: "video", url: "https://pbs.twimg.com/amplify_video_thumb/7/img/a.jpg", uploaded: "2026-01-01T00:00:00.000Z" };
  const posts = [{ id: "1", author: "early", posted: "2026-01-02T00:00:00Z", media: [vid] }, { id: "2", author: "later", posted: "2026-03-01T00:00:00Z", media: [vid] }];
  const log = recordSpread({}, posts);
  const lifted = { id: "3", author: "relay", posted: "2026-04-01T00:00:00Z", media: [{ ...vid, fromPost: "2", fromPostTime: "2026-03-01T00:00:00Z" }] };
  const tweets = new Map([...posts, lifted].map((p) => [p.id, p]));
  const [f] = firstSeen(lifted, tweets, log);
  assert.equal(f.from.handle, "later");
  assert.equal(f.first.handle, "early");
  assert.equal(f.first.how, "seen");
  assert.equal(f.seen.accounts, 2);
  const [own] = firstSeen(posts[0], tweets, log);
  assert.equal(own.first.isThis, true);
  assert.deepEqual(firstSeen({ id: "9" }, tweets, log), []);
});

test("keyframe times: spread across the video, inside what is loaded, at most n", () => {
  assert.deepEqual(keyframeTimes(100, [[0, 100]], 4), [10, 36.7, 63.3, 90]);
  assert.deepEqual(keyframeTimes(100, [[0, 20]], 4), [2, 7.3, 12.7, 18]);
  assert.deepEqual(keyframeTimes(0, [], 4), []);
  assert.deepEqual(keyframeTimes(Infinity, [[5, 9]], 2), [5.4, 8.6]);
});
