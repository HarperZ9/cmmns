// Posts from a Bluesky repository export (Settings > Export my data gives a .car file). A CAR v1
// file is a header and a list of blocks, each a CID and DAG-CBOR bytes. Daylight Commons decodes every block,
// keeps the app.bsky.feed.post records, and names each post by its record key, read from the
// repository's key tree (MST). Everything in the file is the user's own data.

import { cborDecode } from "./cbor.js";
import { EXPORT_AUTHOR } from "./import-exports.js";

const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const td = new TextDecoder();

// An unsigned LEB128 varint at i: [value, next].
export function varint(b, i) {
  let v = 0, shift = 0, k = i;
  while (k < b.length) {
    const x = b[k++];
    v += (x & 127) * 2 ** shift;
    if (!(x & 128)) return [v, k];
    shift += 7;
    if (shift > 49) break;
  }
  throw new Error("car: bad varint");
}

// The length in bytes of the CID that starts at i (v0: a bare sha2-256 multihash; v1: version,
// codec, then the multihash).
function cidLength(b, i) {
  if (b[i] === 0x12 && b[i + 1] === 0x20) return 34;
  let [, k] = varint(b, i);
  [, k] = varint(b, k);
  const [, k2] = varint(b, k), [len, k3] = varint(b, k2);
  return k3 + len - i;
}

// Blocks of a CAR v1 file: [{ cid (hex), data }]. Throws when the file is not CAR v1.
export function carBlocks(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const [hlen, h] = varint(b, 0);
  const header = cborDecode(b.subarray(h, h + hlen));
  if (!header || header.version !== 1) throw new Error("car: not a CAR v1 file");
  const out = [];
  for (let i = h + hlen; i < b.length;) {
    const [len, k] = varint(b, i);
    const n = cidLength(b, k);
    out.push({ cid: hex(b.subarray(k, k + n)), data: b.subarray(k + n, k + len) });
    i = k + len;
  }
  return out;
}

// A DAG-CBOR link (tag 42) as the hex of the CID, without the leading multibase zero.
const linkHex = (v) => (v && v.tag === 42 && v.value instanceof Uint8Array ? hex(v.value.subarray(1)) : null);
const str = (v) => (v instanceof Uint8Array ? td.decode(v) : String(v || ""));

// Record CID -> repository key ("app.bsky.feed.post/3k..."), from every MST node in the file.
function mstKeys(nodes) {
  const keys = new Map();
  for (const n of nodes) {
    let prev = "";
    for (const e of n.e) {
      const key = prev.slice(0, e.p || 0) + str(e.k);
      const cid = linkHex(e.v);
      if (cid) keys.set(cid, key);
      prev = key;
    }
  }
  return keys;
}

function decoded(blocks) {
  const posts = [], nodes = [];
  for (const blk of blocks) {
    let v;
    try { v = cborDecode(blk.data); } catch { continue; }
    if (v && v.$type === "app.bsky.feed.post" && typeof v.text === "string") posts.push({ cid: blk.cid, v });
    else if (v && Array.isArray(v.e) && "l" in v) nodes.push(v);
  }
  return { posts, nodes };
}

const linksOf = (v) => [...(v.facets || []).flatMap((f) => (f.features || []).map((x) => x && x.uri)), v.embed && v.embed.external && v.embed.external.uri].filter((u) => typeof u === "string" && /^https?:/.test(u));

// Returns { site: "Bluesky", posts, notes } or null when the bytes are not a CAR file.
export function blueskyCarPosts(bytes) {
  let blocks;
  try { blocks = carBlocks(bytes); } catch { return null; }
  const { posts, nodes } = decoded(blocks), keys = mstKeys(nodes);
  const out = posts.map(({ cid, v }, i) => {
    const key = keys.get(cid);
    const t = Date.parse(v.createdAt || "");
    return { id: key ? key.split("/").pop() : "post" + (i + 1), author: EXPORT_AUTHOR, text: v.text, posted: Number.isFinite(t) ? new Date(t).toISOString() : null, links: linksOf(v) };
  }).sort((a, b) => String(a.posted).localeCompare(String(b.posted)));
  return { site: "Bluesky", posts: out, notes: [`${blocks.length} blocks read; ${out.length} posts found.`] };
}
