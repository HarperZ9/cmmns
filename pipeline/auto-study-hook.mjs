#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Automated post-download CMMNS -> Gather -> Distill -> Study pipeline hook.
// Pure Node stdlib ESM (zero external dependencies). Strictly scoped to public research
// media, documents, transcripts, papers, and repos (fail-closed refusal on personal
// surveillance, movement tracking, or genetic profiling). Seals SOURCE.txt + SHA256SUMS,
// decomposes claims/citations/equations/metadata, emits a structured Study (.md + .json
// with verified/unverified bounds and SHA-256 receipt), and generates a cross-domain
// routing manifest for BuildLang, Superframe, Flywheel, and Playground.

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  watch,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STUDY_SCHEMA = "cmmns-auto-study/1";
export const ROUTING_SCHEMA = "cmmns-cross-domain-routing/1";

const GENERATED_NAMES = new Set([
  "SOURCE.txt",
  "SHA256SUMS",
  "study.md",
  "study.json",
  "routing_manifest.json",
]);

const TEXT_EXTS = new Set([".md", ".txt", ".json", ".jsonl", ".csv", ".tsv", ".tex", ".bib", ".yml", ".yaml"]);
const AUDIO_EXTS = new Set([".wav", ".mp3", ".ogg", ".flac", ".m4a", ".opus"]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mkv", ".mov"]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"]);

const REFUSED_POLICY_RULES = [
  { reason: "personal_surveillance_refused", re: /\b(personal[-_ ]surveillance|stalkerware|covert[-_ ]tracking|doxxing|private[-_ ]person[-_ ]dossier)\b/i },
  { reason: "movement_tracking_refused", re: /\b(movement[-_ ]tracking|gps[-_ ]stalk|location[-_ ]history[-_ ]dossier|license[-_ ]plate[-_ ]tracker|imsi[-_ ]catcher)\b/i },
  { reason: "genetic_profiling_refused", re: /\b(genetic[-_ ]profiling|dna[-_ ]profiling|private[-_ ]genome[-_ ]dossier|biometric[-_ ]surveillance)\b/i },
];

const LANE_KEYWORDS = {
  buildlang: ["compiler", "mir", "wasm", "superopt", "gpu", "wgsl", "hlsl", "spirv", "glsl", "metal", "fma", "kernel", "avx2", "simd", "buildlang", "zero-c", "verifier"],
  superframe: ["renderer", "shader", "3dgs", "raytracing", "optics", "brdf", "iridescence", "mesh", "gaussian", "vulkan", "graphics", "color", "audio", "dsp", "superframe"],
  flywheel: ["receipt", "provenance", "benchmark", "oracle", "verification", "goodhart", "harness", "eval", "dataset", "rlvr", "audit", "gate", "flywheel", "cmmns"],
  playground: ["browser", "interactive", "canvas", "studio", "ui", "ux", "playground", "webgpu", "html", "drafting", "drop-in", "demo"],
};

function canonicalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== undefined) out[key] = canonicalize(value[key]);
  }
  return out;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256Hex(input) {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input);
  return createHash("sha256").update(buf).digest("hex");
}

export function checkPublicResearchPolicy(meta = {}, corpusText = "") {
  if (meta.personalSurveillance === true) {
    return { ok: false, reason: "personal_surveillance_refused", detail: "Personal surveillance content is refused fail-closed" };
  }
  if (meta.movementTracking === true) {
    return { ok: false, reason: "movement_tracking_refused", detail: "Movement tracking content is refused fail-closed" };
  }
  if (meta.geneticProfiling === true) {
    return { ok: false, reason: "genetic_profiling_refused", detail: "Genetic profiling content is refused fail-closed" };
  }
  const combined = `${meta.title || ""} ${meta.sourceUrl || ""} ${meta.tags || ""} ${corpusText}`;
  for (const rule of REFUSED_POLICY_RULES) {
    if (rule.re.test(combined)) {
      return { ok: false, reason: rule.reason, detail: `Matched prohibited policy pattern (${rule.reason})` };
    }
  }
  return { ok: true, reason: "public_research_allowed" };
}

function collectBundleFiles(rootDir) {
  const results = [];
  function walk(dir) {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of entries) {
      if (ent.name === ".git" || ent.name === "node_modules") continue;
      const full = path.join(dir, ent.name);
      const rel = path.relative(rootDir, full).split(path.sep).join("/");
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.isFile() && !GENERATED_NAMES.has(rel)) {
        results.push({ rel, full });
      }
    }
  }
  walk(rootDir);
  return results;
}

