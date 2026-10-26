// Text kept without any picture: a text post or a selection as a daylight.sidecar/1 note with
// kind "text" and no file, and the text card, a Daylight rendering that never looks like a platform.
import test from "node:test";
import assert from "node:assert/strict";
import { postMeta, sidecarMarkdown, metaName, captionText } from "../src/core/media-meta.js";
import { wrapLines, cardPlan, CARD_FOOT } from "../src/core/media-card.js";

const NOW = "2026-10-25T12:00:00.000Z";

test("an X text post becomes a note with no file, its link cards, hashtags and poll", () => {
  const m = postMeta({ site: "x", kind: "text", handle: "ana", authorName: "Ana", text: "Which glaze base do you start from? #ceramics\nhttps://ex.ample/bases",
    postUrl: "https://x.com/ana/status/9", postedAt: "2026-10-24T10:00:00Z",
    cards: [{ url: "https://ex.ample/bases", title: "Ten glaze bases compared" }],
    poll: { options: [{ label: "Leach 4321", result: "41%" }, { label: "Tenmoku", result: "59%" }], total: "312 votes", status: "Final results" } }, NOW);
  const md = sidecarMarkdown(m, []);
  assert.ok(md.startsWith('---\nformat: "daylight.sidecar/1"\nfiles: []\nkind: "text"\n'));
  assert.ok(md.includes("## Poll\n\n- Leach 4321: 41%\n- Tenmoku: 59%\n\n312 votes, Final results"));
  assert.ok(md.includes("## Link cards\n\n- Ten glaze bases compared: https://ex.ample/bases"));
  assert.ok(md.includes('hashtags: ["#ceramics"]'));
  assert.equal(metaName(m, "md"), "ana_2026-10-24_which-glaze-base-do-you-start-from-ceramics.md");
});

test("a quote of a text post keeps both texts; a thread by one author is one note in order", () => {
  const m = postMeta({ site: "x", kind: "text", handle: "lee", text: "This, exactly.", quoted: { text: "Fire slower through quartz inversion.", url: "https://x.com/ana/status/8", author: "ana" },
    thread: ["Part two: hold at 573 C.", "Part three: cool slowly."] }, NOW);
  const md = sidecarMarkdown(m, []);
  assert.ok(md.indexOf("> This, exactly.") < md.indexOf("> Part two") && md.indexOf("> Part two") < md.indexOf("> Part three"));
  assert.ok(md.includes("Quoting @ana (https://x.com/ana/status/8):\n\n> Fire slower through quartz inversion."));
});

test("a Reddit self-post note has title, self-text, subreddit and flair", () => {
  const m = postMeta({ site: "reddit", kind: "text", title: "How I wedge 10 kg", text: "Ram's head, then spiral.\n\nTwo minutes each.", handle: "u/potter_j", subreddit: "r/Pottery", flair: "Technique",
    postUrl: "https://www.reddit.com/r/Pottery/comments/x/how/" }, NOW);
  const md = sidecarMarkdown(m, []);
  assert.ok(md.includes("**How I wedge 10 kg**") && md.includes("> Ram's head, then spiral.\n>\n> Two minutes each."));
  assert.ok(md.includes('flair: "Technique"') && md.includes("- Flair: Technique") && md.includes("- Subreddit: r/Pottery"));
});

test("a selection on an article page keeps the page's title, address, author and date", () => {
  const m = postMeta({ site: "example.org", kind: "text", selection: true, title: "On reduction firing", text: "Carbon trapping happens early.", pageUrl: "https://example.org/reduction",
    authorName: "J. Rhodes", postedAt: "2025-03-01" }, NOW);
  const md = sidecarMarkdown(m, []);
  assert.ok(md.includes("selection: true") && md.includes("**On reduction firing**") && md.includes("- Page: https://example.org/reduction"));
  assert.equal(captionText(m), "Carbon trapping happens early.\n\nJ. Rhodes https://example.org/reduction");
});

const measure = (t, font) => t.length * (Number((/(\d+)px/.exec(font) || [])[1]) || 20) * 0.5;

test("the text card wraps long text, says it is a rendering, and draws no platform chrome", () => {
  assert.deepEqual(wrapLines("a b c", measure, "20px x", 30), ["a b", "c"]);
  assert.ok(wrapLines("x".repeat(50), measure, "20px x", 100).every((l) => measure(l, "20px x") <= 100));
  const plan = cardPlan(postMeta({ site: "x", handle: "ana", authorName: "Ana", text: "word ".repeat(600), postUrl: "https://x.com/ana/status/9" }, NOW), measure);
  const texts = plan.items.filter((i) => i.kind === "text").map((i) => i.text);
  assert.equal(texts.at(-1), CARD_FOOT);
  assert.ok(texts.includes("The rest is in the saved note."));
  assert.ok(plan.items.every((i) => i.kind === "text" || i.kind === "rule"), "only type and rules: no avatar, icon or button");
  assert.ok(plan.items.filter((i) => i.kind === "text").every((i) => /Hanken Grotesk|JetBrains Mono/.test(i.font)));
  assert.equal(plan.width, 1200);
});
