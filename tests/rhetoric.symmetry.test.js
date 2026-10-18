// The symmetry test: the same sentence about different groups must get the same markers,
// whichever side of politics would usually say it. If this test fails, the scoring treats
// one side's targets differently from another's, and the tool must not ship.
import test from "node:test";
import assert from "node:assert/strict";
import { score } from "../src/core/rhetoric.js";

// Targets drawn from every direction: groups the right is often hostile to, groups the left is
// often hostile to, and groups outside the left-right axis.
const TARGETS = [
  "immigrants", "muslims", "jews", "christians", "blacks", "whites", "trans people", "feminists",
  "leftists", "liberals", "communists", "democrats", "conservatives", "republicans", "nationalists", "fascists",
  "billionaires", "the rich", "landlords", "police", "protesters", "journalists", "men", "women", "farmers",
];

const families = (t) => score(t).markers.map((m) => m.family).sort().join(",");

const TEMPLATES = [
  ["{G} are vermin and should be treated like it", "dehumanise"],
  ["{G} are a plague on this country", "dehumanise"],
  ["{G} should all be shot", "violence"],
  ["{G} deserve to be hanged", "violence"],
  ["the media won't tell you what {G} are really doing", "conspiracy"],
  ["{G} are traitors, every one of them", "absolutist"],
  ["{G} are scum and they should all be killed", "dehumanise,violence"],
  // controls: strong disagreement without the marker grammar scores nothing
  ["I strongly disagree with {G} on almost everything", ""],
  ["{G} are wrong about the economy and I will vote against them", ""],
  ["{G} are not animals and nobody should talk like that", ""],
  ["I am angry at {G} today, this policy is a disaster", ""],
];

for (const [tpl, expected] of TEMPLATES) {
  test(`same markers for every target: "${tpl}"`, () => {
    const got = new Map(TARGETS.map((g) => [g, families(tpl.replace("{G}", g))]));
    const differing = [...got].filter(([, f]) => f !== expected);
    assert.deepEqual(differing, [], `targets scored differently from "${expected}"`);
  });
}

// Coded slogans in matched pairs: each pair is one family, one phrase from each side.
const PAIRS = [
  ["free helicopter rides for the commies", "bring out the guillotines for the billionaires", "violence"],
  ["day of the rope is coming", "bash the fash, all of them", "violence"],
  ["the protests are funded by soros", "the counter-protest is funded by the kochs", "conspiracy"],
  ["he is a race traitor", "he is a class traitor", "absolutist"],
  ["real patriots know the truth", "real americans know the truth", "absolutist"],
];

for (const [a, b, fam] of PAIRS) {
  test(`coded pair scores alike: "${a}" / "${b}"`, () => {
    assert.equal(families(a), fam);
    assert.equal(families(b), fam);
    assert.equal(score(a).score, score(b).score);
  });
}

test("policy positions are not markers", () => {
  for (const t of [
    "illegal immigrants should be deported under the law",
    "corrupt politicians should be jailed",
    "tax the rich and fund the schools",
    "we need stronger borders",
    "we need open borders",
    "abolish the police and fund communities",
    "back the blue",
  ]) assert.equal(score(t).score, 0, t);
});

test("ordinary uses of marker words are not markers", () => {
  for (const t of [
    "I wake up at six for the march",
    "the civil war in Sudan has killed thousands",
    "my cat caught rats in the barn",
    "the guillotine at the museum was terrifying",
  ]) assert.ok(!score(t).extreme, t);
});

// Blanket claims about every member of a group, from several directions.
test("blanket claims about a group score the same for every target", () => {
  const got = new Map(TARGETS.map((g) => [g, families(`all ${g} are the same`)]));
  assert.deepEqual([...got].filter(([, f]) => f !== "essentialise"), []);
});

test("calls for people outside the law to act are markers on every side", () => {
  for (const t of ["the locals will deal with them", "the comrades will deal with them", "time to take matters into our own hands", "send in the army against them"]) {
    assert.equal(families(t), "vigilante", t);
  }
});

test("slang slurs read as group terms from more than one side", () => {
  for (const t of ["those mussie scum", "those magat scum", "those fash scum"]) assert.equal(families(t), "dehumanise", t);
});

test("coded hate terms register for targets in every direction", () => {
  for (const t of ["the black fatigue is everywhere", "13/50 again", "the goyim know", "kung flu strikes", "send the wetbacks home", "more troons on tv", "white devils did this", "kill all men lol"]) {
    assert.equal(families(t), "slur", t);
  }
});

test("ambiguous coded terms weigh less and need company to count as extreme", () => {
  assert.equal(families("the fatigue is real"), "slurSoft");
  assert.equal(score("the fatigue is real").extreme, false);
  assert.equal(score("the fatigue is real, traitors all of them").extreme, true);
  for (const t of ["I saw a jogger by the lake", "crackers and cheese for lunch", "I use jq to parse json", "41% of voters agreed"]) assert.ok(!score(t).extreme, t);
});

test("stereotypes score the same for every target", () => {
  const got = new Map(TARGETS.map((g) => [g, families(`${g} are lazy`)]));
  assert.deepEqual([...got].filter(([, f]) => f !== "stereotype"), []);
});

test("invented motives score the same for every target", () => {
  const got = new Map(TARGETS.map((g) => [g, families(`${g} want to destroy everything`)]));
  assert.deepEqual([...got].filter(([, f]) => f !== "motive"), []);
});

test("slurs register in every direction, including disguised spellings", () => {
  for (const t of ["typical chink behaviour", "go home spic", "kike bankers", "stupid towelhead", "dumb honky", "what a faggot", "such a retard", "n1gg3r", "k1ke"]) {
    assert.ok(families(t).split(",").includes("slur"), t);
  }
});

test("innocent words that contain or resemble slurs do not count as slurs", () => {
  for (const t of ["a raccoon in the garden", "the Spice Girls reunion", "flame retardant foam", "I'm a fag hag for the 90s", "my japonica bloomed", "Scunthorpe United won"]) {
    assert.ok(!families(t).split(",").includes("slur"), t);
  }
});

test("scoring stays fast enough to run on every reply", () => {
  const t0 = performance.now();
  for (let i = 0; i < 2000; i++) score("I strongly disagree with the new immigration policy and I will vote against it next year " + i);
  assert.ok(performance.now() - t0 < 1500, "2,000 replies should score in well under 1.5 s");
});
