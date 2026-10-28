// Builds docs/how-it-works.html for the public site from HOW-IT-WORKS.md, the diagram and the demo
// stills in docs/demo/ (scripts/demo/README.md). Each finding type is shown with its still, a caption
// saying what the still shows, and, where a reader could take the sign too far, one line on how to
// read it. The window itself still carries each sign's full line.
//   node scripts/how-it-works.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, esc, markdown, sitePage } from "./site/page.mjs";
// [still, title, what the window shows, how to read it (or "" where the caption is enough)]
export const FINDINGS = [
  ["finding-place.png", "Place", "Where the platform places the account, and a sign when a reply speaks as a local of somewhere else (here, \"Here in France\" from an account X labels Nigeria).", "Treat it as a lead. The label follows the connection, so a VPN or a trip moves it, and people abroad still talk about home."],
  ["finding-account.png", "Account", "The account's age and renames, as the platform discloses them.", "Plenty of real people sign up during a news event, so age is one sign among several."],
  ["finding-posting.png", "Posting", "How the account posts: the app it posts from, its hours, its rate.", "News desks, brands and busy people schedule posts too."],
  ["finding-coordination.png", "Coordination", "The same text from several accounts in one thread, with the accounts it matched.", "Matching text shows the words were copied. Open the matched accounts to see who sent them."],
  ["finding-language.png", "Language", "Dehumanising language and calls for violence, with the words that matched and the sign's measured precision.", "The sign describes the words in this post. A quote, a joke or a news report can match too."],
  ["finding-fact-check.png", "Fact-checked claims", "A claim a fact-checker already reviewed, with their rating in their own words and a link.", "The rating belongs to the claim the fact-checker reviewed. Open their link and compare the wording with this post."],
  ["finding-sources.png", "Sources", "Who owns a linked outlet, and a state link only where a cited source names it (here, an outlet Wikidata records as controlled by a government).", "Public broadcasters with their own newsrooms count as state-owned too, and Wikidata can lag a sale."],
  ["finding-thread-report.png", "Thread report", "Where the thread's accounts are based, coordination across the thread, and whether the harshest replies come mostly from flagged accounts.", "The report describes the thread as the platform ranked it. It never scores a single reply or account."],
  ["finding-launch-campaign.png", "Launch campaign", "On a launch post: how its engagement compares with the account's own posts, shared bio templates, join-date waves and Paid partnership labels.", "The signs describe the engagement your page loaded. Real people also write stock bios, join in waves and reshare launches."],
  ["finding-evidence.png", "Evidence receipts", "On your click: a linked repository's creation date and a site's first Internet Archive capture, each kept as a receipt.", "The date is when this repository appeared on GitHub. A team may have built for years before that."],
  ["finding-verify.png", "Offline check", "The saved evidence chain, checked on the Analyse a file page: every receipt, link, the root and each proof.", ""],
];

const CSS = `.sheet video{display:block;width:100%;max-width:100%;height:auto;border:1px solid var(--rule)}
.dc-fig{margin:.6rem 0 1.2rem}.dc-fig img{display:block;width:100%;height:auto;border:1px solid var(--rule)}
.dc-fig figcaption{margin-top:.5rem;color:var(--ink-muted);font-size:.9rem;max-width:var(--measure)}
.dc-read{color:var(--ink-soft)}`;

function figure(src, alt, caption) {
  return `<figure class="dc-fig"><img src="demo/${src}" alt="${esc(alt)}" width="1280" height="800" loading="lazy" decoding="async"><figcaption>${esc(caption)}</figcaption></figure>`;
}

export function render(md = readFileSync(join(ROOT, "HOW-IT-WORKS.md"), "utf8")) {
  const updated = (md.match(/^Last updated: (\d{4}-\d{2}-\d{2})\.$/m) || [])[1];
  if (!updated) throw new Error('HOW-IT-WORKS.md needs a "Last updated: YYYY-MM-DD." line');
  const text = md.replace(/^Last updated: .*\n\n?/m, "");
  const [intro, ...rest] = markdown(text).split(/(?=<h2>)/);
  const diagram = `<figure class="art dc-fig"><img class="art-light" src="demo/how-it-works-light.svg" width="1600" height="970" alt="A reply goes from the page to the reader, the rules and the window, all inside your browser. Evidence lookups leave the browser only on your click; their answers become receipts in a chain you can save, and anyone can check that chain offline." loading="lazy" decoding="async"><img class="art-dark" src="demo/how-it-works-dark.svg" width="1600" height="970" alt="" loading="lazy" decoding="async"><figcaption>Inside the line stays on your device. The dashed paths run only after you turn a feature on and click.</figcaption></figure>`;
  const film = `<h2>Watch it</h2>
<p>Install, a page, a reply's window, its evidence, a lookup's receipts, and the saved chain checked offline, in under two minutes, on synthetic pages where every account is invented.</p>
<video controls preload="metadata" width="1280" height="800" poster="demo/finding-place.png" src="demo/demo-install-to-verify.webm"></video>`;
  const findings = `<h2>What each finding shows</h2>
<p>Each still is the installed extension on a made-up page. Every account in them is invented.</p>
${FINDINGS.map(([src, title, what, read]) => `<h3>${esc(title)}</h3>
${figure(src, `${title}: CMMNS' window on a synthetic page`, what)}${read ? `\n<p class="dc-read">${esc(read)}</p>` : ""}`).join("\n")}`;
  const body = [intro, diagram, ...rest.slice(0, 2), film, findings, ...rest.slice(2)].join("\n");
  return sitePage({ file: "how-it-works.html", title: "How CMMNS works", role: "What the extension reads, where each sign comes from, what leaves your browser, and how anyone can check a receipt without us.", description: "How CMMNS works: each finding type on a real window, the path a reply takes, and receipts anyone can check offline.", updated, body, css: CSS });
}

export const missingStills = () => FINDINGS.map(([src]) => src).filter((f) => !existsSync(join(ROOT, "docs", "demo", f)));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(join(ROOT, "docs", "how-it-works.html"), render());
  console.log("wrote docs/how-it-works.html");
}
