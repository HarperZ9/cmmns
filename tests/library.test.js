// Library capture (project-docs/LIBRARY-CAPTURE.md): which pages fill which library, which posts a
// one-account library keeps, the index line and LIBRARY.md (with the evidence-only scope note), a
// library continuing where it stopped, the auto-scroll pace and stop rules, and the case hand-off
// checking every file's hash against the index.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { libraryOf, librarySkip, libraryLine, libraryIndex, libraryMarkdown, libraryState, LIBRARY_SCOPE, SKIP } from "../src/core/library.js";
import { savePath } from "../src/core/media-meta.js";
import { runCaseCommand } from "../bin/lib/case.mjs";
import { initCase } from "../src/investigate/layout.js";
import { loadCase } from "../src/investigate/store.js";
import { buildTimeline } from "../src/investigate/timeline.js";

test("profile, list and search pages on X, and user and subreddit pages on Reddit, are library pages", () => {
  const f = (u) => (libraryOf(u) || {}).folder || null;
  assert.equal(f("https://x.com/MeditInColor"), "x-meditincolor");
  assert.equal(f("https://x.com/MeditInColor/media"), "x-meditincolor", "a profile's tabs fill the same library");
  assert.equal(f("https://twitter.com/a_b/with_replies"), "x-a_b");
  assert.equal(f("https://x.com/i/lists/1234567890"), "x-list-1234567890");
  assert.equal(f("https://x.com/search?q=meditations%20in%20color&f=live"), "x-search-meditations-in-color");
  assert.equal(f("https://x.com/hashtag/Colour"), "x-hashtag-colour");
  assert.equal(f("https://www.reddit.com/r/Art/"), "reddit-r-art");
  assert.equal(f("https://www.reddit.com/r/Art/top/?t=all"), "reddit-r-art");
  assert.equal(f("https://www.reddit.com/user/someone/submitted/"), "reddit-u-someone");
  assert.equal(libraryOf("https://x.com/MeditInColor").author, "MeditInColor");
  assert.equal(libraryOf("https://www.reddit.com/r/Art/").author, null);
  for (const no of ["https://x.com/home", "https://x.com/a/status/1", "https://x.com/settings/account", "https://x.com/a/likes", "https://x.com/search",
    "https://www.reddit.com/r/Art/comments/abc/title/", "https://www.youtube.com/@chan", "not a url"]) assert.equal(libraryOf(no), null, no);
});

test("a one-account library keeps that account's own posts; reposts, adverts and posts with no id are counted, not saved", () => {
  const mine = libraryOf("https://x.com/MeditInColor"), sub = libraryOf("https://www.reddit.com/r/Art/");
  assert.equal(librarySkip(mine, { id: "1", handle: "meditincolor" }), null);
  assert.equal(librarySkip(mine, { id: "2", handle: "someone_else" }), SKIP.other);
  assert.equal(librarySkip(mine, { id: "3", handle: "MeditInColor", promoted: true }), SKIP.promoted);
  assert.equal(librarySkip(mine, { handle: "MeditInColor" }), SKIP.noId);
  assert.equal(librarySkip(sub, { id: "t3_x", handle: "u/anyone" }), null, "a subreddit keeps every author");
  assert.equal(librarySkip(libraryOf("https://www.reddit.com/user/Someone"), { id: "t3_y", handle: "u/someone" }), null);
});

test("library files go to <save folder>/library/<site>-<name>/, even with saving into Downloads on", () => {
  assert.equal(savePath({}, "x", false, "x-meditincolor"), "Daylight/library/x-meditincolor/");
  assert.equal(savePath({ mediaFolder: "Saves" }, "x", false, "reddit-r-art"), "Saves/library/reddit-r-art/");
  assert.equal(savePath({ mediaToRoot: true }, "x", false, "x-a"), "library/x-a/");
  assert.doesNotMatch(savePath({}, "x", false, "../../evil"), /(^|\/)\.\.(\/|$)/, "no way out of the library folder");
  assert.equal(savePath({}, "x"), "Daylight/x/", "ordinary saves are unchanged");
});

