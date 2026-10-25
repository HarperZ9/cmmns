// Reads the samples out of an MP4, plain or fragmented (an init segment followed by moof and mdat
// pairs, as HLS and DASH deliver it), so that a video track and an audio track fetched apart can
// be written into one MP4 with the toolkit's own muxer (media-mp4.js). It copies sample bytes as
// they are and never decodes them. Encrypted tracks are refused before this runs (media-protect.js).

import { readBoxes } from "./media-read.js";
import { muxMp4 } from "./media-mp4.js";

const u8 = (b, at) => b[at];
const u16 = (b, at) => (b[at] << 8) | b[at + 1];
const u32 = (b, at) => ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];
const u64 = (b, at) => u32(b, at) * 4294967296 + u32(b, at + 4);
const i32 = (b, at) => u32(b, at) | 0;
const kids = (b, box) => readBoxes(b, box.start + box.headerSize, box.start + box.size);
const child = (b, box, type) => box && (box.children || kids(b, box)).find((x) => x.type === type);
const path = (b, box, ...types) => types.reduce((x, t) => x && child(b, x, t), box);
const body = (box) => box.start + box.headerSize;

// The MPEG-4 AudioSpecificConfig inside esds (descriptor tags 3, 4, 5).
function escConfig(b, start, end) {
  let at = start + 4;
  const desc = () => { const tag = u8(b, at++); let len = 0, k = 0, c; do { c = u8(b, at++); len = (len << 7) | (c & 127); } while (c & 128 && ++k < 4); return { tag, len }; };
  let d = desc();
  if (d.tag !== 3) return null;
  at += 2; const flags = u8(b, at++);
  if (flags & 0x80) at += 2;
  if (flags & 0x40) at += u8(b, at) + 1;
  if (flags & 0x20) at += 2;
  d = desc();
  if (d.tag !== 4) return null;
  at += 13;
  d = desc();
  return d.tag === 5 && at + d.len <= end ? b.slice(at, at + d.len) : null;
}

// { kind, codec, width, height, channels, sampleRate, description } from the first stsd entry.
function sampleEntry(b, stsd, audio) {
  const [entry] = readBoxes(b, body(stsd) + 8, stsd.start + stsd.size);
  if (!entry) return null;
  const fields = audio ? 28 : 78, inner = readBoxes(b, entry.start + 8 + fields, entry.start + entry.size);
  const config = (t) => inner.find((x) => x.type === t);
  const out = { codec: entry.type };
  if (audio) {
    Object.assign(out, { channels: u16(b, entry.start + 24), sampleRate: u32(b, entry.start + 32) >>> 16 });
    const e = config("esds");
    if (e) out.description = escConfig(b, body(e), e.start + e.size);
  } else {
    Object.assign(out, { width: u16(b, entry.start + 32), height: u16(b, entry.start + 34) });
    const c = config("avcC") || config("hvcC") || config("av1C");
    if (c) out.description = b.slice(body(c), c.start + c.size);
  }
  return out;
}

function trackInfo(b, trak) {
  const tkhd = child(b, trak, "tkhd"), mdhd = path(b, trak, "mdia", "mdhd"), hdlr = path(b, trak, "mdia", "hdlr");
  const v = (box) => u8(b, body(box));
  const id = u32(b, body(tkhd) + (v(tkhd) === 1 ? 20 : 12)), timescale = u32(b, body(mdhd) + (v(mdhd) === 1 ? 20 : 12));
  const handler = String.fromCharCode(...b.subarray(body(hdlr) + 8, body(hdlr) + 12));
  const kind = handler === "vide" ? "video" : handler === "soun" ? "audio" : null;
  const stbl = path(b, trak, "mdia", "minf", "stbl"), stsd = stbl && child(b, stbl, "stsd");
  return { id, timescale, kind, entry: stsd && kind ? sampleEntry(b, stsd, kind === "audio") : null, stbl };
}

