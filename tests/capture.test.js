// Evidence capture (3.7.0): the record keeps the artifact's hash taken before any words are written
// in, the transparency record measures what survived, and the custody chain breaks on any removed or
// edited line. The claim checks: corroboration opacity, the same headline over different sourcing
// (a metamer) and a quote clipped from its source (an isomer).
import test from "node:test";
import assert from "node:assert/strict";
import { captureRecord, transparencyRecord, custodyLine, verifyCustody, captureCanonical, CAPTURE_FORMAT } from "../src/core/capture.js";
import { corroboration, corroborationOpacity, headlineMetamer, clippedQuote } from "../src/core/claim-checks.js";

const meta = { site: "x", text: "Water at the gauge rose 2 m", textComplete: true, author: { name: "River Desk", handle: "riverdesk" }, postUrl: "https://x.com/riverdesk/status/1",
  engagement: { replies: "12", reposts: "40", likes: "300", views: "9K" }, threadComplete: null, kind: "media" };

test("a capture keeps the original hash beside the saved copy's and says what survived", () => {
  const r = captureRecord({ meta, files: [{ name: "a.jpg", sha256: "aa", saved_sha256: "bb", bytes: 10, mime: "image/jpeg" }],
    screenshot: { name: "a.capture.png", sha256: "cc", viewport_height: 900, page_height: 3600, scroll_y: 0 }, tool: { version: "3.7.0" }, now: new Date("2026-10-26T10:00:00Z"), offsetMinutes: -420 });
  assert.equal(r.format, CAPTURE_FORMAT);
  assert.equal(r.artifact[0].sha256, "aa");
  assert.equal(r.artifact[0].saved_sha256, "bb");
  assert.equal(r.captured.offset_minutes, -420);
  const t = Object.fromEntries(r.transparency.rows.map((x) => [x.property, x]));
  assert.equal(t["file a.jpg"].clarity, 1);
  assert.equal(t.engagement.clarity, 0.67);
  assert.equal(t["page picture"].clarity, 0.25);
  assert.equal(t["page snapshot"].kept, "none");
  assert.equal(t["trusted time"].clarity, 0);
  assert.ok(r.transparency.mean > 0 && r.transparency.mean < 1);
});

test("unknown losses stay unknown: a cut-off text or an unproved thread has no clarity number", () => {
  const t = transparencyRecord({ ...meta, textComplete: false, threadComplete: "unknown" }, { files: [{ name: "g.gif", sha256: "x", made: "a GIF from the video" }] });
  const by = Object.fromEntries(t.rows.map((x) => [x.property, x]));
  assert.equal(by.text.clarity, null);
  assert.equal(by.text.kept, "partial");
  assert.equal(by.thread.clarity, null);
  assert.equal(by["file g.gif"].clarity, null);
  assert.equal(t.measured, t.rows.filter((r) => r.clarity != null).length);
});

test("captureCanonical form ignores key order", () => {
  assert.equal(captureCanonical({ b: 1, a: [2, { d: 3, c: 4 }] }), captureCanonical({ a: [2, { c: 4, d: 3 }], b: 1 }));
});

test("the custody chain verifies, and breaks on an edited, removed or reordered line", async () => {
  const l1 = await custodyLine(null, { what: "capture", page: "https://x.com/a/status/1", hashes: ["aa"] }, new Date("2026-10-26T10:00:00Z"));
  const l2 = await custodyLine(l1, { what: "capture", hashes: ["bb"] }, new Date("2026-10-26T10:01:00Z"));
  const l3 = await custodyLine(l2, { what: "export", hashes: ["cc"] }, new Date("2026-10-26T10:02:00Z"));
  assert.deepEqual(await verifyCustody([l1, l2, l3]), { ok: true, lines: 3, broken_at: null, reason: null });
  const edited = { ...l2, hashes: ["b0"] };
  assert.equal((await verifyCustody([l1, edited, l3])).broken_at, 2);
  assert.equal((await verifyCustody([l1, l3])).broken_at, 3);
  const rehashed = await custodyLine(l1, { what: "capture", hashes: ["b0"] }, new Date("2026-10-26T10:01:00Z"));
  assert.equal((await verifyCustody([l1, rehashed, l3])).broken_at, 3, "a rewritten line breaks the next one");
});

test("corroboration counts other origins, not other copies from the same account", () => {
  const c = corroboration([{ id: "S1", url: "https://x.com/a/status/1" }, { id: "S2", url: "https://twitter.com/a/status/2" }, { id: "S3", url: "https://www.reuters.com/x" }, { id: "S4", url: "https://bsky.app/profile/b.bsky.social/post/3" }]);
  assert.deepEqual(c.map((x) => x.corroborated_by), [2, 2, 2, 2]);
  assert.equal(corroboration([{ id: "S1", url: "https://x.com/a/status/1" }, { id: "S2", url: "https://x.com/a/status/9" }])[0].corroborated_by, 0);
  assert.equal(corroborationOpacity(0), 0.25);
  assert.equal(corroborationOpacity(3), 1);
  assert.equal(corroborationOpacity(9), 1);
});

