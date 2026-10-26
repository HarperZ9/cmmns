// The boundaries of the protection features (project-docs/SECURITY-REVIEW.md and the
// counter-repression brief): Daylight never targets, tracks, locates or deanonymises a person.
// These checks hold the line in code: no face recognition, no named-person search, no account
// linking, and no reading of location from other people's files. Each one fails the build if a
// change crosses it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { shareClean } from "../src/core/clean.js";
import * as clean from "../src/core/clean.js";
import * as audit from "../src/core/self-audit.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const code = (dir) => readdirSync(join(ROOT, dir)).filter((f) => /\.m?js$/.test(f) && !/\.bundle\.js$/.test(f)).map((f) => [`${dir}/${f}`, readFileSync(join(ROOT, dir, f), "utf8")]);
const ALL = [...code("src/core"), ...code("src/ext"), ...code("src/investigate"), ...code("bin/lib")];

test("no face recognition, matching or embedding anywhere in the code", () => {
  const banned = /\b(faceapi|face-api|facenet|arcface|insightface|faceDescriptor|face_?embedding|faceEmbedding|recogni[sz]eFace|matchFace|faceMatch)\b/i;
  for (const [f, src] of ALL) assert.ok(!banned.test(src), `${f} names a face recognition capability`);
});

test("no named-person search: the protection and self-audit modules take no name or handle from the user", () => {
  for (const f of ["src/core/self-audit.js", "src/core/clean.js", "src/investigate/protection.js", "bin/lib/protect.mjs", "src/ext/selfaudit.js", "src/ext/protection.js", "src/ext/share-clean.js"]) {
    const src = readFileSync(join(ROOT, f), "utf8").replace(/\/\/[^\n]*/g, "");
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|new WebSocket/.test(src), `${f} makes no request`);
  }
  // The self-audit's only entry points: page markers or the user's own export files.
  assert.deepEqual(Object.keys(audit).filter((k) => typeof audit[k] === "function").sort(), ["exportAuditInput", "ownedProfile", "postingClock", "selfAudit"]);
});

test("no account linking: the self-audit refuses files from more than one platform", () => {
  const x = `window.YTD.tweets.part0 = ${JSON.stringify([{ tweet: { id_str: "1", full_text: "hello", created_at: "Wed Oct 01 10:00:00 +0000 2026" } }])};`;
  const masto = JSON.stringify({ orderedItems: [{ type: "Create", published: "2026-10-01T10:00:00Z", object: { id: "1", content: "<p>hello</p>" } }] });
  assert.equal(audit.exportAuditInput([{ name: "tweets.js", text: x }, { name: "outbox.json", text: masto }]).ok, false);
});

test("no reading of location from files: Share clean reports field names, never values", async () => {
  const photo = readFileSync(join(ROOT, "tests/fixtures/clean/photo.jpg"));
  const r = await shareClean(photo);
  const report = JSON.stringify(r.removed) + JSON.stringify(r.notes);
  assert.ok(!/\d+\.\d{3,}|\b40\b.*\b42\b|\bN\b.*\bW\b|DLSECRET/.test(report), "no coordinates or values in the report");
  // Nothing in the clean API returns metadata values: its exports clean, name and hash, nothing reads out.
  assert.deepEqual(Object.keys(clean).filter((k) => typeof clean[k] === "function").sort(), ["cleanFormat", "cleanLineage", "cleanName", "shareClean"]);
  for (const [f, src] of ALL) if (/GPS/.test(src)) assert.ok(/^(src\/core\/clean[\w-]*\.js|bin\/lib\/help\.mjs)$/.test(f), `${f} mentions GPS: only Share clean may, to remove it`);
});
