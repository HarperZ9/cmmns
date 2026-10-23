// Builds Daylight Commons' public privacy policy from PRIVACY.md: src/ext/privacy.html inside the extension
// and docs/privacy.html for the public site. The Markdown stays the one source of record.
//   node scripts/privacy.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, REPO, markdown, page, sitePage, writePage } from "./site/page.mjs";

export function render(target = "ext", md = readFileSync(join(ROOT, "PRIVACY.md"), "utf8")) {
  const updated = (md.match(/^Last updated: (\d{4}-\d{2}-\d{2})\.$/m) || [])[1];
  if (!updated) throw new Error('PRIVACY.md needs a "Last updated: YYYY-MM-DD." line');
  const text = md.replace(/^Last updated: .*\n\n?/m, "")
    .replace("are listed in CHANGELOG.md", `are listed in [Daylight Commons' changelog](${REPO}/blob/main/CHANGELOG.md)`)
    .replace("open an issue on the project's repository", `open an issue on [Daylight Commons' repository](${REPO}/issues)`);
  const description = "Daylight Commons runs in your browser: no server, no account, no analytics. What it reads, what it keeps and for how long, and your controls.";
  if (target === "site") return sitePage({ file: "privacy.html", title: "Privacy policy", role: "What Daylight Commons reads, what it sends and to whom, what it keeps and for how long, and your controls.", description, updated, body: markdown(text) });
  return page({ title: "Daylight Commons privacy policy", description, updated, body: markdown(text) });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  writePage("privacy.html", (t) => render(t));
  console.log("wrote src/ext/privacy.html and docs/privacy.html");
}
