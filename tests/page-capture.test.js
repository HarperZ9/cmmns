// The generic save's record (src/core/page-capture.js): what a page states about itself becomes a
// daylight.sidecar/1 note with the adapter that read it, the page's own metadata, each media
// element's address, and a plain reason wherever a file was not saved.
import test from "node:test";
import assert from "node:assert/strict";
import { pageMetadata, pagePicks, pageRaw, mediaOffer, mediaFileLine, captionTracks, captionTrackLines, adapterOf } from "../src/core/page-capture.js";
import { postMeta, sidecarMarkdown, sidecarJson, metaName } from "../src/core/media-meta.js";

const NOW = "2026-11-13T12:00:00.000Z";
const LD = JSON.stringify({ "@context": "https://schema.org", "@graph": [{ "@type": "WebSite", name: "The Valley Record" },
  { "@type": "NewsArticle", headline: "Floods force thousands from homes", author: [{ "@type": "Person", name: "Ana Reyes" }, "Bo Lind"], datePublished: "2026-11-10T08:30:00Z", publisher: { name: "The Valley Record" } }] });
const METAS = [{ key: "og:title", content: "Floods force thousands from homes | Valley Record" }, { key: "og:type", content: "article" }, { key: "og:description", content: "Rivers rose overnight." },
  { key: "article:published_time", content: "2026-11-09T00:00:00Z" }, { key: "twitter:card", content: "summary" }, { key: "author", content: "Staff" }];
const PAGE = { url: "https://news.example.org/story?utm_source=x", host: "www.news.example.org", title: "Floods - Valley Record", text: "Rivers rose overnight.\n\nThousands left.", textFrom: "article",
  metas: METAS, jsonld: [LD], canonical: "https://news.example.org/story", lang: "en-GB", links: ["https://example.org/data"],
  media: [{ kind: "image", url: "https://img.example.org/a.jpg", alt: "The river", width: 1200, height: 800, file: "floods-a.jpg" },
    { kind: "video", url: "https://cdn.example.org/v/master.m3u8", file: "not saved (the page delivers it as a segmented stream, with no plain file address)" }] };

test("the page's own metadata is kept by family, and JSON-LD nodes are read out of a graph", () => {
  const m = pageMetadata(PAGE);
  assert.deepEqual(m.openGraph, { title: "Floods force thousands from homes | Valley Record", type: "article", description: "Rivers rose overnight." });
  assert.deepEqual(m.article, { published_time: "2026-11-09T00:00:00Z" });
  assert.deepEqual(m.jsonLd.map((n) => n.type), ["WebSite", "NewsArticle"]);
  assert.deepEqual(m.jsonLd[1].author, ["Ana Reyes", "Bo Lind"]);
  assert.equal(m.canonical, "https://news.example.org/story");
  assert.equal(m.lang, "en-GB");
});

test("title, author and date come from the most specific source the page gives", () => {
  const p = pagePicks(pageMetadata(PAGE));
  assert.deepEqual([p.title, p.author, p.published, p.isArticle], ["Floods force thousands from homes", "Ana Reyes, Bo Lind", "2026-11-10T08:30:00Z", true]);
  const cited = pagePicks(pageMetadata({ metas: [{ key: "citation_title", content: "On ochre" }, { key: "citation_author", content: "Reyes, A." }, { key: "citation_author", content: "Lind, B." },
    { key: "citation_publication_date", content: "2024/03/01" }, { key: "citation_doi", content: "10.1234/ochre.5" }, ...METAS], jsonld: [LD] }));
  assert.deepEqual([cited.title, cited.author, cited.published], ["On ochre", "Reyes, A., Lind, B.", "2024/03/01"]);
  const bare = pagePicks(pageMetadata({ metas: [], jsonld: ["{ not json"] }));
  assert.deepEqual([bare.title, bare.author, bare.published, bare.isArticle], [null, null, null, false]);
});