function classifyMediaKind(ext) {
  if (TEXT_EXTS.has(ext)) return "text";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (VIDEO_EXTS.has(ext)) return "video";
  if (IMAGE_EXTS.has(ext)) return "image";
  return "binary";
}

export function sealBundle(bundleDir, meta = {}) {
  const files = collectBundleFiles(bundleDir);
  const hashed = [];
  for (const f of files) {
    const raw = readFileSync(f.full);
    const ext = path.extname(f.rel).toLowerCase();
    hashed.push({
      rel: f.rel,
      bytes: raw.length,
      sha256: sha256Hex(raw),
      kind: classifyMediaKind(ext),
      ext,
    });
  }

  const sumsLines = hashed.map((h) => `${h.sha256}  ${h.rel}`);
  const sumsText = `${sumsLines.join("\n")}${sumsLines.length ? "\n" : ""}`;
  writeFileSync(path.join(bundleDir, "SHA256SUMS"), sumsText, "utf8");

  const intakeIso = meta.intakeIso || "2026-11-27T00:00:00Z";
  const sourceLines = [
    `schema: cmmns-bundle-source/1`,
    `title: ${String(meta.title || path.basename(bundleDir))}`,
    `source_url: ${String(meta.sourceUrl || "public-local-bundle")}`,
    `license: ${String(meta.license || "public-research")}`,
    `intake_utc: ${intakeIso}`,
    `policy: public_research_only`,
    `file_count: ${hashed.length}`,
    `sha256sums_digest: ${sha256Hex(sumsText)}`,
  ];
  const sourceText = `${sourceLines.join("\n")}\n`;
  writeFileSync(path.join(bundleDir, "SOURCE.txt"), sourceText, "utf8");

  return {
    files: hashed,
    sha256sums_digest: sha256Hex(sumsText),
    source_txt_digest: sha256Hex(sourceText),
  };
}

export function verifyBundleSeals(bundleDir) {
  const sumsPath = path.join(bundleDir, "SHA256SUMS");
  const sourcePath = path.join(bundleDir, "SOURCE.txt");
  if (!existsSync(sumsPath)) return { ok: false, reason: "missing_sha256sums" };
  if (!existsSync(sourcePath)) return { ok: false, reason: "missing_source_txt" };

  const sumsRaw = readFileSync(sumsPath, "utf8");
  const lines = sumsRaw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const checked = [];
  for (const line of lines) {
    const m = line.match(/^([0-9a-f]{64})  (.+)$/);
    if (!m) return { ok: false, reason: "malformed_sha256sums_line", line };
    const [, expectedSha, rel] = m;
    const full = path.join(bundleDir, rel);
    if (!existsSync(full) || !statSync(full).isFile()) {
      return { ok: false, reason: "missing_sealed_file", file: rel };
    }
    const actualSha = sha256Hex(readFileSync(full));
    if (actualSha !== expectedSha) {
      return { ok: false, reason: "sha256_mismatch", file: rel, expected: expectedSha, actual: actualSha };
    }
    checked.push({ rel, sha256: actualSha });
  }
  return { ok: true, checked_count: checked.length, files: checked };
}

