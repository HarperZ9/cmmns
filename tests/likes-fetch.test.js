// `cmmns likes fetch` over a local HTTP/2 media host: 200 liked posts in two manifest parts, 30 of
// them saved before (priors, found by the post id in a file name), 10 whose picture has the same bytes
// as a file already saved, one the host no longer has (404), one answered 429 first, and one half
// downloaded before (a .part resumed with a range). The counts, the folder and the notes are checked.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http2";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { manifestLine, manifestText } from "../src/core/likes.js";
import { fetchLikes, missingCommand } from "../bin/lib/likes.mjs";
import { makePost, mediaBytes } from "./likes-fixture.js";

const SAME = mediaBytes("image", 5000, "same-picture");

function host() {
  const hits = { total: 0, ranged: 0, limited: 0 }, seen429 = new Set();
  const server = createServer((req, res) => {
    hits.total++;
    const key = req.url.split("?")[0].split("/").pop();
    if (key === "Lgone") { res.writeHead(404); return res.end(); }
    if (key === "Llimit" && !seen429.has(key)) { seen429.add(key); hits.limited++; res.writeHead(429, { "retry-after": "0" }); return res.end(); }
    const body = /^Lsame/.test(key) ? SAME : mediaBytes("image", 3000 + (key.length * 7), key);
    const m = /bytes=(\d+)-/.exec(req.headers.range || "");
    if (m) { hits.ranged++; res.writeHead(206, { "content-range": `bytes ${m[1]}-${body.length - 1}/${body.length}` }); return res.end(body.subarray(Number(m[1]))); }
    res.writeHead(200, { "content-type": "image/jpeg" }); res.end(body);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ server, hits, base: `http://127.0.0.1:${server.address().port}` })));
}

test("fetch: 200 likes, priors and same bytes skipped, 404 reported, 429 waited out, a .part resumed", { timeout: 60000 }, async () => {
  const { server, hits, base } = await host();
  try {
    const root = mkdtempSync(join(tmpdir(), "cmmns-likes-")), dir = join(root, "x"), lib = join(root, "library", "x-likes");
    mkdirSync(dir, { recursive: true }); mkdirSync(lib, { recursive: true });
    const key = (i) => (i === 50 ? "Lgone" : i === 51 ? "Llimit" : i >= 60 && i < 70 ? `Lsame${i}` : `L${i}`);
    const posts = Array.from({ length: 200 }, (_, i) => makePost(String(1800000000000000000n + BigInt(i)), { media: [{ type: "photo", url: `${base}/media/${key(i)}` }] }));
    const lines = posts.map((p) => { const l = manifestLine(p); l.files = l.files.map((f, j) => ({ ...f, url: p.media[j].url })); return l; });
    // Priors: 30 posts saved before, in a study folder, the post id in the name.
    mkdirSync(join(root, "study", "x"), { recursive: true });
    for (const l of lines.slice(170)) writeFileSync(join(root, "study", "x", `painter_2026-01-01_old_${l.id}.jpg`), "prior");
    writeFileSync(join(root, "study", "x", "earlier_same.jpg"), SAME);
    // Half of post 80's picture, from a run that was cut off.
    const full = mediaBytes("image", 3000 + ("L80".length * 7), "L80");
    writeFileSync(join(dir, lines[80].files[0].name + ".part"), full.subarray(0, 1000));
    writeFileSync(join(lib, "manifest-0001.jsonl"), manifestText(lines.slice(0, 100)));
    writeFileSync(join(lib, "manifest-0002.jsonl"), manifestText(lines.slice(100)));

    const r = await fetchLikes(["fetch", "--dir", root, "--jobs", "8"], { env: { CMMNS_PROTECT: "0" }, log: () => {} });
    assert.equal(r.counts.posts, 200);
    assert.equal(r.counts.duplicate, 30, "priors are skipped before any request");
    assert.equal(r.counts.failed, 1, "the 404");
    assert.equal(r.counts.saved, 169);
    assert.equal(r.counts.sameBytes, 10, "the same picture is not kept twice");
    assert.equal(r.counts.files, 159, "169 posts, 10 of them the same picture as one already saved");
    assert.equal(hits.total, 170 + 1, "one request per new file, plus the 429's retry");
    assert.equal(hits.ranged, 1, "the .part was resumed with a range");
    assert.equal(createHash("sha256").update(readFileSync(join(dir, lines[80].files[0].name))).digest("hex"), createHash("sha256").update(full).digest("hex"));
    const md = readFileSync(join(dir, lines[60].sidecar), "utf8");
    assert.match(md, /^files: \["\.\.\/study\/x\/earlier_same\.jpg"\]$/m, "the note names the file already saved");
    assert.match(md, /^from: "x-likes"$/m);
    assert.ok(!existsSync(join(dir, lines[50].sidecar)), "a post with no file saved gets no note, so the next run tries it again");
    assert.ok(!readdirSync(dir).some((n) => n.endsWith(".part")));
    assert.match(r.line, /likes a minute/);
    assert.ok(r.stages.some((s) => s.stage === "fetch") && r.stages.some((s) => s.stage === "dedupe"));

    // Run again: everything is known now, so nothing is requested.
    const before = hits.total, again = await fetchLikes(["fetch", "--dir", root], { env: { CMMNS_PROTECT: "0" }, log: () => {} });
    assert.equal(again.counts.duplicate, 199, "every post saved, or saved before, is known by its id");
    assert.equal(hits.total - before, 1, "only the post that failed is tried again");

    // The archive checklist against the folder.
    const archive = join(root, "like.js");
    writeFileSync(archive, `window.YTD.like.part0 = ${JSON.stringify([...posts.slice(0, 3), makePost("99")].map((p) => ({ like: { tweetId: p.id } })))}`);
    const m = missingCommand(["missing", "--dir", root, "--archive", archive]);
    assert.deepEqual(m.miss, ["99"]);
    assert.match(m.line, /4 likes in the archive, 3 saved, 1 not saved yet/);
  } finally { server.close(); }
});

test("fetch refuses in source-protection mode", async () => {
  const root = mkdtempSync(join(tmpdir(), "cmmns-likes-p-"));
  mkdirSync(join(root, "library", "x-likes"), { recursive: true });
  await assert.rejects(fetchLikes(["fetch", "--dir", root], { env: { CMMNS_PROTECT: "1" }, log: () => {} }), /Source-protection mode is on/);
  assert.ok(!existsSync(join(root, "x")) || !readdirSync(join(root, "x")).length);
});
