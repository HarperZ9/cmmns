#!/usr/bin/env node
// radar: Daylight Commons' evidence from the command line, reading local files only. Nothing is fetched.
//   radar analyze <file> [--json] [--bundle out.json] [--include-text] [--key path] [--no-claims]
//                [--carrier-safe [--page address]]
//   radar verify <bundle.json | evidence-chain.json> [--key-id id] [--json]
//   radar site <domain> [--json]
//   radar media <file> [--json]
//   radar media convert|compress <file> [--to format] [options]   (needs a system ffmpeg)
//   radar export <evidence-chain.json> --profile legal|technical|journalistic|research [--out dir]
// <file> for analyze: a saved page (.html), thread JSON, an X archive tweets.js, a Reddit export
// CSV, a Mastodon outbox.json or a Bluesky repository .car. project-docs/INTEGRATION.md has more.
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { analyzeThread, analyzeText, checkMedia, siteInfo } from "../src/core/api.js";
import { importFile } from "../src/core/imports.js";
import { makeBundle, signBundle, signCarrierSafe, verifyBundle, CARRIER_SAFE } from "../src/core/evidence-bundle.js";
import { chainChecks, EXPORT_FORMAT } from "../src/core/evidence-seal.js";
import { loadTables, dataLock, radarVersion, ROOT } from "./lib/data.mjs";
import { loadOrMakeKey, DEFAULT_KEY } from "./lib/keys.mjs";
import { readable, verdictLines, chainLines } from "./lib/report.mjs";
import { validate } from "./lib/jsonschema.mjs";
import { runExport } from "./lib/export.mjs";
import { runCaseCommand } from "./lib/case.mjs";
import { TOP_HELP, MEDIA_HELP, SIDECAR_HELP, BOARD_HELP, helpText, friendly } from "./lib/help.mjs";
import { runMedia } from "./lib/media.mjs";
import { cleanCommand, protectCommand, selfAuditCommand, PROTECT_USAGE } from "./lib/protect.mjs";
import { runFetch } from "./lib/media-fetch.mjs";
import { checkSidecars, checkLines } from "./lib/sidecar-check.mjs";
import { makeBoard, renderSpec } from "./lib/board.mjs";

const USAGE = `Usage:
  daylight analyze <file> [--json] [--bundle out.json] [--include-text] [--key path] [--no-claims]
               [--carrier-safe [--page address]]
  daylight verify <bundle.json | evidence-chain.json> [--key-id id] [--json]
  daylight site <domain> [--json]
  daylight media <file> [--json]
  daylight media convert <file> --to <format> [--quality 0-1] [--max-side N] [--max-height N]
               [--bitrate 2M] [--audio-bitrate 96k] [--fps N] [--out file] [--json]
  daylight media compress <file> [the same options]
  daylight media fetch <page address> [--dir folder]       (needs a system yt-dlp)
  daylight sidecar check <folder>                          (flags unproved thread continuations)
  daylight board make <folder> --title <name> [--layout book|grid|timeline|evidence] [--head grotesk|accession|mono] [--pdf]
  daylight export <evidence-chain.json> --profile legal|technical|journalistic|research [--out dir]
               [--reply replies.json] [--corrections corrections.json] [--seed text]
  daylight case <command>   an investigation case folder; "daylight case help" lists the commands
${PROTECT_USAGE}<file> for analyze: a saved page (.html), thread JSON, an X archive tweets.js, a Reddit export
CSV, a Mastodon outbox.json or a Bluesky repository .car. verify checks a signed evidence bundle
or an evidence chain saved from the extension ("Save evidence chain"). Daylight Commons reads local
files only. --carrier-safe signs the bundle with a one-time key that is never saved, keeps only
the day it was made, and leaves out the page address unless you give one with --page; its
signature then proves the bundle is unchanged and says nothing about who made it. export writes a saved evidence chain as a legal dossier, a technical PROV record, a
journalistic write-up or a research dataset, into a new folder; it refuses a chain that fails its
check. "daylight <command> --help" shows one command with an example.
`;
// Version 2 is current; version 1 bundles (items with doesNotProve) still verify against their own schema.
const SCHEMAS = { "urn:radar:evidence:v1": "evidence.v1.json", "urn:radar:evidence:v2": "evidence.v2.json" };
const schemaFor = (doc) => { const f = SCHEMAS[doc && doc.schema] || SCHEMAS["urn:radar:evidence:v2"]; return { file: f, schema: JSON.parse(readFileSync(`${ROOT}/schema/${f}`, "utf8")) }; };

