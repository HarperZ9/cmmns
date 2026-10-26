// Saves land in Downloads/<save folder>/<site>/ after an upgrade from 3.6.0. An empty folder name is
// never "save into the Downloads root"; only the explicit switch is (the 3.6.1 regression).
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSettings } from "../src/core/settings.js";
import { savePath } from "../src/core/media-meta.js";

// What 3.6.0 stored: its own keys, no hover, study or root keys.
const V360 = { paused: false, feeds: true, auto: true, sites: {}, areas: {}, historyDays: 60, aboutDays: 14, calm: false, large: false, onboarded: true,
  search: {}, coverage: false, feedConsent: false, outlets: {}, customFeeds: [], imageText: false, evidence: false, lensAll: false, pressureLens: false,
  adblock: false, adblockAllow: [], mediaButtons: true, mediaAskWhere: false, mediaSidecar: true, mediaEmbed: true, mediaSidecarJson: false, mediaFolder: "Daylight" };

test("a 3.6.0 settings blob upgraded keeps Daylight/<site>/ for every kind of save", () => {
  const s = normalizeSettings(V360);
  assert.equal(s.mediaFolder, "Daylight");
  assert.equal(s.mediaToRoot, false);
  for (const site of ["x", "reddit", "en.wikipedia.org", "youtube"]) {
    assert.equal(savePath(s, site), `Daylight/${site}/`);
    assert.equal(savePath(s, site, true), `Daylight/study/${site}/`);
  }
});

test("an empty or blank folder name goes back to Daylight; the switch alone saves into Downloads", () => {
  for (const v of ["", "   ", "..", "/"]) assert.equal(normalizeSettings({ ...V360, mediaFolder: v }).mediaFolder, "Daylight", JSON.stringify(v));
  assert.equal(savePath(normalizeSettings({ ...V360, mediaFolder: "" }), "x"), "Daylight/x/");
  assert.equal(savePath({ mediaFolder: "" }, "x"), "Daylight/x/", "even settings that skipped normalising");
  const root = normalizeSettings({ ...V360, mediaToRoot: true });
  assert.equal(savePath(root, "x"), "");
  assert.equal(savePath(root, "x", true), "study/x/");
  assert.equal(savePath(normalizeSettings({ ...V360, mediaFolder: "Research/refs" }), "x"), "Research/refs/x/");
});
