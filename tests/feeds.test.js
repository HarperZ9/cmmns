// The feed reader (src/core/feeds.js) on synthetic RSS 2.0, Atom, RSS 1.0 and hostile feeds in
// tests/fixtures/feeds. Feeds are text from outside servers, so the reader keeps only https links,
// strips markup and never throws.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFeed, plainText, safeLink, FEED_MAX_ITEMS } from "../src/core/feeds.js";

const fx = (n) => readFileSync(new URL(`./fixtures/feeds/${n}`, import.meta.url), "utf8");

test("RSS 2.0: titles from CDATA and entities, links from <link> or a permalink guid, dates as ISO", () => {
  const f = parseFeed(fx("rss.xml"));
  assert.equal(f.kind, "rss");
  assert.equal(f.title, "Example Courier: World");
  assert.deepEqual(f.items.map((x) => x.title), ["Floods force thousands from homes in the river valley", "Central bank holds rates & signals patience", "Permalink only in the guid"]);
  assert.equal(f.items[0].link, "https://courier.example/world/floods-valley");
  assert.equal(f.items[0].summary, "Rescue teams worked through the night as rivers rose.");
  assert.equal(f.items[0].published, "2026-10-16T10:15:00.000Z");
  assert.equal(f.items[2].link, "https://courier.example/world/guid-story");
});

test("Atom: the alternate link wins over self, html summaries come out as text", () => {
  const f = parseFeed(fx("atom.xml"));
  assert.equal(f.kind, "atom");
  assert.equal(f.items[0].link, "https://herald.example/2026/10/valley-floods");
  assert.equal(f.items[0].summary, "Homes along the river were evacuated.");
  assert.equal(f.items[1].published, "2026-10-15T08:00:00.000Z", "updated stands in for published");
});

test("RSS 1.0 (RDF) feeds read like RSS 2.0", () => {
  const f = parseFeed(fx("rdf.xml"));
  assert.equal(f.kind, "rss");
  assert.equal(f.items.length, 1);
  assert.equal(f.items[0].link, "https://wave.example/en/valley-floods/a-1");
  assert.equal(f.items[0].published, "2026-10-16T12:00:00.000Z");
});

test("hostile feeds: script, http and credential links are dropped and markup never survives", () => {
  const f = parseFeed(fx("hostile.xml"));
  assert.deepEqual(f.items.map((x) => x.link), ["https://hostile.example/c", "https://hostile.example/d"]);
  assert.equal(f.items[0].title, "Valley floods & thousands");
  assert.doesNotMatch(JSON.stringify(f), /<|script>|onerror/);
  assert.equal(f.items[1].title, "Bad entity here");
});

test("anything that is not a feed gives an empty list, without throwing", () => {
  for (const t of [null, undefined, "", "<html><body>hello</body></html>", "{\"a\":1}", "<rss", "<<<>>>"]) {
    const f = parseFeed(t);
    assert.deepEqual(f.items, []);
  }
});

test("entries are capped", () => {
  const items = Array.from({ length: FEED_MAX_ITEMS + 50 }, (_, i) => `<item><title>Story ${i}</title><link>https://x.example/${i}</link></item>`).join("");
  assert.equal(parseFeed(`<rss><channel>${items}</channel></rss>`).items.length, FEED_MAX_ITEMS);
});

test("plain text and safe links", () => {
  assert.equal(plainText("<![CDATA[a <b>b</b>]]>"), "a b", "markup inside CDATA is removed");
  assert.equal(plainText("x &lt;i&gt;y&lt;/i&gt; z"), "x y z", "markup escaped once is removed");
  assert.equal(plainText("x &amp;lt;y&amp;gt; z"), "x <y> z", "text escaped twice is the publisher's literal text");
  assert.equal(safeLink("https://ok.example/a"), "https://ok.example/a");
  assert.equal(safeLink("data:text/html,hi"), null);
  assert.equal(safeLink("not a url"), null);
});
