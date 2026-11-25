// Bundle src/core/*.js into src/ext/core.bundle.js for the content scripts, and src/ocr/*.js into
// src/ext/ocr.bundle.js for the background worker only. MV3 content scripts and service workers
// cannot import ES modules, so each file becomes a function scope that returns its exports,
// imports become reads from the modules built before it, and everything lands on one global
// (PB for core, PBOCR for the text recogniser).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORDER = ["precision.js", "places.js", "confusables-data.js", "confusables.js", "lookalike-outlets.js", "lookalike.js", "brands.js", "similarity.js", "mismatch.js", "reddit.js", "pattern.js", "flags.js", "lexicon.js", "rhetoric-util.js", "lexicon-fr.js", "rhetoric-fr.js", "lexicon-es.js", "rhetoric-es.js", "lexicon-de.js", "rhetoric-de.js", "lexicon-pt.js", "rhetoric-pt.js", "lexicon-it.js", "rhetoric-it.js", "rhetoric-mention.js", "lexicon-ar.js", "rhetoric-ar.js", "lexicon-ru.js", "rhetoric-ru.js", "lexicon-uk.js", "rhetoric-uk.js", "lexicon-zh.js", "rhetoric-zh.js", "lexicon-hi.js", "rhetoric-hi.js", "lexicon-derived.js", "rhetoric-derived.js", "theories-coercion.js", "theories.js", "rhetoric-groups.js", "rhetoric.js", "measured.js", "measured-langs.js", "persuasion-cues.js", "persuasion.js", "reading-lists.js", "reading-pressure.js", "reading-cues.js", "reading-weights.js", "reading-inflection.js", "reading-measured.js", "reading.js", "framing.js", "report.js", "about.js", "meta.js", "bsky.js", "fedi.js", "owners.js", "xdata.js", "machine.js", "threadkey.js", "network.js", "ytdata.js", "timing.js", "reply-timeline.js", "thread-save.js", "baselines-bins.js", "baselines-data.js", "techniques-data.js", "baselines.js", "pace.js", "langs.js", "state.js", "ops.js", "backing.js", "cloned.js", "trail.js", "crosslang.js", "flooding.js", "swarming.js", "campaign-baselines-data.js", "campaign-text.js", "campaign-shape.js", "campaign-sample.js", "campaign-quotes.js", "campaign-overlap.js", "campaign-platforms.js", "campaign.js", "receipt.js", "evidence-github.js", "evidence-domain.js", "evidence-ads.js", "evidence-ledger.js", "evidence-fetch.js", "evidence-seal.js", "chain.js", "history.js", "claims.js", "cbor.js", "jumbf.js", "der.js", "aimeta.js", "c2pa-verify.js", "c2pa.js", "c2pa-pki.js", "c2pa-revocation.js", "c2pa-weaknesses.js", "c2pa-badge.js", "c2pa-report.js", "mediacheck.js", "survival.js", "keyframes.js", "graph.js", "feed.js", "sig.js", "evidence.js", "hosts.js", "packs.js", "packs-content.js", "pack-keys.js", "sites.js", "outlets.js", "feeds.js", "feedfetch.js", "coverage.js", "health.js", "generic.js", "media-bytes.js", "media-webm.js", "media-ogg.js", "media-mp4-boxes.js", "media-mp4.js", "media-gif-lzw.js", "media-gif.js", "media-read.js", "media-xml.js", "media-hls.js", "media-dash.js", "media-protect.js", "media-collect.js", "media-name.js", "media-pick.js", "media-gif-encode.js", "media-demux.js", "media-assemble.js", "capture-thread.js", "url-clean.js", "video-transcript.js", "video-bundle.js", "instagram-data.js", "page-capture.js", "media-meta.js", "sidecar-receipt.js", "engagement-series.js", "library.js", "likes.js", "media-embed.js", "media-card.js", "media-thread.js", "claim-checks.js", "capture.js", "discourse/sheets.js", "board.js", "board-html.js", "clean-util.js", "clean-icc.js", "clean-image.js", "clean-av.js", "clean-pdf.js", "clean-zip.js", "clean.js", "adblock.js"];
// Product modules (settings, badge families) come last; they read only measured.js and persuasion.js.
const PRODUCT = ["catalogue-data.js", "catalogue-links.js", "definitions.js", "settings.js", "families.js", "feedback.js", "claims-parts.js", "learn.js", "imagetext.js"];
// The integration surface (radar-core, src/core/api.js) and its importers and bundles: they read the
// modules above and nothing reads them, so they come after everything else.
const INTEGRATION = ["api-words.js", "api-data.js", "api-site.js", "api-post.js", "api-thread.js", "api-media.js", "api.js", "bundle-verify.js", "evidence-bundle.js", "signing.js", "head.js", "import-html.js", "import-exports.js", "import-json.js", "import-car.js", "imports.js", "self-audit.js"];
// The discourse checks (src/core/discourse/, project-docs/DISCOURSE.md): their own bundle and global
// (PBD), loaded by the content scripts and the background worker after core.bundle.js.
const DISCOURSE = ["text.js", "quotes.js", "persona.js", "stats.js", "docclaim.js", "corrections.js", "argument-measured.js", "cards.js", "sheets.js", "parts.js", "argument-cues.js", "argument.js", "labels-data.js", "labels.js", "claimtype.js", "isomer.js"];
const OCR = ["charset.js", "image.js", "binarize.js", "components.js", "segment.js", "gemm-wasm.js", "gemm.js", "model.js", "weights.js", "read.js"];
const ident = (f) => "M_" + f.replace(/\.js$/, "").replace(/[-/]/g, "_");
const lf = (s) => s.replace(/\r\n/g, "\n");
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

