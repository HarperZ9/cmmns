// Package Radar for the browser stores: dist/radar-chrome-<version>.zip and
// dist/radar-firefox-<version>.xpi (unsigned), from src/ext, with dist/SHA256SUMS.
// Deterministic: the same source tree gives the same bytes and the same hashes.
//   node scripts/package.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { zip, browserManifest, listFiles, EXT } from "./zip.mjs";

const files = listFiles();
const manifest = JSON.parse(files.find(([n]) => n === "manifest.json")[1].toString("utf8"));
const dist = join(EXT, "..", "..", "dist");
mkdirSync(dist, { recursive: true });

const sums = [];
for (const [browser, ext] of [["chrome", "zip"], ["firefox", "xpi"]]) {
  const m = Buffer.from(JSON.stringify(browserManifest(manifest, browser), null, 2) + "\n");
  const archive = zip(files.map(([n, d]) => [n, n === "manifest.json" ? m : d]));
  const name = `radar-${browser}-${manifest.version}.${ext}`;
  writeFileSync(join(dist, name), archive);
  const sha = createHash("sha256").update(archive).digest("hex");
  sums.push(`${sha}  ${name}`);
  console.log(`${name}  ${archive.length} bytes  sha256 ${sha}`);
}
writeFileSync(join(dist, "SHA256SUMS"), sums.join("\n") + "\n");