const LIB = libraryOf("https://x.com/MeditInColor");
function filled() {
  const st = libraryState(LIB, null, "2026-10-28T10:00:00.000Z");
  st.sources.push("https://x.com/MeditInColor/media");
  st.sessions.push({ started: "2026-10-28T10:00:00.000Z", stopped: "2026-10-28T10:20:00.000Z", saved: 2, mode: "auto", why: "the cap of 2 posts was reached" });
  st.items.push(libraryLine({ id: "11", url: "https://x.com/MeditInColor/status/11", handle: "MeditInColor", posted: "2026-01-02T00:00:00.000Z", saved: "2026-10-28T10:01:00.000Z",
    files: [{ name: "a_11.jpg", sha256: "aa" }, { name: "a_11.md", sha256: "bb" }] }));
  st.items.push(libraryLine({ id: "12", url: "https://x.com/MeditInColor/status/12", saved: "2026-10-28T10:02:00.000Z", kind: "text",
    files: [{ name: "b_12.mp4", sha256: null }, { name: "b_12.md", sha256: "cc" }], missing: ["item 2 of 2: Protected"] }));
  st.skipped[SKIP.other] = 3;
  return st;
}

test("index.jsonl has one line per post with each file's hash; LIBRARY.md says where, when, how many and what was left out", () => {
  const st = filled(), lines = libraryIndex(st).trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.id), ["11", "12"]);
  assert.deepEqual(Object.keys(lines[0]), ["id", "url", "handle", "posted", "saved", "kind", "files"]);
  assert.deepEqual(lines[0].files, [{ name: "a_11.jpg", sha256: "aa" }, { name: "a_11.md", sha256: "bb" }]);
  assert.match(lines[1].files[0].note, /not hashed/);
  assert.deepEqual(lines[1].missing, ["item 2 of 2: Protected"]);
  const md = libraryMarkdown(st);
  for (const want of ['library: "x-meditincolor"', "posts: 2", "https://x.com/MeditInColor/media", "2026-10-28T10:00:00.000Z to 2026-10-28T10:20:00.000Z", "auto-scroll",
    "the cap of 2 posts was reached", `3: ${SKIP.other}`, "1 saved post lacks some media", "1 file saved without a hash", "daylight case add-library", ...LIBRARY_SCOPE]) assert.ok(md.includes(want), want);
  assert.doesNotMatch(md, /—/, "no em-dashes");
  assert.match(LIBRARY_SCOPE.join(" "), /never label a person's character, disposition, beliefs not stated, honesty or intent/);
});

test("reopening the same page continues the same library; another library starts fresh", () => {
  const kept = JSON.parse(JSON.stringify(filled()));
  const again = libraryState(LIB, kept);
  assert.equal(again.items.length, 2);
  again.items.push({ id: "13" });
  assert.equal(kept.items.length, 2, "the kept record is not changed in place");
  assert.equal(libraryState(libraryOf("https://x.com/other"), kept).items.length, 0);
});

function scroller() {
  const ctx = { setTimeout, Math, document: { documentElement: { scrollHeight: 1000 } }, innerHeight: 800, window: { scrollBy() {} } };
  ctx.globalThis = ctx;
  vm.runInNewContext(readFileSync(join(import.meta.dirname, "..", "src", "ext", "library-scroll.js"), "utf8"), ctx);
  return ctx.PBLibraryScroll;
}

test("auto-scroll moves at a reading pace with jitter, and stops at the cap, the end of the feed, or Stop", () => {
  const s = scroller();
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const steps = Array.from({ length: 60 }, (_, n) => s.step(rnd, n));
  for (const x of steps) { assert.ok(x.by >= 0.55 && x.by <= 0.9); assert.ok(x.wait >= 1600 && x.wait <= 16200); }
  assert.ok(new Set(steps.map((x) => x.wait)).size > 50, "waits vary");
  assert.ok(steps.some((x) => x.wait > 5000), "with longer pauses now and then");
  assert.equal(s.stopWhy({ stopped: false, saved: 499, cap: 500, idle: 0 }), null);
  assert.match(s.stopWhy({ stopped: false, saved: 500, cap: 500, idle: 0 }), /cap of 500/);
  assert.match(s.stopWhy({ stopped: false, saved: 3, cap: 500, idle: 6 }), /end of the feed/);
  assert.equal(s.stopWhy({ stopped: true, saved: 3, cap: 500, idle: 0 }), "Stop pressed");
});