export function decomposeBundle(bundleDir, sealedFiles) {
  const claims = [];
  const citations = new Set();
  const equations = [];
  const mediaInventory = [];
  let corpusText = "";

  for (const f of sealedFiles) {
    const full = path.join(bundleDir, f.rel);
    const meta = { rel: f.rel, kind: f.kind, ext: f.ext, bytes: f.bytes, sha256: f.sha256 };
    if (f.kind === "text") {
      const text = readFileSync(full, "utf8");
      corpusText += `\n${text}`;
      const lines = text.split(/\r?\n/);
      meta.lines = lines.length;
      meta.words = text.trim() ? text.trim().split(/\s+/).length : 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        for (const m of line.matchAll(/arXiv:\d{4}\.\d{4,5}(?:v\d+)?/gi)) citations.add(m[0]);
        for (const m of line.matchAll(/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/g)) citations.add(`doi:${m[0]}`);
        for (const m of line.matchAll(/https?:\/\/[^\s)>\]"']+/g)) citations.add(m[0]);
        for (const m of line.matchAll(/\bgithub\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/gi)) citations.add(`https://${m[0]}`);

        for (const m of line.matchAll(/\$\$([^$]+)\$\$|\$([^$\n]{3,120})\$/g)) {
          equations.push({ file: f.rel, line: i + 1, expr: (m[1] || m[2]).trim() });
        }
        if (/^[A-Za-z][A-Za-z0-9_()]+\s*=\s*[^=]{3,120}$/.test(line) && !line.startsWith("http")) {
          equations.push({ file: f.rel, line: i + 1, expr: line });
        }

        const isClaimLine = /^[-*]?\s*(claim|finding|result|benchmark|theorem|lemma|observation):/i.test(line)
          || (/\b(\d+(?:\.\d+)?x|\d+(?:\.\d+)?%|\d+\/\d+)\b/.test(line) && line.length >= 24 && line.length <= 240 && !line.startsWith("#"));
        if (isClaimLine && claims.length < 64) {
          claims.push({ file: f.rel, line: i + 1, text: line.replace(/^[-*]\s*/, "") });
        }
      }
    }
    mediaInventory.push(meta);
  }

  return {
    claims,
    citations: Array.from(citations).sort(),
    equations,
    media_inventory: mediaInventory,
    corpusText,
  };
}

export function buildRoutingManifest(title, decomposition, studySha256) {
  const lower = `${title} ${decomposition.corpusText}`.toLowerCase();
  const lanes = {};
  const matchedLanes = [];
  for (const [lane, words] of Object.entries(LANE_KEYWORDS)) {
    const hits = words.filter((w) => lower.includes(w));
    lanes[lane] = { score: hits.length, matched_keywords: hits };
    if (hits.length > 0) matchedLanes.push(lane);
  }
  const primaryLane = Object.entries(lanes).sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0]))[0][0];
  const payload = {
    schema: ROUTING_SCHEMA,
    title,
    study_receipt_sha256: studySha256,
    primary_lane: primaryLane,
    active_lanes: matchedLanes.sort(),
    lanes,
    citation_count: decomposition.citations.length,
    claim_count: decomposition.claims.length,
    equation_count: decomposition.equations.length,
  };
  return { ...payload, routing_sha256: sha256Hex(canonicalJson(payload)) };
}

export function verifyStudyReceipt(studyObj) {
  if (!studyObj || typeof studyObj !== "object" || typeof studyObj.receipt_sha256 !== "string") {
    return { ok: false, reason: "malformed_study" };
  }
  const { receipt_sha256, ...payload } = studyObj;
  if (payload.schema !== STUDY_SCHEMA) return { ok: false, reason: "invalid_schema" };
  const expected = sha256Hex(canonicalJson(payload));
  if (expected !== receipt_sha256) {
    return { ok: false, reason: "study_digest_mismatch", expected, actual: receipt_sha256 };
  }
  return { ok: true, receipt_sha256: expected };
}

