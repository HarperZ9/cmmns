// Study boards (project-docs/STUDY-BOARDS.md): one refdb.board/1 format for saves, 3.6.0 moodboards
// and the reference library's `refdb board`; the page draws plates without scripts and escapes every
// caption; timeline gaps and the evidence sheets follow the shared sheet model.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseSidecar, boardFrom, boardFromMoodboard, timelineRows, sheetOpacity, evidencePlan, mediaKind, BOARD_FORMAT } from "../src/core/board.js";
import { boardHtml } from "../src/core/board-html.js";
import { makeBoard, renderSpec } from "../bin/lib/board.mjs";

const sidecar = (front, body = "") => "---\n" + Object.entries(front).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n") + "\n---\n" + body;
const entry = (front, files = ["a.jpg"], body = "") => ({ sidecar: parseSidecar(sidecar({ format: "daylight.sidecar/1", files, ...front }, body)), sidecarName: (files[0] || "t") + ".md", files });

test("parseSidecar reads the front matter, the quoted text, alt text and the note", () => {
  const sc = parseSidecar(sidecar({ format: "daylight.sidecar/1", site: "x", posted: "2026-01-02T00:00:00Z" }, "\n**A title**\n\n> line one\n> line two\n\nAlt text: a heron\nWhat draws me to this: the light\n"));
  assert.equal(sc.front.site, "x");
  assert.equal(sc.text, "line one\nline two");
  assert.equal(sc.alt, "a heron");
  assert.equal(sc.note, "the light");
  assert.equal(sc.title, "A title");
  assert.equal(parseSidecar("---\nformat: \"other/1\"\n---\n"), null);
  assert.equal(parseSidecar("no front matter"), null);
});

test("boardFrom makes a refdb.board/1 board with numbered plates that keep their source", () => {
  const b = boardFrom([entry({ site: "x", handle: "@a", posted: "2026-01-01T00:00:00Z", engagement: { views: 900 } }, ["a.jpg", "b.mp4"]), entry({ site: "reddit" }, [])],
    { title: "Herons", lane: "design", keywords: "water, light, water", layout: "grid" });
  assert.equal(b.format, BOARD_FORMAT);
  assert.deepEqual(b.running_head, { left: "Herons", right: "DESIGN" });
  assert.deepEqual(b.keyword_line, ["water", "light"]);
  assert.deepEqual(b.plates.map((p) => p.n), [1, 2, 3]);
  assert.deepEqual(b.plates.map((p) => p.media[0] && p.media[0].kind), ["still", "motion", undefined]);
  assert.equal(b.plates[1].source.item, "2 of 2");
  assert.equal(b.plates[0].source.reach, 900);
  assert.equal(b.plates[2].medium, "text");
  assert.equal(b.layout, "grid");
  assert.equal(boardFrom([], { layout: "nonsense" }).layout, "book");
  assert.equal(mediaKind("x.OPUS"), "audio");
});

test("a 3.6.0 moodboard becomes a board of kind moodboard, its plates addressed by SHA-256", () => {
  const b = boardFromMoodboard({ id: "m1", name: "Kilns" }, [{ id: "r1", sha256: "ab".repeat(32), name: "k.png", mime: "image/png", tags: ["clay"], source: { page: "https://x.com/a/status/1" } }]);
  assert.equal(b.format, BOARD_FORMAT);
  assert.equal(b.kind, "moodboard");
  assert.equal(b.running_head.right, "MOODBOARD");
  assert.equal(b.plates[0].media[0].path, "ab".repeat(32));
  assert.deepEqual(b.keyword_line, ["clay"]);
});

test("the timeline shows a gap only where the silence is long", () => {
  const day = 86400000, at = (d) => new Date(Date.UTC(2026, 0, 1) + d * day).toISOString();
  const b = boardFrom([0, 1, 2, 30].map((d, i) => entry({ posted: at(d) }, [`p${i}.jpg`])).concat(entry({}, ["u.jpg"])));
  const rows = timelineRows(b.plates);
  const gaps = rows.filter((r) => r.gap);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].gap.days, 28);
  assert.equal(rows.at(-1).undated, true);
});

