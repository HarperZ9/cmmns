# Media stage

Pages and a capture script for filming the extension without signing in anywhere. Development
tools only; nothing here ships in the extension.

- `stage-launch.html`: a synthetic launch thread with the X post-page structure and no platform
  name or logo. The real content scripts run on it. The launch campaign lens is computed by the
  real core (`src/core/campaign.js`) from `tests/fixtures/campaign-fixtures.js`; only the X
  network plumbing in `src/ext/campaign.js` is staged. Every handle carries a `demo_` prefix.
- `stage-definitions.html?entry=<id>`: the element table `src/core/definitions.js` builds for the
  same launch, drawn in the extension's canon. The extension does not draw these tables yet.
- `capture.py`: Playwright stills of each state at 3840x2160 (install page, first-run page, thread, reply window, panel, element tables, bundle check) and `states.json` with the rectangles
  a compositor needs.

```
node scripts/serve.mjs 8743
python scripts/media/capture.py --out OUT --bundle signed.json --edited signed-edited.json
```
