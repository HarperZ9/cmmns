// Mastodon and TikTok data from responses the site's own app loaded. Field names follow Mastodon's
// public REST API entities and TikTok's comment list; every account and value here is synthetic.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dataKeys, SITES } from "../src/core/settings.js";
import { mastoAccounts, mastoStatuses, mastodonProbe, instanceOrigin, tiktokComments } from "../src/core/fedi.js";

const acc = (acct, extra = {}) => ({ id: "9", username: acct.split("@")[0], acct, url: "https://example.social/@" + acct,
  created_at: "2026-10-19T00:00:00.000Z", followers_count: 2, following_count: 800, statuses_count: 40, ...extra });

test("Mastodon accounts: join date, counts and the account's own automated switch", () => {
  const m = mastoAccounts({ ancestors: [], descendants: [{ id: "1", content: "<p>hi</p>", account: acc("new.one", { bot: true }) },
    { id: "2", content: "<p>yo</p>", account: acc("Old@Remote.Example", { created_at: "2017-01-02T00:00:00Z", display_name: "Old" }) }] });
  const a = m.get("new.one");
  assert.equal(a.joinDate, "2026-10-19");
  assert.deepEqual(a.platformLabels, ["automated (set by the account)"]);
  assert.equal(a.followingCount, 800);
  assert.equal(a.postsCount, 40);
  const b = m.get("old@remote.example");
  assert.equal(b.handle, "Old@Remote.Example");
  assert.equal(b.joinDate, "2017-01-02");
  assert.equal(b.platformLabels, undefined);
});

test("Mastodon statuses: id, author and time; objects that are not statuses are skipped", () => {
  const s = mastoStatuses({ descendants: [{ id: "77", content: "<p>x</p>", created_at: "2026-10-21T01:00:00Z", language: "de", account: acc("a") },
    { id: "78", content: "<p>x</p>" }, { acct: "half" }] });
  assert.deepEqual([...s.keys()], ["77"]);
  assert.deepEqual(s.get("77"), { id: "77", author: "a", posted: "2026-10-21T01:00:00Z", lang: "de" });
  assert.equal(mastoAccounts(null).size, 0);
});

test("the popup's probe accepts only a Mastodon root with a version, and keeps no other field", () => {
  assert.deepEqual(mastodonProbe({ root: true, version: "4.3.1", domain: "Example.Social", access_token: "secret" }), { version: "4.3.1", domain: "example.social" });
  assert.equal(mastodonProbe({ root: false, version: "4.3.1" }), null);
  assert.equal(mastodonProbe({ root: true }), null);
  assert.equal(mastodonProbe(null), null);
  assert.equal(mastodonProbe({ root: true, version: "4.3.1", domain: "not a domain" }).domain, null);
});

test("permission is asked for one https server at a time", () => {
  assert.equal(instanceOrigin("https://example.social/@a/1"), "https://example.social/*");
  assert.equal(instanceOrigin("http://example.social/"), null);
  assert.equal(instanceOrigin("chrome://extensions"), null);
  assert.equal(instanceOrigin("https://localhost/"), null);
  assert.equal(instanceOrigin("not a url"), null);
});

test("TikTok comment list: id, author, text and time from seconds", () => {
  const c = tiktokComments({ comments: [{ cid: "7300000000000000001", text: "nice", create_time: 1760000000, user: { unique_id: "some.one" } },
    { cid: "x", text: "no user" }] });
  assert.equal(c.size, 1);
  const r = c.get("7300000000000000001");
  assert.equal(r.author, "some.one");
  assert.equal(r.text, "nice");
  assert.equal(r.posted, new Date(1760000000 * 1000).toISOString());
});

test("clearing Radar's data keeps the settings and the Mastodon servers the user turned on", () => {
  assert.deepEqual(dataKeys(["pb.settings", "pb.instances.v1", "pb.meta.v1", "pb.history.v1", "other"]), ["pb.meta.v1", "pb.history.v1"]);
  for (const id of ["threads", "mastodon", "tiktok"]) assert.ok(SITES.some(([s]) => s === id), id);
});

test("the manifest asks for Mastodon servers only as optional, and runs on Firefox for Android", () => {
  const m = JSON.parse(readFileSync(new URL("../src/ext/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(m.optional_host_permissions, ["https://*/*"]);
  assert.ok(!m.host_permissions.includes("https://*/*"));
  assert.ok(parseFloat(m.browser_specific_settings.gecko_android.strict_min_version) >= 128);
  const main = m.content_scripts.find((c) => c.js.includes("content.js"));
  assert.ok(main.js.indexOf("platforms-reach.js") < main.js.indexOf("platforms.js"));
  for (const h of ["https://www.threads.com/*", "https://www.tiktok.com/*"]) assert.ok(main.matches.includes(h), h);
});