test("sheet opacity rises with reach on a log scale and unknown reach reads faint", () => {
  assert.equal(sheetOpacity(null, 1000), 0.25);
  assert.equal(sheetOpacity(1000, 1000), 1);
  const mid = sheetOpacity(30, 1000);
  assert.ok(mid > 0.25 && mid < 1);
});

test("the evidence plan lays each claim over its matched source plates, widest reach on top", () => {
  const b = boardFrom([entry({ post: "https://twitter.com/a/status/1?s=20", engagement: { views: 10 } }, ["a.jpg"]), entry({ post: "https://x.com/b/status/2", engagement: { views: 100000 } }, ["b.jpg"]), entry({ post: "https://x.com/c/status/3" }, ["c.jpg"])]);
  const plan = evidencePlan(b.plates, { sources: [{ id: "S1", url: "https://x.com/a/status/1" }, { id: "S2", url: "https://www.x.com/b/status/2/" }], claims: [{ id: "C1", text: "It flooded", rung: "observed", source: "S1, S2" }, { id: "C2", text: "no source", source: "S9" }] });
  assert.equal(plan.sheets.length, 1);
  assert.deepEqual(plan.sheets[0].layers.map((l) => l.source), ["S2", "S1"]);
  assert.ok(plan.sheets[0].layers[0].opacity > plan.sheets[0].layers[1].opacity);
  assert.deepEqual(plan.unmatched, [3]);
});

test("the page escapes captions, carries no script and draws every layout", () => {
  const b = boardFrom([entry({ site: "x", author: "<img src=x onerror=alert(1)>", post: "https://x.com/a/status/1" }, ["a.jpg"], "\n> <script>alert(1)</script>\n")], { title: "T<b>" });
  for (const layout of ["book", "grid", "timeline", "evidence"]) {
    const html = boardHtml(b, { layout, caseData: { sources: [{ id: "S1", url: "https://x.com/a/status/1" }], claims: [{ id: "C1", text: "<i>claim</i>", source: "S1" }] } });
    assert.doesNotMatch(html, /<script/i, layout);
    assert.doesNotMatch(html, /<img src=x/, layout);
    assert.match(html, /T&lt;b&gt;/, layout);
  }
  assert.match(boardHtml(b, { layout: "book" }), /plates\/a\.jpg/);
});

test("the heading face is a choice, and Accession loads only when a board uses it", () => {
  const b = boardFrom([entry({ site: "x" })], { title: "T" });
  assert.equal(b.head, "grotesk");
  assert.doesNotMatch(boardHtml(b), /AccessionStencil/);
  assert.match(boardHtml(b, { head: "accession" }), /AccessionStencil\.woff2[\s\S]*--head: "Accession Stencil"/);
  assert.match(boardHtml(b, { head: "mono" }), /--head: var\(--mono\)/);
  assert.equal(boardFrom([], { head: "comic" }).head, "grotesk");
  assert.match(boardHtml(b, { head: "</style><b>" }), /--head: var\(--sans\)/);
});

