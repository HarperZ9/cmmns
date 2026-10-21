// The claim symmetry test: the same claim shape about actors from every political direction must
// be handled alike. Each actor's post must match that actor's checked claim, never another
// actor's, with the same decision and the same score. If this fails, the matcher treats one
// side's claims differently from another's, and the layer must not ship.
import test from "node:test";
import assert from "node:assert/strict";
import { buildClaimIndex, matchClaims } from "../src/core/claims.js";

// Named actors from the left, the right, governments, companies and campaign groups.
const NAMED = [
  "Democrats", "Republicans", "Labour", "the Conservatives", "Biden", "Trump", "Macron", "Le Pen",
  "Putin", "Zelensky", "Netanyahu", "Hamas", "Greenpeace", "Exxon", "Soros", "Musk", "the WHO",
  "Pfizer", "Antifa", "the Proud Boys", "China", "Taiwan", "the EU", "the NRA",
];
// Lower-case groups, which the matcher cannot treat as names: they rely on the substitution check.
const GROUPS = [
  "immigrants", "veterans", "farmers", "police officers", "teachers", "union members", "gun owners",
  "climate activists", "evangelicals", "atheists", "billionaires", "students",
];

// [claim template, post template]: the post is a light rewording of the claim.
const NAMED_TEMPLATES = [
  ["{A} paid protesters to storm the capitol building last week", "BREAKING: {A} paid protesters to storm the capitol building last week https://t.co/x"],
  ["Leaked video shows {A} admitting the vaccine program was a cover up", "leaked video shows {A} admitting that the vaccine program was a cover up!!"],
  ["{A} secretly bought thousands of ballots in Arizona to win the election", "{A} secretly bought thousands of ballots in Arizona to win the election, share before deleted"],
  ["{A} plans to ban all private cars by 2030 under a new climate law", "{A} plans to ban all private cars by 2030 under the new climate law"],
];
const GROUP_TEMPLATES = [
  ["the government is paying {G} to vote twice in the county election", "The government is paying {G} to vote twice in the county election. Wake up."],
  ["official records show {G} receive free housing before local families", "official records show {G} receive free housing before local families"],
];
const RATINGS = ["False", "Pants on Fire", "Misleading", "Faux", "Falso", "Missing context"];

function fill(tpl, key, value) { return tpl.replace(key, value); }
function build(actors, templates, key) {
  const rows = [], urls = new Map();
  actors.forEach((a, i) => templates.forEach(([claim], t) => {
    const url = `https://check.example/${t}/${i}`;
    urls.set(`${t}|${a}`, url);
    rows.push([fill(claim, key, a), RATINGS[(i + t) % RATINGS.length], i % 3, url, "2024-05-01", "en"]);
  }));
  return { index: buildClaimIndex({ checkers: ["A", "B", "C"], rows }), urls };
}

function runSymmetry(name, actors, templates, key) {
  const { index, urls } = build(actors, templates, key);
  templates.forEach(([, post], t) => {
    test(`${name}: same decision and score for every actor, template ${t}`, () => {
      const results = actors.map((a) => {
        const hits = matchClaims(index, fill(post, key, a));
        return { a, n: hits.length, url: hits[0] && hits[0].url, coverage: hits[0] && hits[0].coverage, others: hits.filter((h) => h.url !== urls.get(`${t}|${a}`)).length };
      });
      for (const r of results) {
        assert.equal(r.url, urls.get(`${t}|${r.a}`), `${r.a} did not match its own claim`);
        assert.equal(r.others, 0, `${r.a} matched another actor's claim`);
      }
      assert.equal(new Set(results.map((r) => r.coverage)).size, 1, "coverage differed between actors");
    });
  });
}

runSymmetry("named actors", NAMED, NAMED_TEMPLATES, "{A}");
runSymmetry("groups", GROUPS, GROUP_TEMPLATES, "{G}");

test("the rating is passed through verbatim, whatever it says", () => {
  const { index } = build(["Biden", "Trump"], NAMED_TEMPLATES.slice(0, 1), "{A}");
  const a = matchClaims(index, "Biden paid protesters to storm the capitol building last week")[0];
  const b = matchClaims(index, "Trump paid protesters to storm the capitol building last week")[0];
  assert.equal(a.rating, RATINGS[0]);
  assert.equal(b.rating, RATINGS[1]);
});
