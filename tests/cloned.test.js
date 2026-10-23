// Cloned-outlet framing (src/core/cloned.js): a post that names an outlet while linking a look-alike
// of it. The outlet's name is the only wording read, so the result never depends on the topic.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clonedCitations, namesOutlet, CLONED_DOES_NOT_PROVE } from "../src/core/cloned.js";
import { setOpsTable } from "../src/core/ops.js";

setOpsTable(JSON.parse(readFileSync(new URL("../data/ops.json", import.meta.url), "utf8")));

test("names the outlet: with or without The, accents folded, or its own address", () => {
  assert.ok(namesOutlet("The Washington Post reports the plan failed", "The Washington Post", "washingtonpost.com"));
  assert.ok(namesOutlet("washington post says", "The Washington Post", "washingtonpost.com"));
  assert.ok(namesOutlet("Laut SUDDEUTSCHE ZEITUNG", "Süddeutsche Zeitung", "sueddeutsche.de"));
  assert.ok(namesOutlet("seen on spiegel.de today", "Der Spiegel", "spiegel.de"));
  assert.ok(!namesOutlet("a post about the postal service", "The Washington Post", "washingtonpost.com"));
});

test("a look-alike link is marked named only when the post names the copied outlet", () => {
  const [a] = clonedCitations("Der Spiegel: the sanctions failed", ["spiegel.ltd"]);
  assert.deepEqual([a.outlet, a.how, a.named], ["Der Spiegel", "swapped ending", true]);
  const [b] = clonedCitations("read this", ["spiegel.ltd"]);
  assert.equal(b.named, false);
  assert.deepEqual(clonedCitations("Der Spiegel says", ["spiegel.de", "example.org"]), [], "the real address and unrelated links are not look-alikes");
});

test("an address a published report named lists the operation", () => {
  const ops = JSON.parse(readFileSync(new URL("../data/ops.json", import.meta.url), "utf8"));
  const named = ops.indicators.map((i) => i.d).filter(Boolean).find((d) => clonedCitations("", [d]).length);
  assert.ok(named, "some report-named domain is a look-alike");
  assert.ok(clonedCitations("", [named])[0].reports.length >= 1);
});

test("the topic around the outlet's name never changes the result", () => {
  const topics = ["immigration", "Ukraine", "Israel", "Gaza", "vaccines", "the election", "climate", "taxes", "the president", "the opposition"];
  const got = new Set(topics.map((t) => JSON.stringify(clonedCitations(`The Washington Post on ${t}: read it here`, ["washingtonpost.pm"]))));
  assert.equal(got.size, 1);
  assert.match(CLONED_DOES_NOT_PROVE, /the words and the address disagree/);
});
