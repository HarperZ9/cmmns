// Text read from an image (src/ocr, run in the extension's background on click). The words go
// through the same rhetoric, theory, persuasion and fact-check matchers as a post's own text, and
// every sign found that way says it was read from an image, with the recogniser's confidence. These
// signs are not measured yet and never count toward the thread report.
import { score } from "./rhetoric.js";
import { persuasion } from "./persuasion.js";

export const IMAGE_TEXT_NOTE = "Reads the image this page already loaded, on this device, with Daylight Commons' own text recogniser. The image and its text stay in your browser.";
export const IMAGE_TEXT_OFF = "Off. Turn on \"Read text in images\" in Daylight Commons' options to read the words inside an image on this device.";
export const IMAGE_TEXT_DOES_NOT_PROVE = "Software read these words, so a letter can change a word or a word can drop out. The image itself can be edited, screenshots of posts included.";
const MAX_SHOWN = 280;

// The language model of the image's text, in the shape signals.js reads from a post.
export function imageTextModel(result) {
  const text = (result && result.text) || "";
  if (!text) return { markers: [], persuasion: [] };
  return { markers: score(text).markers, persuasion: persuasion(text) };
}

const percent = (c) => `${Math.round(100 * Math.max(0, Math.min(1, c || 0)))}%`;

// The window's rows once a reading has finished (or failed).
export function imageTextRows(result) {
  if (!result) return [];
  if (result.error) return [["Text in the image", `could not read it: ${result.error}`]];
  if (!result.text) return [["Text in the image", "none found. Daylight Commons reads printed Latin-script text, such as English, French or Spanish; handwriting and other scripts are not read yet."]];
  const shown = result.text.length > MAX_SHOWN ? result.text.slice(0, MAX_SHOWN).replace(/\s+\S*$/, "") + " …" : result.text;
  const unsure = (result.lines || []).filter((l) => l.low).length;
  return [
    ["Text in the image", `"${shown}"`],
    ["Confidence", `${percent(result.confidence)}, the recogniser's own average over the lines it kept; not a measured accuracy`],
    ...(unsure ? [["Left out", `${unsure} ${unsure === 1 ? "line" : "lines"} the recogniser was unsure of`]] : []),
    ["Read by", `Daylight Commons' own recogniser on this device, in ${Math.max(1, Math.round(result.ms || 0))} ms`],
  ];
}

// A sign from the post's matchers, restated as read from an image: its own label and rows, the
// recogniser's confidence, and the image line before its own does-not-prove line. Its family
// becomes "image-text", so its measured line reads "not measured yet".
export function fromImage(signal, result) {
  const rows = signal.rows.map(([h, v]) => [h === "In this post" ? "Read from the image" : h, v]);
  const at = rows.findIndex(([h]) => h === "What it shows");
  const extra = [["Confidence", `${percent(result && result.confidence)} for the image's text as a whole`]];
  const dnp = ["What it shows", IMAGE_TEXT_DOES_NOT_PROVE + (at >= 0 ? " " + rows[at][1] : "")];
  const body = at >= 0 ? rows.filter((_, i) => i !== at) : rows;
  return { ...signal, label: `in image: ${signal.label}`, fam: "image-text", of: signal.fam, level: "info", fromImage: true, rows: [...body, ...extra, dnp] };
}