export function processBundle(bundleDir, options = {}) {
  const outDir = options.outDir || bundleDir;
  const meta = {
    title: options.title || path.basename(bundleDir),
    sourceUrl: options.sourceUrl || "public-local-bundle",
    license: options.license || "public-research",
    intakeIso: options.intakeIso || "2026-11-27T00:00:00Z",
    personalSurveillance: options.personalSurveillance === true,
    movementTracking: options.movementTracking === true,
    geneticProfiling: options.geneticProfiling === true,
  };

  // Pre-scan files for policy compliance before sealing
  const rawFiles = collectBundleFiles(bundleDir).map((f) => ({
    rel: f.rel,
    bytes: statSync(f.full).size,
    sha256: sha256Hex(readFileSync(f.full)),
    kind: classifyMediaKind(path.extname(f.rel).toLowerCase()),
    ext: path.extname(f.rel).toLowerCase(),
  }));
  const preDecomp = decomposeBundle(bundleDir, rawFiles);
  const policy = checkPublicResearchPolicy(meta, preDecomp.corpusText);
  if (!policy.ok) {
    return { ok: false, verdict: "REFUSE", reason: policy.reason, detail: policy.detail };
  }

  const seal = sealBundle(bundleDir, meta);
  const sealCheck = verifyBundleSeals(bundleDir);
  if (!sealCheck.ok) {
    return { ok: false, verdict: "REFUSE", reason: sealCheck.reason };
  }

  const studyPayload = {
    schema: STUDY_SCHEMA,
    title: meta.title,
    source_url: meta.sourceUrl,
    license: meta.license,
    intake_utc: meta.intakeIso,
    policy: "public_research_only",
    seal: {
      file_count: seal.files.length,
      sha256sums_digest: seal.sha256sums_digest,
      source_txt_digest: seal.source_txt_digest,
    },
    bounds: {
      verified: {
        description: "Cryptographically hashed local bundle files and verbatim extracted claims, citations, equations, and media metadata.",
        sealed_files: seal.files.length,
        claims_extracted: preDecomp.claims.length,
        equations_extracted: preDecomp.equations.length,
      },
      unverified: {
        description: "External URLs, arXiv/DOI citations, and third-party performance numbers not independently re-executed by this intake hook.",
        external_citations: preDecomp.citations,
      },
    },
    media_inventory: preDecomp.media_inventory,
    claims: preDecomp.claims,
    citations: preDecomp.citations,
    equations: preDecomp.equations,
  };

  const receipt_sha256 = sha256Hex(canonicalJson(studyPayload));
  const study = { ...studyPayload, receipt_sha256 };
  const routing = buildRoutingManifest(meta.title, preDecomp, receipt_sha256);

  const mdLines = [
    `# Study: ${meta.title}`,
    ``,
    `- **Schema:** \`${STUDY_SCHEMA}\``,
    `- **Source:** \`${meta.sourceUrl}\``,
    `- **License:** \`${meta.license}\``,
    `- **Intake UTC:** \`${meta.intakeIso}\``,
    `- **Receipt SHA-256:** \`${receipt_sha256}\``,
    `- **Primary Route:** \`${routing.primary_lane}\` (active lanes: ${routing.active_lanes.join(", ") || "none"})`,
    ``,
    `## Verified Bounds`,
    ``,
    `- Sealed files: \`${seal.files.length}\` (\`SHA256SUMS\` digest \`${seal.sha256sums_digest.slice(0, 16)}...\`)`,
    `- Claims extracted verbatim: \`${preDecomp.claims.length}\``,
    `- Equations extracted verbatim: \`${preDecomp.equations.length}\``,
    ``,
    `## Unverified Bounds`,
    ``,
    `- External citations and URLs (\`${preDecomp.citations.length}\`) are recorded verbatim and remain unverified until independently fetched or reproduced.`,
    ``,
    `## Extracted Claims`,
    ``,
    ...(preDecomp.claims.length
      ? preDecomp.claims.map((c) => `- \`${c.file}:${c.line}\`: ${c.text}`)
      : [`- None extracted.`]),
    ``,
    `## Citations`,
    ``,
    ...(preDecomp.citations.length
      ? preDecomp.citations.map((c) => `- ${c}`)
      : [`- None extracted.`]),
    ``,
    `## Equations`,
    ``,
    ...(preDecomp.equations.length
      ? preDecomp.equations.map((e) => `- \`${e.file}:${e.line}\`: \`${e.expr}\``)
      : [`- None extracted.`]),
    ``,
  ];

  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "study.json"), `${JSON.stringify(study, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outDir, "study.md"), mdLines.join("\n"), "utf8");
  writeFileSync(path.join(outDir, "routing_manifest.json"), `${JSON.stringify(routing, null, 2)}\n`, "utf8");

  return { ok: true, verdict: "SEALED", study, routing, seal };
}

export function watchIntakeDir(rootDir, options = {}) {
  const processed = new Set();
  const onResult = typeof options.onResult === "function" ? options.onResult : () => {};
  const watcher = watch(rootDir, { persistent: false }, (_event, filename) => {
    if (!filename) return;
    const candidate = path.join(rootDir, filename);
    if (processed.has(candidate)) return;
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      processed.add(candidate);
      onResult(candidate, processBundle(candidate, options));
    }
  });
  return { close: () => watcher.close() };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: node pipeline/auto-study-hook.mjs <bundleDir>");
    process.exit(2);
  }
  const res = processBundle(path.resolve(target));
  console.log(JSON.stringify({ ok: res.ok, verdict: res.verdict, reason: res.reason, receipt_sha256: res.study?.receipt_sha256, primary_lane: res.routing?.primary_lane }, null, 2));
  if (!res.ok) process.exit(1);
}
