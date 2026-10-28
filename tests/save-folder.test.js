// Saves land in Downloads/<save folder>/<site>/ after an upgrade from 3.6.0. An empty folder name is
// never "save into the Downloads root"; only the explicit switch is (the 3.6.1 regression).
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSettings, legacyFolderPatch, DEFAULTS, LEGACY_MEDIA_FOLDER } from "../src/core/settings.js";
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

test("an empty or blank folder name goes back to the default, CMMNS; the switch alone saves into Downloads", () => {
  for (const v of ["", "   ", "..", "/"]) assert.equal(normalizeSettings({ ...V360, mediaFolder: v }).mediaFolder, "CMMNS", JSON.stringify(v));
  assert.equal(savePath(normalizeSettings({ ...V360, mediaFolder: "" }), "x"), "CMMNS/x/");
  assert.equal(savePath({ mediaFolder: "" }, "x"), "CMMNS/x/", "even settings that skipped normalising");
  const root = normalizeSettings({ ...V360, mediaToRoot: true });
  assert.equal(savePath(root, "x"), "");
  assert.equal(savePath(root, "x", true), "study/x/");
  assert.equal(savePath(normalizeSettings({ ...V360, mediaFolder: "Research/refs" }), "x"), "Research/refs/x/");
});

// The CMMNS rename (3.9.0) moved the default folder. An install from before keeps Downloads/Daylight.
test("a new install saves under CMMNS", () => {
  assert.equal(DEFAULTS.mediaFolder, "CMMNS");
  assert.equal(normalizeSettings(undefined).mediaFolder, "CMMNS");
  assert.equal(savePath(normalizeSettings(undefined), "x"), "CMMNS/x/");
});

test("an update from 3.8.0 keeps the Daylight folder whether or not settings were ever stored", () => {
  for (const raw of [undefined, {}, { onboarded: true }, { ...V360, mediaFolder: "" }, { ...V360, mediaFolder: "   " }]) {
    const patch = legacyFolderPatch(raw, "3.8.0");
    assert.equal(patch.mediaFolder, LEGACY_MEDIA_FOLDER, JSON.stringify(raw));
    assert.equal(savePath(normalizeSettings(patch), "reddit"), "Daylight/reddit/");
    for (const [k, v] of Object.entries(raw || {})) if (k !== "mediaFolder") assert.deepEqual(patch[k], v, `keeps ${k}`);
  }
  assert.equal(legacyFolderPatch(V360, "3.6.0"), null, "a folder already stored is left alone");
  assert.equal(legacyFolderPatch({ ...V360, mediaFolder: "Research" }, "3.8.0"), null);
});

test("no pin after the rename, on a fresh install or for an unreadable version", () => {
  for (const v of ["3.9.0", "3.9.1", "4.0.0", undefined, "", "dev"]) assert.equal(legacyFolderPatch(undefined, v), null, String(v));
});
