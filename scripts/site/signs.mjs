// The lead of the transparency page: one figure per sign that has a measurement, each with a plain
// sentence first and its counts in "How we know". Inputs are the committed results files.
import { esc } from "./page.mjs";
import { ciFigure, signBlock } from "./figures.mjs";
import { SHIP_PRECISION } from "../../src/core/persuasion.js";
import { BASELINE_SOURCE } from "../../src/core/baselines.js";
import { wilson } from "../../src/core/report.js";

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const per100 = (x) => Math.round(x * 100);
const counts = (r) => `${r.k.toLocaleString("en")} of ${r.n.toLocaleString("en")}; 95% interval ${pct(r.ci[0])} to ${pct(r.ci[1])}`;
const LANG = { slur: "Slur or coded hate term", violence: "Call for violence", dehumanise: "Dehumanising language", stereotype: "Group stereotype" };
const DNP_LANG = "Words can be quoted, ironic or reported speech. A sign describes the post, not who wrote it or why.";

function languageSigns(fams) {
  return Object.entries(LANG).filter(([id]) => fams[id] && fams[id].measured).map(([id, name]) => {
    const d = fams[id], r = d.precision;
    return signBlock({ title: name, takeaway: `When Radar shows this sign, the people who labelled the test comments agreed ${per100(r.value)} times in 100.`,
      figure: ciFigure({ value: r.value, ci: r.ci, what: `${name}, precision` }),
      details: [["Precision", esc(counts(r))], d.precisionRange ? ["Range across corpora", esc(d.precisionRange.map(pct).join(" to "))] : null,
        d.recall ? ["Recall", esc(`${pct(d.recall.value)} (${counts(d.recall)}). Radar is built for precision, so it misses most cases.`)] : null,
        ["Data", "Measuring Hate Speech, HateXplain and Civil Comments, held-out test split"], ["Does not prove", esc(DNP_LANG)]] });
  });
}

function persuasionSigns(ptc) {
  return Object.entries(ptc.techniques).filter(([, x]) => x.precision.n >= 20).map(([id, x]) => {
    const name = id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()), r = x.precision;
    return signBlock({ title: `Persuasion: ${name.toLowerCase()}`, takeaway: `Held back: right ${per100(r.value)} times in 100 on news articles, under the bar of ${per100(SHIP_PRECISION)}.`,
      figure: ciFigure({ value: r.value, ci: r.ci, bar: SHIP_PRECISION, what: `${name}, precision` }),
      details: [["Precision", esc(counts(r))], ["Recall", esc(pct(x.recall.value))], ["Chance", esc(`${pct(x.chance.value)} of words sit inside a span of this technique`)],
        ["Data", "Propaganda Techniques Corpus v2, held-out articles"], ["Does not prove", "A technique can carry a true claim; it describes how a post argues."]] });
  });
}

// Coordination signs: what normal looks like, from ordinary threads.
function coordinationSigns(B) {
  const bin = "20-49", same = B.same[bin], burst = B.burst[bin], tog = B.together["100"];
  const max = 0.1;
  return [
    signBlock({ title: "Same text as other replies", takeaway: `In ordinary threads with 20 to 49 replies, a group of near-identical replies shows up in ${pct(same.share)} of threads.`,
      figure: ciFigure({ value: same.share, ci: same.ci, max, what: "Same text, ordinary threads of 20 to 49 replies" }),
      details: [...Object.entries(B.same).map(([b, r]) => [`${b} replies`, esc(counts(r))]), ["Before quotes were set aside", "33% to 47% of these threads, almost all from replies that copied the post they quoted"], ["Source", esc(BASELINE_SOURCE)]] }),
    signBlock({ title: "Burst of replies", takeaway: `In ordinary threads with 20 to 49 replies, a burst like those Radar reports shows up in ${pct(burst.share)} of threads.`,
      figure: ciFigure({ value: burst.share, ci: burst.ci, max, what: "Bursts, ordinary threads of 20 to 49 replies" }),
      details: [...Object.entries(B.burst).map(([b, r]) => [`${b} replies`, esc(counts(r))]), ["Independent posting", esc(`A simulation where each reply is timed on its own, at the thread's own pace, fires in ${Object.values(B.burstDecayNull).map((r) => pct(r.share)).join(", ")} of threads by size.`)], ["Source", esc(BASELINE_SOURCE)]] }),
    signBlock({ title: "Accounts seen together", takeaway: `For someone who opened about 100 threads on one news story, a pair seen together in two or more other threads shows up in ${pct(tog.share)} of threads.`,
      figure: ciFigure({ value: tog.share, ci: tog.ci, max, what: "Accounts seen together, about 100 threads viewed" }),
      details: [...Object.entries(B.together).map(([w, r]) => [`About ${w} threads`, esc(counts(r))]), ["Independent posting", esc(`With the same accounts placed in threads at random: ${Object.values(B.togetherNull).map((r) => pct(r.share)).join(", ")}.`)], ["Source", esc(BASELINE_SOURCE)]] }),
  ];
}

export function leadSigns({ D, ptc, B, fold }) {
  const f = fold, s = D.duplicates.precision;
  return [
    ...languageSigns(D.families),
    signBlock({ title: "The thread report's \"extreme\"", takeaway: `When the report counts a reply as extreme, the corpus labelled it severe ${per100(D.extreme.precision.value)} times in 100.`,
      figure: ciFigure({ value: D.extreme.precision.value, ci: D.extreme.precision.ci, what: "Extreme, precision" }),
      details: [["Precision", esc(counts(D.extreme.precision))], ["Recall", esc(counts(D.extreme.recall))], ["Data", "Measuring Hate Speech severity labels"]] }),
    ...coordinationSigns(B),
    signBlock({ title: "Look-alike letters", takeaway: `Copies with one letter swapped for a Cyrillic or Greek look-alike: Radar now finds ${f.after} in 100, up from ${f.before}.`,
      figure: ciFigure({ value: f.after / 100, ci: wilson(f.after, 100), what: "Copies found after folding look-alike letters" }),
      details: [["Seeded copies", esc(`${f.after} of 100 found after folding, ${f.before} of 100 before`)], ["Ordinary text", esc(`${f.changed} of ${f.replies.toLocaleString("en")} replies in ordinary threads changed at all, mostly fullwidth letters and digits read as plain ones`)],
        ["Test cases", esc(`Same text, cases written for the test: ${counts(s)}`)], ["Data", "Unicode confusables table (UTS #39), Unicode License v3"]] }),
    ...persuasionSigns(ptc),
  ].join("\n");
}