function table(b, box, width) {
  if (!box) return [];
  const at = body(box) + 4, n = u32(b, at), rows = [];
  for (let i = 0; i < n; i++) rows.push(Array.from({ length: width }, (_, k) => u32(b, at + 4 + (i * width + k) * 4)));
  return rows;
}

// Samples of a plain MP4 track from its sample tables.
function plainSamples(b, t) {
  const s = t.stbl, stsz = child(b, s, "stsz"), co64 = child(b, s, "co64"), stco = child(b, s, "stco");
  if (!stsz || !(stco || co64)) return [];
  const fixed = u32(b, body(stsz) + 4), n = u32(b, body(stsz) + 8);
  const sizes = Array.from({ length: n }, (_, i) => (fixed || u32(b, body(stsz) + 12 + i * 4)));
  const offsets = co64 ? Array.from({ length: u32(b, body(co64) + 4) }, (_, i) => u64(b, body(co64) + 8 + i * 8)) : table(b, stco, 1).map((r) => r[0]);
  const stsc = table(b, child(b, s, "stsc"), 3), stts = table(b, child(b, s, "stts"), 2), ctts = table(b, child(b, s, "ctts"), 2);
  const sync = child(b, s, "stss") ? new Set(table(b, child(b, s, "stss"), 1).map((r) => r[0] - 1)) : null;
  const out = [];
  let i = 0;
  for (let c = 0; c < offsets.length && i < n; c++) {
    const row = stsc.filter((r) => r[0] <= c + 1).pop();
    let at = offsets[c];
    for (let k = 0; k < (row ? row[1] : 1) && i < n; k++, i++) { out.push({ offset: at, size: sizes[i], key: !sync || sync.has(i) }); at += sizes[i]; }
  }
  const expand = (rows) => rows.flatMap(([count, v]) => Array(count).fill(v));
  const durs = expand(stts), cts = expand(ctts);
  let dts = 0;
  out.forEach((x, k) => { x.dts = dts; x.duration = durs[k] ?? durs[durs.length - 1] ?? 0; x.cts = cts[k] ? (cts[k] | 0) : 0; dts += x.duration; });
  return out;
}

const TFHD = { base: 0x1, desc: 0x2, dur: 0x8, size: 0x10, flags: 0x20 };

// Samples of every track in the moof boxes, with defaults from trex.
function fragmentSamples(b, top, trex) {
  const out = new Map(), next = new Map();
  for (const moof of top.filter((x) => x.type === "moof")) {
    for (const traf of kids(b, moof).filter((x) => x.type === "traf")) {
      const tfhd = child(b, traf, "tfhd"), tfdt = child(b, traf, "tfdt");
      const f = u32(b, body(tfhd)) & 0xffffff, id = u32(b, body(tfhd) + 4), d = { ...(trex.get(id) || { dur: 0, size: 0, flags: 0 }) };
      let at = body(tfhd) + 8, base = moof.start;
      if (f & TFHD.base) { base = u64(b, at); at += 8; }
      if (f & TFHD.desc) at += 4;
      if (f & TFHD.dur) { d.dur = u32(b, at); at += 4; }
      if (f & TFHD.size) { d.size = u32(b, at); at += 4; }
      if (f & TFHD.flags) d.flags = u32(b, at);
      let dts = tfdt ? (u8(b, body(tfdt)) === 1 ? u64(b, body(tfdt) + 4) : u32(b, body(tfdt) + 4)) : next.get(id) || 0;
      const list = out.get(id) || [];
      let cursor = null;
      for (const trun of kids(b, traf).filter((x) => x.type === "trun")) {
        const tf = u32(b, body(trun)) & 0xffffff, n = u32(b, body(trun) + 4);
        let p = body(trun) + 8;
        if (tf & 0x1) { cursor = base + i32(b, p); p += 4; } else if (cursor === null) cursor = base;
        let first = null;
        if (tf & 0x4) { first = u32(b, p); p += 4; }
        for (let k = 0; k < n; k++) {
          const dur = tf & 0x100 ? u32(b, (p += 4) - 4) : d.dur, size = tf & 0x200 ? u32(b, (p += 4) - 4) : d.size;
          const flags = tf & 0x400 ? u32(b, (p += 4) - 4) : k === 0 && first !== null ? first : d.flags;
          const cts = tf & 0x800 ? i32(b, (p += 4) - 4) : 0;
          list.push({ offset: cursor, size, dts, duration: dur, cts, key: !(flags & 0x10000) });
          cursor += size; dts += dur;
        }
      }
      out.set(id, list); next.set(id, dts);
    }
  }
  return out;
}

