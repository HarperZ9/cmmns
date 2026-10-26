// The persona account marker (project-docs/DISCOURSE.md): an account whose display name is the name
// of a well-known person who has died, such as "Arthur Schopenhauer" posting in 2026. The names come
// from Wikidata (src/ext/discourse/persons.json, CC0), and the build keeps only names no other person
// in Wikidata shares who might be alive (scripts/discourse-data.mjs persons). A second cue is
// required: the handle carries the name, or the display name says what kind of account it is.
// It never names a living person, and it says what the account is not, never what it intends.
import { fold, containsNear, editDistance } from "./text.js";

export const PERSONA_DOES_NOT_PROVE = "A display name is chosen by whoever runs the account. Fan pages, quote accounts, parodies and tributes all use the names of people who have died. This shows only that the name belongs to someone who died, according to Wikidata.";
export const CHECKMARK_NOTE = "On X, the blue checkmark has been sold as part of a paid subscription since 2023. It does not confirm who runs an account.";

// Words that say an account presents a person's work rather than being that person.
const KIND = /\b(quotes?|wisdom|philosophy|literature|daily|official|fan|fans|parody|tribute|archive|words|teachings|legacy|thoughts|writings|letters|sayings|bot|reads?|books?|now)\b/i;

const tokens = (s) => (fold(s).match(/[a-z]+/g) || []);

// The lookup over persons.json: first token to [[tokens], person].
export function buildPersons(data) {
  const byFirst = new Map();
  for (const p of data.people || []) {
    const [qid, name, born, died, names] = p;
    for (const n of names || [name]) {
      const t = tokens(n);
      if (!t.length) continue;
      let l = byFirst.get(t[0]);
      if (!l) byFirst.set(t[0], (l = []));
      l.push([t, { qid, name, born, died }]);
    }
  }
  return { byFirst, source: data.source || null };
}

// The person whose full name runs, word for word, through the display name. Longest name wins.
function inDisplay(index, display) {
  const t = tokens(display);
  let best = null;
  for (let i = 0; i < t.length; i++) {
    for (const [nt, person] of index.byFirst.get(t[i]) || []) {
      if (nt.every((w, k) => t[i + k] === w) && (!best || nt.length > best.tokens.length)) best = { person, tokens: nt, extra: t.length - nt.length };
    }
  }
  return best;
}

// Does the handle carry the person's name? Each name word of five letters or more is looked for,
// with one letter of slack for six letters or more ("LeoTollstoy").
function handleCue(handle, nameTokens) {
  const h = fold(handle).replace(/[^a-z]/g, "");
  const long = nameTokens.filter((w) => w.length >= 5);
  if (!long.length) return nameTokens.join("") === h ? nameTokens.join(" ") : null;
  return long.find((w) => containsNear(h, w)) || null;
}

// account: { display, handle, verified }. Returns null, or the marker: the person, the cue that
// carried it and the rows the window shows.
export function personaOf(index, account) {
  if (!index || !account || !account.display) return null;
  const hit = inDisplay(index, account.display);
  if (!hit) return null;
  const inHandle = account.handle ? handleCue(account.handle, hit.tokens) : null;
  const kindWord = hit.extra > 0 ? (account.display.match(KIND) || [])[0] : null;
  if (!inHandle && !kindWord) return null;
  const p = hit.person, years = `${yearText(p.born)} to ${yearText(p.died)}`;
  return {
    person: p, cue: inHandle ? "handle" : "display",
    label: `uses the name of ${p.name} (died ${yearText(p.died)})`,
    rows: [
      ["What Daylight Commons sees", `This account's name is the name of ${p.name} (${years}), who died ${p.died < 0 || p.died < 1900 ? "long before social media" : "in " + yearText(p.died)}. It is not that person writing.`],
      ["Why it shows", inHandle ? `The display name and the handle both carry the name ("${inHandle}").` : `The display name adds "${kindWord}" to the name.`],
      ...(account.verified ? [["The checkmark", CHECKMARK_NOTE]] : []),
      ["Source", `Wikidata ${p.qid}, from the name list that ships inside Daylight Commons.`],
      ["What it shows", PERSONA_DOES_NOT_PROVE],
    ],
  };
}

export const yearText = (y) => (y == null ? "unknown" : y <= 0 ? `${1 - y} BCE` : String(y));

// Exposed for tests: a handle is "close" to a name word when one letter differs.
export const nearWord = (a, b) => editDistance(fold(a), fold(b), 1) <= 1;
