<!-- writing-profile: procedure -->
# Rename checklist: Daylight Commons to CMMNS

Decided 2026-10-28: CMMNS, spoken "commons", is the product name and the display mark. Each surface
names the old names once: "formerly Daylight Commons, and Radar before that". The rule is the one
the 2026-10-22 Radar rename used. Names a person reads change. Names that a saved file, an installed
extension or a signature depends on stay.

Built from a fresh case-insensitive grep for "daylight" on 2026-10-28 across this repository, the
site repository (HarperZ9/HarperZ9.github.io) and the workspace index files. Before the sweep: 514
files and 2,430 lines in this repository. After it: 138 files, every one listed below as changed or
staying with its reason. `[x]` means done. "stays" means kept on purpose.

## A. Identity and package

- [x] Product name in UI strings: `src/ext/*.html`, `src/ext/*.js`, popup, options, side panel,
  cards, toolbar titles (`src/ext/lifecycle.js`).
- [x] Manifest `name`, `action.default_title`, `homepage_url` (`src/ext/manifest.json`). The
  `description` never named the product and is unchanged. It stays identical to the store summary.
- [ ] stays: Firefox id `radar@harperz9.github.io`. A new id makes Firefox treat the add-on as new.
- [ ] stays: Chrome extension id. It comes from the store key or the unpacked path.
- [ ] stays: icon files `radar-*.png` and their artwork. The author picks a wordmark first.
- [x] `package.json`: name `cmmns`, description, homepage, repository, bugs.
- [x] `CITATION.cff`: title, URLs, the old names in the abstract, and a `daylight-commons` keyword.
- [x] `REUSE.toml`: `SPDX-PackageName` and the three copyright lines name CMMNS. The holders are
  unchanged.

## B. Command line

- [x] `cmmns` bin added. `daylight`, `daylight-commons` and `radar` stay and run the same tool.
- [x] Help text, usage, error prefix (`cmmns: ...`) and every example say `cmmns`. The top help names
  the old names once.
- [x] `CMMNS_*` environment variables are read before `DAYLIGHT_*` (`src/core/env-names.js`): PROTECT,
  HOME, CASE_NOW, CASE_REPLAY, CASE_CRASH_AT, DISCOURSE_CACHE, and the test-only SIM_SRC.
- [ ] stays: `DAYLIGHT_*` read names, as fallbacks. Scripts and scheduled tasks use them.
- [ ] stays: `RADAR_*` variables (DATA, BUILT, SIGNING_KEY, PACK_KEY, LOCK) and `~/.radar`.
- [ ] stays: `bin/radar.mjs` as the file name. Docs call it by path and the release zip carries it.

## C. Files on users' disks

- [x] New-install save folder is `CMMNS` (`DEFAULTS.mediaFolder`, `media-meta.js` fallback).
- [x] An update from before 3.9.0 stores `mediaFolder: "Daylight"` when no folder was stored
  (`legacyFolderPatch`, run from `lifecycle.js` on `onInstalled` with reason "update").
- [x] `cmmns media fetch` saves into `Downloads/CMMNS`, or into `Downloads/Daylight` when only that
  folder exists (`saveRoot`).
- [x] Readers take any folder. `capture verify`, `sidecar check` and `board make` are tested on a
  `Downloads/Daylight` tree written by v3.8.0 (`tests/rename-compat.test.js`).
- [ ] stays: `scripts/qa/folder_check.py` loads 3.6.0 settings that store `Daylight`, and checks that
  saves still land there. That is the upgrade path and stays correct.
- [ ] stays: every format id. `daylight.sidecar/1`, `daylight.capture/1`, `.custody/1`, `.quotes/1`,
  `.persons/1`, `.labels/1`, `.clean-lineage/1`, `.argument-gold/1`, `.argument-annotation/1`,
  `.calibration-cases/1`, `daylight-case/1`, `-case-export/1`, `-case-network/1`, `-case-reading/2`,
  `-case-run/1`, `-collection/1`, `-head/1`, `-lineage/1`. Saved files carry them and hashes and
  signatures cover them.
- [ ] stays: `urn:daylight:` and `urn:radar:` ids (`src/investigate/dataset.js`, schemas).
- [ ] stays: the research export's dataset name `daylight-commons-evidence` and the split seed
  `daylight-export-1`. Exported datasets and their splits are keyed on them.
- [x] Schema titles in `schema/*.json` and `catalogue/schema/definition.v1.json`. Every `$id` stays.

## D. Identifiers a user never sees

- [ ] stays: custom elements `daylight-hover`, `daylight-toast`. Page CSS or user styles may target
  them.
- [ ] stays: global `PBSaveToDaylight` and the hover message action `"daylight"`. Internal, and a
  content script left open across an update still sends the old action.
- [x] Console prefix `[cmmns]` in every file that had `[daylight-commons]`.
- [ ] stays: storage keys, the IndexedDB name `daylight-media` and the folder-picker id
  `daylight-saves`. Changing them loses stored data or the remembered folder.
- [ ] stays: the board spec's provenance key `sources.daylight`. Boards already written use it and
  the site reads it.
- [x] Collection export file names: `cmmns-<type>-<id>.json`. Readers match the format id, not the
  name.
