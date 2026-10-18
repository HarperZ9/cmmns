import test from "node:test";
import assert from "node:assert/strict";
import { OWNERS, ownerOfDomain, ownerOfHandle, domainsIn } from "../src/core/owners.js";

test("every owner entry names a source", () => {
  for (const o of OWNERS) assert.match(o.source, /^https:\/\//, o.name);
});

test("domains resolve to the most specific listed outlet, with or without www and paths", () => {
  assert.equal(ownerOfDomain("https://www.washingtonpost.com/world/x").name, "The Washington Post");
  assert.equal(ownerOfDomain("news.sky.com").name, "Sky News");
  assert.equal(ownerOfDomain("m.youtube.com").name, "YouTube");
  assert.equal(ownerOfDomain("example.com"), null);
});

test("handles resolve case-insensitively", () => {
  assert.equal(ownerOfHandle("FoxNews").name, "Fox News");
  assert.equal(ownerOfHandle("someone"), null);
});

test("domains are found in post and card text", () => {
  assert.deepEqual(domainsIn("From washingtonpost.com and see bbc.co.uk/news"), ["washingtonpost.com", "bbc.co.uk"]);
});
