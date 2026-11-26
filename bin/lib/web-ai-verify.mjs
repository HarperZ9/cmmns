// Offline CLI runner for `cmmns provenance verify <dir> [--origin <url>] [--json]`.
// Reads local .well-known/agent-card.json, llms.txt, index.html, and any linked engine-receipt/1
// JSON files from <dir> (zero network I/O) and runs verifyWebAiProvenance fail-closed.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ENGINE_RECEIPT_SCHEMA } from "../../src/core/sidecar-receipt.js";
import { verifyWebAiProvenance } from "../../src/core/web-ai-provenance.js";

function readIf(p) {
  return existsSync(p) && statSync(p).isFile() ? readFileSync(p, "utf8") : "";
}

function collectReceiptFiles(dir) {
  const out = [];
  const scan = (d) => {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "receipts" || entry.name === ".well-known") scan(full);
        continue;
      }
      if (!entry.name.endsWith(".json") || entry.name === "agent-card.json") continue;
      try {
        const parsed = JSON.parse(readFileSync(full, "utf8"));
        if (parsed && parsed.schema === ENGINE_RECEIPT_SCHEMA) {
          out.push({ name: relative(dir, full).replace(/\\/g, "/"), receipt: parsed });
        }
      } catch { /* non-receipt JSON ignored unless explicitly named .receipt.json */
        if (entry.name.endsWith(".receipt.json")) {
          out.push({ name: relative(dir, full).replace(/\\/g, "/"), receipt: readFileSync(full, "utf8") });
        }
      }
    }
  };
  scan(dir);
  return out;
}

function loadArtifactMap(dir, receipts) {
  const files = new Map();
  for (const r of receipts) {
    const arts = r && r.receipt && r.receipt.subject && r.receipt.subject.artifacts;
    if (!Array.isArray(arts)) continue;
    for (const a of arts) {
      if (!a || !a.rel_path || files.has(a.rel_path)) continue;
      const full = join(dir, a.rel_path);
      if (existsSync(full) && statSync(full).isFile()) files.set(a.rel_path, readFileSync(full));
    }
  }
  return files;
}

export async function verifyProvenanceDir(dir, { origin = null, hmacKey = null } = {}) {
  const cardPath = existsSync(join(dir, ".well-known", "agent-card.json"))
    ? join(dir, ".well-known", "agent-card.json")
    : join(dir, "agent-card.json");
  const agentCard = existsSync(cardPath) ? readFileSync(cardPath, "utf8") : null;
  const llmsTxt = readIf(join(dir, "llms.txt"));
  const html = readIf(join(dir, "index.html"));
  const receipts = collectReceiptFiles(dir);
  const files = loadArtifactMap(dir, receipts);
  return verifyWebAiProvenance({ origin, html, agentCard, llmsTxt, receipts, files, hmacKey });
}

export function provenanceLines(dir, r) {
  const out = [`${dir} (${r.schema}): ${r.verdict} (json-ld=${r.summary.json_ld_nodes}, llms-links=${r.summary.llms_links}, receipts=${r.summary.receipts_checked}, findings=${r.summary.findings})`];
  for (const f of r.findings || []) out.push(`  fail  [${f.kind}] ${f.surface}: ${f.detail}`);
  return out.join("\n") + "\n";
}
