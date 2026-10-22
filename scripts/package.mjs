// Package Daylight Commons: dist/radar-chrome-<version>.zip and dist/radar-firefox-<version>.xpi (unsigned,
// for the stores), dist/radar-firefox-self-<version>.xpi (with an update address on Daylight Commons' own
// site, for Mozilla's unlisted signing and self-distribution), from src/ext, with dist/SHA256SUMS
// and dist/FILES-<version>.sha256 (the hash of every file inside each package).
// Deterministic: the same source tree gives the same bytes and the same hashes on the same zlib;
// the per-file list does not depend on zlib at all.
//   node scripts/package.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { zip, browserManifest, listFiles, EXT } from "./zip.mjs";

export const DIST = join(EXT, "..", "..", "dist");
export const VARIANTS = [["chrome", "zip"], ["firefox", "xpi"], ["firefox-self", "xpi"]];
export const sha = (b) => createHash("sha256").update(b).digest("hex");
const byName = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0);

// The packages as [[name, bytes]], then the per-file hash list. Writes nothing.
export function buildPackages(files = listFiles()) {
  const manifest = JSON.parse(files.find(([n]) => n === "manifest.json")[1].toString("utf8"));
  const out = [], inner = [];
  for (const [browser, ext] of VARIANTS) {
    const m = Buffer.from(JSON.stringify(browserManifest(manifest, browser), null, 2) + "\n");
    const entries = files.map(([n, d]) => [n, n === "manifest.json" ? m : d]).sort(byName);
    const name = `radar-${browser}-${manifest.version}.${ext}`;
    out.push([name, zip(entries)]);
    for (const [n, d] of entries) inner.push(`${sha(d)}  ${name}/${n}`);
  }
  out.push([`FILES-${manifest.version}.sha256`, Buffer.from(inner.join("\n") + "\n")]);
  return { version: manifest.version, files: out };
}

export const sumsOf = (files) => [...files].sort(byName).map(([n, d]) => `${sha(d)}  ${n}`).join("\n") + "\n";

export function writePackages(dist = DIST) {
  mkdirSync(dist, { recursive: true });
  const built = buildPackages();
  for (const [name, data] of built.files) {
    writeFileSync(join(dist, name), data);
    console.log(`${name}  ${data.length} bytes  sha256 ${sha(data)}`);
  }
  writeFileSync(join(dist, "SHA256SUMS"), sumsOf(built.files));
  return built;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) writePackages();