// { tracks: [{ id, kind, timescale, entry }], samples: Map(id -> [{ offset, size, dts, cts, duration, key }]) }.
export function demuxMp4(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const top = readBoxes(b), moov = top.find((x) => x.type === "moov");
  if (!moov) throw new Error("The file has no movie header (moov), so it is not an MP4 Daylight Commons can read.");
  const tracks = (moov.children || kids(b, moov)).filter((x) => x.type === "trak").map((t) => trackInfo(b, t)).filter((t) => t.kind && t.entry);
  const trex = new Map();
  const mvex = child(b, moov, "mvex");
  for (const x of mvex ? kids(b, mvex).filter((y) => y.type === "trex") : []) trex.set(u32(b, body(x) + 4), { dur: u32(b, body(x) + 12), size: u32(b, body(x) + 16), flags: u32(b, body(x) + 20) });
  const frag = top.some((x) => x.type === "moof") ? fragmentSamples(b, top, trex) : null;
  const samples = new Map(tracks.map((t) => [t.id, frag ? frag.get(t.id) || [] : plainSamples(b, t)]));
  return { tracks, samples, bytes: b };
}

const MUXABLE_VIDEO = { avc1: "avc1", avc3: "avc1", av01: "av01" }, MUXABLE_AUDIO = { mp4a: "mp4a" };

// Chunks for muxMp4 from one demuxed track.
function chunksOf(d, t, name) {
  const us = (v) => (v * 1e6) / t.timescale;
  return d.samples.get(t.id).filter((s) => s.offset + s.size <= d.bytes.length).map((s) => ({ track: name, data: d.bytes.subarray(s.offset, s.offset + s.size),
    timestampUs: us(s.dts + s.cts), decodeTimestampUs: us(s.dts), durationUs: us(s.duration), key: s.key }));
}

// One MP4 with sound from MP4 files that each hold a video or an audio track (or both). Throws
// when a codec is one the muxer cannot write; the caller then keeps the files apart.
export function remuxMp4(files) {
  const parsed = files.map((f) => demuxMp4(f));
  const find = (kind) => { for (const d of parsed) { const t = d.tracks.find((x) => x.kind === kind && d.samples.get(x.id).length); if (t) return { d, t }; } return null; };
  const v = find("video"), a = find("audio");
  if (!v && !a) throw new Error("No video or audio samples were found.");
  if (v && !MUXABLE_VIDEO[v.t.entry.codec]) throw new Error(`The video is ${v.t.entry.codec}, which Daylight Commons cannot rewrap yet.`);
  if (a && (!MUXABLE_AUDIO[a.t.entry.codec] || !a.t.entry.description)) throw new Error(`The sound is ${a.t.entry.codec}, which Daylight Commons cannot rewrap yet.`);
  const video = v && { codec: MUXABLE_VIDEO[v.t.entry.codec], width: v.t.entry.width, height: v.t.entry.height, description: v.t.entry.description };
  const audio = a && { codec: "mp4a", channels: a.t.entry.channels || 2, sampleRate: a.t.entry.sampleRate || a.t.timescale, description: a.t.entry.description };
  const chunks = [...(v ? chunksOf(v.d, v.t, "video") : []), ...(a ? chunksOf(a.d, a.t, "audio") : [])];
  return muxMp4({ video, audio, chunks });
}
