#!/usr/bin/env node
// The labelling ledger: an append-only, hash-chained record of when each file of a labelling run
// was fixed. It holds hashes and row counts only, so it can be committed and pushed after every
// step; the push time is then an outside witness to the order.
//   node scripts/label/ledger.mjs record <ledger.jsonl> <event> <file>
// Events, in the only order the ledger accepts:
//   cases                the case set, fixed before any labelling (the manifest hash)
//   labels-A, labels-B   each labeller's file, hashed before any detector output is joined
//   resolution           Claude's resolution of every A and B disagreement, before the detector
//   lens                 the detector's output, joined last
import { createHash } from "node:crypto";
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const LEDGER = "dc-label-ledger/1";
export const EVENTS = ["cases", "labels-A", "labels-B", "resolution", "lens"];
const NEEDS = {
  cases: [],
  "labels-A": ["cases"],
  "labels-B": ["cases"],
  resolution: ["labels-A", "labels-B"],
  lens: ["labels-A", "labels-B", "resolution"],
};

export const sha256 = (text) => createHash("sha256").update(String(text).replace(/\r\n/g, "\n")).digest("hex");
const rowCount = (text) => String(text).split(/\r?\n/).filter((l) => l.trim()).length;

// Parse and verify the chain. Returns the entries; throws on a broken link or a bad order.
export function readLedger(text) {
  const entries = [];
  let prev = null;
  String(text).split(/\r?\n/).filter((l) => l.trim()).forEach((raw, i) => {
    const e = JSON.parse(raw);
    if (e.format !== LEDGER) throw new Error(`ledger line ${i + 1}: format must be ${LEDGER}`);
    if (e.seq !== i + 1) throw new Error(`ledger line ${i + 1}: seq ${e.seq} out of order`);
    if (e.prev !== prev) throw new Error(`ledger line ${i + 1}: the chain is broken (prev does not match the line before)`);
    if (!EVENTS.includes(e.event)) throw new Error(`ledger line ${i + 1}: unknown event ${e.event}`);
    checkOrder(entries, e.event, `ledger line ${i + 1}`);
    entries.push(e);
    prev = sha256(raw);
  });
  return { entries, head: prev };
}

function checkOrder(entries, event, where) {
  const done = new Set(entries.map((e) => e.event));
  if (done.has(event)) throw new Error(`${where}: ${event} is already recorded; a changed file needs a new run`);
  for (const n of NEEDS[event]) if (!done.has(n)) throw new Error(`${where}: ${event} cannot be recorded before ${n}`);
  if (event !== "lens" && done.has("lens")) throw new Error(`${where}: ${event} cannot be recorded after the detector output was joined`);
}

// The entry `record` would append, without writing it.
export function entryFor(ledgerText, event, fileText, at = new Date().toISOString()) {
  const { entries, head } = readLedger(ledgerText);
  if (!EVENTS.includes(event)) throw new Error(`event must be one of ${EVENTS.join(", ")}`);
  checkOrder(entries, event, "record");
  return { format: LEDGER, seq: entries.length + 1, event, sha256: sha256(fileText), rows: rowCount(fileText), at, prev: head };
}

// Check that each file passed to scoring is the one the ledger recorded. files: { event: text }.
export function verifyFiles(ledgerText, files) {
  const { entries } = readLedger(ledgerText);
  const byEvent = new Map(entries.map((e) => [e.event, e]));
  for (const ev of EVENTS) {
    const e = byEvent.get(ev);
    if (!e) throw new Error(`the ledger has no ${ev} entry; scoring needs every step recorded in order`);
    if (files[ev] === undefined) throw new Error(`no ${ev} file was given to check against the ledger`);
    if (sha256(files[ev]) !== e.sha256) throw new Error(`the ${ev} file does not match the hash recorded at ledger line ${e.seq}; it changed after it was fixed`);
  }
  return entries;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const [cmd, ledger, event, file] = process.argv.slice(2);
  try {
    if (cmd !== "record" || !ledger || !event || !file) throw new Error("usage: node scripts/label/ledger.mjs record <ledger.jsonl> <event> <file>");
    const e = entryFor(existsSync(ledger) ? readFileSync(ledger, "utf8") : "", event, readFileSync(file, "utf8"));
    appendFileSync(ledger, JSON.stringify(e) + "\n");
    console.log(`recorded ${event}: ${e.rows} rows, sha256 ${e.sha256}, ledger line ${e.seq}. Commit and push the ledger now.`);
  } catch (err) {
    console.error(`ledger: ${err.message}`);
    process.exit(1);
  }
}
