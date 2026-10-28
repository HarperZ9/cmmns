// Library capture in a real (headless) Chrome on an X profile fixture (tests/library-page.js): the
// "Save page as library" bar, one save per post, a repost kept as kind "repost" with its original,
// another account's post shown for context skipped, a post loaded later saved too, X's post data in
// the index and the note, index.jsonl and LIBRARY.md on Stop with each file's hash, a reload
// continuing the same library, and two overlapping saves each landing in its own folder.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { browserSkip } from "./browser.js";
import { page, withSite } from "./library-page.js";

const post = (handle, id, text, media = true, repostedBy = null) => `<article>${repostedBy ? `<div><a href="/${repostedBy}"><span data-testid="socialContext">${repostedBy} reposted</span></a></div>` : ""}
  <a href="/${handle}"><span>Meditations</span></a><a href="/${handle}/status/${id}"><time datetime="2026-0${id % 9 + 1}-02T10:00:00.000Z"></time></a>
  <div data-testid="tweetText" lang="en">${text}</div>${media ? `<img alt="a colour study" src="https://pbs.twimg.com/media/P${id}?format=jpg&name=small" width="200" height="200">` : ""}</article>`;
const PAGE = page("Meditations in Color (@MeditInColor) / X", post("MeditInColor", 111, "Blue first, then the gold.") + post("someone", 222, "The post a reply answers.")
  + post("MeditInColor", 333, "Only words today.", false) + post("painter", 555, "A study in ochre.", true, "MeditInColor"));
const X_DATA = { data: { tweetResult: { result: { __typename: "Tweet", rest_id: "111", source: "<a href=\"https://x.com\">Web App</a>", views: { count: "1200" },
  edit_control: { edit_tweet_ids: ["110", "111"] }, birdwatch_pivot: { subtitle: { text: "Readers added context." } },
  legacy: { created_at: "Thu Apr 02 10:00:00 +0000 2026", full_text: "Blue first, then the gold. https://t.co/abc", lang: "en", entities: { urls: [{ url: "https://t.co/abc", expanded_url: "https://example.org/palette" }] } } } } } };
const URL_ = "https://x.com/MeditInColor";

