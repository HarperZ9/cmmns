// Library capture in a real (headless) Chrome on Reddit fixtures (tests/library-page.js): a user page
// saves the user's posts and comments in one index, each comment as kind "comment" with its parent
// post's id and its subreddit; a subreddit page saves its posts and collects no comments. The markup
// is the shape quick-sites.js reads; Reddit's live markup is not checked here.
import test from "node:test";
import assert from "node:assert/strict";
import { browserSkip } from "./browser.js";
import { page, withSite } from "./library-page.js";

const post = (author, id, title, img = true) => `<shreddit-post id="t3_${id}" author="${author}" post-title="${title}" permalink="/r/ColorTheory/comments/${id}/slug/"
  created-timestamp="2026-05-0${id.length}T12:00:00.000000+0000" subreddit-prefixed-name="r/ColorTheory" score="41" comment-count="7" post-type="${img ? "image" : "link"}" domain="${img ? "i.redd.it" : "example.org"}"
  ${img ? "" : 'content-href="https://example.org/ochre"'}>${img ? `<div slot="post-media-container"><img src="https://i.redd.it/${id}.png" width="300" height="300"></div>` : ""}</shreddit-post>`;
const comment = (author, id, postId, text) => `<shreddit-profile-comment author="${author}" thingid="t1_${id}" href="/r/ColorTheory/comments/${postId}/slug/${id}/"
  created-timestamp="2026-06-01T09:30:00.000000+0000" subreddit-prefixed-name="r/ColorTheory" post-title="On ochre" score="12"><div slot="comment"><p>${text}</p></div></shreddit-profile-comment>`;
const USER = page("u/painter", post("painter", "aa1", "Ochre study") + comment("painter", "c1", "zz9", "Ochre reads warmer beside blue.") + post("painter", "aa22", "A link I liked", false));
const SUB = page("r/ColorTheory", post("painter", "aa1", "Ochre study") + post("someone", "bb2", "Teal", true) + comment("painter", "c1", "zz9", "Not collected on a subreddit page."));

test("a Reddit user library keeps posts and comments in one index, comments with their parent post and subreddit", { skip: browserSkip, timeout: 120000 }, () => withSite(["www.reddit.com"], { "/user/painter/": USER }, async (s) => {
  await s.open("https://www.reddit.com/user/painter/");
  await s.click("Save page as library");
  await s.until("PBLibrary.status().saved === 3");
  await s.click("Stop");
  await s.until("__dl.some((d) => d.filename === 'LIBRARY.md')");
  const dl = await s.downloads(), index = await s.index();
  assert.ok(dl.every((d) => d.library === "reddit-u-painter"));
  assert.deepEqual(index.map((l) => [l.id, l.kind, l.content]), [["t3_aa1", "post", "media"], ["t1_c1", "comment", "text"], ["t3_aa22", "post", "text"]]);
  const c = index[1];
  assert.deepEqual([c.handle, c.parent_post, c.subreddit, c.url], ["u/painter", "t3_zz9", "r/ColorTheory", "https://www.reddit.com/r/ColorTheory/comments/zz9/slug/c1/"]);
  assert.equal(c.posted, "2026-06-01T09:30:00.000Z");
  const note = dl.find((d) => d.filename === c.files.at(-1).name).text;
  assert.match(note, /> Ochre reads warmer beside blue\./);
  assert.match(note, /## Comment\n\nA comment in r\/ColorTheory on post t3_zz9\./);
  assert.match(note, /Replying to \(https:\/\/www\.reddit\.com\/r\/ColorTheory\/comments\/zz9\/\)/);
  // A link post keeps its target and Reddit's own marks on the post.
  assert.deepEqual(index[2].fields, { post_type: "link", domain: "example.org" });
  assert.match(dl.find((d) => d.filename === index[2].files.at(-1).name).text, /https:\/\/example\.org\/ochre/);
  assert.match(dl.filter((d) => d.filename === "LIBRARY.md").pop().text, /3 items saved, \d+ files: 2 posts of its own, 0 reposts, 1 comment\./);
}));

test("a subreddit library keeps every author's posts and collects no comments", { skip: browserSkip, timeout: 120000 }, () => withSite(["www.reddit.com"], { "/r/ColorTheory/": SUB }, async (s) => {
  await s.open("https://www.reddit.com/r/ColorTheory/");
  await s.click("Save page as library");
  await s.until("PBLibrary.status().saved === 2");
  await new Promise((ok) => setTimeout(ok, 800));
  await s.click("Stop");
  await s.until("__dl.some((d) => d.filename === 'index.jsonl')");
  assert.deepEqual((await s.index()).map((l) => [l.id, l.handle, l.kind]), [["t3_aa1", "u/painter", "post"], ["t3_bb2", "u/someone", "post"]]);
}));
