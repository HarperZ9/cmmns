// Automated X Likes pagination, persistent dedup index (seenIds + SHA-256 + URLs),
// skip-duplicates default with includeDuplicates opt-in, rate-limit backoff, pause/stop,
// fail-closed CAPTCHA/challenge halt, and CLI --include-duplicates + --receipt verification.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http2";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  extractLikesCursor, buildNextLikesUrl, isChallengeResponse, createDedupIndex, admitWithPolicy, paginateLikes,
} from "../src/core/likes-sync.js";
import { manifestLine, manifestText } from "../src/core/likes.js";
import { verifySidecarDigest, verifySidecarEngineReceipt } from "../src/core/sidecar-receipt.js";
import { fetchLikes } from "../bin/lib/likes.mjs";
import { makePost, likesJson, timelineAnswer, mediaBytes } from "./likes-fixture.js";

test("extractLikesCursor and buildNextLikesUrl handle GraphQL variables and query cursors", () => {
  const page = likesJson([makePost("101")], "CURSOR_NEXT_42");
  assert.deepEqual(extractLikesCursor(page), { bottomCursor: "CURSOR_NEXT_42", topCursor: null });

  const gql = "https://x.com/i/api/graphql/abc/Likes?variables=%7B%22userId%22%3A%227%22%2C%22count%22%3A20%7D&features=%7B%7D";
  const next = buildNextLikesUrl(gql, "CURSOR_NEXT_42");
  const vars = JSON.parse(new URL(next).searchParams.get("variables"));
  assert.equal(vars.cursor, "CURSOR_NEXT_42");
  assert.equal(vars.userId, "7");
  assert.equal(new URL(buildNextLikesUrl("https://x.com/i/api/graphql/sim/Likes?cursor=0", "20")).searchParams.get("cursor"), "20");
});

test("dedup index persists seenIds/SHA-256/URLs, skips planted duplicates by default, and honors includeDuplicates", () => {
  const idx = createDedupIndex({ seenIds: ["1001"], contentHashes: ["abcd".repeat(16)], mediaUrls: ["https://pbs.twimg.com/media/L1002?format=jpg&name=orig"] });
  const reloaded = createDedupIndex(JSON.parse(JSON.stringify(idx.serialize("2026-11-25T19:00:00Z"))));

  // Planted duplicate by post ID
  const dupId = admitWithPolicy(reloaded, makePost("1001"));
  assert.equal(dupId.action, "skip");
  assert.equal(dupId.duplicate, true);

  // Planted duplicate by media URL
  const dupUrl = admitWithPolicy(reloaded, makePost("1002"));
  assert.equal(dupUrl.action, "skip");
  assert.equal(dupUrl.duplicate, true);

  // Planted duplicate by content SHA-256 hash
  const dupHash = admitWithPolicy(reloaded, makePost("1003"), { sha256: "abcd".repeat(16) });
  assert.equal(dupHash.action, "skip");

  // Explicit opt-in includeDuplicates=true re-saves the duplicate
  const optIn = admitWithPolicy(reloaded, makePost("1001"), { includeDuplicates: true });
  assert.equal(optIn.action, "save");
  assert.equal(optIn.duplicate, true);
  assert.equal(optIn.line.source_site, "x");
  assert.equal(optIn.line.deconstruct_ready, true);
  assert.ok(optIn.line.workflow_hints.includes("civic_audit"));
});

test("paginateLikes exhausts multi-page timeline with zero manual scrolling and accurate telemetry", async () => {
  const unique = Array.from({ length: 50 }, (_, i) => makePost(String(1850000000000000000n + BigInt(i))));
  const timeline = [...unique.slice(0, 30), ...unique.slice(10, 15), ...unique.slice(30)]; // 5 redrawn overlaps
  const dedupIndex = createDedupIndex({ seenIds: unique.slice(40).map((p) => p.id) }); // 10 previously saved

  const res = await paginateLikes({
    dedupIndex,
    initialBackoffMs: 0,
    sleep: async () => {},
    fetchPage: async (cursor) => timelineAnswer(timeline, cursor),
  });
  assert.equal(res.stoppedReason, "exhausted");
  assert.equal(res.nextCursor, null);
  assert.equal(res.pagesFetched, 3);
  assert.equal(res.totalSeen, 55);
  assert.equal(res.saved, 40);
  assert.equal(res.skippedDuplicates, 15, "10 priors + 5 redrawn overlaps skipped");
  assert.equal(res.items.length, 40);
  assert.equal(new Set(res.items.map((x) => x.id)).size, 40);
});

