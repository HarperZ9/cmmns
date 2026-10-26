// The reframing marker (project-docs/ARGUMENT-LENS.md): an isomer is the same parts in a different
// arrangement. A post names the same people and things as the sources beneath it (the replies that bring
// a source, the documents they link) but puts them in an act none of those sources states, or states
// only to deny. The worked example of 2026-10-26: a documented relationship and a documented killing,
// rearranged as "hired a hitman". The marker compares words; it reads no side and no person.
import { keyTerms, findIn } from "./docclaim.js";
import { content, fold } from "./text.js";

export const ISOMER_DOES_NOT_PROVE = "Sources can be incomplete, and words the sources lack can still be true. This shows only that the post's arrangement goes past what the sources beneath it say.";
const NEGATION = /\b(?:no|not|never|nor|false|untrue|without|denied|denies|deny|no credible evidence|there is no|unfounded|baseless)\b/i;

// Where a term sits in a source: "stated", "denied" (a negation in the 80 characters before it), or null.
function standing(source, term) {
  const t = fold(source), hit = findIn(source, term);
  if (!hit) return null;
  const at = t.indexOf(hit);
  return at >= 0 && NEGATION.test(t.slice(Math.max(0, at - 80), at)) ? "denied" : "stated";
}

// claim: the post's text; sources: [{ text }]. Returns null, or { shared, added, denied, sources }.
export function reframing(claim, sources) {
  const usable = (sources || []).filter((s) => s && s.text && s.text.length > 40);
  if (!usable.length) return null;
  const names = keyTerms(claim).filter((t) => t.kind === "name").map((t) => t.term);
  const nameWords = new Set(names.flatMap((n) => content(n)));
  const shared = names.filter((n) => usable.some((s) => standing(s.text, n)));
  const acts = [...new Set(content(claim).filter((w) => w.length >= 4 && !nameWords.has(w)))];
  const added = [], denied = [];
  for (const w of acts) {
    const st = usable.map((s) => standing(s.text, w));
    if (st.includes("stated")) continue;
    (st.includes("denied") ? denied : added).push(w);
  }
  if (shared.length < 2 || added.length + denied.length < 1) return null;
  return { shared, added, denied, sources: usable.length };
}

export function reframingRows(r) {
  return [
    ["Same parts", `The post names what the ${r.sources} ${r.sources === 1 ? "source" : "sources"} beneath it name: ${r.shared.join(", ")}.`],
    ...(r.denied.length ? [["Stated only to deny", `The sources contain ${r.denied.map((w) => `"${w}"`).join(", ")} only next to a denial.`]] : []),
    ...(r.added.length ? [["In none of the sources", r.added.slice(0, 10).map((w) => `"${w}"`).join(", ")]] : []),
    ["What it shows", ISOMER_DOES_NOT_PROVE],
  ];
}
