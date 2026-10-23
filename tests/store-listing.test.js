// The store listing (docs/store/LISTING.md) against each store's published limits, the
// manifest it describes, and the permanent Firefox add-on id.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const md = readFileSync(new URL("../docs/store/LISTING.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const manifest = JSON.parse(readFileSync(new URL("../src/ext/manifest.json", import.meta.url), "utf8"));
const field = (name) => {
  const m = md.match(new RegExp(`<!-- field:${name} -->\\n([\\s\\S]*?)\\n<!-- /field -->`));
  assert.ok(m, `field ${name}`);
  return m[1];
};

test("every field fits its store's limit", () => {
  assert.ok(field("name").length <= 50, "AMO name, 50");
  assert.ok(manifest.name.length <= 75, "CWS name, 75");
  assert.ok(field("summary").length <= 132, `CWS summary is ${field("summary").length}`);
  assert.ok(field("amo-summary").length <= 250, `AMO summary is ${field("amo-summary").length}`);
  assert.ok(field("description").length <= 16000);
});

test("the CWS summary is the manifest description, and the name matches", () => {
  assert.equal(field("summary"), manifest.description);
  assert.equal(field("name"), manifest.name);
});

test("no placeholder, em dash or score claim is left in the listing", () => {
  assert.doesNotMatch(md, /AUTHOR|TODO|TBD|—/);
  assert.match(field("description"), /Never a score/);
});

test("every requested host and permission has a justification", () => {
  for (const p of manifest.permissions || []) assert.ok(md.includes("| `" + p + "` |"), p);
  for (const h of manifest.host_permissions || []) assert.ok(md.includes("`" + h + "`"), h);
  assert.equal(manifest.optional_permissions, undefined, "optional permissions need their own row");
  for (const h of manifest.optional_host_permissions || []) assert.ok(md.includes("Optional host `" + h + "`"), h);
});

test("the Firefox id is the permanent one; nothing is collected by default, and evidence lookups are declared", () => {
  const g = manifest.browser_specific_settings.gecko;
  assert.equal(g.id, "radar@harperz9.github.io", "never change the add-on id: see DESIGN.md");
  assert.deepEqual(g.data_collection_permissions.required, ["none"]);
  // Evidence lookups send link domains and repository names (src/ext/evidence-bg.js), so Firefox
  // must be told, and the listing and the store forms must say the same.
  assert.deepEqual(g.data_collection_permissions.optional, ["websiteContent"]);
  assert.ok(md.includes('"optional": ["websiteContent"]'));
  assert.match(md, /\| Website content, sent \| Yes \|/);
  assert.ok(md.includes(g.id));
});

test("no store text claims an error rate for every sign or that nothing ever leaves the browser", () => {
  for (const t of [manifest.description, field("summary"), field("amo-summary"), field("description"), field("single-purpose")]) {
    assert.doesNotMatch(t, /each sign with its (measured )?error rate|nothing leaves your browser|one click deletes/i, t.slice(0, 60));
  }
});

test("the listing points at the public privacy and transparency pages", () => {
  for (const u of ["https://harperz9.github.io/daylight-commons/privacy.html", "https://harperz9.github.io/daylight-commons/transparency.html"]) assert.ok(md.includes(u), u);
});
