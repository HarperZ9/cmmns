// SYNTHETIC labelled cases for the duplicate and mismatch detectors. Written for this evaluation
// on 2026-10-21; the label of each case is set by how it was built, not by a human annotator.
// These are a pilot: they show how the detectors behave on known kinds of input. Measured
// rates on live, human-labelled threads are still pending the author's labelling.

import { duplicateClusters } from "../../src/core/similarity.js";
import { compare } from "../../src/core/mismatch.js";
import { confusion } from "./metrics.mjs";

const BASES = [
  "The new transit plan will cut the commute for everyone living east of the river by twenty minutes",
  "I have watched this channel for years and the coverage of the election was the most balanced I have seen",
  "Nobody in my town asked for this factory and now the water tastes like metal every single morning",
  "This is exactly why we need independent audits of every vote count in every county across the state",
  "The minister promised cheaper energy bills last winter and my bill went up by forty percent instead",
  "Our hospital lost three nurses this month because the pay has not kept up with rent in the city",
  "Stop sharing that video it was filmed two years ago in another country and has nothing to do with this",
  "The protest was peaceful until a small group arrived at night and started breaking shop windows downtown",
  "Teachers have been asking for smaller classes for a decade and the budget still ignores them completely",
  "If the bridge had been inspected on schedule this collapse would never have happened and people know it",
  "Farmers in the valley are selling their land because the drought insurance payouts never arrived on time",
  "The referee made the worst call of the season and the league should review every decision from that game",
];

// Edits that copy-paste campaigns use: case, punctuation, emoji, a handle, a link, a hashtag.
const EDITS = [
  (t) => t.toUpperCase(),
  (t) => t + "!!! 🔥🔥",
  (t) => "@someone " + t,
  (t) => t + " https://example.org/x" + t.length,
  (t) => t.replace(/ the /, " this "),
  (t) => t + " #truth",
  (t) => t.replace(/,/g, "").replace(/ and /, " & "),
];

// Labelled pairs come from these replies: copies of one base by different authors share a
// group; everything else is a different group.
export function duplicateCases() {
  const replies = [];
  BASES.forEach((b, bi) => {
    replies.push({ id: `b${bi}`, author: `a${bi}`, text: b, group: `g${bi}` });
    if (bi % 3 === 2) return; // a third of the bases have no copies
    EDITS.slice(0, 2 + (bi % 5)).forEach((e, ei) => replies.push({ id: `b${bi}e${ei}`, author: `c${bi}_${ei}`, text: e(b), group: `g${bi}` }));
  });
  // Negatives: the same stock phrase in different replies, short identical replies (below the
  // six-word floor by design), the same author posting twice, and one shared opening clause.
  const stock = ["Totally agree with this", "This is so true", "lol", "Well said", "100%"];
  stock.forEach((s, i) => { for (let k = 0; k < 3; k++) replies.push({ id: `s${i}_${k}`, author: `s${i}_${k}`, text: s, group: `s${i}_${k}` }); });
  ["I have watched this channel for years and I still cannot stand the host",
    "Nobody in my town asked for this and nobody will vote for him again"].forEach((t, i) => replies.push({ id: `n${i}`, author: `n${i}`, text: t, group: `n${i}` }));
  replies.push({ id: "self", author: "a0", text: BASES[0] + " again", group: "self" });
  return replies;
}

export function evaluateDuplicates() {
  const replies = duplicateCases();
  const clusters = duplicateClusters(replies);
  const cid = new Map();
  clusters.forEach((c, i) => c.ids.forEach((id) => cid.set(id, i)));
  const rows = [];
  for (let x = 0; x < replies.length; x++) for (let y = x + 1; y < replies.length; y++) {
    const a = replies[x], b = replies[y];
    if (a.author === b.author) continue;
    rows.push({ item: { gold: a.group === b.group }, hit: cid.has(a.id) && cid.get(a.id) === cid.get(b.id) });
  }
  return { synthetic: true, unit: "reply pairs from different authors", replies: replies.length, ...confusion(rows, (r) => r.hit, (i) => i.gold) };
}

// [text, platform label, does a person speak as a local of a place other than the label?]
export const MISMATCH_CASES = [
  ["Here in France nobody believes this", "Nigeria", true], ["Here in France nobody believes this", "France", false],
  ["Here in France nobody believes this", "Europe", false], ["As a Frenchman I am ashamed", "Pakistan", true],
  ["As a Frenchman I am ashamed", "France", false], ["We Americans are tired of this", "Russia", true],
  ["We Americans are tired of this", "United States", false], ["We Americans are tired of this", "North America", false],
  ["I live in London and the trains are fine", "India", true], ["I live in London and the trains are fine", "United Kingdom", false],
  ["I'm from Germany, this is false", "Turkey", true], ["I'm from Germany, this is false", "Germany", false],
  ["Born and raised in Texas, never seen this", "Nigeria", true], ["My fellow Canadians, wake up", "China", true],
  ["My fellow Canadians, wake up", "Canada", false], ["Ici en France on en a marre", "Algeria", true],
  ["Ici en France on en a marre", "France", false], ["Nous les Français on paie tout", "Morocco", true],
  ["As an English speaker I find this confusing", "Japan", false], ["As a French teacher I disagree", "Brazil", false],
  ["France is in chaos tonight", "Nigeria", false], ["The French government lied again", "Russia", false],
  ["I visited Paris last summer, lovely", "Australia", false], ["We need answers from Germany", "Iran", false],
  ["As an Italian living abroad I worry", "Argentina", true], ["Here in the UK prices doubled", "Egypt", true],
  ["Here in the UK prices doubled", "United Kingdom", false], ["We Brits never vote for this", "Ghana", true],
  ["As a German I understand", "", false], ["Here in Spain it is quiet", "Spain", false],
  ["Here in Spain it is quiet", "Vietnam", true], ["I grew up in Ireland and still go back", "United States", true],
];

export function evaluateMismatch() {
  const rows = MISMATCH_CASES.map(([text, label, gold]) => ({ item: { gold }, hit: compare(text, label).status === "mismatch" }));
  return { synthetic: true, unit: "reply and label pairs", cases: rows.length, ...confusion(rows, (r) => r.hit, (i) => i.gold) };
}
