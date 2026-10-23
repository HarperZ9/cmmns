#!/usr/bin/env node
// radar: Daylight Commons' evidence from the command line, reading local files only. Nothing is fetched.
//   radar analyze <file> [--json] [--bundle out.json] [--include-text] [--key path] [--no-claims]
//                [--carrier-safe [--page address]]
//   radar verify <bundle.json | evidence-chain.json> [--key-id id] [--json]
//   radar site <domain> [--json]
//   radar media <file> [--json]
//   radar export <evidence-chain.json> --profile legal|technical|journalistic|research [--out dir]
// <file> for analyze: a saved page (.html), thread JSON, an X archive tweets.js, a Reddit export
// CSV, a Mastodon outbox.json or a Bluesky repository .car. project-docs/INTEGRATION.md has more.
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { analyzeThread, analyzeText, checkMedia, siteInfo } from "../src/core/api.js";
import { importFile } from "../src/core/imports.js";
import { makeBundle, signBundle, signCarrierSafe, verifyBundle, CARRIER_SAFE } from "../src/core/evidence-bundle.js";
import { chainChecks, EXPORT_FORMAT } from "../src/core/evidence-seal.js";
import { loadTables, dataLock, radarVersion, ROOT } from "./lib/data.mjs";
import { loadOrMakeKey, DEFAULT_KEY } from "./lib/keys.mjs";
import { readable, verdictLines, chainLines } from "./lib/report.mjs";
import { validate } from "./lib/jsonschema.mjs";
import { runExport } from "./lib/export.mjs";

const USAGE = `Usage:
  radar analyze <file> [--json] [--bundle out.json] [--include-text] [--key path] [--no-claims]
               [--carrier-safe [--page address]]
  radar verify <bundle.json | evidence-chain.json> [--key-id id] [--json]
  radar site <domain> [--json]
  radar media <file> [--json]
  radar export <evidence-chain.json> --profile legal|technical|journalistic|research [--out dir]
               [--reply replies.json] [--corrections corrections.json] [--seed text]
<file> for analyze: a saved page (.html), thread JSON, an X archive tweets.js, a Reddit export
CSV, a Mastodon outbox.json or a Bluesky repository .car. verify checks a signed evidence bundle
or an evidence chain saved from the extension ("Save evidence chain"). Daylight Commons reads local
files only. --carrier-safe signs the bundle with a one-time key that is never saved, keeps only
the day it was made, and leaves out the page address unless you give one with --page; its
signature then proves the bundle is unchanged and says nothing about who made it. export writes a saved evidence chain as a legal dossier, a technical PROV record, a
journalistic write-up or a research dataset, into a new folder; it refuses a chain that fails its
check.
`;
const SCHEMA = JSON.parse(readFileSync(`${ROOT}/schema/evidence.v1.json`, "utf8"));

export function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const [k, v] = a.slice(2).split("=");
    out.flags[k] = v !== undefined ? v : ["bundle", "key", "key-id", "profile", "out", "reply", "corrections", "seed", "page"].includes(k) ? argv[++i] : true;
  }
  return out;
}

const print = (s) => process.stdout.write(s);
const asJson = (x) => JSON.stringify(x, null, 2) + "\n";

async function analyze(file, f) {
  const imp = importFile(basename(file), readFileSync(file));
  if (!imp.ok) throw new Error(imp.reason);
  loadTables({ claims: !f["no-claims"] });
  const result = imp.source === "page" ? analyzeText(imp.input.replies[0].text, { id: "page", links: imp.input.replies[0].links }) : analyzeThread(imp.input);
  if (f.bundle) await writeBundle(result, imp, f);
  print(f.json ? asJson(result) : readable(result, [`Read as ${imp.format}.`, ...imp.notes]));
}

async function writeBundle(result, imp, f) {
  const quoted = [...(imp.input.quoted || []), ...[imp.input.root, ...imp.input.replies].filter((p) => p && p.quoted && typeof p.quoted === "object").map((p) => p.quoted)];
  const texts = Object.fromEntries([imp.input.root, ...imp.input.replies, ...quoted].filter(Boolean).map((p, i) => [p.id != null ? String(p.id) : "p" + i, p.text]));
  const carrier = !!f["carrier-safe"];
  const built = makeBundle(result, { tool: `Daylight Commons ${radarVersion()} (CLI)`, dataLock: await dataLock(), source: imp.source === "export" ? "export" : "thread", includeText: !!f["include-text"], texts, ...(carrier ? { profile: CARRIER_SAFE, typedPage: typeof f.page === "string" ? f.page : null } : {}) });
  if (!built.ok) throw new Error(built.reason);
  if (carrier) {
    const signed = await signCarrierSafe(built.bundle);
    writeFileSync(f.bundle, JSON.stringify(signed, null, 2) + "\n");
    process.stderr.write(`Carrier-safe bundle written to ${f.bundle}, signed with a one-time key ${signed.signer.keyId} that was not saved. Its signature proves the bundle is unchanged and says nothing about who made it.\n`);
    return;
  }
  const key = await loadOrMakeKey(typeof f.key === "string" ? f.key : DEFAULT_KEY);
  const signed = await signBundle(built.bundle, key.keyPair);
  writeFileSync(f.bundle, JSON.stringify(signed, null, 2) + "\n");
  process.stderr.write(`Signed bundle written to ${f.bundle} with key ${signed.signer.keyId}${key.made ? ` (a new key, saved at ${typeof f.key === "string" ? f.key : DEFAULT_KEY})` : ""}.\n`);
}

async function verify(file, f) {
  const bundle = JSON.parse(readFileSync(file, "utf8"));
  if (bundle && bundle.format === EXPORT_FORMAT) {
    const c = await chainChecks(bundle);
    print(f.json ? asJson(c) : chainLines(file, c));
    return c.ok ? 0 : 1;
  }
  const v = await verifyBundle(bundle, { keyId: typeof f["key-id"] === "string" ? f["key-id"] : null });
  const errs = validate(SCHEMA, bundle);
  v.checks.push({ name: "schema", ok: !errs.length, text: errs.length ? errs.slice(0, 3).join("; ") : "fits schema/evidence.v1.json" });
  v.ok = v.ok && !errs.length;
  print(f.json ? asJson(v) : verdictLines(file, v));
  return v.ok ? 0 : 1;
}

export async function main(argv) {
  const { _: [cmd, arg], flags } = parseArgs(argv);
  if (!cmd || flags.help || !arg) { print(USAGE); return cmd ? 2 : 0; }
  if (cmd === "analyze") { await analyze(arg, flags); return 0; }
  if (cmd === "verify") return verify(arg, flags);
  if (cmd === "site") { loadTables({ claims: false }); const r = siteInfo(arg); if (!r) throw new Error("No domain given."); print(flags.json ? asJson(r) : readable(r)); return 0; }
  if (cmd === "export") { const r = await runExport(arg, flags); print(`Wrote ${r.files.length} files to ${r.out}: ${r.files.join(", ")}.
`); return 0; }
  if (cmd === "media") { const r = await checkMedia(readFileSync(arg)); print(flags.json ? asJson(r) : readable(r)); return 0; }
  print(USAGE);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { process.stderr.write(`radar: ${e.message}\n`); process.exitCode = 1; });
}
