<!-- writing-profile: procedure -->
# Chrome Web Store and Firefox AMO Packaging Checklist

Use this checklist before uploading a release build to the Chrome Web Store (CWS) or Firefox Add-ons (AMO). Every technical verification step runs locally with Node 22+ and zero third-party build servers.

## 1. Pre-flight source and manifest parity

1. Confirm `package.json`, `src/ext/manifest.json`, `CITATION.cff`, and `codemeta.json` share the exact same `version` string.
2. Run `npm run build:check` to prove double-build SHA-256 bundle reproducibility for `src/ext/core.bundle.js`.
3. Run `npm run ci` (`node scripts/ci.mjs test`) and confirm `tests/store-listing.test.js`, `tests/licence.test.js`, `tests/canon.test.js`, and `tests/web-ai-provenance.test.js` all pass.
4. Confirm `src/ext/manifest.json` keeps the permanent Gecko add-on id `radar@harperz9.github.io` and declares `data_collection_permissions.required = ["none"]` and `optional = ["websiteContent", "browsingActivity"]`.

## 2. Build deterministic packages and reviewer source archive

1. Run `npm run package` to produce:
   - `dist/cmmns-chrome-<version>.zip` (Chrome Web Store upload package)
   - `dist/cmmns-firefox-<version>.xpi` (Firefox AMO upload package)
   - `dist/SHA256SUMS` (verify with `node scripts/verify-release.mjs dist`)
2. Run `node scripts/amo-source.mjs` whenever `src/` or `scripts/` changes to refresh `docs/store/amo-source-<version>.zip` (required by AMO reviewers because `src/ext/core.bundle.js` is bundled from `src/core/`).
3. Verify `LICENSE.txt` (verbatim `AGPL-3.0-only` text) and all three SIL OFL 1.1 font notices are present inside the Chrome zip and Firefox xpi (`tests/licence.test.js` enforces this).

## 3. Store form fields and media assets

1. **Chrome Web Store (CWS):**
   - Upload `dist/cmmns-chrome-<version>.zip`.
   - Paste name (`<= 75` chars), summary (`<= 132` chars, exact match to `manifest.json` `description`), and full description from `docs/store/LISTING.md`.
   - Upload `docs/store/promo-tile.png` (`440x280`) and `docs/store/screenshots/01` through `05` (`1280x800`).
   - Fill the Privacy practices tab using the single-purpose statement and per-permission table in `docs/store/LISTING.md`, linking `https://harperz9.github.io/cmmns/privacy.html`.
2. **Firefox Add-ons (AMO):**
   - Upload `dist/cmmns-firefox-<version>.xpi` as the add-on binary and `docs/store/amo-source-<version>.zip` as the reviewer source archive.
   - Include build notes in the reviewer box: `Node 22+, run npm run build:check && npm run package`.
   - Paste the AMO summary (`<= 250` chars) and description from `docs/store/LISTING.md`, linking `https://harperz9.github.io/cmmns/privacy.html` and `https://harperz9.github.io/cmmns/transparency.html`.

## 4. Post-approval links

Once CWS and AMO listings go live, add the published store URLs to `README.md`, `llms.txt`, `codemeta.json`, and `https://harperz9.github.io/cmmns.html`.
