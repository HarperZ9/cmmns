// "Backing on record" in the extension (src/core/backing.js): exact handle matches per platform,
// YouTube channel ids, the subset the worker sends a page, the badge's count, and the window's rows
// with quotes, dates, does-not-prove lines and the corrections path. Local data only.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setBackingTable, backingOf, backingOfChannel, backingLookup, backingRows, backingLabel, sourceCount, BACKING_DOES_NOT_PROVE, CORRECTIONS_PATH } from "../src/core/backing.js";

const ROOT = join(import.meta.dirname, "..");
const read = (f) => readFileSync(join(ROOT, f), "utf8");
const table = JSON.parse(read("src/ext/personalities.json"));
const src = (u, q) => ({ publisher: "Pub", title: "T", url: u, date: "2026-01-02", read: "2026-10-21", kind: "press", quote: q, check: "exact" });
const fake = { people: [{ id: "a", name: "Person A", role: "host", country: null, accounts: [["x", "HostA"], ["youtube", "hosta"]], channels: ["UC0123456789012345678901"],
  rows: [{ kind: "employer", who: "Network N", summary: "Network N's page says Person A hosts a show.", period: "since 2020", status: "documented", confidence: "high", sources: [src("https://n.example/a", "Person A hosts the show."), src("https://m.example/b", "joined Network N")], doesNotProve: "Employment does not show the network writes the host's words." },
    { kind: "court record", who: "Company C", via: "Outlet O", summary: "An indictment alleges Company C was funded by a foreign broadcaster.", period: null, status: "alleged", confidence: "moderate", sources: [src("https://n.example/a", "alleges")], doesNotProve: "The indictment does not accuse the host." }] }] };

test("a handle matches only on its own platform, in any letter case; a channel id matches YouTube", () => {
  setBackingTable(fake);
  assert.equal(backingOf("x", "hosta").id, "a");
  assert.equal(backingOf("x", "@HOSTA").id, "a");
  assert.equal(backingOf("fixture", "HostA").id, "a", "the fixture page behaves as X");
  assert.equal(backingOf("youtube", "HostA").id, "a");
  assert.equal(backingOf("reddit", "HostA"), null, "the same name on another platform is someone else");
  assert.equal(backingOf("x", "hosta2"), null);
  assert.equal(backingOfChannel("UC0123456789012345678901").id, "a");
  assert.equal(backingOfChannel(null), null);
});

test("the worker sends a page only the people it shows", () => {
  const sub = backingLookup(table, { accounts: [[table.people[0].accounts[0][0], table.people[0].accounts[0][1]]] });
  assert.deepEqual(sub.people.map((p) => p.id), [table.people[0].id]);
  assert.equal(backingLookup(table, { accounts: [["x", "no-such-handle-zz"]] }).people.length, 0);
});

test("the badge counts distinct documents, and the window shows quotes, dates, statuses and limits", () => {
  setBackingTable(fake);
  const p = backingOf("x", "hosta");
  assert.equal(sourceCount(p), 2);
  assert.equal(backingLabel(p), "Backing on record: 2 sources");
  assert.equal(backingLabel({ rows: [fake.people[0].rows[1]] }), "Backing on record: 1 source");
  const rows = backingRows(p), flat = JSON.stringify(rows);
  assert.match(flat, /Pub \(2026-01-02\), read 2026-10-21: \\"Person A hosts the show.\\"/);
  assert.match(flat, /alleged, not proven/);
  assert.match(flat, /as owner or backer of Outlet O/);
  assert.equal(rows.filter(([k]) => k === "This does not prove").length, 2);
  assert.deepEqual(rows[rows.length - 1], ["Does not prove", BACKING_DOES_NOT_PROVE]);
  assert.ok(rows.some(([k, v]) => k === "Wrong or out of date?" && v.links[0][1] === CORRECTIONS_PATH));
});

test("every shipped person renders, and each row in the window carries its does-not-prove line", () => {
  setBackingTable(table);
  for (const p of table.people) {
    const rows = backingRows(p);
    assert.equal(rows.filter(([k]) => k === "This does not prove").length, p.rows.length, p.id);
    assert.match(backingLabel(p), /^Backing on record: \d+ sources?$/);
  }
});

test("wiring: the worker answers pb-backing from the bundled table, pages ask, the window and panel show it", () => {
  assert.match(read("src/ext/background.js"), /type === "pb-backing"[\s\S]*PB\.backingLookup/);
  assert.match(read("src/ext/background.js"), /getURL\("personalities\.json"\)/);
  assert.match(read("src/ext/logs.js"), /type: "pb-backing"/);
  assert.match(read("src/ext/signals.js"), /fam: "backing-record"/);
  assert.match(read("src/ext/panel.js"), /backingOfChannel/);
  assert.ok(read("scripts/build.mjs").includes('"backing.js"'));
  assert.ok(read("scripts/pack.mjs").includes('"personalities.json"'));
});

test("nothing is fetched live: the matcher and the build name no remote address and make no request", () => {
  for (const f of ["src/core/backing.js", "scripts/personalities-build.mjs", "src/core/personalities-schema.js"]) {
    const code = read(f);
    assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|https?:\/\/(?!github\.com\/HarperZ9\/radar)/, f);
  }
});