export const BUNDLES = [
  { dir: "src/core", files: [...ORDER, ...PRODUCT, ...INTEGRATION], global: "PB", out: "src/ext/core.bundle.js" },
  { dir: "src/ocr", files: OCR, global: "PBOCR", out: "src/ext/ocr.bundle.js" },
  { dir: "src/core/discourse", files: DISCOURSE, global: "PBD", out: "src/ext/discourse.bundle.js" },
];

export function renderBundle({ dir, files, global }, base = root) {
  let body = "";
  const all = [];
  for (const f of files) {
    let src = lf(readFileSync(join(base, dir, f), "utf8"));
    // A module in a subfolder of the same tree ("./discourse/sheets.js") is listed by that path.
    src = src.replace(/^import \{([^}]*)\} from "\.\/([\w/-]+\.js)";$/gm, (_, names, dep) => `const {${names}} = ${ident(dep)};`);
    src = src.replace(/^import \* as (\w+) from "\.\/([\w-]+\.js)";$/gm, (_, name, dep) => `const ${name} = ${ident(dep)};`);
    // A re-export ("export { a, b };") names functions already on the global, so it is dropped.
    src = src.replace(/^export {[^}]*};$/gm, "");
    const exported = [];
    src = src.replace(/^export (const|async function|function|let|class) ([A-Za-z_$][\w$]*)/gm, (_, kind, name) => { exported.push(name); return `${kind} ${name}`; });
    body += `\n// ---- ${f}\nconst ${ident(f)} = (() => {\n${src}\nreturn { ${exported.join(", ")} };\n})();\n`;
    all.push(`...${ident(f)}`);
  }
  return `// Generated by scripts/build.mjs from ${dir}. Do not edit.\n(() => {\n"use strict";\n${body}\nglobalThis.${global} = Object.freeze({ ${all.join(", ")} });\n})();\n`;
}

export function checkBundles(base = root) {
  const results = BUNDLES.map((spec) => {
    const fresh = renderBundle(spec, base);
    const outPath = join(base, spec.out);
    const current = existsSync(outPath) ? lf(readFileSync(outPath, "utf8")) : null;
    const expectedSha = sha(fresh), actualSha = current === null ? null : sha(current);
    return { out: spec.out, ok: current !== null && fresh === current, expectedSha, actualSha, bytes: fresh.length };
  });
  return { ok: results.every((r) => r.ok), results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--check")) {
    const r = checkBundles(root);
    for (const b of r.results) {
      console.log(`${b.ok ? "ok" : "DRIFT"}  ${b.out}  sha256:${b.expectedSha.slice(0, 16)} (${b.bytes} bytes)${b.ok ? "" : ` != ${b.actualSha ? b.actualSha.slice(0, 16) : "missing"}`}`);
    }
    if (!r.ok) { console.error("Bundle drift detected. Run `npm run build` and commit the updated bundles."); process.exit(1); }
  } else {
    for (const spec of BUNDLES) {
      const text = renderBundle(spec, root);
      writeFileSync(join(root, spec.out), text);
      console.log(`${spec.out}: ${text.length} bytes`);
    }
  }
}
