import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setOwnerRows, ownerOfDomain, ownerOfHandle, domainsIn } from "../src/core/owners.js";

const table = JSON.parse(readFileSync(new URL("../src/ext/owners.json", import.meta.url), "utf8"));
setOwnerRows(table.rows);

test("every row comes from a Wikidata item", () => {
  assert.ok(table.rows.length > 1000);
  for (const r of table.rows) assert.match(r.source, /wikidata\.org\/entity\/Q\d+$/, r.domain);
});

test("domains resolve to the most specific listed outlet, with or without www and paths", () => {
  assert.equal(ownerOfDomain("https://www.washingtonpost.com/world/x").owner, "Jeff Bezos");
  assert.equal(ownerOfDomain("lefigaro.fr").owner, "Dassault Group");
  assert.equal(ownerOfDomain("not-a-listed-outlet.example"), null);
});

test("owners who have died or were dissolved are filtered out", () => {
  for (const r of table.rows) assert.ok(!/Robert Hersant|François Coty|Andrew Breitbart|CBS Corporation/.test(r.owner), r.domain);
});

test("X handles resolve case-insensitively", () => {
  const any = table.rows.find((r) => r.x);
  assert.equal(ownerOfHandle(any.x.toUpperCase()).domain, any.domain);
});

test("domains are found in post and card text", () => {
  assert.deepEqual(domainsIn("From washingtonpost.com and see bbc.co.uk/news"), ["washingtonpost.com", "bbc.co.uk"]);
});
