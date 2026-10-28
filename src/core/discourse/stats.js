// Numbers with their sample size (project-docs/DISCOURSE.md): "45/50 replies", "8 of 25", "62% of
// 1,200 people", "n = 40". Each count gets a Wilson 95% interval, the same interval CMMNS
// Commons prints for its own figures, and a note when the sample is small.
export const STATS_DOES_NOT_PROVE = "An interval shows how much a count of this size can move by chance alone. It says nothing about how the sample was chosen, how the question was asked, or whether the result holds elsewhere.";
export const SMALL_N = 30;

// Wilson score interval for k of n, at 95%. Returns [low, high] as proportions.
export function wilson(k, n, z = 1.96) {
  if (!(n > 0) || k < 0 || k > n) return null;
  const p = k / n, d = 1 + (z * z) / n, c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

const num = (s) => Number(String(s).replace(/,/g, ""));
// Words that make a fraction a count of things rather than a date or a score.
const COUNT_NOUN = /^\s*(?:of\s+(?:the\s+)?)?(?:\w+\s+){0,2}?(people|persons|participants|respondents|patients|replies|responses|answers|users|voters|adults|subjects|cases|trials|runs|samples|students|children|women|men|households|doctors|experts|models|messages|posts|times|tries|attempts|items|questions|say|said|mention|mentioned|agree|agreed|chose|reported|were|are|had|have|did|got|passed|failed|correct|right|wrong|unsteered|steered)\b/i;
const DATE_LIKE = (k, n) => n <= 31 && k <= 31 && (k <= 12 || n <= 12);

// Every count in a text: { k, n, text, at, interval, small }.
export function findCounts(text) {
  const t = String(text || ""), out = [], seen = new Set();
  const push = (k, n, at, len) => {
    if (!(n >= 2 && n <= 1e7 && k >= 0 && k <= n) || seen.has(at)) return;
    seen.add(at);
    out.push({ k, n, at, text: t.slice(at, at + len), interval: wilson(k, n), small: n < SMALL_N });
  };
  for (const m of t.matchAll(/\b(\d{1,3}(?:,\d{3})*|\d+)\s*\/\s*(\d{1,3}(?:,\d{3})*|\d+)\b/g)) {
    const k = num(m[1]), n = num(m[2]), after = t.slice(m.index + m[0].length, m.index + m[0].length + 40);
    if (COUNT_NOUN.test(after) || (!DATE_LIKE(k, n) && /^\s*(?:\)|$|[,.;:])/.test(after) && sameDenominator(t, n) > 1)) push(k, n, m.index, m[0].length);
  }
  for (const m of t.matchAll(/\b(\d{1,3}(?:,\d{3})*|\d+)\s+(?:out\s+)?of\s+(?:the\s+)?(\d{1,3}(?:,\d{3})*|\d+)\b/gi)) push(num(m[1]), num(m[2]), m.index, m[0].length);
  for (const m of t.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s?%\s*(?:of\s+(?:the\s+)?|\(\s*n\s*=\s*)(\d{1,3}(?:,\d{3})*|\d+)/gi)) {
    const p = Number(m[1]) / 100, n = num(m[2]);
    if (p <= 1) push(Math.round(p * n), n, m.index, m[0].length);
  }
  return out.sort((a, b) => a.at - b.at);
}

// How many fractions in the text share a denominator: "45/50 ... 3/50" reads as two arms of one test.
function sameDenominator(t, n) {
  return [...t.matchAll(/\b\d+\s*\/\s*(\d+)\b/g)].filter((m) => num(m[1]) === n).length;
}

const pct = (x) => `${Math.round(x * 1000) / 10}%`;

// Two counts with the same denominator, read as two arms: do their intervals overlap?
export function compareArms(counts) {
  const out = [];
  for (let i = 0; i < counts.length; i++) for (let j = i + 1; j < counts.length; j++) {
    const a = counts[i], b = counts[j];
    if (a.n !== b.n || !a.interval || !b.interval) continue;
    out.push({ a, b, overlap: a.interval[0] <= b.interval[1] && b.interval[0] <= a.interval[1] });
  }
  return out;
}

// The window's rows for a text's counts.
export function countRows(counts) {
  const rows = counts.slice(0, 6).map((c) => [`"${c.text.trim()}"`, `${c.k} of ${c.n} is ${pct(c.k / c.n)}; 95% interval ${pct(c.interval[0])} to ${pct(c.interval[1])}${c.small ? `. With fewer than ${SMALL_N}, the interval is wide and one more or one fewer moves the figure a lot.` : "."}`]);
  for (const x of compareArms(counts).slice(0, 2)) rows.push(["Side by side", `${x.a.text.trim()} against ${x.b.text.trim()}: the intervals ${x.overlap ? "overlap, so chance alone could explain the gap" : "do not overlap"}.`]);
  return rows;
}
