// The one-click save on pages with no site reader, on a text post, and on a YouTube watch page, in a
// real (headless) Chrome on simulated pages (tests/capture-page.js). Three reported defects are
// held here: "Download" with no picture under the pointer saved nothing; a note on a page without
// a site reader was refused; a YouTube reference kept a description cut at "more" without saying
// so, and dated the video from the first video the tab loaded.
// With CMMNS_SIM_SRC pointing at a checkout from before the fix, the defect cases fail.
// The markup is the shape the readers read; the sites' live markup is not checked here.
import test from "node:test";
import assert from "node:assert/strict";
import { browserSkip } from "./browser.js";
import { page, withPage } from "./capture-page.js";
import { X_PAGE } from "./full-capture-fixtures.js";

const opts = { skip: browserSkip, timeout: 120000 };
const LD = { "@context": "https://schema.org", "@type": "NewsArticle", headline: "Floods force thousands from homes", author: { "@type": "Person", name: "Ana Reyes" }, datePublished: "2026-11-10T08:30:00Z" };
const ARTICLE = `<link rel="canonical" href="https://news.example.org/story"><meta property="og:type" content="article"><meta property="og:site_name" content="The Valley Record">
<meta name="citation_doi" content="10.1234/valley.77"><script type="application/ld+json">${JSON.stringify(LD)}</script>
<nav><a href="/home">Home</a> menu words</nav>
<article><h1>Floods force thousands from homes</h1><p id="p1">Rivers rose overnight across the valley.</p><p>Thousands left before dawn. See <a href="https://data.example.org/levels">the gauge data</a>.</p>
<img id="pic" src="https://pbs.twimg.com/media/river.png" alt="The river at dawn" width="320" height="200">
<video id="clip" src="https://pbs.twimg.com/v/clip.mp4" preload="none" width="320" height="180"></video>
<video id="live" src="https://stream.example.org/live/master.m3u8" preload="none" width="320" height="180"></video>
<a href="https://pbs.twimg.com/files/report.png" download>Download the report scan</a>
<aside>Related stories that are not part of the text</aside></article><footer>Footer words</footer>`;
const at = (sel) => `(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left + 4, y: r.top + 4 }; })()`;
const STORY = "https://news.example.org/story";

test("Download with no picture under the pointer saves the page: text, its own metadata, and the files it offers as plain addresses", opts, () => withPage({ "/story": page("Floods - Valley Record", ARTICLE) }, async (s) => {
  await s.open(STORY + "?utm_source=feed");
  const loaded = s.requests.length;   // what the page itself asked for while loading; the save's requests come after
  const r = await s.js(`PBQuickSave.fromMenu({ at: ${at("#p1")} }).then((x) => ({ ok: x.ok, line: x.line || null }))`);
  assert.equal(r.ok, true, `the save answered: ${r.line}`);
  const md = (await s.file("\\.md$")).text, json = JSON.parse((await s.file("\\.json$")).text), dl = await s.downloads();
  assert.match(md, /^adapter: "article"$/m);
  assert.match(md, /^author: "Ana Reyes"$/m);
  assert.match(md, /^posted: "2026-11-10T08:30:00\.000Z"$/m);
  assert.match(md, /^page: "https:\/\/news\.example\.org\/story"$/m);
  assert.match(md, /^canonical: "https:\/\/news\.example\.org\/story"$/m);
  assert.ok(md.includes("> Floods force thousands from homes\n>\n> Rivers rose overnight across the valley.\n>\n> Thousands left before dawn. See the gauge data."), md);
  assert.ok(!/menu words|Related stories|Footer words/.test(md), "navigation, asides and the footer are not part of the text");
  assert.deepEqual(json.items.map((i) => [i.kind, /^not saved/.test(i.file) ? i.file : "saved"]), [["image", "saved"], ["video", "saved"],
    ["video", "not saved (the page delivers it as a segmented stream, with no plain file address)"], ["image", "saved"]]);
  assert.equal(json.files.length, 3, "three plain files were saved and listed");
  assert.deepEqual(dl.filter((d) => !d.text).map((d) => d.filename.replace(/^.*\./, "")).sort(), ["mp4", "png", "png"]);
  assert.match(json.mediaFile, /^3 of 4 saved; 1 not saved \(the page delivers it as a segmented stream/);
  assert.deepEqual([json.page.citation.citation_doi, json.page.openGraph.site_name, json.page.jsonLd[0].type, json.links.includes("https://data.example.org/levels")], [["10.1234/valley.77"], "The Valley Record", "NewsArticle", true]);
  assert.ok(!s.requests.some((u) => u.includes("stream.example.org")), "the stream was never asked for");
  assert.ok(s.requests.slice(loaded).some((u) => u.startsWith("https://pbs.twimg.com/v/clip.mp4")), "the plain video file was asked for by the save");
  const other = s.requests.filter((u) => !u.startsWith("https://news.example.org/") && !u.startsWith("https://pbs.twimg.com/"));
  assert.deepEqual(other, [], "no request beyond the page and the files it offered");
}));

test("Save as note on a page with no site reader keeps the text and the media's addresses, and asks for no file", opts, () => withPage({ "/story": page("Floods - Valley Record", ARTICLE) }, async (s) => {
  await s.open(STORY);
  const loaded = s.requests.length;
  const r = await s.js(`PBQuickText.run("note", { at: ${at("#p1")} }).then((x) => ({ ok: x.ok }))`);
  assert.equal(r.ok, true);
  const json = JSON.parse((await s.file("\\.json$")).text);
  assert.equal(json.adapter, "article");
  assert.deepEqual(json.files, []);
  assert.ok(json.items.every((i) => /^not saved \(not asked for/.test(i.file)));
  assert.deepEqual(s.requests.slice(loaded).filter((u) => !u.startsWith("blob:") && !/favicon.ico$/.test(u)), [], "a note asks no host for anything");
}));

test("source protection saves the page's words and asks no host for a file", opts, () => withPage({ "/story": page("Floods - Valley Record", ARTICLE, { protection: true }) }, async (s) => {
  await s.open(STORY);
  const loaded = s.requests.length;
  assert.equal(await s.js(`PBQuickText.run("page", { at: ${at("#p1")} }).then((x) => x.ok)`), true);
  const json = JSON.parse((await s.file("\\.json$")).text);
  assert.equal(json.items.filter((i) => /source protection is on/.test(i.file)).length, 3);
  assert.deepEqual(s.requests.slice(loaded).filter((u) => !u.startsWith("blob:") && !/favicon.ico$/.test(u)), [], "no host was asked for a file");
}));

test("Download on an X text post saves the post as a note, by X's own reader", opts, () => withPage({ "/painter/status/100": page("X", X_PAGE) }, async (s) => {
  await s.open("https://x.com/painter/status/100");
  await s.js(`window.__t = [...document.querySelectorAll("article")].find((a) => !a.querySelector("img, video")); !!window.__t`);
  const r = await s.js(`(() => { const b = (__t.querySelector('[data-testid="tweetText"], div[lang]') || __t).getBoundingClientRect(); return PBQuickSave.fromMenu({ at: { x: b.left + 3, y: b.top + 3 } }).then((x) => ({ ok: x.ok, line: x.line || null })); })()`);
  assert.equal(r.ok, true, `the save answered: ${r.line}`);
  const md = (await s.file("\\.md$")).text;
  assert.match(md, /^kind: "text"$/m);
  assert.match(md, /^site: "x"\nadapter: "x"$/m);
}));

// A watch page reached by YouTube's own navigation: the tab first loaded another video, so the
// page's inline data and date tags describe that one; the player holds the current video's record.
const FULL = "Start of the text, and the rest of it that the page hides behind its control.\n\nSecond paragraph.";
const player = (id) => ({ videoDetails: { videoId: id, title: "Hellgate walk", author: "Painter", shortDescription: FULL }, microformat: { playerMicroformatRenderer: { publishDate: "2020-09-29T11:00:10-07:00" } },
  captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: "en", kind: "asr", name: { simpleText: "English (auto-generated)" } }, { languageCode: "es", name: { runs: [{ text: "Spanish" }] } }] } } });
