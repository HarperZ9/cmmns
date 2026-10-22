#!/usr/bin/env node
// radar: Daylight Commons' evidence from the command line, reading local files only. Nothing is fetched.
//   radar analyze <file> [--json] [--bundle out.json] [--include-text] [--key path] [--no-claims]
//   radar verify <bundle.json> [--key-id id] [--json]
//   radar site <domain> [--json]
//   radar media <file> [--json]
// <file> for analyze: a saved page (.html), thread JSON, an X archive tweets.js, a Reddit export
// CSV, a Mastodon outbox.json or a Bluesky repository .car. project-docs/INTEGRATION.md has more.
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { analyzeThread, analyzeText, checkMedia, siteInfo } from "../src/core/api.js";
import { importFile } from "../src/core/imports.js";
import { makeBundle, signBundle, verifyBundle } from "../src/core/evidence-bundle.js";
import { loadTables, dataLock, radarVersion, ROOT } from "./lib/data.mjs";
import { loadOrMakeKey, DEFAULT_KEY } from "./lib/keys.mjs";
import { readable, verdictLines } from "./lib/report.mjs";
import { validate } from "./lib/jsonschema.mjs";

const USAGE = `Usage:
  radar analyze <file> [--json] [--bundle out.json] [--include-text] [--key path] [--no-claims]
  radar verify <bundle.json> [--key-id id] [--json]
  radar site <domain> [--json]
  radar media <file> [--json]
<file> for analyze: a saved page (.html), thread JSON, an X archive tweets.js, a Reddit export
CSV, a Mastodon outbox.json or a Bluesky repository .car. Daylight Commons reads local files only.
`;
const SCHEMA = JSON.parse(readFileSync(`${ROOT}/schema/evidence.v1.json`, "utf8"));

export function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const [k, v] = a.slice(2).split("=");
    out.flags[k] = v !== undefined ? v : ["bundle", "key", "key-id"].includes(k) ? argv[++i] : true;
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
  const texts = Object.fromEntries([imp.input.root, ...imp.input.replies].filter(Boolean).map((p, i) => [p.id != null ? String(p.id) : "p" + i, p.text]));
  const built = makeBundle(result, { tool: `Daylight Commons ${radarVersion()} (CLI)`, dataLock: await dataLock(), source: imp.source === "export" ? "export" : "thread", includeText: !!f["include-text"], texts });
  if (!built.ok) throw new Error(built.reason);
  const key = await loadOrMakeKey(typeof f.key === "string" ? f.key : DEFAULT_KEY);
  const signed = await signBundle(built.bundle, key.keyPair);
  writeFileSync(f.bundle, JSON.stringify(signed, null, 2) + "\n");
  process.stderr.write(`Signed bundle written to ${f.bundle} with key ${signed.signer.keyId}${key.made ? ` (a new key, saved at ${typeof f.key === "string" ? f.key : DEFAULT_KEY})` : ""}.\n`);
}

async function verify(file, f) {
  const bundle = JSON.parse(readFileSync(file, "utf8"));
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
  if (cmd === "media") { const r = await checkMedia(readFileSync(arg)); print(flags.json ? asJson(r) : readable(r)); return 0; }
  print(USAGE);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { process.stderr.write(`radar: ${e.message}\n`); process.exitCode = 1; });
}
