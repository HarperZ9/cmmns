// `daylight sidecar check` on the files a note names: a note left naming another save's file is
// found, and repaired only when a file carries the note's post address and was written in its
// save's window. A file with no address inside, or two that could fit, is reported and left alone.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, utimesSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkFiles, repairText, fileLines } from "../bin/lib/sidecar-files.mjs";
import { postMeta, sidecarMarkdown } from "../src/core/media-meta.js";

const S = "horacioaltuna_2026-10-28_frederic-pillot";
const url = (id) => `https://x.com/HoracioAltuna/status/${id}`;
const at = (iso) => new Date(iso);

function folder(build) {
  const dir = mkdtempSync(join(tmpdir(), "dl-sidecar-"));
  const put = (name, text, when) => { writeFileSync(join(dir, name), text); utimesSync(join(dir, name), at(when), at(when)); };
  const note = (name, id, saved, files) => put(name, sidecarMarkdown(postMeta({ site: "x", handle: "HoracioAltuna", text: "Frederic Pillot", postUrl: url(id) }, saved), files), saved);
  const jpg = (name, id, when) => put(name, `\xff\xd8\xff<x:xmpmeta><dc:source>${id ? url(id) : ""}</dc:source></x:xmpmeta>`, when);
  build({ note, jpg });
  return dir;
}

test("the frederic-pillot case: the second note is found and repaired to its own (1) file", () => {
  const dir = folder(({ note, jpg }) => {
    jpg(`${S}.jpg`, "2115320633450275274", "2026-10-28T07:25:30Z"); note(`${S}.md`, "2115320633450275274", "2026-10-28T07:25:29.579Z", [`${S}.jpg`]);
    jpg(`${S} (1).jpg`, "2115320786059952505", "2026-10-28T07:41:08Z"); note(`${S} (1).md`, "2115320786059952505", "2026-10-28T07:41:04.308Z", [`${S}.jpg`]);
  });
  try {
    const r = checkFiles(dir);
    assert.deepEqual([r.notes, r.ok, r.wrong, r.fixable, r.unresolved, r.fixed], [2, 1, 1, 1, 0, 0]);
    assert.deepEqual(r.flagged[0].rows, [{ name: `${S}.jpg`, verdict: "other", to: `${S} (1).jpg`, candidates: 1 }]);
    assert.match(readFileSync(join(dir, `${S} (1).md`), "utf8"), new RegExp(`^files: \\["${S}\\.jpg"\\]$`, "m"), "report-only changes nothing");
    const f = checkFiles(dir, { fix: true });
    assert.equal(f.fixed, 1);
    const md = readFileSync(join(dir, `${S} (1).md`), "utf8");
    assert.match(md, new RegExp(`^files: \\["${S} \\(1\\)\\.jpg"\\]$`, "m"));
    assert.match(md, new RegExp(`^- File: ${S} \\(1\\)\\.jpg$`, "m"));
    assert.deepEqual([checkFiles(dir).wrong, checkFiles(dir).ok], [0, 2], "a second run finds nothing to repair");
    assert.match(readFileSync(join(dir, `${S}.md`), "utf8"), new RegExp(`^files: \\["${S}\\.jpg"\\]$`, "m"), "the first note is untouched");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a gallery saved twice: the second note's files are moved to its own (1) files, by time", () => {
  const g = (n, s = "") => `${S}-${n}${s}.jpg`;
  const dir = folder(({ note, jpg }) => {
    for (const n of [1, 2]) jpg(g(n), "2115225205727523045", "2026-10-28T06:51:44Z");
    note(`${S}.md`, "2115225205727523045", "2026-10-28T06:50:23.957Z", [g(1), g(2)]);
    for (const n of [1, 2]) jpg(g(n, " (1)"), "2115225205727523045", "2026-10-28T07:24:25Z");
    note(`${S} (1).md`, "2115225205727523045", "2026-10-28T07:24:24.346Z", [g(1), g(2)]);
  });
  try {
    const r = checkFiles(dir, { fix: true });
    assert.deepEqual([r.ok, r.wrong, r.fixed], [1, 1, 1]);
    const md = readFileSync(join(dir, `${S} (1).md`), "utf8");
    assert.match(md, new RegExp(`^- Files: 1\\. ${S}-1 \\(1\\)\\.jpg, 2\\. ${S}-2 \\(1\\)\\.jpg$`, "m"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("no guess: a file with no post address, or a missing file with no proved match, is reported and left", () => {
  const dir = folder(({ note, jpg }) => {
    jpg(`${S}.jpg`, "2115320633450275274", "2026-10-28T07:25:30Z"); note(`${S}.md`, "2115320633450275274", "2026-10-28T07:25:29Z", [`${S}.jpg`]);
    jpg(`${S} (1).jpg`, null, "2026-10-28T07:41:08Z"); note(`${S} (1).md`, "2115320786059952505", "2026-10-28T07:41:04Z", [`${S}.jpg`]);
    note("other.md", "2115225205727523999", "2026-10-28T08:00:00Z", ["gone.jpg"]);
  });
  try {
    const before = readFileSync(join(dir, `${S} (1).md`), "utf8");
    const r = checkFiles(dir, { fix: true });
    assert.deepEqual([r.wrong, r.fixable, r.unresolved, r.fixed], [2, 0, 2, 0]);
    assert.equal(readFileSync(join(dir, `${S} (1).md`), "utf8"), before);
    assert.match(fileLines(r, true), /missing\), no file proved/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("repairText changes only the files line and the File line", () => {
  const md = `---\nformat: "daylight.sidecar/1"\nfiles: ["a.jpg"]\n---\n\n> a.jpg is in the text\n\n- File: a.jpg\n- Post: x\n`;
  const out = repairText(md, [{ name: "a.jpg", to: "a (1).jpg" }]);
  assert.equal(out, md.replace('["a.jpg"]', '["a (1).jpg"]').replace("- File: a.jpg", "- File: a (1).jpg"));
});
