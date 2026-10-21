// Write each lesson page, the lesson index and the self-check as plain text, one file per page,
// so the prose can be scored with the writing linter:
//   node scripts/learn-text.mjs <out-dir>
//   python <flywheel>/scripts/check_writing.py --profile readme <out-dir>/*.md
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LESSONS, GROUPS, lesson, lessonText } from "../src/ext/learn/index.js";
import { RESEARCH, METHOD } from "../src/ext/learn/research.js";
import { ITEMS, QUESTION } from "../src/ext/learn/quiz.js";
import { TIPS } from "../src/core/learn.js";
import { DOES_NOT_PROVE } from "../src/core/flags.js";

const out = process.argv[2];
if (!out) { console.error("usage: node scripts/learn-text.mjs <out-dir>"); process.exit(2); }
mkdirSync(out, { recursive: true });
const para = (xs) => xs.filter(Boolean).join("\n\n") + "\n";
for (const l of LESSONS) {
  const cites = l.research.map((k) => `${RESEARCH[k].found} ${RESEARCH[k].limit}`);
  writeFileSync(join(out, `lesson-${l.id}.md`), para([`# ${l.title}`, ...lessonText(l, DOES_NOT_PROVE).split("\n").slice(1), ...cites]));
}
writeFileSync(join(out, "index.md"), para(["# Learn to see it yourself", ...METHOD, ...GROUPS.map(([g, ids]) => `${g}: ${ids.map((i) => lesson(i).title).join(", ")}.`),
  ...Object.values(RESEARCH).map((r) => `${r.found} ${r.limit}`)]));
writeFileSync(join(out, "quiz.md"), para(["# Self-check", QUESTION, ...ITEMS.map((i) => `${i.text} ${i.explain}`)]));
writeFileSync(join(out, "tour.md"), para(["# Tips", ...TIPS.map((t) => t.text)]));
console.log(`${LESSONS.length + 3} pages written to ${out}`);
