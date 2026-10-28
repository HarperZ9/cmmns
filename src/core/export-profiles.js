// The four export profiles (project-docs/EVIDENCE-LAYER.md, "Export profiles"): one evidence chain,
// read four ways. Every profile starts from a saved chain (radar-evidence-chain/1), refuses a chain
// that fails its own check, refuses any receipt that would put post text or a private account's
// handle into the export, and ships the chain itself unchanged so a reader can run `radar verify`.
//
// exportProfile(chain, profile, opts) -> { ok, reason?, profile, files: { name: text } }
//   profile: "legal" | "technical" | "journalistic" | "research"
//   opts: { at, tool, definitions: { "id@version": entry }, replies: [..], corrections: [..], seed }

import { chainChecks, SEAL_DOES_NOT_PROVE } from "./evidence-seal.js";
import { legalFiles, journalisticFiles } from "./export-writeup.js";
import { technicalFiles } from "./export-prov.js";
import { researchFiles } from "./export-research.js";

export const PROFILES = ["legal", "technical", "journalistic", "research"];
export const EXPORT_DOES_NOT_PROVE = "An export shows what this browser recorded, unchanged since. Each fact is as reliable as its source. A definition match compares conduct with published elements; findings belong to courts, regulators and the platform.";
const PSEUDONYM = /^acct-[0-9a-f]{16}$/;
const BUILDERS = { legal: legalFiles, technical: technicalFiles, journalistic: journalisticFiles, research: researchFiles };

// Why a receipt may not leave in an export, or null. Exports hold identifiers, hashes and features
// only (platform terms and authors' copyright), and a private account only as a salted pseudonym.
export function receiptProblem(r, i) {
  if (!r || typeof r !== "object") return `receipt ${i} is missing`;
  if (r.content !== "features") return `receipt ${i} holds content "${r.content}", and exports carry features only`;
  if (r.subjectKind === "private-pseudonym" && !PSEUDONYM.test(String(r.subject || ""))) return `receipt ${i} names a private account without a pseudonym`;
  for (const k of ["text", "postText", "body", "handle"]) if (r.observed && typeof r.observed === "object" && k in r.observed) return `receipt ${i} carries "${k}" in what it observed`;
  return null;
}

// The rows every profile reads: each receipt with its place in the chain and its inclusion proof.
export function chainRows(chain) {
  return chain.seal.entries.map((e, i) => ({ seq: e.seq, link: e.link, prev: e.prev, receipt: e.receipt, proof: chain.proofs[i] }));
}

// The catalogue entries the chain cites, as "id@version" keys, with any entry the caller supplied.
export function citedDefinitions(rows, definitions = {}) {
  const keys = [...new Set(rows.flatMap((r) => [].concat(r.receipt.catalogue || [])).map(String))].sort();
  return keys.map((key) => ({ key, entry: definitions[key] || null }));
}

export async function exportProfile(chain, profile, opts = {}) {
  if (!PROFILES.includes(profile)) return { ok: false, reason: `unknown profile "${profile}"; use one of ${PROFILES.join(", ")}` };
  const check = await chainChecks(chain);
  if (!check.ok) return { ok: false, reason: `the chain fails its own check: ${check.checks.filter((c) => !c.ok).map((c) => c.text).join("; ")}` };
  const rows = chainRows(chain);
  for (let i = 0; i < rows.length; i++) {
    const p = receiptProblem(rows[i].receipt, i);
    if (p) return { ok: false, reason: p };
  }
  const ctx = { chain, check, rows, profile, at: opts.at || new Date().toISOString(), tool: opts.tool || "CMMNS",
    definitions: citedDefinitions(rows, opts.definitions), replies: opts.replies || [], corrections: opts.corrections || [],
    seed: opts.seed || "daylight-export-1", dnp: EXPORT_DOES_NOT_PROVE, sealDnp: SEAL_DOES_NOT_PROVE };
  const files = await BUILDERS[profile](ctx);
  files["evidence-chain.json"] = JSON.stringify(chain, null, 2) + "\n";
  return { ok: true, profile, files };
}

// The steps any reader can run to check the export, shared by every profile.
export function verifySteps() {
  return [
    "Install Node.js 22 or later. The tool runs on Node alone.",
    "Download the CMMNS command line tool (cmmns-cli-<version>.zip) from the project's releases and unpack it.",
    "Run: node bin/radar.mjs verify evidence-chain.json",
    "Every line must read ok: each receipt matches its own hash, each entry follows the one before, the head and the Merkle root match, and each inclusion proof places its receipt under the root.",
    "Any edit, removal, swap or reordering of a receipt makes a line fail.",
  ];
}
