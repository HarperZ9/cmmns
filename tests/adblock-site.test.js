// The per-site part of ad blocking (src/core/adblock.js) and its wiring: off by default, a separate
// switch from the reading features, rulesets disabled in the manifest until the user turns it on.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adblockSite, adblockAllowed, adblockToggle } from "../src/core/adblock.js";
import { normalizeSettings } from "../src/core/settings.js";

test("a site is its host without www, and allowing it covers its subdomains", () => {
  assert.equal(adblockSite("https://www.Example.org/a?b"), "example.org");
  assert.equal(adblockSite("chrome://extensions"), null);
  assert.equal(adblockSite("not a url"), null);
  assert.equal(adblockAllowed(["example.org"], "news.example.org"), true);
  assert.equal(adblockAllowed(["example.org"], "badexample.org"), false);
  assert.deepEqual(adblockToggle([], "example.org", true), ["example.org"]);
  assert.deepEqual(adblockToggle(["example.org"], "news.example.org", true), ["example.org"], "already covered");
  assert.deepEqual(adblockToggle(["example.org", "b.net"], "news.example.org", false), ["b.net"], "turning it back on removes the covering entry");
});

test("off by default, its own setting, and the allow list is cleaned", () => {
  const s = normalizeSettings(null);
  assert.equal(s.adblock, false);
  assert.deepEqual(s.adblockAllow, []);
  const n = normalizeSettings({ adblock: true, adblockAllow: ["WWW.Example.org", "x y", 5, "example.org"] });
  assert.deepEqual(n.adblockAllow, ["example.org"]);
  assert.equal(n.lensAll, false, "ad blocking never turns on a reading feature");
});

test("the manifest ships both rulesets disabled; the background enables them only from the setting", () => {
  const m = JSON.parse(readFileSync(new URL("../src/ext/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(m.declarative_net_request.rule_resources.map((r) => [r.id, r.enabled]), [["easylist", false], ["easyprivacy", false]]);
  assert.ok(m.permissions.includes("declarativeNetRequest") && !m.permissions.includes("declarativeNetRequestFeedback"), "no feedback permission: blocked requests are never read");
  const bg = readFileSync(new URL("../src/ext/adblock-bg.js", import.meta.url), "utf8");
  assert.match(bg, /const on = !s\.paused && s\.adblock;/);
  assert.match(bg, /allowAllRequests/);
});
