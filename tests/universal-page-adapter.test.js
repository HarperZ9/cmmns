// Tests for the universal site-agnostic page adapter (src/core/page-capture.js + src/ext/page-capture.js):
// HTML metadata, OpenGraph, Twitter Card, academic citation_*, Schema.org JSON-LD (Dataset/VideoObject/
// SoftwareSourceCode), RSS/Atom feed discovery, safe read-only JSON data islands (#__NEXT_DATA__),
// structured headings/tables/code blocks, document/research links, and collision-free manifest-*.jsonl export.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import {
  pageMetadata, pagePicks, pageRaw, pageLines, pageManifestLine,
  extractDataIslands, normalizeFeeds, extractDocumentLinks,
} from "../src/core/page-capture.js";
import { parseManifest, MANIFEST_FILE_RE } from "../src/core/likes.js";
import { postMeta, sidecarMarkdown } from "../src/core/media-meta.js";

const root = join(import.meta.dirname, "..");

test("extractDataIslands safely parses #__NEXT_DATA__ and application/json without executing scripts", () => {
  const nextData = JSON.stringify({
    props: {
      pageProps: {
        article: {
          headline: "Coastal Aquifer Recharge Modeling",
          description: "Open telemetry across 14 basins.",
          author: { name: "Dr. M. Vega" },
          publishedAt: "2026-09-14T08:00:00Z",
          canonicalUrl: "https://hydro.example.org/aquifer-2026",
          heroImage: "https://cdn.hydro.example.org/fig1.png",
          datasetPdf: "https://cdn.hydro.example.org/report.pdf",
        },
      },
    },
  });
  const islands = extractDataIslands([
    { id: "__NEXT_DATA__", text: nextData },
    { id: "broken", text: "window.hacked = true;" },
  ]);
  assert.equal(islands.length, 1, "non-JSON script text is ignored safely");
  assert.equal(islands[0].title, "Coastal Aquifer Recharge Modeling");
  assert.equal(islands[0].author, "Dr. M. Vega");
  assert.equal(islands[0].published, "2026-09-14T08:00:00Z");
  assert.equal(islands[0].url, "https://hydro.example.org/aquifer-2026");
  assert.deepEqual(islands[0].mediaUrls.sort(), [
    "https://cdn.hydro.example.org/fig1.png",
    "https://cdn.hydro.example.org/report.pdf",
  ]);
});

test("universal adapter extracts Dataset/SoftwareSourceCode JSON-LD, RSS/Atom feeds, and research links", () => {
  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Dataset",
        name: "Global Soil Moisture 2026",
        creator: { "@type": "Person", name: "S. Patel" },
        datePublished: "2026-10-01",
        identifier: "10.5281/zenodo.999999",
        distribution: [{ "@type": "DataDownload", contentUrl: "https://data.example.org/soil-2026.csv" }],
      },
      {
        "@type": "SoftwareSourceCode",
        name: "soil-pipeline",
        codeRepository: "https://github.com/open-earth/soil-pipeline",
      },
    ],
  });
  const summary = {
    url: "https://science.example.org/datasets/soil-2026",
    host: "science.example.org",
    title: "Global Soil Moisture 2026",
    text: "Daily measurements across 400 stations.",
    textFrom: "main",
    metas: [
      { key: "og:title", content: "Global Soil Moisture 2026" },
      { key: "twitter:description", content: "Open CSV and pipeline release." },
      { key: "citation_doi", content: "10.5281/zenodo.999999" },
    ],
    jsonld: [ld],
    feeds: [
      { href: "https://science.example.org/feed.xml", type: "application/rss+xml", title: "Science RSS" },
      { href: "https://science.example.org/atom.xml", type: "application/atom+xml", title: "Science Atom" },
      { href: "javascript:alert(1)", type: "application/rss+xml" },
    ],
    links: [
      "https://arxiv.org/abs/2610.12345",
      "https://doi.org/10.5281/zenodo.999999",
      "https://github.com/open-earth/soil-pipeline",
      "https://science.example.org/about",
    ],
    media: [{ kind: "file", url: "https://data.example.org/soil-2026.csv" }],
    structure: {
      headings: [{ level: 1, text: "Global Soil Moisture 2026" }],
      codeBlocks: [{ lang: "python", text: "import csv" }],
      tables: [{ headers: ["Station", "Depth"], rows: [["A1", "10cm"]] }],
    },
  };

  const meta = pageMetadata(summary);
  assert.equal(meta.feeds.length, 2, "only valid http(s) RSS/Atom feeds kept");
  assert.equal(meta.jsonLd[0].type, "Dataset");
  assert.equal(meta.jsonLd[0].identifier, "10.5281/zenodo.999999");
  assert.equal(meta.jsonLd[1].codeRepository, "https://github.com/open-earth/soil-pipeline");

  const picks = pagePicks(meta);
  assert.equal(picks.title, "Global Soil Moisture 2026");
  assert.equal(picks.author, "S. Patel");
  assert.equal(picks.published, "2026-10-01");

  const raw = pageRaw(summary);
  assert.ok(raw.page.documents.includes("https://arxiv.org/abs/2610.12345"));
  assert.ok(raw.page.documents.includes("https://github.com/open-earth/soil-pipeline"));
  assert.ok(raw.page.documents.includes("https://doi.org/10.5281/zenodo.999999"));
  assert.ok(raw.page.documents.includes("https://data.example.org/soil-2026.csv"));
  assert.equal(raw.page.structure.tables[0].rows[0][0], "A1");

  const md = sidecarMarkdown(postMeta(raw, "2026-11-26T10:00:00Z"), []);
  assert.match(md, /Feed \(application\/rss\+xml\): Science RSS: https:\/\/science\.example\.org\/feed\.xml/);
  assert.match(md, /Document link: https:\/\/arxiv\.org\/abs\/2610\.12345/);

  // Interoperable manifest-*.jsonl round-trip
  const line = pageManifestLine(raw, { seen: "2026-11-26T10:00:00Z" });
  const parsed = parseManifest(JSON.stringify(line) + "\n");
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].format, "cmmns.page/1");
  assert.equal(parsed[0].files[0].url, "https://data.example.org/soil-2026.csv");
  assert.equal(parsed[0].feeds.length, 2);
});