test("metamer: the same headline over different sourcing is flagged; the same sourcing is not", () => {
  const a = { headline: "Dam “failed” at dawn", sources: ["https://example.org/report", "https://x.com/a/status/1"] };
  const b = { headline: "dam failed at dawn", sources: ["https://x.com/a/status/1?s=20", "https://x.com/b/status/2"] };
  const r = headlineMetamer(a, b);
  assert.equal(r.metamer, true);
  assert.deepEqual(r.shared, ["x.com/a/status/1"]);
  assert.deepEqual(r.only_a, ["example.org/report"]);
  assert.equal(headlineMetamer(a, { ...a }).metamer, false);
  assert.equal(headlineMetamer(a, { headline: "Other", sources: b.sources }).metamer, false);
});

test("isomer: a quote clipped past a negation or qualifier is flagged", () => {
  const src = "The minister said it is not true that the dam failed at dawn, according to the operator.";
  const r = clippedQuote("the dam failed at dawn", src);
  assert.equal(r.found, true);
  assert.equal(r.clipped, true);
  assert.ok(r.turns.includes("not"));
  assert.equal(clippedQuote("the dam held", src).found, false);
  assert.equal(clippedQuote("water rose two metres", "Gauges show water rose two metres overnight.").clipped, false);
});

test("capture verify: intact captures pass; a changed byte, a changed record or a changed line fails; a missing capture is a gap", async () => {
  const { mkdtempSync, writeFileSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createHash } = await import("node:crypto");
  const { verifyCaptures } = await import("../bin/lib/capture-verify.mjs");
  const { captureCanonical: canon } = await import("../src/core/capture.js");
  const sha = (b) => createHash("sha256").update(b).digest("hex");
  const dir = mkdtempSync(join(tmpdir(), "cap-"));
  try {
    let prev = null;
    for (const i of [1, 2, 3]) {
      const file = Buffer.from(`picture ${i}`), png = Buffer.from(`png ${i}`);
      writeFileSync(join(dir, `p${i}.jpg`), file); writeFileSync(join(dir, `p${i}.capture.png`), png);
      const rec = captureRecord({ meta, files: [{ name: `p${i}.jpg`, sha256: sha(file), saved_sha256: sha(file), bytes: file.length, mime: "image/jpeg" }],
        screenshot: { name: `p${i}.capture.png`, sha256: sha(png), viewport_height: 900, page_height: 900, scroll_y: 0 }, now: new Date(Date.UTC(2026, 9, 26, 10, i)) });
      const line = await custodyLine(prev, { what: "capture", hashes: [sha(file), sha(png), sha(canon(rec))] }, new Date(Date.UTC(2026, 9, 26, 10, i)));
      writeFileSync(join(dir, `p${i}.capture.json`), JSON.stringify({ ...rec, custody: line }, null, 2));
      prev = line;
    }
    let r = await verifyCaptures(dir);
    assert.equal(r.checked, 3);
    assert.equal(r.chain.ok, true, JSON.stringify(r));
    writeFileSync(join(dir, "p2.jpg"), Buffer.from("picture 2!"));
    r = await verifyCaptures(dir);
    assert.equal(r.chain.ok, false);
    assert.match(r.problems[0].problem, /p2\.jpg has changed/);
    writeFileSync(join(dir, "p2.jpg"), Buffer.from("picture 2"));
    const j = JSON.parse(readFileSync(join(dir, "p3.capture.json"), "utf8"));
    writeFileSync(join(dir, "p3.capture.json"), JSON.stringify({ ...j, words: { ...j.words, text: "edited" } }));
    assert.match((await verifyCaptures(dir)).problems[0].problem, /record was changed/);
    writeFileSync(join(dir, "p3.capture.json"), JSON.stringify({ ...j, custody: { ...j.custody, at: "2020-01-01T00:00:00.000Z" } }));
    r = await verifyCaptures(dir);
    assert.equal(r.chain.broken_at, 3);
    writeFileSync(join(dir, "p3.capture.json"), JSON.stringify(j));
    rmSync(join(dir, "p2.capture.json"));
    r = await verifyCaptures(dir);
    assert.deepEqual(r.chain.gaps, [2]);
    assert.equal(r.chain.ok, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("origin collapse: five outlets relaying one wire story count as one upstream", async () => {
  const { originCollapse } = await import("../src/core/claim-checks.js");
  const wire = "https://wire.example/story/1";
  const items = ["a", "b", "c", "d", "e"].map((id) => ({ id, url: `https://${id}.example/news`, cites: [wire + "?ref=" + id] }));
  items.push({ id: "f", url: "https://f.example/own", cites: ["https://court.example/ruling", "https://f.example/interview"] });
  const r = originCollapse(items);
  assert.equal(r.items, 6);
  assert.equal(r.upstreams, 2);
  assert.deepEqual(r.collapsed, [{ upstream: "wire.example/story/1", relays: ["a", "b", "c", "d", "e"] }]);
  assert.deepEqual(originCollapse(items.slice(0, 2)).collapsed, []);
});

test("capture is wired in both browsers: worker script, page script, menu item", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const m = JSON.parse(read("src/ext/manifest.json"));
  const bg = m.background.scripts;
  assert.ok(bg.indexOf("capture-bg.js") > bg.indexOf("quick-save-bg.js"), "Firefox loads the capture worker after the save worker");
  assert.match(read("src/ext/background.js"), /importScripts\([^)]*"quick-save-bg\.js", "capture-bg\.js"/);
  assert.ok(m.content_scripts.some((c) => c.js.indexOf("quick-capture.js") > c.js.indexOf("quick-save.js")));
  const q = read("src/ext/quick-save-bg.js");
  assert.match(q, /"quick-save\.js", "quick-capture\.js"/);
  assert.match(q, /\["pb-capture", "Capture as evidence"/);
});
