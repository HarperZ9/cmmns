// Word-level diff between a source line and its retelling, and a near-copy test. Pure functions.

export const words = (s) => String(s || "").normalize("NFC").match(/\S+/g) || [];
const norm = (w) => w.toLowerCase().replace(/^[^\p{L}\p{N}$€£]+|[^\p{L}\p{N}%]+$/gu, "");

// Longest-common-subsequence diff over words, compared after case and edge punctuation are folded.
// Returns [{ op: "=" | "+" | "-", w }]. Long texts fall back to a whole replace.
export function wordDiff(a, b, max = 1500) {
  const A = words(a), B = words(b);
  if (A.length > max || B.length > max) return [...A.map((w) => ({ op: "-", w })), ...B.map((w) => ({ op: "+", w }))];
  const n = A.length, m = B.length, na = A.map(norm), nb = B.map(norm);
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = na[i] === nb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (na[i] === nb[j]) { out.push({ op: "=", w: B[j] }); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push({ op: "-", w: A[i++] }); else out.push({ op: "+", w: B[j++] });
  }
  while (i < n) out.push({ op: "-", w: A[i++] });
  while (j < m) out.push({ op: "+", w: B[j++] });
  return out;
}

// "kept [+added+] [-removed-]", with runs of one kind joined.
export function renderDiff(ops) {
  const parts = [];
  for (const o of ops) {
    const last = parts[parts.length - 1];
    if (last && last.op === o.op) last.ws.push(o.w); else parts.push({ op: o.op, ws: [o.w] });
  }
  return parts.map((p) => (p.op === "=" ? p.ws.join(" ") : `[${p.op}${p.ws.join(" ")}${p.op}]`)).join(" ");
}

const CERTAINTY = new Set(["confirmed", "confirms", "proven", "proof", "real", "definitely", "certainly", "fact", "secret", "secretly", "exposed", "admits", "admitted", "breaking", "just", "officially", "all", "every", "never", "always"]);
const HEDGE = new Set(["reportedly", "allegedly", "alleged", "may", "might", "could", "possible", "possibly", "unconfirmed", "according", "said", "says", "claims", "claimed", "sources"]);

// What a hop changed, by kind: numbers, names (capitalised words), certainty words added, and
// hedges dropped. Each list holds the words as written.
export function hopChanges(ops) {
  const added = ops.filter((o) => o.op === "+").map((o) => o.w), removed = ops.filter((o) => o.op === "-").map((o) => o.w);
  const isNum = (w) => /\d/.test(w), isName = (w) => /^["'“(]?\p{Lu}/u.test(w);
  return {
    added: added.length, removed: removed.length, kept: ops.filter((o) => o.op === "=").length,
    numbers: { added: added.filter(isNum), removed: removed.filter(isNum) },
    names: { added: added.filter(isName), removed: removed.filter(isName) },
    certaintyAdded: added.filter((w) => CERTAINTY.has(norm(w))),
    hedgesDropped: removed.filter((w) => HEDGE.has(norm(w))),
    quoteMarksAdded: added.filter((w) => /["“”]/.test(w)),
  };
}

// Jaccard similarity of word 3-shingles (folded). 1 for identical texts.
export function shingleSimilarity(a, b, k = 3) {
  const sh = (s) => { const w = words(s).map(norm).filter(Boolean); const set = new Set(); for (let i = 0; i + k <= w.length; i++) set.add(w.slice(i, i + k).join(" ")); if (!set.size && w.length) set.add(w.join(" ")); return set; };
  const A = sh(a), B = sh(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

const STOPWORDS = new Set("a an the and or but of to in on at by for with from as is are was were be been it its this that these those he she they we you i his her their our your not no so than then there here who whom which what when where why how all any each also into over under after before about against between per via said says".split(" "));
export const contentWords = (s) => new Set(words(s).map(norm).filter((w) => w && !STOPWORDS.has(w) && (w.length > 2 || /\d/.test(w))));

// Shared content words over the smaller set: high when one text restates most of the other's
// substance, whatever the word order. 1 when the smaller set is wholly contained in the larger.
export function overlapSimilarity(a, b) {
  const A = contentWords(a), B = contentWords(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / Math.min(A.size, B.size);
}