test("board make and board render write the page, board.json and a manifest", async () => {
  const dir = mkdtempSync(join(tmpdir(), "board-"));
  try {
    const saves = join(dir, "saves", "x");
    mkdirSync(saves, { recursive: true });
    writeFileSync(join(saves, "a.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    writeFileSync(join(saves, "a.jpg.md"), sidecar({ format: "daylight.sidecar/1", site: "x", files: ["a.jpg"], posted: "2026-01-01T00:00:00Z" }));
    const made = await makeBoard(join(dir, "saves"), { title: "Shore", out: join(dir, "out") }, {});
    assert.equal(made.board.plates.length, 1);
    for (const f of ["index.html", "board.json", "MANIFEST.sha256", "fonts/hanken-grotesk.woff2", "fonts/OFL-accession.txt"]) assert.ok(existsSync(join(dir, "out", f)), f);
    assert.equal(JSON.parse(readFileSync(join(dir, "out", "board.json"), "utf8")).format, "refdb.board/1");

    const spec = { format: "refdb.board/1", kind: "concept", key: "tide", running_head: { left: "Tide", right: "RESEARCH" }, lane: "research", keyword_line: ["tide"],
      plates: [{ n: 1, unit: "u1", item_ids: ["i1"], media: [{ id: "i1", kind: "still", path: "a.jpg" }, { id: "i2", kind: "still", path: "gone.jpg" }], caption: "Tide pool", medium: "visual", concepts: ["tide"] }], also_in: {}, sources: {} };
    writeFileSync(join(saves, "tide.json"), JSON.stringify(spec));
    const r = await renderSpec(join(saves, "tide.json"), { out: join(dir, "spec") }, {});
    assert.ok(existsSync(join(dir, "spec", "plates", "a.jpg")));
    assert.match(r.line, /Not found: plate 1: gone\.jpg/);
    assert.match(readFileSync(join(dir, "spec", "index.html"), "utf8"), /Tide pool/);
    await assert.rejects(renderSpec(join(saves, "a.jpg.md").replace(".jpg.md", ".bad.json")), /ENOENT/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the claim sheet pairs reach (sheet opacity) with corroboration (provenance opacity, said in words)", () => {
  const b = boardFrom([entry({ post: "https://x.com/a/status/1", engagement: { views: 50 } }, ["a.jpg"]), entry({ post: "https://www.reuters.com/world/flood", engagement: { views: 5 } }, ["b.jpg"]), entry({ post: "https://x.com/a/status/2" }, ["c.jpg"])]);
  const caseData = { sources: [{ id: "S1", url: "https://x.com/a/status/1" }, { id: "S2", url: "https://www.reuters.com/world/flood" }, { id: "S3", url: "https://x.com/a/status/2" }], claims: [{ id: "C1", text: "Flood", rung: "documented", source: "S1 S2 S3" }] };
  const [sheet] = evidencePlan(b.plates, caseData).sheets;
  const by = Object.fromEntries(sheet.layers.map((l) => [l.source, l]));
  assert.equal(by.S1.corroborated_by, 1, "the same account twice is one origin");
  assert.equal(by.S2.corroborated_by, 1);
  assert.equal(by.S1.provenance_opacity, 0.5);
  const html = boardHtml(b, { layout: "evidence", caseData });
  assert.match(html, /class="prov" style="opacity:0\.5">Corroborated by 1 other origin among this claim's sources\./);
});

test("the evidence board prints through the shared sheet engine: ink bands by reach, no CSS opacity on sheets", () => {
  const b = boardFrom([entry({ post: "https://x.com/a/status/1", engagement: { views: 1000 } }, ["a.jpg"]), entry({ post: "https://www.reuters.com/world/flood", engagement: { views: 250 } }, ["b.jpg"])]);
  const caseData = { sources: [{ id: "S1", url: "https://x.com/a/status/1" }, { id: "S2", url: "https://www.reuters.com/world/flood" }], claims: [{ id: "C1", text: "Flood", rung: "documented", source: "S1 S2" }] };
  const html = boardHtml(b, { layout: "evidence", caseData });
  const bands = [...html.matchAll(/<div class="ink" aria-hidden="true"><span style="background:(#[0-9a-f]{6});width:([\d.]+)%">/g)];
  assert.equal(bands.length, 2);
  assert.deepEqual(bands.map((m) => Number(m[2])), [100, 25]);
  assert.doesNotMatch(html, /class="layer"[^>]*opacity/);
  assert.match(html, /25% of the widest reach/);
});
