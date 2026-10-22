// The licence travels with the code: the root LICENSE, the copy every extension package ships
// (src/ext/LICENSE.txt) and the REUSE copy are the same AGPL-3.0 text, and the SPDX id agrees.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { listFiles } from "../scripts/zip.mjs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const pkg = JSON.parse(read("package.json"));

test("the root licence is the GNU AGPL version 3 and package.json names it", () => {
  const text = read("LICENSE");
  assert.match(text, /^\s+GNU AFFERO GENERAL PUBLIC LICENSE\n\s+Version 3, 19 November 2007/);
  assert.match(text, /13\. Remote Network Interaction; Use with the GNU General Public License\./);
  assert.equal(pkg.license, "AGPL-3.0-only");
});

test("every copy of the AGPL text is identical", () => {
  const root = read("LICENSE");
  assert.equal(read("src/ext/LICENSE.txt"), root, "src/ext/LICENSE.txt differs from LICENSE");
  assert.equal(read("LICENSES/AGPL-3.0-only.txt"), root, "LICENSES/AGPL-3.0-only.txt differs from LICENSE");
});

test("every extension package ships the licence", () => {
  assert.ok(listFiles().some(([n]) => n === "LICENSE.txt"), "LICENSE.txt missing from the package list");
});

test("every licence REUSE.toml names has its text in LICENSES/", () => {
  const ids = new Set([...read("REUSE.toml").matchAll(/SPDX-License-Identifier = "([^"]+)"/g)].map((m) => m[1]));
  assert.ok(ids.has("AGPL-3.0-only") && ids.has("CC-BY-4.0"));
  for (const id of ids) assert.ok(read(`LICENSES/${id}.txt`).length > 100, `LICENSES/${id}.txt`);
});
