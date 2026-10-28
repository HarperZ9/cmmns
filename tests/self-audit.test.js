// "What CMMNS shows about you" (src/core/self-audit.js, bin/lib/protect.mjs, src/ext/selfaudit.*).
// The audit runs only on the user's own account: proved by the page's own signed-in markers or by
// the platform's own data export. These tests hold that line: no handle can be typed or passed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ownedProfile, selfAudit, exportAuditInput, postingClock, SELF_AUDIT_NOT_CHECKED } from "../src/core/self-audit.js";
import { selfAuditCommand } from "../bin/lib/protect.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = Date.parse("2026-10-25T00:00:00Z");

// An X archive: 60 posts over 10 days, between 14:00 and 05:00 UTC, quiet 06:00 to 13:59 UTC.
function archive() {
  const rows = [];
  for (let d = 0; d < 10; d++) for (let k = 0; k < 6; k++) {
    const h = (14 + k * 3) % 24, t = new Date(Date.UTC(2026, 9, 10 + d, h, 7 * k, 0));
    rows.push({ tweet: { id_str: String(1000 + d * 10 + k), full_text: k === 0 ? "Morning, everyone, the same greeting again" : `Post ${d}-${k}`, created_at: t.toUTCString().replace("GMT", "+0000"), source: k % 2 ? '<a href="https://x.com">X for iPhone</a>' : '<a href="https://x.com">X Web App</a>', entities: {} } });
  }
  return `window.YTD.tweets.part0 = ${JSON.stringify(rows)};`;
}
const ACCOUNT = `window.YTD.account.part0 = ${JSON.stringify([{ account: { username: "me_myself", createdAt: "2019-03-02T10:00:00.000Z", accountDisplayName: "Me 🇵🇹" } }])};`;

test("ownership needs the signed-in account on its own profile with Edit profile showing", () => {
  assert.equal(ownedProfile({ signedIn: "Me_Myself", pageHandle: "@me_myself", editProfile: true }), "me_myself");
  assert.equal(ownedProfile({ signedIn: "me", pageHandle: "someone_else", editProfile: true }), null, "someone else's profile");
  assert.equal(ownedProfile({ signedIn: null, pageHandle: "me", editProfile: true }), null, "signed out");
  assert.equal(ownedProfile({ signedIn: "me", pageHandle: "me", editProfile: false }), null, "no Edit profile button");
  assert.equal(ownedProfile({ signedIn: "me", pageHandle: "me" }), null);
  assert.equal(ownedProfile({}), null);
});

test("the posting clock finds the quiet hours and the time zone they fit", () => {
  const hist = Array.from({ length: 24 }, (_, h) => (h >= 6 && h < 14 ? 0 : 5));
  const c = postingClock(hist);
  assert.equal(c.quietHours, 8);
  assert.equal(c.quietFromUtc, 6);
  assert.equal(c.offset, -6);
  assert.equal(postingClock(Array(24).fill(3)).offset, null, "no quiet stretch, no time zone");
});

test("an X archive gives the posting clock, apps, account age and repeated wording", () => {
  const got = exportAuditInput([{ name: "tweets.js", text: archive() }, { name: "account.js", text: ACCOUNT }]);
  assert.equal(got.ok, true, got.reason);
  const a = selfAudit({ ...got.input, now: NOW });
  const ids = a.signals.map((s) => s.id);
  for (const id of ["account-age", "name-flag", "posting-clock", "posting-apps", "volume", "repeated-text"]) assert.ok(ids.includes(id), id);
  const clock = a.signals.find((s) => s.id === "posting-clock");
  assert.match(clock.reveals, /UTC-\d+/);
  for (const s of a.signals) { assert.ok(s.reveals && s.reduce, `${s.id} says what it reveals and how to reduce it`); }
  assert.match(a.signals.find((s) => s.id === "posting-apps").shows, /X for iPhone/);
  assert.deepEqual(a.notChecked, SELF_AUDIT_NOT_CHECKED);
  assert.equal(a.local, true);
});

test("files from two platforms are refused: the audit never links accounts", () => {
  const masto = JSON.stringify({ orderedItems: [{ type: "Create", published: "2026-10-01T10:00:00Z", object: { id: "1", content: "<p>hello there friends</p>" } }] });
  const got = exportAuditInput([{ name: "tweets.js", text: archive() }, { name: "outbox.json", text: masto }]);
  assert.equal(got.ok, false);
  assert.match(got.reason, /never links accounts/);
});

test("the command takes only files: a handle or an address is refused", () => {
  assert.throws(() => selfAuditCommand(["@someone"], {}), /not a file/);
  assert.throws(() => selfAuditCommand(["https://x.com/someone"], {}), /not a file/);
  assert.throws(() => selfAuditCommand([], {}), /your own data export/);
  const d = mkdtempSync(join(tmpdir(), "dl-audit-")), f = join(d, "tweets.js");
  writeFileSync(f, archive());
  const out = selfAuditCommand([f], {}, NOW);
  assert.match(out, /Posting clock/);
  assert.match(out, /nothing was sent/);
});

test("no handle field anywhere: the page has no text input, and the code takes no handle", () => {
  const html = readFileSync(join(ROOT, "src/ext/selfaudit.html"), "utf8");
  assert.ok(!/<textarea|contenteditable/i.test(html), "no free text field");
  const inputs = [...html.matchAll(/<input\b[^>]*>/gi)].map((m) => m[0]);
  assert.ok(inputs.length >= 1, "the export file picker");
  for (const i of inputs) assert.match(i, /type="file"/, `only file inputs: ${i}`);
  const help = readFileSync(join(ROOT, "bin/lib/help.mjs"), "utf8");
  assert.ok(!/self-audit[^\n]*--handle/.test(help));
  for (const f of ["src/core/self-audit.js", "src/ext/selfaudit.js", "src/ext/selfaudit-page.js"]) {
    const src = readFileSync(join(ROOT, f), "utf8");
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/.test(src), `${f} makes no request`);
    assert.ok(!/\.value\b(?![^\n]*files)/.test(src.replace(/\/\/[^\n]*/g, "")) || f !== "src/ext/selfaudit.js", `${f} reads no typed value`);
  }
});
