# Install Daylight Commons without a store

Last updated: 2026-10-23.

Every Daylight Commons release can be downloaded, checked and installed without a browser store, and its
source can be rebuilt without any code host. This page says how, and says plainly where a browser
maker still stands in the way.

## What a release holds

- `radar-chrome-<version>.zip`: the Chrome, Edge and Brave build.
- `radar-firefox-<version>.xpi`: the Firefox build sent to Mozilla's add-on store.
- `radar-firefox-self-<version>.xpi`: the Firefox build for installing from this site once Mozilla has signed it. It checks this site for updates.
- `FILES-<version>.sha256`: the hash of every file inside each package.
- `radar-<version>.bundle`: the whole source history at the release commit, as one git file. Commits before 3.0.0 also hold the Conso font, under its designer's licence; 3.0.0 and later ship only fonts under the SIL Open Font License.
- `SOURCE`: the commit and the Node version the release was built with.
- `release-key.json`: Daylight Commons' public signing key.
- `SHA256SUMS` and `SHA256SUMS.sig`: the hash of every file above, and Daylight Commons' signature over that list.

## Check a download

Daylight Commons signs `SHA256SUMS` with its project key, an ECDSA P-256 key whose private half never enters
the repository or any server. The key id is:

**{{KEY_ID}}**

Compare that id with one you got another way: this site, the repository's `docs/release-key.json`,
a mirror, or a person you trust. A key that arrives in the same download as the files proves
nothing on its own.

To check in this browser, use the checker at the end of this page. It runs on your device and sends
nothing. To check with Node 22 from a copy of the source, run `node scripts/verify-release.mjs
<folder>`; it prints the key id, checks the signature, then every file's hash, then the bundle.

## Rebuild it yourself

The packages are reproducible: entries sorted, fixed timestamps, no extra fields. From the bundle:

- `git clone radar-<version>.bundle radar`
- `cd radar` and `npm run ci` to run every check the project runs on GitHub, with no network.
- `npm run package`, then compare `dist/SHA256SUMS` with the release.

The same commit gives the same bytes on the same zlib build. A different zlib can compress
differently; the per-file list in `FILES-<version>.sha256` does not depend on zlib, so compare that
when the package hashes differ.

## Install in Chrome, Edge or Brave

Chrome installs extensions from outside the Chrome Web Store only in two ways, both set by Google:

- **Developer mode.** Unzip the package, open `chrome://extensions`, turn on Developer mode, press
  Load unpacked and pick the folder. Chrome may show a warning about developer-mode extensions, and
  this copy does not update itself: install each new release the same way.
- **Enterprise policy.** A managed computer can force-install Daylight Commons from a self-hosted address
  with the `ExtensionInstallForcelist` policy. This needs an administrator.

There is no other way around the store for an ordinary Chrome install. That is Google's rule, and
Daylight Commons cannot change it.

## Install in Firefox

Release versions of Firefox install only add-ons that Mozilla has signed, even when the file comes
from somewhere other than Mozilla's store. Mozilla signs `radar-firefox-self` without listing it in
its store; once signed, open the file in Firefox to install it, and Firefox checks
`firefox/updates.json` on this site for new versions.

No release so far carries a Mozilla-signed file, 3.0.0 included, and `firefox/updates.json` is not
published yet. Until Mozilla signs the self-distributed build or lists Daylight Commons on Firefox
Add-ons, release Firefox can load it only for one session: open `about:debugging`, choose This
Firefox, then Load Temporary Add-on, and pick the `.xpi`. Firefox Developer Edition, Nightly and
unbranded builds can turn signing checks off.

That signature is Mozilla's requirement. Daylight Commons cannot remove it, and a Mozilla signature says
only that Mozilla's automated review passed.

## If the code host goes away

Daylight Commons' source is hosted on GitHub today. Each release's bundle holds the whole history, so the
project survives without it: clone the bundle, then push it to any git host. Any mirror that
serves the same bundle and the same signed `SHA256SUMS` is as good as the original, because the
signature, not the host, is what you check.

## What this does not prove

A valid signature shows the files were signed by the holder of Daylight Commons' key and have not changed
since. It does not show who holds the key, that the key was never stolen, or that the code is
safe. A reproducible build shows the package came from the published source; it does not show the
source is free of mistakes. Read the source, or ask someone you trust who has.
