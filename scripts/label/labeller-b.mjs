#!/usr/bin/env node
// Labeller B: an open-weight model of a different family from Claude labels every case blind,
// through Flywheel's local lane (harness/local_agent_cli.py in the Flywheel checkout, Ollama
// backend, temperature 0, fixed seed). The model reads only the page text captured for the case,
// whose hash the case file fixed. It never sees the detector's output or labeller A's labels.
//   node scripts/label/labeller-b.mjs --cases cases.jsonl --captures <dir> --flywheel <checkout>
//     --model qwen3:8b --out labels-B.jsonl
// Each capture is <dir>/<case>.txt. A capture whose hash differs from the case file is refused.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { CAMPAIGN, EVIDENCE, FAMILIES, FORMAT, SEEN, parseRows } from "./format.mjs";
import { sha256 } from "./ledger.mjs";

export const SYSTEM = [
  "You label one public social media launch post for an evaluation. Answer with one JSON object and nothing else.",
  `"campaign": one of ${CAMPAIGN.join(", ")}. paid-disclosed: the post or its quotes carry the platform's paid partnership label.`,
  "paid-undisclosed: only when the capture includes outside evidence that promotion was bought without a label, such as an agency case study, a platform enforcement notice, a court or regulator record, or the company's own statement. Then add \"evidence\" with one of " + EVIDENCE.join(", ") + ".",
  "organic: nothing suggests the attention was bought. unsure: anything else, including a hunch from engagement patterns alone.",
  `"families": an object with keys ${FAMILIES.join(", ")}, each ${SEEN.join(", ")}, for whether that sign is visible in the capture:`,
  "shape (engagement unusual for the account's size), bios (repeated bio templates or stock personas among amplifiers), joins (many amplifiers joined in the same window), topic (amplifiers whose usual topics do not match), quotes (unlabelled quotes sharing a template with labelled ones), overlap (the same amplifiers on other launches).",
  "Do not name or describe any account. Output JSON only.",
].join("\n");

export const PROMPT = "Label the launch post in the attached capture. Reply with the JSON object only.";

// Pull the label out of the model's reply. Returns null when no valid object is found.
export function parseAnswer(text) {
  const m = String(text || "").replace(/<think>[\s\S]*?<\/think>/g, "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let o;
  try { o = JSON.parse(m[0]); } catch { return null; }
  if (!CAMPAIGN.includes(o.campaign)) return null;
  const families = {};
  for (const f of FAMILIES) if (o.families && SEEN.includes(o.families[f])) families[f] = o.families[f];
  const row = { campaign: o.campaign, families };
  if (o.campaign === "paid-undisclosed") {
    if (!EVIDENCE.includes(o.evidence)) return { campaign: "unsure", families };
    row.evidence = o.evidence;
  }
  return row;
}

export function labelRow(caseId, model, answer) {
  const a = answer || { campaign: "unsure", families: {} };
  return { format: FORMAT, kind: "label", case: caseId, labeller: "B", model, ...a };
}

// ask(capturePath) returns the model's reply text. Injected so tests run without a model.
export function labelAll({ cases, captures, model, ask }) {
  const rows = [];
  let unreadable = 0;
  for (const c of cases) {
    const path = join(captures, `${c.case}.txt`);
    if (sha256(readFileSync(path, "utf8")) !== c.capture) throw new Error(`capture for ${c.case} does not match the hash in the case file`);
    const answer = parseAnswer(ask(path));
    if (!answer) unreadable++;
    rows.push(labelRow(c.case, model, answer));
  }
  return { rows, unreadable };
}

function flywheelAsk(flywheel, model) {
  return (path) => {
    const out = execFileSync("python", ["-m", "harness.local_agent_cli", "--backend", "ollama", "--model", model, "--temperature", "0", "--seed", "0", "--max-tokens", "4096", "--num-ctx", "16384", "--json", "--system", SYSTEM, "--file", path, PROMPT], { cwd: flywheel, encoding: "utf8", maxBuffer: 1 << 24 });
    const resp = JSON.parse(out);
    return resp.content && resp.content[0] ? resp.content[0].text : "";
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const o = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) o[argv[i].replace(/^--/, "")] = argv[i + 1];
  try {
    for (const k of ["cases", "captures", "flywheel", "model", "out"]) if (!o[k]) throw new Error(`--${k} is required`);
    const cases = parseRows(readFileSync(o.cases, "utf8"), "case");
    const { rows, unreadable } = labelAll({ cases, captures: o.captures, model: o.model, ask: flywheelAsk(o.flywheel, o.model) });
    writeFileSync(o.out, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    console.log(`labeller B (${o.model}): ${rows.length} cases written to ${o.out}; ${unreadable} replies unreadable and recorded as unsure.`);
  } catch (e) {
    console.error(`labeller-b: ${e.message}`);
    process.exit(1);
  }
}