const hex = (b) => createHash("sha256").update(b).digest("hex");

test("case add-library adds every post with its hashes checked, skips posts already in the case, and the timeline runs over them", async () => {
  const root = mkdtempSync(join(tmpdir(), "dc-lib-")), lib = join(root, "x-meditincolor"), cs = join(root, "case");
  try {
    initCase(cs, "Colour study", "2026-10-28T00:00:00.000Z");
    writeFileSync(join(root, "none.json"), "{}");
    const files = { "m_11.jpg": Buffer.from("jpeg bytes"), "m_11.md": Buffer.from("---\nformat: \"daylight.sidecar/1\"\n---\n\n> Blue first, then the gold.\n"), "m_12.md": Buffer.from("> Gold now.\n"), "m_12.mp4": Buffer.from("mp4") };
    mkdirSync(lib, { recursive: true });
    for (const [n, b] of Object.entries(files)) writeFileSync(join(lib, n), b);
    const st = filled();
    st.items = [libraryLine({ id: "11", url: "https://x.com/m/status/11", handle: "MeditInColor", posted: "2026-01-02T00:00:00.000Z", saved: "2026-10-28T10:01:00.000Z", files: [{ name: "m_11.jpg", sha256: hex(files["m_11.jpg"]) }, { name: "m_11.md", sha256: hex(files["m_11.md"]) }] }),
      libraryLine({ id: "12", url: "https://x.com/m/status/12", handle: "MeditInColor", posted: "2026-03-04T00:00:00.000Z", saved: "2026-10-28T10:02:00.000Z", files: [{ name: "m_12.mp4", sha256: null }, { name: "m_12.md", sha256: "0".repeat(64) }, { name: "gone.jpg", sha256: "ff" }] })];
    writeFileSync(join(lib, "index.jsonl"), libraryIndex(st));
    writeFileSync(join(lib, "LIBRARY.md"), libraryMarkdown(st));
    const r = await runCaseCommand(["add-library", lib, "--case", cs, "--no-commit"], { env: { DAYLIGHT_CASE_NOW: "2026-10-28T12:00:00Z", DAYLIGHT_CASE_REPLAY: join(root, "none.json") } });
    assert.equal(r.code, 0);
    assert.match(r.out, /Added 2 posts from library x-meditincolor as S01 to S02\./);
    assert.match(r.out, /2 match the library index, 1 were saved unhashed and are hashed now/);
    assert.match(r.out, /1 file differs from the hash recorded at save \(changed since\): m_12\.md/);
    assert.match(r.out, /1 file is not in the folder: gone\.jpg/);
    assert.match(r.out, /never label a person's character/);
    const data = loadCase(cs), [a, b] = data.sources;
    assert.equal(a.kind, "library-post"); assert.equal(a.author, "MeditInColor"); assert.equal(a.source_date, "2026-01-02T00:00:00.000Z");
    assert.equal(a.capture.sha256, hex(files["m_11.md"]), "the sidecar is the capture");
    assert.deepEqual(b.library.files.map((f) => f.check), ["hashed-now", "differs", "missing"]);
    assert.equal(b.library.files[0].disk, hex(files["m_12.mp4"]));
    assert.ok(readdirSync(join(cs, "captures")).includes("S01.md"));
    assert.deepEqual(buildTimeline(data).events.filter((e) => e.from === "source").map((e) => e.id), ["S01", "S02"]);
    const again = await runCaseCommand(["add-library", lib, "--case", cs, "--no-commit"], { env: { DAYLIGHT_CASE_REPLAY: join(root, "none.json") } });
    assert.match(again.out, /No new posts in library x-meditincolor\.\n2 already in the case, skipped\./);
    assert.equal(loadCase(cs).sources.length, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