export function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const [k, v] = a.slice(2).split("=");
    out.flags[k] = v !== undefined ? v : ["bundle", "key", "key-id", "profile", "out", "reply", "corrections", "seed", "page", "to", "quality", "max-side", "max-height", "fps", "bitrate", "audio-bitrate", "title", "lane", "keywords", "layout", "head", "site", "since", "until", "case", "dir"].includes(k) ? argv[++i] : true;
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
  const S = schemaFor(bundle), errs = validate(S.schema, bundle);
  v.checks.push({ name: "schema", ok: !errs.length, text: errs.length ? errs.slice(0, 3).join("; ") : `fits schema/${S.file}` });
  v.ok = v.ok && !errs.length;
  print(f.json ? asJson(v) : verdictLines(file, v));
  return v.ok ? 0 : 1;
}

export async function main(argv) {
  if (argv[0] === "case") { const r = await runCaseCommand(argv.slice(1)); print(r.out); return process.exitCode || r.code; }
  if (argv[0] === "protect" && argv[1] && !argv.includes("--help")) { print(protectCommand(argv[1])); return 0; }
  if (argv[0] === "self-audit" && !argv.includes("--help")) { const { _: files, flags } = parseArgs(argv.slice(1)); print(selfAuditCommand(files, flags)); return 0; }
  if (argv[0] === "board" && argv[1] === "render") {
    const { _: [spec], flags } = parseArgs(argv.slice(2));
    if (flags.help || !spec) { print(helpText(BOARD_HELP, "daylight board")); return spec || flags.help ? 0 : 2; }
    print((await renderSpec(spec, flags)).line);
    return 0;
  }
  if (argv[0] === "board" && argv[1] === "make") {
    const { _: [dir], flags } = parseArgs(argv.slice(2));
    if (flags.help || !dir) { print(helpText(BOARD_HELP, "daylight board make")); return dir || flags.help ? 0 : 2; }
    print((await makeBoard(dir, flags)).line);
    return 0;
  }
  if (argv[0] === "sidecar" && argv[1] === "check") {
    const { _: [dir], flags } = parseArgs(argv.slice(2));
    if (flags.help || !dir) { print(helpText(SIDECAR_HELP, "daylight sidecar check")); return dir || flags.help ? 0 : 2; }
    const r = checkSidecars(dir);
    print(flags.json ? asJson(r) : checkLines(r));
    return r.counts.unverified ? 1 : 0;
  }
  if (argv[0] === "media" && argv[1] === "fetch") {
    const { _: [url], flags } = parseArgs(argv.slice(2));
    if (flags.help || !url) { print(helpText(MEDIA_HELP.fetch, "daylight media fetch")); return url || flags.help ? 0 : 2; }
    print(runFetch(url, flags).line);
    return 0;
  }
  if (argv[0] === "media" && (argv[1] === "convert" || argv[1] === "compress")) {
    const { _: [file], flags } = parseArgs(argv.slice(2));
    if (flags.help || !file) { print(helpText(MEDIA_HELP[argv[1]], `daylight media ${argv[1]}`)); return file || flags.help ? 0 : 2; }
    const r = runMedia(argv[1], file, flags);
    print(flags.json ? asJson(r.lineage) : r.line);
    return 0;
  }
  const { _: [cmd, arg], flags } = parseArgs(argv);
  if (cmd && flags.help && TOP_HELP[cmd]) { print(helpText(TOP_HELP[cmd], `daylight ${cmd}`)); return 0; }
  if (!cmd || flags.help || !arg) { print(USAGE); return cmd && !flags.help ? 2 : 0; }
  if (cmd === "analyze") { await analyze(arg, flags); return 0; }
  if (cmd === "verify") return verify(arg, flags);
  if (cmd === "site") { loadTables({ claims: false }); const r = siteInfo(arg); if (!r) throw new Error("No domain given."); print(flags.json ? asJson(r) : readable(r)); return 0; }
  if (cmd === "clean") { print(await cleanCommand(arg, flags)); return 0; }
  if (cmd === "export") { const r = await runExport(arg, flags); print(`Wrote ${r.files.length} files to ${r.out}: ${r.files.join(", ")}.
`); return 0; }
  if (cmd === "media") { const r = await checkMedia(readFileSync(arg)); print(flags.json ? asJson(r) : readable(r)); return 0; }
  print(USAGE);
  return 2;
}

// Run as a program, whatever path led here: macOS's temporary folders sit behind a link
// (/var is /private/var), so the path in argv and this module's own path can differ in spelling only.
const real = (p) => { try { return realpathSync(p); } catch { return p; } };
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { const a = process.argv.slice(2); process.stderr.write(`daylight: ${friendly(e, a[0] === "case" ? (a[1] ? `case ${a[1]}` : "case") : a[0])}\n`); process.exitCode = 1; });
}
