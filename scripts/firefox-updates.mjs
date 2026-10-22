// Write docs/firefox/updates.json, the update manifest a self-distributed Radar in Firefox checks
// (the update_url in the radar-firefox-self build, scripts/zip.mjs). Run it on the xpi Mozilla
// signed, since signing changes the file and Firefox checks the hash of what it downloads.
//   node scripts/firefox-updates.mjs <signed.xpi> [--link <download address>]
// The default download address is the GitHub release asset; a mirror can pass its own.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./release-lib.mjs";

export const UPDATES = join(ROOT, "docs", "firefox", "updates.json");
const ID = JSON.parse(readFileSync(join(ROOT, "src", "ext", "manifest.json"), "utf8")).browser_specific_settings.gecko.id;

// The manifest with this version added (or replaced), newest last, as Firefox reads it.
export function addUpdate(current, { version, link, sha256, minVersion = "128.0" }) {
  const doc = current && current.addons ? structuredClone(current) : { addons: {} };
  const entry = doc.addons[ID] || { updates: [] };
  entry.updates = entry.updates.filter((u) => u.version !== version);
  entry.updates.push({ version, update_link: link, update_hash: `sha256:${sha256}`, applications: { gecko: { strict_min_version: minVersion } } });
  entry.updates.sort((a, b) => a.version.localeCompare(b.version, "en", { numeric: true }));
  doc.addons[ID] = entry;
  return doc;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [xpi] = process.argv.slice(2);
  if (!xpi || !existsSync(xpi)) { console.error("usage: node scripts/firefox-updates.mjs <signed.xpi> [--link <url>]"); process.exit(2); }
  const version = JSON.parse(readFileSync(join(ROOT, "src", "ext", "manifest.json"), "utf8")).version;
  const args = process.argv.slice(2);
  const link = (args.includes("--link") && args[args.indexOf("--link") + 1]) || `https://github.com/HarperZ9/radar/releases/download/v${version}/${basename(xpi)}`;
  if (!/^https:\/\//.test(link)) { console.error("the download address must be https"); process.exit(2); }
  const sha256 = createHash("sha256").update(readFileSync(xpi)).digest("hex");
  const current = existsSync(UPDATES) ? JSON.parse(readFileSync(UPDATES, "utf8")) : null;
  mkdirSync(join(ROOT, "docs", "firefox"), { recursive: true });
  writeFileSync(UPDATES, JSON.stringify(addUpdate(current, { version, link, sha256 }), null, 2) + "\n");
  console.log(`docs/firefox/updates.json: ${version} at ${link}, sha256 ${sha256}`);
}