test("a page save is a note in the sidecar format, naming the reader that produced it", () => {
  const meta = postMeta(pageRaw(PAGE), NOW), md = sidecarMarkdown(meta, ["floods-a.jpg"]), json = JSON.parse(sidecarJson(meta, ["floods-a.jpg"]));
  assert.ok(md.startsWith('---\nformat: "daylight.sidecar/1"\nfiles: ["floods-a.jpg"]\nkind: "text"\nsite: "news.example.org"\nadapter: "article"\nauthor: "Ana Reyes, Bo Lind"\nposted: "2026-11-10T08:30:00.000Z"\n'), md.slice(0, 300));
  assert.match(md, /^page: "https:\/\/news\.example\.org\/story"$/m, "the page address, without its campaign parameter");
  assert.match(md, /^canonical: "https:\/\/news\.example\.org\/story"$/m);
  assert.match(md, /^lang: "en-GB"$/m);
  assert.match(md, /^media_file: "1 of 2 saved; 1 not saved \(the page delivers it as a segmented stream, with no plain file address\)"$/m);
  assert.ok(md.includes("> Rivers rose overnight.\n>\n> Thousands left."));
  assert.ok(md.includes("## Media\n\n1. image 1200x800: https://img.example.org/a.jpg\n   Alt text: The river\n   File: floods-a.jpg\n2. video: https://cdn.example.org/v/master.m3u8\n   File: not saved (the page delivers"));
  assert.ok(md.includes("## Page metadata\n\n- Canonical address: https://news.example.org/story\n- Language: en-GB\n- Text read from: the page's article\n- Open Graph title: Floods force thousands from homes | Valley Record"));
  assert.ok(md.includes("- JSON-LD NewsArticle: Floods force thousands from homes | Ana Reyes, Bo Lind | 2026-11-10T08:30:00Z | The Valley Record"));
  assert.ok(md.includes("- Read by: the article reader"));
  assert.deepEqual([json.adapter, json.page.openGraph.type, json.page.jsonLd[1].name, json.items[1].kind, json.files], ["article", "article", "Floods force thousands from homes", "video", ["floods-a.jpg"]]);
  assert.equal(metaName(meta, "md"), "news-example-org_2026-11-10_rivers-rose-overnight-thousands-left_" + metaName(meta, "md").slice(-11));
});

test("a page that states nothing about itself is read by the generic reader", () => {
  const meta = postMeta(pageRaw({ url: "https://forum.example.net/t/9", host: "forum.example.net", title: "Thread 9", text: "A plain page.", textFrom: "body" }), NOW);
  assert.deepEqual([meta.adapter, meta.title, meta.author.name, meta.postedAt, meta.mediaFile], ["generic", "Thread 9", null, null, null]);
  assert.match(sidecarMarkdown(meta, []), /^adapter: "generic"$/m);
});

test("control: a site reader's save names its own reader, and old fields are unchanged", () => {
  const x = postMeta({ site: "x", handle: "ana", text: "Ochre.", postUrl: "https://x.com/ana/status/9" }, NOW);
  assert.equal(x.adapter, "x");
  assert.match(sidecarMarkdown(x, ["a.jpg"]), /^site: "x"\nadapter: "x"\nhandle: "ana"$/m);
  assert.deepEqual(["x", "reddit", "youtube", "instagram", "bsky.app", null].map((s) => adapterOf(s)), ["x", "reddit", "youtube", "instagram", "generic", "generic"]);
});

test("a file is saved only from a plain address; every other case gives its reason", () => {
  assert.deepEqual(mediaOffer({ kind: "video", url: "https://cdn.example.org/a.mp4" }), { plain: true, reason: null });
  assert.match(mediaOffer({ kind: "video", url: "https://cdn.example.org/a.m3u8" }).reason, /segmented stream/);
  assert.match(mediaOffer({ kind: "video", url: "blob:https://example.org/1-2" }).reason, /from memory/);
  assert.match(mediaOffer({ kind: "video", url: "https://example.org/page", noUrl: true }).reason, /from memory/);
  assert.match(mediaOffer({ kind: "video", url: "https://cdn.example.org/a.mp4", protected: "EME" }).reason, /DRM/);
  assert.equal(mediaFileLine([{ file: "a.jpg" }, { file: "b.mp4" }]), "saved");
  assert.equal(mediaFileLine([{ file: "not saved (the page plays it from memory, with no plain file address)" }]), "not saved (the page plays it from memory, with no plain file address)");
  assert.equal(mediaFileLine([]), null);
});

test("the caption tracks a YouTube player response lists are named, never fetched", () => {
  const tracks = captionTracks({ captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: "en", kind: "asr", name: { simpleText: "English (auto-generated)" }, baseUrl: "https://www.youtube.com/api/timedtext?x" },
    { languageCode: "es", name: { runs: [{ text: "Spanish" }] } }, { languageCode: "en", kind: "asr" }] } } });
  assert.deepEqual(tracks, [{ lang: "en", name: "English (auto-generated)", auto: true }, { lang: "es", name: "Spanish", auto: false }]);
  assert.deepEqual(captionTrackLines(tracks), ["en (English (auto-generated)), made by speech recognition", "es (Spanish)"]);
  assert.deepEqual(captionTracks({ videoDetails: {} }), []);
});