test("extractDocumentLinks and normalizeFeeds filter invalid schemes", () => {
  assert.deepEqual(normalizeFeeds([{ href: "ftp://example.org/f.xml", type: "application/rss+xml" }]), []);
  assert.deepEqual(extractDocumentLinks(["https://example.org/a.pdf", "https://example.org/page", "file:///etc/passwd.pdf"]), ["https://example.org/a.pdf"]);
  assert.equal(pageLines(null).length, 0);
});

test("PBPageCapture.exportManifest emits collision-free manifest-*.jsonl with overwrite:false and noSaveAs:true", async () => {
  const store = {};
  const saved = [];
  const docEl = {
    tagName: "ARTICLE",
    textContent: "A universal page body with enough text to capture cleanly.",
    matches: () => true,
    closest: () => null,
    querySelectorAll: () => [],
    getAttribute: () => null,
  };
  const ctx = vm.createContext({
    URL, URLSearchParams, TextEncoder, TextDecoder, console,
    location: { href: "https://docs.example.org/spec", hostname: "docs.example.org" },
    document: {
      title: "Universal Spec",
      body: docEl,
      documentElement: { getAttribute: () => "en" },
      querySelector: (sel) => (sel.includes("canonical") ? { getAttribute: () => "https://docs.example.org/spec" } : null),
      querySelectorAll: () => [],
      createTreeWalker: () => ({ nextNode: () => null }),
    },
    NodeFilter: { SHOW_TEXT: 4 },
    getSelection: () => ({ rangeCount: 0, isCollapsed: true }),
    chrome: {
      storage: {
        local: {
          get: async (k) => ({ [k]: store[k] }),
          set: async (o) => Object.assign(store, o),
        },
      },
    },
    PBQuickSave: {
      async saveText(bytes, mime, name, site, study, opts) {
        saved.push({ name, site, study, opts, text: new TextDecoder().decode(bytes) });
        return name;
      },
    },
  });
  vm.runInContext(readFileSync(join(root, "src/ext/core.bundle.js"), "utf8"), ctx);
  vm.runInContext(readFileSync(join(root, "src/ext/page-capture.js"), "utf8"), ctx);

  const r1 = await ctx.PBPageCapture.exportManifest();
  const r2 = await ctx.PBPageCapture.exportManifest();
  assert.ok(MANIFEST_FILE_RE.test(r1.filename));
  assert.ok(MANIFEST_FILE_RE.test(r2.filename));
  assert.notEqual(r1.filename, r2.filename, "sequential universal page manifest exports never collide");
  assert.deepEqual(saved.map((s) => [s.opts.overwrite, s.opts.noSaveAs, s.opts.library]), [
    [false, true, "web-pages"],
    [false, true, "web-pages"],
  ]);
});
