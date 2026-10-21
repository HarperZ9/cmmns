// Packaging: the zip writer is deterministic (same input, same bytes), its archives read back, and
// each browser gets the manifest it understands.
import test from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync, crc32 } from "node:zlib";
import { zip, browserManifest, listFiles } from "../scripts/zip.mjs";
import { readFileSync } from "node:fs";

// A minimal reader: walks the central directory and inflates each entry.
function unzip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    const lnlen = buf.readUInt16LE(off + 26), lelen = buf.readUInt16LE(off + 28);
    const raw = buf.subarray(off + 30 + lnlen + lelen, off + 30 + lnlen + lelen + csize);
    const data = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
    assert.equal(crc32(data), crc, "crc of " + name);
    out[name] = data;
    p += 46 + nlen + elen + clen;
  }
  return out;
}

const files = [["b.txt", Buffer.from("second")], ["a/one.js", Buffer.from("console.log(1);\n".repeat(50))], ["empty.json", Buffer.alloc(0)]];

test("the same files give the same bytes, whatever order they come in", () => {
  const one = zip(files), two = zip([...files].reverse());
  assert.ok(one.equals(two));
});

test("an archive reads back to the files that went in, in sorted order", () => {
  const got = unzip(zip(files));
  assert.deepEqual(Object.keys(got), ["a/one.js", "b.txt", "empty.json"]);
  for (const [n, d] of files) assert.ok(got[n].equals(d), n);
});

test("entries carry a fixed timestamp, so a rebuild never changes the hash", () => {
  const buf = zip(files);
  assert.equal(buf.readUInt16LE(10), 0, "DOS time");
  assert.equal(buf.readUInt16LE(12), (0 << 9) | (1 << 5) | 1, "DOS date 1980-01-01");
});

const manifest = JSON.parse(readFileSync(new URL("../src/ext/manifest.json", import.meta.url), "utf8"));

test("Chrome gets a service worker and no Firefox keys", () => {
  const m = browserManifest(manifest, "chrome");
  assert.equal(m.background.service_worker, "background.js");
  assert.equal(m.background.scripts, undefined);
  assert.equal(m.browser_specific_settings, undefined);
});

test("Firefox gets background scripts, its id, and a version that supports main-world scripts", () => {
  const m = browserManifest(manifest, "firefox");
  assert.equal(m.background.service_worker, undefined);
  assert.deepEqual(m.background.scripts.slice(-1), ["background.js"]);
  assert.ok(m.browser_specific_settings.gecko.id);
  assert.ok(parseFloat(m.browser_specific_settings.gecko.strict_min_version) >= 128);
});

test("the source manifest is not changed by building a browser manifest", () => {
  const before = JSON.stringify(manifest);
  browserManifest(manifest, "chrome"); browserManifest(manifest, "firefox");
  assert.equal(JSON.stringify(manifest), before);
});

test("every file the manifest and pages name is in the package list", () => {
  const listed = new Set(listFiles().map(([n]) => n));
  const named = [
    ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon), manifest.action.default_popup, manifest.options_ui.page,
    ...manifest.background.scripts, ...manifest.content_scripts.flatMap((c) => [...(c.js || []), ...(c.css || [])]), "welcome.html",
  ];
  for (const n of named) assert.ok(listed.has(n), "missing from the package: " + n);
  for (const [n] of listFiles()) assert.doesNotMatch(n, /(^|\/)\.|\.bak$/, "stray file " + n);
});

test("icons exist at every size for every toolbar state", () => {
  const listed = new Set(listFiles().map(([n]) => n));
  for (const st of ["", "-reading", "-paused"]) for (const n of [16, 32, 48, 128]) {
    const name = `icons/radar${st}-${n}.png`;
    assert.ok(listed.has(name), name);
    const png = readFileSync(new URL("../src/ext/" + name, import.meta.url));
    assert.equal(png.readUInt32BE(16), n, name + " width");
    assert.equal(png.readUInt32BE(20), n, name + " height");
  }
});
