// Builds examples/musk-ukraine-case: the hand-made Musk and Ukraine case of 2026-10-23, moved
// into the `daylight case` format as a worked example. It imports the old sources and timeline
// (the old folder is only read), then records the claims, edges, leads, absences and actors
// from the old CASE.md with the same commands a person would type.
//   node scripts/case-example-musk.mjs <old-case-folder> [--out examples/musk-ukraine-case] [--key path]
// Capture files are not copied: they hold other publishers' pages. Their hashes stay recorded.
import { rmSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { runCaseCommand } from "../bin/lib/case.mjs";

const AUTHOR_WORDS = "Also Musk is actively aiding Russia by denying aid to Ukraine as of this week, as well as threatening democrats.";

const CLAIMS = [
  ["A speed cap hit Ukraine's Starlink and Starshield terminals on 13 to 14 October", "S02,S05,S21", "documented", { date: "2026-10-13", key: "cap-start" }],
  ["Musk proposed the cap to Trump, and Trump agreed", "S06", "inference", { key: "who-decided" }],
  ["Musk ordered the slowdown and discussed it with Trump", "S11", "inference", { corroborates: "C02", key: "who-decided" }],
  ["The White House instructed the Pentagon to slow Starshield", "S05", "inference", { key: "who-decided" }],
  ["Any limits on speed or usage are decided by the US military and ultimately POTUS", "S01", "documented", { "self-sourced": true, corroborates: "C04", date: "2026-10-14" }],
  ["Rubio called reports of White House involvement categorically false and said it wasn't deliberate", "S07", "documented", { date: "2026-10-17", "self-sourced": true }],
  ["Rubio said Starshield is governed by a private commercial contract that sets what speeds are allowed", "S19", "documented", { date: "2026-10-22" }],
  ["Trump said of the restore: The bottom line, he put it back", "S17", "documented", { date: "2026-10-22" }],
  ["The cap cut Ukraine's ability to intercept Russian jet-powered Shaheds", "S06,S04", "inference", {}],
  ["Musk is actively aiding Russia, meaning he acted with intent to help Russia", "S47", "unproven", {}],
  ["Musk denied aid to Ukraine this week", "S47", "contradicted", { note: "No aid package, grant or funding was denied; paid-for service was degraded (S05, S21)." }],
  ["Musk wrote that he will find out who is really pulling the strings and come for them, quoting POLITICO on Democratic probes", "S15", "documented", { date: "2026-10-21" }],
  ["Musk threatened Democrats with violence", "S15", "unproven", { note: "Not met on the true-threat test (S40, S41); the means are unstated." }],
  ["Trump posted a letter To the Great People of Israel endorsing Netanyahu on Truth Social", "S29", "documented", { date: "2026-10-18" }],
  ["A source watched Kushner access a Dubai-based bank account whose money, hundreds of millions of dollars, had come from a bank in Azerbaijan", "S34", "unproven", { key: "kushner-account" }],
  ["Kushner had access to two bank accounts, one Azerbaijani, the other Israeli, and it's real", "S36", "unproven", { retells: "C15" }],
  ["Bank account Alpha at First Abu Dhabi Bank received roughly $750 million from the Saudis and Emiratis, beginning in 2017", "S34", "unproven", { note: "The old CASE.md joined this sum to the Azerbaijan account in C15. The excerpt keeps them apart; corrected here on 2026-10-23." }],
  ["Kushner denies the account and says the author supplied no statements, account numbers or dates", "S35", "documented", { "self-sourced": true }],
  ["Nieuwsuur and de Volkskrant spoke with people directly involved and found no confirmation", "S37", "documented", { date: "2026-10-23" }],
];

const EDGES = [
  ["@elonmusk", "@FedorovMykhailo", "reply", "S01"], ["@elonmusk", "@politico", "quote", "S15"],
  ["@TrumpTruthOnX", "@realDonaldTrump", "repost", "S33"], ["@michaeldweiss", "@VanityFair", "link", "S36"],
];

const LEADS = [
  ["Who ordered the cap, and when?", "The instruction to the Pentagon and SpaceX's change ticket for the cap", "DoD, the DoD Inspector General, SpaceX", 5, "legal", "C02,C03,C04"],
  ["Is the speed limit a contract term, and who may change it?", "The current Ukraine Starshield task order and its service-plan terms", "DISA and Space Systems Command", 4, "request", "C07"],
  ["Did Trump and Musk, or Trump and Putin, speak between 8 and 21 October?", "White House call and meeting logs, 10-08 to 10-21", "The White House (Presidential Records Act)", 4, "legal", "C02,C04"],
  ["What exactly did the WSJ, Reuters and Telegraph report, and from whom?", "The full original articles", "WSJ, Reuters, The Telegraph", 3, "request", "C02,C03,C04"],
  ["Does Musk deny the WSJ report?", "A direct statement from Musk on the report", "Elon Musk", 3, "unknown", "C03"],
  ["Does SpaceX treat the cap as material?", "Any 8-K, or answers at the next earnings call", "SpaceX (SEC EDGAR)", 2, "public", "C03"],
  ["Is the Kushner account real?", "OGE 278 disclosures 2017 to 2020, FARA filings, CTIVD records, the book's notes after 10-27", "OGE, DOJ, CTIVD, the publisher", 4, "request", "C15,C16,C17"],
  ["What capacity stands behind 'come for them'?", "FEC filings for Musk-funded committees, 2026 cycle", "FEC", 2, "public", "C12"],
];

const ABSENT = [
  ["The WSJ, Reuters and Telegraph originals", "withheld", "WSJ, Reuters, The Telegraph", "S11", "Paywalled or blocked; read through relays only."],
  ["A Ukraine Starshield task order after 2025-11-30", "missing", "DISA", "S23", "No successor award visible on USAspending; it may be classified or ally-funded."],
  ["A Musk statement on the WSJ report", "missing", "Elon Musk", "S13", "His 10-21 post names no story."],
  ["Musk's 10-10 reply saying Zelensky has gone too far", "missing", "X Corp.", null, "Reported in search results, not captured."],
  ["SpaceX 10-Q mention of Ukraine or Russia", "missing", "SpaceX", "S25", "The filing is silent on both."],
];

const PUBLIC = ["@elonmusk", "@FedorovMykhailo", "@realDonaldTrump", "@jaredkushner", "@michaeldweiss", "@politico", "@VanityFair"];

async function step(dir, ...argv) {
  const r = await runCaseCommand([...argv, "--case", dir, "--no-commit"]);
  if (r.code) throw new Error(`case ${argv[0]} failed`);
  return r.out;
}

export async function buildExample(oldFolder, out, keyFile) {
  if (existsSync(out)) rmSync(out, { recursive: true, force: true });
  await runCaseCommand(["init", "Musk, Ukraine and the Democrats", "--dir", out, "--no-git"]);
  await step(out, "import", oldFolder);
  writeFileSync(join(out, "captures", "author-claim.txt"), AUTHOR_WORDS + "\n");
  await step(out, "add", join(out, "captures", "author-claim.txt"), "--date", "2026-10-23", "--what", "The author's words that opened the case");
  rmSync(join(out, "captures", "author-claim.txt"));
  for (const [text, source, rung, opts] of CLAIMS) await step(out, "claim", text, "--source", source, "--rung", rung, ...Object.entries(opts).flatMap(([k, v]) => (v === true ? [`--${k}`] : [`--${k}`, v])));
  for (const [from, to, type, source] of EDGES) await step(out, "edge", "--from", from, "--to", to, "--type", type, "--source", source);
  for (const [q, record, holder, d, access, claims] of LEADS) await step(out, "lead", q, "--record", record, "--holder", holder, "--decisive", String(d), "--access", access, "--claims", claims);
  for (const [what, status, custodian, source, note] of ABSENT) await step(out, "absent", what, "--status", status, "--custodian", custodian, ...(source ? ["--source", source] : []), "--note", note);
  for (const h of PUBLIC) await step(out, "actor", h, "--public-figure");
  for (const [c, a, b] of [["C01", "documented", "documented"], ["C02", "inference", "inference"], ["C10", "unproven", "unproven"], ["C11", "contradicted", "contradicted"], ["C13", "unproven", "inference"], ["C15", "unproven", "unproven"]]) {
    await step(out, "label", c, "--labeller", "labeller-a", "--rung", a);
    await step(out, "label", c, "--labeller", "labeller-b", "--rung", b);
  }
  return step(out, "export", "--profile", "newsroom", "--key-file", keyFile);
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  const [oldFolder] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
  if (!oldFolder) { process.stderr.write("usage: node scripts/case-example-musk.mjs <old-case-folder> [--out dir] [--key path]\n"); process.exit(2); }
  buildExample(resolve(oldFolder), resolve(arg("--out", "examples/musk-ukraine-case")), arg("--key", join(process.env.HOME || process.env.USERPROFILE, ".radar", "bundle-key.jwk")))
    .then((o) => process.stdout.write(o), (e) => { process.stderr.write(`${e.stack}\n`); process.exit(1); });
}
