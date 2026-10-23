// The two written export profiles. Legal: numbered exhibits, a chain-of-custody log, the cited
// definitions with their elements, a method statement, limits, and how to run the verifier.
// Journalistic: a write-up with a sourcing note on every claim, the right-of-reply log, archive
// links and corrections. Both are Markdown, so they open anywhere and print; PDF/A is not built.
// Neither profile writes a verdict: tests/export-profiles.test.js keeps the authored wording free of
// the words a court or regulator would use (VERDICT_WORDS in definitions.js).

import { DEFINITION_FRAME, LEGAL_NOTE, CHALLENGE } from "./definitions.js";
import { verifySteps } from "./export-profiles.js";

const cell = (v) => String(v == null ? "" : typeof v === "object" ? JSON.stringify(v) : v).replace(/\|/g, "\\|").replace(/\n/g, " ");
const short = (h) => (h ? String(h).slice(0, 16) : "none");
const observedLine = (o) => (o && typeof o === "object" ? Object.entries(o).map(([k, v]) => `${k}: ${cell(v)}`).join("; ") : cell(o));
const archive = (r) => (r.witness && (r.witness.lookup || r.witness.url)) || null;

function exhibit(row, n) {
  const r = row.receipt;
  return [`### Exhibit ${n}: ${r.kind} about ${r.subject || "no subject"}`, "",
    `- Observed: ${observedLine(r.observed)}`, `- Source: ${r.source}${r.url ? ` (${r.url})` : ""}`, `- Read at: ${r.at}`,
    `- Receipt hash: \`${r.hash}\``, archive(r) ? `- Archive copy: ${archive(r)}` : "- Archive copy: none requested",
    `- Does not prove: ${r.dnp}`, ""];
}

function custody(rows) {
  return ["| Entry | Read at | Method | Adapter | Raw fragment hash | Receipt hash | Link |", "|---|---|---|---|---|---|---|",
    ...rows.map((row) => { const c = row.receipt.capture || {}; return `| ${row.seq} | ${row.receipt.at} | ${cell(c.method)} | ${cell(c.adapter)} | \`${short(c.rawHash)}\` | \`${short(row.receipt.hash)}\` | \`${short(row.link)}\` |`; }), ""];
}

function definitionBlock({ key, entry }) {
  if (!entry) return [`### ${key}`, "", "The chain cites this entry, and it was not supplied to the export. Look it up in the catalogue at that version.", ""];
  const src = (entry.sources || [])[0] || {};
  return [`### ${entry.title} (${key})`, "", `- Jurisdiction: ${entry.jurisdiction && entry.jurisdiction.name}`, `- Instrument: ${entry.instrument}, ${entry.section}`,
    `- Source: ${src.url || "none"}, retrieved ${src.retrieved_at || "unknown"}, SHA-256 \`${short(src.sha256)}\``, "",
    "| Element | What it requires | Observable from |", "|---|---|---|",
    ...(entry.elements || []).map((e) => `| ${cell(e.id)} | ${cell(e.label)} | ${cell(e.observable_from)} |`), "",
    `Does not prove: ${entry.does_not_prove || DEFINITION_FRAME}`, ""];
}

export async function legalFiles(ctx) {
  const { rows, chain } = ctx;
  const L = ["# Evidence dossier", "", `Prepared ${ctx.at} by ${ctx.tool}. ${rows.length} exhibits from one evidence chain.`, "",
    `- Chain root (Merkle, RFC 9162): \`${chain.root}\``, `- Chain head: \`${chain.head}\``, `- Check on export: ${ctx.check.checks.map((c) => c.text).join("; ")}.`, "",
    "## Method", "", "Each exhibit is a receipt this browser recorded when it read a public source or the page the user loaded. A receipt holds what was observed, where, when and how, and a SHA-256 hash over all of it. Receipts are sealed in an append-only chain: each entry carries the hash of the one before, and a Merkle root covers them all, so an edit, removal or reordering of any exhibit is detectable.", "",
    "## Exhibits", "", ...rows.flatMap((row, i) => exhibit(row, i + 1)),
    "## Chain of custody", "", ...custody(rows),
    "## Definitions cited", "", DEFINITION_FRAME, "", ...(ctx.definitions.length ? ctx.definitions.flatMap(definitionBlock) : ["No exhibit cites a catalogue definition.", ""]),
    "## Limits", "", `- ${ctx.sealDnp}`, `- ${ctx.dnp}`, `- ${LEGAL_NOTE}`, "",
    "## How to verify", "", ...verifySteps().map((s, i) => `${i + 1}. ${s}`), "", CHALLENGE, ""];
  return { "DOSSIER.md": L.join("\n") };
}

function replyLog(replies) {
  if (!replies.length) return ["No right-of-reply request is recorded. Ask every named party before publication and record who, when, how and what they said.", ""];
  return ["| Party | Asked | How | Response |", "|---|---|---|---|", ...replies.map((r) => `| ${cell(r.party)} | ${cell(r.asked)} | ${cell(r.channel)} | ${cell(r.response || "no response yet")} |`), ""];
}

export async function journalisticFiles(ctx) {
  const { rows } = ctx;
  const claims = rows.flatMap((row, i) => {
    const r = row.receipt;
    return [`${i + 1}. **${r.kind}**, ${r.subject || "no subject"}: ${observedLine(r.observed)}.`,
      `   Sourcing: ${r.source}${r.url ? `, ${r.url}` : ""}, read ${r.at}; receipt \`${short(r.hash)}\`${archive(r) ? `; archive copy ${archive(r)}` : ""}.`,
      `   Does not prove: ${r.dnp}`];
  });
  const corr = ctx.corrections.length ? ctx.corrections.map((c) => `- ${cell(c.date)}: ${cell(c.text)}`) : ["- None."];
  const L = ["# Write-up", "", `Draft from an evidence chain of ${rows.length} receipts, prepared ${ctx.at} by ${ctx.tool}. Every line below carries its source; add the story around them in your own words.`, "",
    "## What the record shows", "", ...claims, "", "## Right of reply", "", ...replyLog(ctx.replies),
    "## Corrections", "", ...corr, "", "## How a reader can check this", "", ...verifySteps().map((s, i) => `${i + 1}. ${s}`), "",
    "## Does not prove", "", ctx.dnp, "", CHALLENGE, ""];
  return { "WRITE-UP.md": L.join("\n") };
}
