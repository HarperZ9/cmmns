// Writes Ogg Opus files (RFC 7845) from encoded Opus packets: an OpusHead page, an OpusTags
// page, then audio pages with lacing, 48 kHz granule positions that count the pre-skip, and
// the Ogg page CRC (polynomial 0x04c11db7, not reflected, initial value 0).

import { concatBytes, muxUtf8 } from "./media-bytes.js";
import { opusHead } from "./media-webm.js";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    t[i] = r >>> 0;
  }
  return t;
})();

export function oggCrc32(bytes) {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ bytes[i]) & 255]) >>> 0;
  return crc >>> 0;
}

const PAGE_TARGET = 4096;
const FLAG_CONTINUED = 1;
const FLAG_BOS = 2;
const FLAG_EOS = 4;

// granule is a number, or -1 for "no packet ends on this page".
function oggPage({ flags, granule, serial, sequence, lacing, body }) {
  const head = new Uint8Array(27 + lacing.length);
  const dv = new DataView(head.buffer);
  head.set(muxUtf8("OggS"), 0);
  head[4] = 0;
  head[5] = flags;
  if (granule < 0) {
    dv.setUint32(6, 0xffffffff, true);
    dv.setUint32(10, 0xffffffff, true);
  } else {
    dv.setUint32(6, granule % 4294967296, true);
    dv.setUint32(10, Math.floor(granule / 4294967296), true);
  }
  dv.setUint32(14, serial, true);
  dv.setUint32(18, sequence, true);
  head[26] = lacing.length;
  head.set(lacing, 27);
  const page = concatBytes([head, body]);
  new DataView(page.buffer).setUint32(22, oggCrc32(page), true);
  return page;
}

function opusTags(vendor) {
  const v = muxUtf8(vendor);
  const b = new Uint8Array(8 + 4 + v.length + 4);
  b.set(muxUtf8("OpusTags"), 0);
  const dv = new DataView(b.buffer);
  dv.setUint32(8, v.length, true);
  b.set(v, 12);
  dv.setUint32(12 + v.length, 0, true);
  return b;
}

// Packs packets into pages. Each packet is { data, granule }; a packet may span pages.
function packPages(packets, serial, firstSequence) {
  const pages = [];
  let page = null;
  const open = (continued) => ({ flags: continued ? FLAG_CONTINUED : 0, granule: -1, lacing: [], parts: [], size: 0 });
  const flush = () => {
    pages.push({ ...page, serial, sequence: firstSequence + pages.length, body: concatBytes(page.parts) });
    page = null;
  };
  for (const pkt of packets) {
    const len = pkt.data.length;
    const segs = Math.floor(len / 255) + 1;
    let pos = 0;
    for (let s = 0; s < segs; s++) {
      if (!page) page = open(s > 0);
      const take = s < segs - 1 ? 255 : len - pos;
      page.lacing.push(take);
      page.parts.push(pkt.data.subarray(pos, pos + take));
      page.size += take;
      pos += take;
      if (s === segs - 1) page.granule = pkt.granule;
      if (page.lacing.length === 255 && s < segs - 1) flush();
    }
    if (page && (page.size >= PAGE_TARGET || page.lacing.length === 255)) flush();
  }
  if (page) flush();
  return pages;
}

// Granules count decoded 48 kHz samples from 0, so they include the pre-skip samples that a
// player drops. With totalSamples (the source PCM length) the last page trims the end to
// preSkip + totalSamples, never past what the packets decode to.
export function muxOggOpus({ sampleRate = 48000, channels, preSkip = 3840, packets = [], totalSamples, serial = 0x44434f4d, vendor = "Daylight Commons", head } = {}) {
  if (!(channels > 0)) throw new Error("muxOggOpus: channels is required");
  const headBytes = head instanceof Uint8Array ? head : opusHead({ channels, sampleRate, preSkip });
  const headPage = { flags: FLAG_BOS, granule: 0, serial, sequence: 0, lacing: laceOne(headBytes.length), body: headBytes };
  let granule = 0;
  const audio = packets.map((p) => {
    if (!(p.data instanceof Uint8Array)) throw new Error("muxOggOpus: packet data must be a Uint8Array");
    if (!(p.durationSamples >= 0)) throw new Error("muxOggOpus: packet durationSamples is required");
    granule += p.durationSamples;
    return { data: p.data, granule };
  });
  const tags = packPages([{ data: opusTags(vendor), granule: 0 }], serial, 1);
  const pages = [headPage, ...tags, ...packPages(audio, serial, 1 + tags.length)];
  const lastPage = pages[pages.length - 1];
  lastPage.flags |= FLAG_EOS;
  if (Number.isFinite(totalSamples) && audio.length && lastPage.granule >= 0) {
    const floor = pages.slice(0, -1).reduce((g, pg) => Math.max(g, pg.granule), 0);
    lastPage.granule = Math.max(floor, Math.min(granule, preSkip + totalSamples));
  }
  return concatBytes(pages.map(oggPage));
}

function laceOne(len) {
  const out = new Array(Math.floor(len / 255)).fill(255);
  out.push(len % 255);
  return out;
}
