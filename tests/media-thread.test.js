// The author's thread is joined only where each part answers the one before: a profile page's
// unrelated posts by one author never become a "continuation" (the 3.6.0 defect), and the check
// command flags notes saved with that defect.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { threadChain, continuationStatus } from "../src/core/media-thread.js";
import { postMeta, sidecarMarkdown } from "../src/core/media-meta.js";
import { checkSidecars } from "../bin/lib/sidecar-check.mjs";

const post = (id, author, replyTo, text) => ({ id, author, replyTo, text });

test("a profile page's consecutive posts by one author are not a thread", () => {
  const profile = [post("1", "mathverse", null, "Rubik's cube"), post("2", "mathverse", null, "robot knee"), post("3", "mathverse", null, "RSA keys"), post("4", "mathverse", null, "Buffon's needle")];
  assert.deepEqual(threadChain(profile, "1", "mathverse"), { ids: [], texts: [] });
});

test("a self-thread is joined in order, and stops at another author's reply", () => {
  const status = [post("10", "ana", null, "1/ Glaze"), post("12", "ana", "11", "3/ cool"), post("11", "ana", "10", "2/ fire"), post("13", "bob", "10", "nice"), post("14", "ana", "13", "thanks bob")];
  assert.deepEqual(threadChain(status, "10", "Ana"), { ids: ["11", "12"], texts: ["2/ fire", "3/ cool"] });
});

test("notes say whether their continuation was proved, and the check flags 3.6.0's unproved ones", () => {
  const proved = sidecarMarkdown(postMeta({ site: "x", handle: "ana", text: "1/", thread: ["2/"], threadComplete: true }), ["a.jpg"]);
  const old = sidecarMarkdown(postMeta({ site: "x", handle: "mathverse", text: "cube", thread: ["knee", "keys"] }), ["b.jpg"]);
  const maybe = sidecarMarkdown(postMeta({ site: "x", handle: "ana", text: "1/", threadComplete: "unknown" }), ["c.jpg"]);
  assert.equal(continuationStatus(proved), "verified");
  assert.equal(continuationStatus(old), "unverified");
  assert.equal(continuationStatus(maybe), "unknown");
  assert.ok(proved.includes("\nthread_complete: true\n"));
  const dir = mkdtempSync(join(tmpdir(), "dc-sidecars-"));
  try {
    mkdirSync(join(dir, "x"));
    writeFileSync(join(dir, "x", "a.md"), proved); writeFileSync(join(dir, "x", "b.md"), old); writeFileSync(join(dir, "x", "c.md"), maybe); writeFileSync(join(dir, "x", "notes.md"), "# my own notes\n");
    const r = checkSidecars(dir);
    assert.equal(r.checked, 3);
    assert.deepEqual(r.flagged.map((f) => [f.file.split("\\").join("/"), f.status]), [["x/b.md", "unverified"], ["x/c.md", "unknown"]]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("engagement is kept as the page showed it, with the time it was read", () => {
  const m = postMeta({ site: "x", text: "t", engagement: { replies: 3, likes: "1.2K", views: null } }, "2026-10-25T12:00:00Z");
  assert.deepEqual(m.engagement, { replies: 3, likes: "1.2K", at: "2026-10-25T12:00:00.000Z" });
  const md = sidecarMarkdown(m, []);
  assert.ok(md.includes('engagement: {"replies":3,"likes":"1.2K","at":"2026-10-25T12:00:00.000Z"}'));
  assert.ok(md.includes("- Engagement at save: replies 3, likes 1.2K"));
});
