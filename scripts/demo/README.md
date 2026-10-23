# Demo stage and captures

Development tools for the demonstration material in `docs/demo/`. Nothing here ships in the
extension or in a release package.

The captures are of the real, installed extension. `browser.py` unpacks the release zip into a fresh
Chrome profile and loads it through the DevTools protocol, the way a developer loads it unpacked.
Every x.com address is answered inside the browser with the synthetic pages and X-shaped responses
that `stage.mjs` writes, so no request reaches X. Every account, post and company on the stage is
invented, and every handle starts with `demo_`.

```
node scripts/demo/stage.mjs <stage dir>
npm run package
python scripts/demo/capture.py --stage <stage dir> --out docs/demo [--only stills|film|pages]
node scripts/demo/diagram.mjs docs/demo
python scripts/demo/render_svg.py docs/demo/how-it-works-light.svg docs/demo/how-it-works-dark.svg
npm run pages
```

Needs Node 22 or later, Python 3 with Playwright and Pillow, and Google Chrome. The recording is
encoded with the ffmpeg build Playwright installs.

What the capture changes, so a reader can judge the result:
- The demo copy of the extension has `https://web.archive.org/*` added to its host access. A real
  user grants that from the Evidence lookups switch in Options; a script cannot click the browser's
  permission prompt.
- "Read account details automatically" is turned off, so the extension never asks the stage for
  account pages it does not have.
- Requests are limited: the stage, the extension itself, the author's site (for the install page's
  shared style) and, for evidence lookups, api.github.com, rdap.org and web.archive.org. Everything
  else is blocked. `requests.json` lists every request and what happened to it.
- `chrome://extensions` is left out of the recording because it lists every extension in the
  machine's Chrome, including ones unrelated to this project.