- [x] Case request user agent `cmmns-case`, the case repository's default git identity
  `CMMNS case`, and the example scheduled-task name `cmmns-watch`.

## E. Distribution and signing

- [x] Repository URLs point at `github.com/HarperZ9/cmmns`. GitHub redirects the old address.
- [x] Project Pages URLs point at `harperz9.github.io/cmmns/`. The site repository serves redirect
  stubs at `/daylight-commons/` (section G).
- [x] Firefox update URL: `https://harperz9.github.io/ext/firefox/updates.json`, served from the
  site repository with the id `radar@harperz9.github.io` (`scripts/zip.mjs`). It carries no product
  name. `/radar/firefox/updates.json` stays on the site.
- [x] Release assets: `cmmns-chrome-<v>.zip`, `cmmns-firefox-<v>.xpi`, `cmmns-firefox-self-<v>.xpi`,
  `cmmns-cli-<v>.zip`, `cmmns-<v>.bundle` (`scripts/package.mjs`, `scripts/release.mjs`). The
  checker reads names from the signed list, so `radar-*` releases still verify (tested).
- [ ] stays: past release titles and assets (v3.8.0 and earlier).
- [x] Key label "CMMNS project key" (`docs/release-key.json`, `scripts/verify-offline.mjs`). No
  verifier compares the label: `trustedSet`, `kit-verify.js` and `verify-release.mjs` check the key
  id and the public key only. The key, the key id `0e5e 1984 0565 840c 977e 0f03 6c9a c021` and the
  thumbprint are unchanged.
- [ ] stays: key paths `D:/radar-keys/...` and `~/.radar/bundle-key.jwk`.
- [x] Store listing copy (`docs/store/LISTING.md`, `README.md`, `promo-tile.svg`).
- [ ] open: `docs/store/promo-tile.png` and the store screenshots still show "Daylight". They are
  re-rendered with the wordmark the author picks.
- [x] Issue templates. `test.yml` comment.

## F. Docs

- [x] README, INSTALL, HOW-IT-WORKS, PRIVACY, SECURITY, GOVERNANCE, CONTRIBUTING, THIRD-PARTY,
  CLAUDE.md. README, INSTALL, HOW-IT-WORKS and PRIVACY name the old names once.
- [x] Pages generators (`scripts/site/page.mjs` and the five page scripts), then `npm run pages`.
- [x] Anchors: a heading that names the product gets an empty element with its old id
  (`what-daylight-commons-reads` and three more), so old deep links land.
- [x] project-docs, catalogue notes, data READMEs, examples README, docs/guide.
- [x] CHANGELOG header line and a dated "Changed" entry. Catalogue CHANGELOG line for the six
  entries' notes. No catalogue entry version moved: only the product name changed.
- [ ] stays: CHANGELOG entries before 2026-10-28. They describe releases under their names.
- [ ] stays: `project-docs/evidence/**`, `docs/RELEASE-AUDIT.md` (dated records),
  `docs/demo/*.json` and `*.txt` (hashed demo chains), `docs/demo/README.md` (the recordings show the
  old name; a line says so), `examples/musk-ukraine-case/` case and exports (signed in 3.4.0),
  `data/calibration/cases.json` (preregistered), `tests/fixtures/v3.8.0/` (what 3.8.0 wrote).
- [ ] stays: `src/ext/sites.json`, `src/ext/discourse/*.json` and the data packs. They are hashed in
  `data/LOCK.json` and signed with the project key. Their "Daylight Commons" text is in descriptions
  only, and changes at the next data rebuild.
- [ ] stays: LICENSE texts. They name no project.

## G. The site repository (HarperZ9/HarperZ9.github.io)

- [ ] `cmmns.html`, built by `scripts/build-cmmns.mjs` from the CMMNS record in `discover.json`.
- [ ] `daylight.html` becomes a redirect stub to `cmmns.html`.
- [ ] `daylight-commons/*.html` redirect stubs to `/cmmns/<page>`, keeping the `#fragment`.
- [ ] `ext/firefox/updates.json` with id `radar@harperz9.github.io` and an empty update list.
- [ ] Nav entry, sitemap, `llms.txt`, `llms-full.txt`, home, hire, site index, routes.
- [ ] Career and resume lines: "CMMNS (formerly Daylight Commons)".
- [ ] stays: `radar/firefox/updates.json`, `media/daylight-commons/`, `tests/release-pins/media/daylight-commons/`.
- [ ] stays: `world/alive/vendor/daylight-gif/`. Its header says FSL-1.1-MIT while the source is
  AGPL-3.0-only. That mismatch is the author's call and is outside this rename.
- [ ] stays: dated release reviews in `tests/release-reviews/`, and "daylight" as a lighting word in
  shaders and papers.

## H. Workspace

- [x] `C:/dev/CLAUDE.md`, `AGENTS.md`, `WORKSPACE-INDEX.md`, `ECOSYSTEM.md`: grepped, none names the
  project or the old repository. Nothing to change.
- [ ] stays: the local folder `C:/dev/provenance-badges` and worktree paths. Only the remote changes.
- [ ] Remotes in every checkout and worktree, after the GitHub rename.
- Memory, MEMORY.md and mission-control CONSENSUS are handled by the coordinating session.