test("paginateLikes honors rate-limit backoff, pause/stop valve, and halts closed on CAPTCHA challenge", async () => {
  const sleeps = [];
  let calls = 0;
  const posts = [makePost("2001"), makePost("2002")];
  const rateRes = await paginateLikes({
    initialBackoffMs: 100,
    maxBackoffMs: 5000,
    sleep: async (ms) => { sleeps.push(ms); },
    fetchPage: async () => {
      calls++;
      if (calls === 1) return { status: 429, retryAfterSec: 1, json: { errors: [{ code: 88 }] } };
      return { status: 200, json: likesJson(posts, null) };
    },
  });
  assert.equal(rateRes.stoppedReason, "exhausted");
  assert.equal(rateRes.saved, 2);
  assert.ok(sleeps.includes(1000), "honored retryAfterSec backoff");

  // CAPTCHA / challenge response immediately halts with zero bypass attempts
  assert.equal(isChallengeResponse({ status: 403, bodyText: "Please complete Arkose captcha verification" }), true);
  let challengeCalls = 0;
  const blocked = await paginateLikes({
    initialBackoffMs: 0,
    sleep: async () => {},
    fetchPage: async () => { challengeCalls++; return { status: 403, bodyText: "human verification challenge_required" }; },
  });
  assert.equal(blocked.stoppedReason, "challenge_required");
  assert.equal(challengeCalls, 1, "zero retries or bypass attempts on challenge");

  // Stop valve halts immediately after first page
  let stopNow = false;
  const stopped = await paginateLikes({
    initialBackoffMs: 0,
    sleep: async () => {},
    shouldStop: () => stopNow,
    fetchPage: async (c) => timelineAnswer([makePost("3001"), makePost("3002")], c),
    onItem: () => { stopNow = true; },
  });
  assert.equal(stopped.stoppedReason, "stopped");
});

test("CLI likes fetch --include-duplicates --receipt emits verifiable receipts and catches 1-byte tamper", async () => {
  const img = mediaBytes("image", 4096, "receipt-like");
  const server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "image/jpeg" });
    res.end(img);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  const root = mkdtempSync(join(tmpdir(), "cmmns-likes-receipt-"));
  try {
    const lib = join(root, "library", "x-likes");
    mkdirSync(lib, { recursive: true });
    const post = makePost("1860000000000000001", { media: [{ type: "photo", url: `${base}/media/L1` }] });
    const line = manifestLine(post);
    line.files[0].url = `${base}/media/L1`;
    writeFileSync(join(lib, "manifest-0001.jsonl"), manifestText([line]));

    const first = await fetchLikes(["fetch", "--dir", root, "--receipt"], { env: { CMMNS_PROTECT: "0" }, log: () => {} });
    assert.equal(first.counts.saved, 1);

    // Default second run skips the duplicate
    const skipped = await fetchLikes(["fetch", "--dir", root], { env: { CMMNS_PROTECT: "0" }, log: () => {} });
    assert.equal(skipped.counts.duplicate, 1);
    assert.equal(skipped.counts.saved, 0);

    // Opt-in --include-duplicates re-saves cleanly
    const forced = await fetchLikes(["fetch", "--dir", root, "--include-duplicates", "--receipt"], { env: { CMMNS_PROTECT: "0" }, log: () => {} });
    assert.equal(forced.counts.saved, 1);
    assert.equal(forced.counts.duplicate, 0);

    const dir = join(root, "x"), stem = line.sidecar.replace(/\.md$/, "");
    const md = readFileSync(join(dir, line.sidecar), "utf8");
    assert.match(md, /^media_kind: "image"$/m);
    assert.match(md, /^source_site: "x"$/m);
    assert.match(md, /^deconstruct_ready: true$/m);

    const digest = JSON.parse(readFileSync(join(dir, `${stem}.digest.json`), "utf8"));
    const receipt = JSON.parse(readFileSync(join(dir, `${stem}.receipt.json`), "utf8"));
    const intact = new Map([[line.sidecar, Buffer.from(md)], [line.files[0].name, readFileSync(join(dir, line.files[0].name))]]);
    assert.equal((await verifySidecarDigest(digest, { files: intact })).ok, true);
    assert.equal((await verifySidecarEngineReceipt(receipt, { files: intact })).ok, true);

    // Planted 1-byte tamper breaks both verifiers
    const tampered = new Map(intact);
    const copy = new Uint8Array(intact.get(line.files[0].name));
    copy[10] ^= 0x01;
    tampered.set(line.files[0].name, copy);
    assert.equal((await verifySidecarDigest(digest, { files: tampered })).ok, false);
    assert.equal((await verifySidecarEngineReceipt(receipt, { files: tampered })).ok, false);
  } finally {
    server.close();
    rmSync(root, { recursive: true, force: true });
  }
});
