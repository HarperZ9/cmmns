<!-- writing-profile: procedure -->
# Store kit

Everything the Chrome Web Store and Firefox Add-ons ask for, ready to paste or upload. Creating the
developer accounts, paying the Chrome Web Store fee, accepting each store's agreement and pressing
submit are the author's steps; nothing here has been submitted.

| What | File | Where it goes |
|---|---|---|
| Listing copy: name, summaries, description, category, URLs | `LISTING.md`, "Shared copy" | CWS Store listing tab; AMO listing |
| Privacy practices: single purpose, remote code, data use, certifications | `LISTING.md`, "Chrome Web Store: privacy practices tab" | CWS Privacy tab |
| One justification per permission | `LISTING.md`, "Permission justifications" | CWS Privacy tab |
| Five screenshots, 1280x800, with captions | `screenshots/01` to `05`, captions in `LISTING.md` | CWS and AMO |
| Small promo tile, 440x280 | `promo-tile.png` | CWS |
| Firefox reviewer source package | `amo-source-<version>.zip` (made by `node scripts/amo-source.mjs`) | AMO "Source code" |
| Packages | `cmmns-chrome-<version>.zip`, `cmmns-firefox-<version>.xpi` from the GitHub release | CWS; AMO |
| Step-by-step submission | `LISTING.md`, "Submission steps for the author" | |

`tests/store-listing.test.js` keeps the copy within each store's limits, the summary identical to the
manifest, and the permission table complete for every permission the manifest asks for.
