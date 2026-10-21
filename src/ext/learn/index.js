// Every lesson, by id, and how long it takes to read aloud. A lesson's does-not-prove line is its
// own `dnp`, or the badge's line from DOES_NOT_PROVE (src/core/flags.js) when `dnp` is empty, so a
// lesson and its badge never disagree. Pure data and functions: the lesson page and the tests
// both import this file.

import { PERSUASION_LESSONS } from "./lessons-persuasion.js";
import { LANGUAGE_LESSONS } from "./lessons-language.js";
import { SPREAD_LESSONS } from "./lessons-spread.js";
import { ACCOUNT_LESSONS } from "./lessons-account.js";
import { MEDIA_LESSONS } from "./lessons-media.js";

// Spoken pace, in words a minute. The inoculation videos ran about 90 seconds.
export const WORDS_PER_MINUTE = 150;
export const SIDES = ["left", "right", "centre", "none"];
// Example kinds: "sign" shows the move; "fair" is a legitimate or true use that looks alike;
// "ordinary" is an ordinary account that trips the same sign. Fair and ordinary examples are there
// so a lesson builds discernment instead of suspicion of everything (Modirrousta-Galian and Higham 2023).
export const KINDS = ["sign", "fair", "ordinary"];
// Every lesson says this, in these words, after its own does-not-prove line.
export const TRUE_TOO = "A post that shows this sign can still be true. Judge the claim by its evidence, and the sign by what it is: a reason to look closer.";
export const MAX_SECONDS = 120;

// Groups for the lesson index, in the window's area order, with the thread report last.
export const GROUPS = [
  ["Language", LANGUAGE_LESSONS.map((l) => l.id)],
  ["Persuasion techniques", PERSUASION_LESSONS.map((l) => l.id)],
  ["Coordination and media", ["duplicates", "copied-elsewhere", "same-upload", "old-media", "lifted-media", ...MEDIA_LESSONS.map((l) => l.id)]],
  ["Sources", ["community-note", "fact-check", "ad", "state-link", "owner", "site-record", "client"]],
  ["Place", ["mismatch", "written-in", "store-elsewhere", "flag-elsewhere", "profile-location-elsewhere", "hours-elsewhere"]],
  ["Posting", ["fast-replier", "automation-app", "no-sleep-gap", "repost-only", "high-volume"]],
  ["Account", ["new-account", "name-changes", "default-handle", "follow-pattern", "low-karma", "brand-lookalike"]],
  ["The thread", ["thread-report"]],
];

export const LESSONS = [...LANGUAGE_LESSONS, ...PERSUASION_LESSONS, ...SPREAD_LESSONS, ...MEDIA_LESSONS, ...ACCOUNT_LESSONS];
const BY_ID = new Map(LESSONS.map((l) => [l.id, l]));

export const lesson = (id) => BY_ID.get(id) || null;

// The lesson's does-not-prove line. `table` is DOES_NOT_PROVE from the core bundle.
export function doesNotProve(l, table = {}) {
  return l.dnp || table[l.flag || l.id] || "";
}

// Every sentence a reader meets, in page order.
export function lessonText(l, table = {}) {
  return [l.title, l.what, ...l.examples.map((e) => e.text), l.why, l.spot, l.counter, doesNotProve(l, table), TRUE_TOO].filter(Boolean).join("\n");
}

const words = (s) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'.,%-]*/gu) || []).length;
export function readSeconds(l, table = {}) {
  return Math.round((words(lessonText(l, table)) / WORDS_PER_MINUTE) * 60);
}
