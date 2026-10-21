// Near-duplicate replies across different accounts. Copied or templated text posted by many
// accounts is a coordination sign; a short stock phrase ("this", "lol", "100%") is not, so
// replies under MIN_WORDS words never cluster.
//
// Method: word 3-gram shingles, a 64-hash MinHash signature, banding (16 bands of 4) to find
// candidate pairs, then the exact Jaccard similarity of the shingle sets to confirm a pair.

export const MIN_WORDS = 6;
export const JACCARD_MIN = 0.6;
const HASHES = 64, BANDS = 16, ROWS = HASHES / BANDS;

export function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")        // links differ per copy
    .replace(/@\w+/g, " ")                  // so do the handles replied to
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ") // punctuation and emoji; combining marks stay in words
    .replace(/\s+/g, " ")
    .trim();
}

export function shingles(text, k = 3) {
  const words = normalize(text).split(" ").filter(Boolean);
  const out = new Set();
  if (words.length < k) { if (words.length) out.add(words.join(" ")); return out; }
  for (let i = 0; i + k <= words.length; i++) out.add(words.slice(i, i + k).join(" "));
  return out;
}

// 32-bit FNV-1a, seeded, so each of the 64 hash functions is independent enough for MinHash.
function hash(str, seed) {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

export function signature(set) {
  const sig = new Array(HASHES).fill(0xffffffff);
  for (const s of set) for (let i = 0; i < HASHES; i++) { const v = hash(s, i * 0x9e3779b1); if (v < sig[i]) sig[i] = v; }
  return sig;
}

export function jaccard(a, b) {
  if (!a.size && !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function wordCount(text) { return normalize(text).split(" ").filter(Boolean).length; }

// replies: [{ id, author, text }]. Returns clusters of two or more replies from two or more
// distinct authors: [{ ids: [...], authors: [...], similarity }], largest first.
export function duplicateClusters(replies) {
  const items = replies.filter((r) => wordCount(r.text) >= MIN_WORDS)
    .map((r) => { const sh = shingles(r.text); return { ...r, sh, sig: signature(sh) }; });
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const buckets = new Map();
  items.forEach((it, i) => {
    for (let b = 0; b < BANDS; b++) {
      const key = b + ":" + it.sig.slice(b * ROWS, b * ROWS + ROWS).join(",");
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(i);
    }
  });
  for (const group of buckets.values()) {
    for (let x = 0; x < group.length; x++) for (let y = x + 1; y < group.length; y++) {
      const a = items[group[x]], b = items[group[y]];
      if (a.author === b.author) continue;
      const j = jaccard(a.sh, b.sh);
      if (j < JACCARD_MIN) continue;
      parent[find(group[x])] = find(group[y]);
    }
  }
  const groups = new Map();
  items.forEach((it, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(it); });
  const out = [];
  for (const members of groups.values()) {
    const authors = [...new Set(members.map((m) => m.author))];
    if (members.length < 2 || authors.length < 2) continue;
    let sim = 1;
    for (let x = 0; x < members.length; x++) for (let y = x + 1; y < members.length; y++) sim = Math.min(sim, jaccard(members[x].sh, members[y].sh));
    out.push({ ids: members.map((m) => m.id), authors, similarity: Math.round(sim * 100) / 100 });
  }
  return out.sort((a, b) => b.ids.length - a.ids.length);
}
