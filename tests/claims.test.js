// The claim matcher (src/core/claims.js): a post is matched to a fact-checked claim only when
// it carries nearly all of the claim's wording. The false-match controls below are the cases
// that look similar but are a different claim; each must stay unmatched.
import test from "node:test";
import assert from "node:assert/strict";
import { buildClaimIndex, matchClaims, claimTokens, guessLanguage, claimCard, CLAIM_DOES_NOT_PROVE, MIN_CLAIM_TOKENS, nearToken } from "../src/core/claims.js";

const TABLE = {
  checkers: ["Checker A", "Checker B", "Checker C"],
  rows: [
    ["The 2020 election was stolen through millions of fake mail-in ballots in Arizona", "Pants on Fire", 0, "https://a.example/1", "2021-01-05", "en"],
    ["Pfizer vaccine causes infertility in women, a new study finds", "Falso", 1, "https://b.example/2", "2022-03-01", "en"],
    ["Photo shows Eiffel Tower on fire after protests in Paris", "Missing context", 2, "https://c.example/3", "2023-06-30", "en"],
    ["Wind turbines kill more birds every year than cats and buildings combined", "Mostly false", 0, "https://a.example/4", "2024-02-11", "en"],
    ["Drinking hot water with lemon cures the coronavirus within three days", "False", 1, "https://b.example/5", "2020-04-02", "en"],
    ["Le gouvernement va interdire les voitures diesel dans toutes les villes en 2025", "Faux", 2, "https://c.example/6", "2024-09-01", "fr"],
    ["this is fake", "False", 0, "https://a.example/7", "2024-01-01", "en"],
  ],
};
const idx = buildClaimIndex(TABLE);
const top = (text) => matchClaims(idx, text)[0] || null;

test("an exact repost of a checked claim matches, with the rating in the checker's words", () => {
  const m = top("BREAKING: The 2020 election was stolen through millions of fake mail-in ballots in Arizona!! https://t.co/abc @someone");
  assert.ok(m);
  assert.equal(m.rating, "Pants on Fire");
  assert.equal(m.checker, "Checker A");
  assert.equal(m.url, "https://a.example/1");
  assert.equal(m.date, "2021-01-05");
  assert.equal(m.coverage, 1);
});

test("light rewording still matches", () => {
  assert.equal((top("Wind turbines are killing more birds every year than cats and buildings combined") || {}).url, "https://a.example/4");
  assert.equal((top("Le gouvernement va interdire toutes les voitures diesel dans les villes en 2025") || {}).rating, "Faux");
});

test("a post that denies the claim still matches, and says the two differ on 'not'", () => {
  const m = top("No, drinking hot water with lemon does not cure the coronavirus within three days");
  assert.ok(m);
  assert.equal(m.negationDiffers, true);
  assert.equal(top("Drinking hot water with lemon cures the coronavirus within three days").negationDiffers, false);
});

// False-match controls.
test("control: same topic, different claim", () => {
  assert.equal(top("I got the Pfizer vaccine today and feel completely fine"), null);
  assert.equal(top("Women should talk to a doctor before any new study finds its way into their routine"), null);
});
test("control: a different year or number is a different claim", () => {
  assert.equal(top("The 2024 election was stolen through millions of fake mail-in ballots in Arizona"), null);
  assert.equal(top("Drinking hot water with lemon cures the coronavirus within ten days"), null);
});
test("control: a different named place is a different claim", () => {
  assert.equal(top("The 2020 election was stolen through millions of fake mail-in ballots in Georgia"), null);
  assert.equal(top("Photo shows Big Ben on fire after protests in London"), null);
});
test("control: a swapped common word mid-claim is a different claim", () => {
  assert.equal(top("Wind turbines kill more bats every year than cats and buildings combined"), null);
});
test("control: the claim's words scattered through a long post do not match", () => {
  const long = "Arizona weather in 2020 was wild. Millions of birds, fake news everywhere, mail delays, ballots of the "
    + "school board, a stolen bike, and the election of a new club president. Through it all, fake smiles.";
  assert.equal(top(long), null);
});
test("control: stock phrases and claims under the minimum length never match", () => {
  assert.equal(top("this is fake"), null);
  assert.equal(top("lol"), null);
  assert.equal(claimTokens("this is fake").tokens.length < MIN_CLAIM_TOKENS, true);
});
test("control: empty input and an empty index", () => {
  assert.deepEqual(matchClaims(idx, ""), []);
  assert.deepEqual(matchClaims(buildClaimIndex({ checkers: [], rows: [] }), "anything at all goes here today"), []);
  assert.deepEqual(matchClaims(null, "The 2020 election was stolen"), []);
});

