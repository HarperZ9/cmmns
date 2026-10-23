// Group stereotypes, from misses in the 2026-10-23 feed test (82 X posts, a development set). The
// sentences paraphrase the structure of the missed posts; none is copied. Each rule runs over every
// faith and race (and origin, where the rule reads it), whichever side usually targets the group.
// Near misses must not fire: quoting to criticise, reporting, counter-speech, no group named.
import test from "node:test";
import assert from "node:assert/strict";
import { score } from "../src/core/rhetoric.js";
import { IDENTITY_GROUPS, ORIGIN_GROUPS, IDENTITY_ADJ } from "../src/core/lexicon.js";

const families = (t) => score(t).markers.map((m) => m.family).sort().join(",");
const every = (groups, tpl, expected = "stereotype") => {
  const differing = groups.map((g) => [g, families(tpl.replace("{G}", g))]).filter(([, f]) => f !== expected);
  assert.deepEqual(differing, [], tpl);
};

test("control put on a people, for every faith and race", () => {
  every(IDENTITY_GROUPS, "honestly {G} control the media and the banks");
  every(IDENTITY_GROUPS, "it is obvious that {G} secretly run this country");
  // these two also name the secret-control theory (src/core/theories.js), for every group alike
  every(IDENTITY_ADJ, "a rich {G} cabal is calling the shots", "conspiracy-theory,stereotype");
  every(IDENTITY_ADJ, "{G} money and influence control American foreign policy", "conspiracy-theory,stereotype");
});

test("a people predicted to attack, or named as a country's ruin, or by a trait word", () => {
  every(IDENTITY_GROUPS, "watch, the {G} will probably attack the festival");
  every([...IDENTITY_GROUPS, ...ORIGIN_GROUPS], "letting in more {G} will be the downfall of this nation");
  every(IDENTITY_ADJ, "being soft on {G} immigrants will cause your ruin");
  every([...IDENTITY_GROUPS, ...ORIGIN_GROUPS], "why import illiterate {G} to sit on welfare");
});

test("near misses: quoting to criticise, reporting, counter-speech", () => {
  assert.equal(families('She posted "Jews control the media" and it is an old lie'), "");
  assert.equal(families("The survey asked whether Muslims will attack anyone"), "");
  assert.equal(families("the myth that Christians secretly run the government keeps coming back"), "");
  assert.equal(families("Saying white people control everything is racist and lazy"), "");
  assert.equal(families("Posts saying Catholic money controls the courts are spreading again"), "");
});

test("near misses: the same words with no people named", () => {
  assert.equal(families("Billionaires control the media and that is a policy problem"), "");
  assert.equal(families("Big tech money controls Washington"), "");
  assert.equal(families("the rebels will attack the city at dawn"), "");
  assert.equal(families("Russia will probably attack again in spring"), "");
  assert.equal(families("leave the dirty dishes for later"), "");
  assert.equal(families("the dirty chinese restaurant on main street closed"), "");
  assert.equal(families("the cabal of executives on the board voted it down"), "");
});
