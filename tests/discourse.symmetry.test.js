// No discourse check reads a political side. Each fixture thread is run as written and with its sides
// swapped (parties, ideologies and named figures traded for their counterparts); the correction
// ranking, its scores and the document and count results must not change. The threads are synthetic,
// shaped like the study's Hitler-placement and Musk and King exchanges.
import test from "node:test";
import assert from "node:assert/strict";
import { rankCorrections } from "../src/core/discourse/corrections.js";
import { checkDocument } from "../src/core/discourse/docclaim.js";
import { findCounts } from "../src/core/discourse/stats.js";
import { extractQuotes } from "../src/core/discourse/quotes.js";

const PAIRS = [["left", "right"], ["Left", "Right"], ["socialist", "conservative"], ["Socialist", "Conservative"], ["liberal", "nationalist"], ["Democrats", "Republicans"],
  ["Democrat", "Republican"], ["progressive", "traditionalist"], ["communism", "fascism"], ["Communism", "Fascism"], ["Marxism", "capitalism"], ["Biden", "Trump"], ["Musk", "Soros"], ["King", "Carlson"]];
const swap = (s) => String(s).replace(new RegExp(`\\b(${PAIRS.flat().join("|")})\\b`, "g"), (w) => { for (const [a, b] of PAIRS) { if (w === a) return b; if (w === b) return a; } return w; });

const THREADS = [
  { root: { author: "p1", text: "Hitler was a far left socialist. Literally in the name of his party! Communism and fascism are the same." },
    replies: [
      { id: "1", author: "h", text: "Historians place the party on the far right; the socialist in the name is not Marxism. See the record.", links: ["https://www.britannica.com/topic/Nazi-Party"] },
      { id: "2", author: "m", text: "Left wing people always say this, you are a moron.", links: [] },
      { id: "3", author: "q", text: "In fact the party purged its left wing in 1934 and banned the socialist unions in 1933.", links: [] },
      { id: "4", author: "r", text: "Right wing people always say this, fascism is fascism.", links: ["https://x.com/a/status/2"] },
    ] },
  { root: { author: "p2", text: "Musk is afraid of the Democrat candidate because of his business in Texas. 62% of 1,200 voters agree." },
    replies: [
      { id: "1", author: "a", text: "That's not true: the filing shows his business there is a small share of revenue, according to the annual report.", links: ["https://www.sec.gov/x"] },
      { id: "2", author: "b", text: "Your mental model is pathetically stupid, typical progressive.", links: [] },
      { id: "3", author: "c", text: "The poll cited was 62% of 1,200 voters, but it asked about the Republican, not the Democrat.", links: [] },
    ] },
];

const view = (ranked) => ranked.map((x) => [x.id, x.score, x.source, x.quoted, x.cues]);

test("swapping the sides of each thread leaves the correction ranking and its scores unchanged", () => {
  for (const t of THREADS) {
    const swapped = { root: { ...t.root, text: swap(t.root.text) }, replies: t.replies.map((r) => ({ ...r, text: swap(r.text) })) };
    assert.notEqual(swapped.root.text, t.root.text, "the swap changes the words");
    assert.deepEqual(view(rankCorrections(swapped.root, swapped.replies)), view(rankCorrections(t.root, t.replies)));
  }
});

test("the document check, the counts and quote extraction read the same either way", () => {
  const pages = [{ text: "The Democrats wrote to the committee about the filing. Republicans did not reply." }];
  for (const t of THREADS) {
    const a = checkDocument(t.root.text, pages), b = checkDocument(swap(t.root.text), pages.map((p) => ({ text: swap(p.text) })));
    assert.deepEqual([a.found.length, a.absent.length], [b.found.length, b.absent.length]);
    const kn = (s) => findCounts(s).map((c) => [c.k, c.n, c.interval]);
    assert.deepEqual(kn(t.root.text), kn(swap(t.root.text)));
    assert.equal(extractQuotes(t.root.text, []).quotes.length, extractQuotes(swap(t.root.text), []).quotes.length);
  }
});

test("no discourse module names a party, an ideology or a side", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const dir = new URL("../src/core/discourse/", import.meta.url);
  const words = new RegExp(`\b(${PAIRS.flat().join("|")})\b`, "i");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".js"))) assert.doesNotMatch(readFileSync(new URL(f, dir), "utf8"), words, f);
});