test("acronyms that look like stopwords are kept (WHO, US)", () => {
  const t = claimTokens("The WHO says the US hid the data");
  assert.ok(t.tokens.includes("who") && t.tokens.includes("us"));
  assert.ok(t.named.has("who"));
});

test("the card never gives Daylight Commons' own verdict and always carries the does-not-prove line", () => {
  const m = top("The 2020 election was stolen through millions of fake mail-in ballots in Arizona");
  const card = claimCard(m);
  assert.equal(card.label, "A fact-checker reviewed a similar claim");
  const text = JSON.stringify(card);
  assert.ok(text.includes("Pants on Fire") && text.includes("Checker A") && text.includes("https://a.example/1"));
  assert.ok(text.includes(CLAIM_DOES_NOT_PROVE));
  assert.match(CLAIM_DOES_NOT_PROVE, /similar wording to a reviewed claim/i);
  // Daylight Commons' own words never rate the post: strip the checker's rating and look for verdict words.
  const own = text.replaceAll(m.rating, "").replaceAll(m.claim, "");
  assert.doesNotMatch(own, /\b(false|fake|untrue|lie|misinformation|disinformation|debunked)\b/i);
});

test("language guess is a guess, and null when unsure", () => {
  assert.equal(guessLanguage("The government will ban all cars in the city"), "en");
  assert.equal(guessLanguage("Le gouvernement va interdire les voitures dans la ville"), "fr");
  assert.equal(guessLanguage("El gobierno va a prohibir los coches en la ciudad"), "es");
  assert.equal(guessLanguage("12345"), null);
});

test("control: a word that is a function word in another language still counts (English 'son')", () => {
  const t = buildClaimIndex({ checkers: ["X"], rows: [["Video shows mayor hugging son", "False", 0, "https://x.example/1", "2025-01-01", "en"]] });
  assert.deepEqual(matchClaims(t, "Video shows the mayor hugging his wife at the parade"), []);
  assert.equal(matchClaims(t, "video shows mayor hugging son").length, 1);
});

// Text read from an image: one wrong letter in a word, mended only toward a single claim word.
test("fuzzy matching mends one misread letter in image text, and only when asked", () => {
  const misread = "Photo shows Eiffel Towcr on fire after protests in Paris";
  assert.deepEqual(matchClaims(idx, misread), []);
  assert.deepEqual(matchClaims(idx, misread, { fuzzy: true }).map((m) => m.url), ["https://c.example/3"]);
  const digits = "The 2O20 election was stolen through millions of fake mail-in ballots in Arizona";
  assert.deepEqual(matchClaims(idx, digits, { fuzzy: true }).map((m) => m.url), ["https://a.example/1"]);
});

test("fuzzy matching leaves short words, known words and ambiguous words alone", () => {
  const two = buildClaimIndex({ checkers: [], rows: [["mayors banned cars downtown from tuesday onward", "False", 0, "u", null, "en"], ["mayors banned bars downtown from tuesday onward", "False", 0, "v", null, "en"]] });
  assert.equal(nearToken(two, "dars"), "dars");   // cars and bars are both one edit away
  assert.equal(nearToken(two, "car"), "car");     // under four letters
  assert.equal(nearToken(idx, "photo"), "photo"); // already a claim word
  assert.equal(nearToken(idx, "towcr"), "tower");
});
