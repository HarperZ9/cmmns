// Multi-site download routing, filename sanitization, type subfolders, sister-tool workflow hints,
// and daylight.sidecar/1 + commons-digest/1 + engine-receipt/1 round-trip with planted tamper tests.
import test from "node:test";
import assert from "node:assert/strict";
import {
  classifySite, classifyMediaKind, subfolderForKind, dedupKeyOf, deriveWorkflowHints,
  sidecarRoutingMeta, sanitizeFilename, planStreamlinedDownload,
} from "../src/core/download-route.js";
import { postMeta, sidecarMarkdown, savePath } from "../src/core/media-meta.js";
import { sidecarReceiptSidecars, verifySidecarDigest, verifySidecarEngineReceipt } from "../src/core/sidecar-receipt.js";
import { normalizeSettings } from "../src/core/settings.js";

const NOW = "2026-11-25T19:00:00.000Z";

test("classifySite and classifyMediaKind cover every supported platform and media type", () => {
  const cases = [
    ["https://x.com/alice/status/123", "image/jpeg", "x", "image", "images"],
    ["https://www.reddit.com/r/MachineLearning/comments/abc123/paper/", "", "reddit", "post", "posts"],
    ["https://youtu.be/dQw4w9WgXcQ", "video/mp4", "youtube", "video", "video"],
    ["https://bsky.app/profile/alice.bsky.social/post/3kabc", "", "bluesky", "post", "posts"],
    ["https://news.ycombinator.com/item?id=42001999", "", "hackernews", "post", "posts"],
    ["https://arxiv.org/pdf/2511.08544.pdf", "application/pdf", "arxiv", "whitepaper", "papers"],
    ["https://cdn.example.org/tracks/master-stem.wav", "audio/wav", "cdn.example.org", "audio", "audio"],
  ];
  for (const [url, mime, wantSite, wantKind, wantSub] of cases) {
    assert.equal(classifySite(url), wantSite, url);
    const kind = classifyMediaKind({ url, mime });
    assert.equal(kind, wantKind, url);
    assert.equal(subfolderForKind(kind), wantSub, url);
  }
});

test("dedupKeyOf and deriveWorkflowHints bridge captures to distill, research_verify, and civic_audit", () => {
  assert.equal(dedupKeyOf({ postUrl: "https://arxiv.org/abs/2511.08544v2" }), "arxiv:2511.08544v2");
  assert.equal(dedupKeyOf({ postUrl: "https://news.ycombinator.com/item?id=991234" }), "hackernews:991234");
  assert.equal(dedupKeyOf({ postUrl: "https://bsky.app/profile/bob.bsky.social/post/xyz9" }), "bluesky:bob.bsky.social:xyz9");

  assert.deepEqual(deriveWorkflowHints({ mediaKind: "whitepaper", sourceSite: "arxiv" }), ["research_verify"]);
  assert.deepEqual(deriveWorkflowHints({ mediaKind: "audio", sourceSite: "cdn.example.org" }), ["distill_media"]);
  assert.deepEqual(
    deriveWorkflowHints({ mediaKind: "video", sourceSite: "x", meta: { links: ["https://arxiv.org/abs/2511.08544"] } }),
    ["civic_audit", "distill_media", "research_verify"],
  );
});

test("sanitizeFilename and planStreamlinedDownload prevent path traversal and organize subfolders cleanly", () => {
  assert.equal(sanitizeFilename("../../etc/passwd.pdf"), "passwd.pdf");
  assert.equal(sanitizeFilename("CON.pdf"), "_con.pdf");
  assert.equal(sanitizeFilename("weird:name*?|.wav"), "weird-name.wav");

  const sDefault = normalizeSettings({});
  const sTyped = normalizeSettings({ mediaOrganizeByType: true });
  assert.equal(savePath(sDefault, "arxiv"), "CMMNS/arxiv/");
  assert.equal(savePath(sTyped, "arxiv", false, null, "papers"), "CMMNS/arxiv/papers/");

  const plan = planStreamlinedDownload({
    meta: { title: "LeJEPA Scaling Laws", pageUrl: "https://arxiv.org/abs/2511.08544" },
    url: "https://arxiv.org/pdf/2511.08544.pdf",
    mime: "application/pdf",
    settings: sTyped,
  });
  assert.equal(plan.sourceSite, "arxiv");
  assert.equal(plan.mediaKind, "whitepaper");
  assert.equal(plan.subfolder, "papers");
  assert.equal(plan.folder, "CMMNS/arxiv/papers/");
  assert.equal(plan.dedupKey, "arxiv:2511.08544");
  assert.deepEqual(plan.workflowHints, ["research_verify"]);
  assert.equal(plan.deconstructReady, true);
});

test("daylight.sidecar/1 emits routing metadata hooks and signed capture receipts reject 1-byte tamper", async () => {
  const base = postMeta({
    site: "arxiv",
    title: "Test Whitepaper",
    text: "Deterministic scaling study.",
    pageUrl: "https://arxiv.org/abs/2511.08544",
    links: ["https://github.com/HarperZ9/flywheel"],
  }, NOW);
  const routing = sidecarRoutingMeta(base, { url: "https://arxiv.org/pdf/2511.08544.pdf", mime: "application/pdf" });
  const enriched = postMeta({ ...base, ...routing }, NOW);
  const pdfBytes = new TextEncoder().encode("%PDF-1.7\n1 0 obj <<>> endobj\n%%EOF\n");
  const bundle = await sidecarReceiptSidecars(enriched, {
    fileNames: ["2511-08544.pdf"],
    includeJson: true,
    emittedAt: NOW,
    files: [{ name: "2511-08544.pdf", data: pdfBytes }],
  });

  const md = sidecarMarkdown(enriched, ["2511-08544.pdf"]);
  assert.ok(md.startsWith('---\nformat: "daylight.sidecar/1"\n'));
  assert.match(md, /^media_kind: "whitepaper"$/m);
  assert.match(md, /^source_site: "arxiv"$/m);
  assert.match(md, /^dedup_key: "arxiv:2511\.08544"$/m);
  assert.match(md, /^workflow_hints: \["research_verify"\]$/m);
  assert.match(md, /^deconstruct_ready: true$/m);

  const files = new Map([
    ["2511-08544.md", new TextEncoder().encode(bundle.sidecarMd)],
    ["2511-08544.json", new TextEncoder().encode(bundle.sidecarJson)],
    ["2511-08544.pdf", pdfBytes],
  ]);
  assert.equal((await verifySidecarDigest(bundle.digest, { files })).ok, true);
  assert.equal((await verifySidecarEngineReceipt(bundle.engineReceipt, { files })).ok, true);
  assert.equal(bundle.digest.subject.capture.media_kind, "whitepaper");
  assert.deepEqual(bundle.engineReceipt.subject.capture.workflow_hints, ["research_verify"]);

  // Planted 1-byte tamper on PDF breaks verification
  const badPdf = new Uint8Array(pdfBytes);
  badPdf[5] ^= 0x01;
  files.set("2511-08544.pdf", badPdf);
  assert.equal((await verifySidecarDigest(bundle.digest, { files })).ok, false);
  assert.equal((await verifySidecarEngineReceipt(bundle.engineReceipt, { files })).ok, false);
});
