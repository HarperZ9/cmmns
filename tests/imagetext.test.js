// Text read from an image (src/core/imagetext.js): it goes through the post matchers, every sign
// it gives says it was read from an image with the recogniser's confidence, it is "not measured
// yet", and the rows say what the recogniser read without overstating it.
import test from "node:test";
import assert from "node:assert/strict";
import { imageTextModel, imageTextRows, fromImage, IMAGE_TEXT_DOES_NOT_PROVE, IMAGE_TEXT_NOTE } from "../src/core/imagetext.js";
import { measuredLine } from "../src/core/families.js";

const result = { text: "They spray chemtrails over every city and nobody asks why", confidence: 0.91, ms: 640.2, lines: [{ text: "x", low: false }, { text: "y", low: true }] };

test("image text goes through the same matchers as a post", () => {
  const m = imageTextModel(result);
  assert.ok(m.markers.some((x) => x.family === "conspiracy-theory"), JSON.stringify(m.markers));
  assert.deepEqual(imageTextModel({ text: "" }), { markers: [], persuasion: [] });
  assert.deepEqual(imageTextModel(null), { markers: [], persuasion: [] });
});

test("a sign from an image is labelled, keeps its rows, adds confidence and the image's limits", () => {
  const sig = { label: "names a theory: Chemtrails", fam: "conspiracy-theory", level: "warn", cat: "language", rows: [["In this post", "\"chemtrails\""], ["The theory", "t"], ["What it shows", "own line"]] };
  const s = fromImage(sig, result);
  assert.equal(s.label, "in image: names a theory: Chemtrails");
  assert.equal(s.fam, "image-text");
  assert.equal(s.of, "conspiracy-theory");
  assert.equal(s.level, "info");
  assert.equal(s.cat, "language");
  assert.deepEqual(s.rows[0], ["Read from the image", "\"chemtrails\""]);
  assert.deepEqual(s.rows.find(([h]) => h === "Confidence"), ["Confidence", "91% for the image's text as a whole"]);
  const dnp = s.rows.filter(([h]) => h === "What it shows");
  assert.equal(dnp.length, 1);
  assert.ok(dnp[0][1].startsWith(IMAGE_TEXT_DOES_NOT_PROVE) && dnp[0][1].endsWith("own line"));
  assert.equal(s.rows.at(-1)[0], "What it shows");
});

test("signs read from an image are not measured yet", () => {
  assert.equal(measuredLine("image-text").text, "not measured yet");
});

test("the rows quote the text, give confidence as the recogniser's own, and count left-out lines", () => {
  const rows = imageTextRows(result);
  assert.deepEqual(rows[0], ["Text in the image", `"${result.text}"`]);
  assert.match(rows[1][1], /^91%, the recogniser's own average/);
  assert.match(rows[1][1], /not a measured accuracy/);
  assert.deepEqual(rows[2], ["Left out", "1 line the recogniser was unsure of"]);
  assert.match(rows[3][1], /on this device, in 640 ms/);
  const long = imageTextRows({ ...result, text: "word ".repeat(100).trim() });
  assert.ok(long[0][1].length < 300 && long[0][1].endsWith(" …\""));
  assert.match(imageTextRows({ text: "", lines: [] })[0][1], /^none found/);
  assert.deepEqual(imageTextRows({ error: "too large" }), [["Text in the image", "could not read it: too large"]]);
  assert.deepEqual(imageTextRows(null), []);
});

test("the notes say nothing leaves the browser and use no em dash", () => {
  assert.match(IMAGE_TEXT_NOTE, /stay in your browser/);
  for (const t of [IMAGE_TEXT_NOTE, IMAGE_TEXT_DOES_NOT_PROVE]) assert.doesNotMatch(t, /—/);
});