const watch = (withPlayer) => `<meta itemprop="identifier" content="firstvideo1"><meta itemprop="datePublished" content="2011-01-01T00:00:00Z">
<script>window.ytInitialPlayerResponse = { videoDetails: { videoId: "firstvideo1", title: "First", shortDescription: "The first video's text." } };</script>
<div id="movie_player"><video></video></div>${withPlayer ? `<script>document.getElementById("movie_player").getPlayerResponse = () => (${JSON.stringify(player("abcdefghijk"))});</script>` : ""}
<ytd-watch-metadata><h1>Hellgate walk</h1><div id="owner"><ytd-channel-name><a href="/@painter">Painter</a></ytd-channel-name></div>
<div id="description-inline-expander">Start of the text  …<div>more</div></div></ytd-watch-metadata>
<script src="/__dc/ytsniff.js"></script><script src="/__dc/yt-reference.js"></script>`;
const refOf = "(() => { const m = PB.postMeta(PBYouTube.reference().meta); return { text: m.text, complete: m.textComplete, posted: m.postedAt, notes: m.notes, mediaFile: m.mediaFile, adapter: m.adapter }; })()";

test("a YouTube reference after the site's own navigation keeps the current video's whole description, date and caption list", opts, () => withPage({ "/watch": page("Hellgate walk - YouTube", watch(true)) }, async (s) => {
  await s.open("https://www.youtube.com/watch?v=abcdefghijk");
  await s.js("new Promise((ok) => setTimeout(() => ok(true), 300))");
  const m = await s.js(refOf);
  assert.equal(m.text, FULL);
  assert.equal(m.complete, true);
  assert.equal(m.posted, "2020-09-29T18:00:10.000Z", "the current video's date, never the first video's");
  assert.deepEqual(m.notes.find((n) => n.label === "Caption tracks the page lists").text.split("\n"), ["en (English (auto-generated)), made by speech recognition", "es (Spanish)"]);
  assert.match(m.mediaFile, /^not saved \(YouTube plays this video as a segmented stream/);
  assert.equal(m.adapter, "youtube");
}));

test("a YouTube description the page cut short is marked incomplete, without the page's \"more\" control in it", opts, () => withPage({ "/watch": page("Hellgate walk - YouTube", watch(false)) }, async (s) => {
  await s.open("https://www.youtube.com/watch?v=abcdefghijk");
  await s.js("new Promise((ok) => setTimeout(() => ok(true), 300))");
  const m = await s.js(refOf);
  assert.equal(m.text, "Start of the text …");
  assert.equal(m.complete, false, "the note says the page showed only the start");
  assert.equal(m.posted, null, "no date is better than another video's date");
}));
