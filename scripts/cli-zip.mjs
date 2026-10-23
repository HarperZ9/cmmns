// The command line tool as one release file, radar-cli-<version>.zip: bin/, src/core/, the data
// tables it reads from src/ext/, schema/, package.json and the licence. Unzip it anywhere with Node
// 22 or later and run `node bin/radar.mjs verify <file>` to check a signed evidence bundle or a saved
// evidence chain offline, or `analyze` on a saved thread or a data export. No npm install.
// Deterministic: the same tree gives the same bytes (scripts/zip.mjs).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { zip } from "./zip.mjs";
import { ROOT } from "./release-lib.mjs";

function walk(dir, rel = "") {
  const out = [];
  for (const name of readdirSync(join(ROOT, dir, rel)).sort()) {
    if (name.startsWith(".") || name.endsWith(".bak")) continue;
    const r = rel ? `${rel}/${name}` : name, full = join(ROOT, dir, r);
    if (statSync(full).isDirectory()) out.push(...walk(dir, r));
    else out.push([`${dir}/${r}`, readFileSync(full)]);
  }
  return out;
}

// [[path, Buffer]] of everything the command line tool needs.
export function cliFiles() {
  const tables = readdirSync(join(ROOT, "src", "ext")).filter((n) => n.endsWith(".json")).sort().map((n) => [`src/ext/${n}`, readFileSync(join(ROOT, "src", "ext", n))]);
  return [...walk("bin"), ...walk("src/core"), ...tables, ...walk("schema"), ["package.json", readFileSync(join(ROOT, "package.json"))], ["LICENSE", readFileSync(join(ROOT, "LICENSE"))]];
}

export const cliZip = () => zip(cliFiles());
