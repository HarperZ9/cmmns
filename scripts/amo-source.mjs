// The source package Firefox Add-ons asks for when a package holds generated code. Daylight Commons'
// xpi holds two generated files, core.bundle.js and ocr.bundle.js, each made by scripts/build.mjs
// from src/core and src/ocr by plain concatenation (nothing is minified or transpiled). This zip holds
// exactly what a reviewer needs to remake them byte for byte, with the steps in REVIEWER.md.
//   node scripts/amo-source.mjs            writes docs/store/amo-source-<version>.zip
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { zip } from "./zip.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(ROOT, "src/ext/manifest.json"), "utf8")).version;

function walk(rel) {
  const full = join(ROOT, rel);
  if (statSync(full).isFile()) return [[rel, readFileSync(full)]];
  return readdirSync(full).sort().flatMap((n) => walk(`${rel}/${n}`));
}

export const REVIEWER = (v) => `Daylight Commons ${v}: source for the generated files in the Firefox package

The xpi holds two generated files. Everything else in it is hand-written source or plain data,
shipped as is.

  core.bundle.js  made by scripts/build.mjs from src/core (one file per module, concatenated in a
                  fixed order and wrapped in one function; no minifying, no transpiling)
  ocr.bundle.js   made the same way from src/ocr

Remake and compare them:

  1. Install Node.js 22 or later. No npm install is needed: the project has no dependencies.
  2. Unzip this archive into an empty folder.
  3. Unzip the submitted radar-firefox-${v}.xpi into src/ext inside that folder.
  4. Run: node scripts/build.mjs
     It rewrites src/ext/core.bundle.js and src/ext/ocr.bundle.js.
  5. Compare them with the files from the xpi; they are identical byte for byte. For example:
       git diff --no-index <xpi copy>/core.bundle.js src/ext/core.bundle.js
     prints nothing.

The whole repository, with its history and tests, is public:
  https://github.com/HarperZ9/daylight-commons (tag v${v})

Licence: AGPL-3.0-only for code (LICENSE), CC BY 4.0 for data and docs.
`;

export function amoSource(v = version) {
  const files = [...walk("src/core"), ...walk("src/ocr"), ...["scripts/build.mjs", "package.json", "LICENSE"].flatMap(walk),
    ["REVIEWER.md", Buffer.from(REVIEWER(v))]];
  return zip(files.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(join(ROOT, "docs/store"), { recursive: true });
  const out = join(ROOT, "docs/store", `amo-source-${version}.zip`), bytes = amoSource();
  writeFileSync(out, bytes);
  console.log(`${out}: ${bytes.length} bytes`);
}
