# Radar

Radar adds evidence badges to social media replies, so you can see which voices in a thread may
not be what they seem. It runs in your browser and sends nothing anywhere.

- **On X:** where X labels each account as based, how old the account is, how often it changed
  its name, and a flag when a reply speaks as a local ("here in France") from an account labelled
  as based somewhere else.
- **On X, Reddit and YouTube:** groups of near-identical replies posted by different accounts,
  and a thread report that says whether the most extreme replies come mostly from flagged accounts.

Every badge opens a note saying where its data came from and what it does not prove. Radar never
calls anyone a bot or a propagandist.

## Install on this PC (about one minute)
Radar is a browser extension. It works in every account you use inside the browser profile you
add it to. Add it once to each browser profile you use.

**Chrome, Edge or Brave**
1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose the folder `C:\dev\provenance-badges\src\ext`.
4. Pin Radar: click the puzzle-piece icon in the toolbar, then the pin next to Radar.
5. Open any post with replies. Radar fills in by itself: account details come from the data X has
   already loaded for the page, and each reply author's "About this account" data is read in the
   page, one account every 1.5 seconds, with no second page. (The very first time, Radar opens one
   About page in a minimised window so it can learn X's request; it does this again only if X
   changes it.)

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and pick `src\ext\manifest.json`. Firefox removes temporary
   add-ons on restart; a signed build comes later.

To update after a change, press the reload arrow on Radar's card in the extensions page.

## Status
Prototype. Built and checked on a test thread (`tests/fixtures/thread.html`); not yet checked on
live pages or measured for accuracy. See `project-docs/LIVE-CHECKS.md` and
`project-docs/EVALUATION.md`. Facebook and Instagram are planned.

## Develop
`npm test` runs the tests. `npm run build` regenerates `src/ext/core.bundle.js` from `src/core`.
