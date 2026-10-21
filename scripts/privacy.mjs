// Builds Radar's public privacy policy from PRIVACY.md: src/ext/privacy.html inside the extension
// and docs/privacy.html for the public site. The Markdown stays the one source of record.
//   node scripts/privacy.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, REPO, markdown, page, writePage } from "./site/page.mjs";

export function render(md = readFileSync(join(ROOT, "PRIVACY.md"), "utf8")) {
  const updated = (md.match(/^Last updated: (\d{4}-\d{2}-\d{2})\.$/m) || [])[1];
  if (!updated) throw new Error('PRIVACY.md needs a "Last updated: YYYY-MM-DD." line');
  const text = md.replace(/^Last updated: .*\n\n?/m, "")
    .replace("are listed in CHANGELOG.md", `are listed in [Radar's changelog](${REPO}/blob/main/CHANGELOG.md)`)
    .replace("open an issue on the project's repository", `open an issue on [Radar's repository](${REPO}/issues)`);
  return page({ title: "Radar privacy policy", description: "Radar runs entirely in your browser: no server, no account, no analytics. What it reads, what it keeps and for how long, and your controls.", updated, body: markdown(text) });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  writePage("privacy.html", render());
  console.log("wrote src/ext/privacy.html and docs/privacy.html");
}
