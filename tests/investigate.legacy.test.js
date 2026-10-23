// Moving a hand-made case into the case format (src/investigate/legacy.js), and the extension's
// "Add to case" list (src/ext/case-inbox.js), which keeps addresses in the browser and sends nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { legacySource, legacyEvents } from "../src/investigate/legacy.js";

test("a hand-made source row keeps its id, hash, origin and archive note", () => {
  const s = legacySource({ id: "S05", kind: "news", source: "Ukrainska Pravda, relaying Reuters", source_date: "2026-10-16", tier: "secondary (Reuters origin)", url: "https://u.test/a", capture: { method: "HTTP GET", raw_file: "captures/p.html", sha256_raw: "ab".repeat(32) }, archive_url: null, archive_note: "No public archive copy requested, per the brief." }, "S05");
  assert.deepEqual([s.id, s.kind, s.origin, s.capture.sha256, s.capture.hash_of, s.capture.file], ["S05", "web", "Reuters", "ab".repeat(32), "raw bytes", "captures/S05.html"]);
  assert.match(s.archive.note, /per the brief/);
  const p = legacySource({ id: "P01", kind: "x-post", author: "@a", source_date: "queried 2026-10-23", url: "https://x.com/a/status/1", capture: { local_file: "captures/x/1.json", sha256: "cd".repeat(32) }, archive: { wayback_url: "https://web.archive.org/web/1/x" } }, "S01");
  assert.equal(p.legacy_id, "P01");
  assert.equal(p.source_date, null);
  assert.equal(p.source_date_note, "queried 2026-10-23");
  assert.equal(p.archive.url, "https://web.archive.org/web/1/x");
});

test("timeline tables in an old CASE.md become dated events with their sources", () => {
  const md = "| Date (UTC) | Event | Source |\n|---|---|---|\n| 10-14 19:00 | Musk: **limits** decided by POTUS | S01 |\n| 10-15 | Reuters report | S05, S06 |\n\nAfter the table.";
  assert.deepEqual(legacyEvents(md, 2026), [
    { date: "2026-10-14T19:00:00Z", text: "Musk: limits decided by POTUS", source: "S01", also: [], date_text: "10-14 19:00" },
    { date: "2026-10-15", text: "Reuters report", source: "S05", also: ["S06"], date_text: "10-15" },
  ]);
});

test("Add to case keeps web addresses only, once each, up to the cap", () => {
  const ctx = { globalThis: {} };
  ctx.globalThis = ctx;
  vm.runInNewContext(readFileSync(new URL("../src/ext/case-inbox.js", import.meta.url), "utf8"), ctx);
  const I = ctx.PBCaseInbox;
  assert.equal(I.row({ url: "chrome://extensions" }), null);
  const r = I.row({ url: "https://a.test/x", title: "A" }, "2026-10-23T00:00:00Z");
  assert.deepEqual({ ...r }, { url: "https://a.test/x", title: "A", added: "2026-10-23T00:00:00Z" });
  let list = I.addTo([], r);
  list = I.addTo(list, r);
  assert.equal(list.length, 1);
  assert.equal(I.toJsonl(list), JSON.stringify(r) + "\n");
  let big = [];
  for (let i = 0; i < I.MAX + 5; i++) big = I.addTo(big, I.row({ url: `https://a.test/${i}` }));
  assert.equal(big.length, I.MAX);
  const popup = readFileSync(new URL("../src/ext/popup.html", import.meta.url), "utf8");
  assert.ok(popup.indexOf("case-inbox.js") < popup.indexOf("popup.js"), "the list script loads before the popup script");
  assert.doesNotMatch(readFileSync(new URL("../src/ext/case-inbox.js", import.meta.url), "utf8"), /fetch\(|XMLHttpRequest|sendBeacon/);
});