test("Save page as library on X: own posts and reposts kept by kind, context skipped, index on Stop, a reload continues", { skip: browserSkip, timeout: 120000 }, () => withSite(["x.com"], { "/MeditInColor": PAGE }, async (s) => {
  await s.open(URL_);
  assert.equal(await s.js("document.querySelector('.pb-lib button').textContent"), "Save page as library");
  // X's own post data for post 111, as sniff.js passes it on: an edit, a Community Note, a link target.
  await s.js(`window.postMessage({ source: "radar-sniff", json: ${JSON.stringify(X_DATA)} }, location.origin), true`);
  await new Promise((ok) => setTimeout(ok, 300));
  await s.click("Save page as library");
  await s.until("PBLibrary.status().saved === 3");
  assert.match(await s.js("document.querySelector('.pb-lib-count').textContent"), /^Library x-meditincolor: 3 saved, 1 skipped/);
  assert.ok(await s.js("[...document.querySelectorAll('.pb-lib button')].some((b) => b.textContent === 'Scroll to the end')"), "the unpacked build offers auto-scroll");
  // A post the page loads later is saved too, and a redrawn one is not saved twice.
  await s.js(`document.getElementById('feed').insertAdjacentHTML('beforeend', ${JSON.stringify(post("MeditInColor", 444, "Gold now.") + post("MeditInColor", 111, "Blue first, then the gold."))}), true`);
  await s.until("PBLibrary.status().saved === 4");
  await s.click("Stop");
  await s.until("__dl.some((d) => d.filename === 'LIBRARY.md')");
  const dl = await s.downloads(), index = await s.index();
  assert.ok(dl.every((d) => d.library === "x-meditincolor" && d.overwrite && !d.study), "every file goes to the library folder, written in place");
  assert.deepEqual(index.map((l) => [l.id, l.kind, l.content]), [["111", "post", "media"], ["333", "post", "text"], ["555", "repost", "media"], ["444", "post", "media"]]);
  assert.deepEqual([index[2].handle, index[2].repost_by, index[2].original], ["painter", "MeditInColor", { author: "painter", id: "555", url: "https://x.com/painter/status/555" }]);
  assert.match(dl.find((d) => d.filename === index[2].files.at(-1).name).text, /## Reposted\n\nReposted by @MeditInColor; the post above is @painter's\./);
  assert.match(index[0].files[0].name, /^meditincolor_2026-04-02_blue-first-then-the-gold_111\.png$/);
  assert.equal(index[0].files[0].sha256.length, 64);
  const side = dl.find((d) => d.filename === index[0].files[1].name);
  assert.equal(index[0].files[1].sha256, createHash("sha256").update(side.text).digest("hex"), "the sidecar's hash is of the bytes saved");
  assert.match(side.text, /^---\nformat: "daylight\.sidecar\/1"/);
  // Every field the page delivered: X's data on the post goes into the index and the note.
  assert.deepEqual(index[0].fields, { lang: "en", client: "Web App", edits: 1, community_note: "Readers added context.", views: 1200 });
  assert.match(side.text, /## Community Note\n\nReaders added context\./);
  assert.match(side.text, /## Edited\n\nX lists 1 earlier version of this post\./);
  assert.match(side.text, /https:\/\/example\.org\/palette/, "the link's target, not only the short link");
  const md = dl.filter((d) => d.filename === "LIBRARY.md").pop().text;
  assert.match(md, /4 items saved, \d+ files: 3 posts of its own, 1 repost, 0 comments/);
  assert.match(md, /reposts: 1/);
  assert.match(md, /- 1: a post by another account shown in the feed for context/);
  assert.match(md, /never label a person's character/);

  // Reopening the page continues the library: the posts on it are counted, not saved again.
  await s.open(URL_);
  await s.click("Save page as library");
  await s.until("PBLibrary.status().already === 3");
  await new Promise((ok) => setTimeout(ok, 1500));
  assert.equal(await s.js("PBLibrary.status().saved"), 0);
  assert.equal(await s.js("__dl.length"), 0, "nothing downloaded again");
  await s.click("Stop");
  await s.until("__dl.some((d) => d.filename === 'LIBRARY.md')");
  assert.equal((await s.index()).length, 4);
  assert.match((await s.downloads()).find((d) => d.filename === "LIBRARY.md").text, /## Sessions \(UTC\)\n\n- .+: 4 saved, collected while scrolling; stopped: Stop pressed\n- .+: 0 saved/);
}));

// Before this fix the folder was shared state in quick-save.js, so a save that started for a library
// and a study note saved while it waited for the network could swap folders.
test("two overlapping saves each keep their own folder (library and study)", { skip: browserSkip, timeout: 60000 }, () => withSite(["x.com"], { "/MeditInColor": PAGE }, async (s) => {
  await s.open(URL_);
  await s.js(`(async () => {
    const t = PBQuickSites.postMedia(document.querySelector("article")).items[0];
    const col = { files: [], unhashed: [], lenient: true, add: async () => {} };
    const a = PBQuickSave.run(t, { library: "race-lib", collector: col, nameTag: "race", oneSidecar: true });
    await new Promise((ok) => setTimeout(ok, 300));   // the picture is held 1.5 s on the network
    const b = PBQuickSave.saveText(new TextEncoder().encode("a study note"), "text/plain", "study-note.txt", "x", true);
    await Promise.all([a, b]);
    return true; })()`);
  const dl = await s.downloads();
  const pic = dl.find((d) => /_race\.png$/.test(d.filename)), note = dl.find((d) => d.filename === "study-note.txt");
  assert.deepEqual([pic.library, pic.study], ["race-lib", false], "the library's picture stays in the library");
  assert.deepEqual([note.library, note.study], [null, true], "the study note stays in the study folder");
}, { mediaDelay: 1500 }));
