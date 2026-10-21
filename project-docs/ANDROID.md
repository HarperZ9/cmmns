# Firefox for Android

Radar's Firefox package (`dist/radar-firefox-<version>.xpi`, from `npm run package`) declares
`browser_specific_settings.gecko_android` with a minimum of Firefox 128, the first version with
main-world content scripts. The same package serves desktop and Android.

## What changes on a phone
- **Opening the window.** A phone cannot hover. When the main pointer cannot hover (CSS
  `(hover: none)`), each post gets one small "Radar" button beside its text. A tap opens the window
  and holds it open; a tap anywhere else closes it. The tap does not reach the site, so it does not
  open the post. Mouse and keyboard paths are unchanged on desktop. (`src/ext/pop.js`)
- **The window** is never wider than the screen less 16 px, and goes below the post when there is
  no room beside it.
- **The toolbar popup** opens as a full page from the browser menu's Extensions list. Its width
  follows the screen and its buttons are at least 44 px tall.
- **X account lookups** read profiles in a background tab, since Firefox for Android has no
  windows API; on desktop they still use a minimised window. (`src/ext/background.js`)
- **Mastodon servers** are turned on the same way: open the server, open Radar from the menu, tap
  "Turn on Radar here", and allow the browser's prompt.

## How to test
Steps from Mozilla's extension workshop documentation, from memory and not re-run for this
release; check the current page before relying on them.

1. On the phone: install Firefox Nightly or Beta (or release 128 or later), enable Developer
   options, and turn on USB debugging. In Firefox, Settings, turn on "Remote debugging via USB".
2. On the computer: install `adb` (Android platform tools) and `web-ext` (`npm i -g web-ext`).
   `adb devices` should list the phone.
3. Run `npm run package`, then from `src/ext`:
   `web-ext run -t firefox-android --android-device <id-from-adb> --firefox-apk org.mozilla.fenix`
   (`org.mozilla.firefox` for release, `org.mozilla.firefox_beta` for Beta).
4. Check, on a phone screen:
   - a thread on X, Bluesky, Threads and a Mastodon server shows one "Radar" button per post;
   - a tap opens the window inside the screen, a second tap closes it, and the post did not open;
   - the popup page lists what Radar sees and its buttons work;
   - on a Mastodon server, "Turn on Radar here" shows the browser's prompt, and after a reload the
     buttons appear; Options, Mastodon servers, Remove takes it away again.
5. Record the result in `LIVE-CHECKS.md` (row 42).

## Not checked yet
None of this has run on a phone. The touch mode was checked in a desktop browser emulating a
375 px touch screen (`tests/fixtures/reach.html`). Whether Firefox for Android shows the optional
permission prompt from the popup page, and keeps registered content scripts across restarts, is
unknown until the steps above are run; `src/ext/instances.js` re-registers them at start-up in
case it does not.
