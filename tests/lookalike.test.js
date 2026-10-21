// Look-alike news addresses: the clone patterns influence operations used are caught, and real
// outlets never match. The controls are every domain in the outlet-owner table (Wikidata) and the
// site table, plus the listed outlets' own domains and subdomains. The rules were tuned against
// these same tables, so the controls guard against regressions; they are not a held-out error rate.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lookalikeOf, punyDecode, oneEdit, splitHost } from "../src/core/lookalike.js";
import { OUTLETS } from "../src/core/lookalike-outlets.js";

const ROOT = join(import.meta.dirname, "..");
const json = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

test("the clone patterns from the reports are caught", () => {
  const cases = {
    "washingtonpost.pm": "swapped ending", "spiegel.ltd": "swapped ending", "bild.pics": "swapped ending", "theguardian.co.com": "swapped ending",
    "t-online.life": "swapped ending", "faz.ltd": "swapped ending", "theguaradian.com": "misspelling", "theatlatnic.com": "misspelling",
    "indepnedent.co": "misspelling", "bloomberq.com": "misspelling", "haaaretz.com": "misspelling", "bildd.lol": "misspelling",
    "xn--theguardan-4ub.com": "look-alike letters", "thejerusalempost.org": "copies the name", "rbk.media": "copies the name",
  };
  for (const [d, how] of Object.entries(cases)) assert.equal((lookalikeOf(d) || {}).how, how, d);
});

test("an outlet's own domains and subdomains never match", () => {
  for (const o of OUTLETS) for (const d of o.domains) {
    assert.equal(lookalikeOf(d), null, d);
    assert.equal(lookalikeOf("www." + d), null, d);
    assert.equal(lookalikeOf("amp." + d), null, d);
  }
});

test("no real outlet in the owner table or the site table matches a clone pattern", () => {
  const owners = json("src/ext/owners.json").rows.map((r) => r.domain), sites = Object.keys(json("src/ext/sites.json").facts);
  const all = [...new Set([...owners, ...sites])];
  assert.ok(all.length > 50000, "the controls cover the tables");
  assert.deepEqual(all.filter((d) => lookalikeOf(d)), []);
});

test("regional outlets that share a word with a listed outlet do not match", () => {
  for (const d of ["guardian.ng", "independent.ie", "delfi.lv", "politico.eu", "huffingtonpost.fr", "aljazeera.net", "20minutos.es", "nltimes.nl", "kypost.com", "uatoday.tv", "nbcnews.com", "pravda.ru", "telegraph.co.uk", "dailytelegraph.com.au"]) {
    assert.equal(lookalikeOf(d), null, d);
  }
});

test("it catches a measured share of the report-named domains", () => {
  // Most named domains are operation brands, not copies of an outlet, so most are not look-alikes.
  const doms = [...new Set(json("data/ops.json").indicators.filter((i) => i.d).map((i) => i.d))];
  const caught = doms.filter((d) => lookalikeOf(d)).length;
  assert.ok(caught >= 140, `caught ${caught} of ${doms.length}`);
});

test("helpers: punycode, one edit, host split", () => {
  assert.equal(punyDecode("xn--mnchen-3ya"), "münchen");
  assert.equal(punyDecode("plain"), "plain");
  assert.equal(oneEdit("speigel", "spiegel"), "swap");
  assert.equal(oneEdit("haaaretz", "haaretz"), "double");
  assert.equal(oneEdit("bloomberq", "bloomberg"), "change");
  assert.equal(oneEdit("abc", "xyz"), null);
  assert.deepEqual(splitHost("theguardian.co.com"), ["theguardian", "co.com"]);
  assert.deepEqual(splitHost("news.bbc.co.uk"), ["bbc", "co.uk"]);
  assert.deepEqual(splitHost("abc.go.com"), ["go", "com"]);
});
