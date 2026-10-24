// ISO base media (MP4) box builders used by muxMp4: generic boxes, movie and track headers,
// handler and media info boxes, and the stsd sample entries for avc1, vp09, av01, mp4a and Opus.

import { MuxByteWriter, concatBytes } from "./media-bytes.js";

const TWO32 = 4294967296;
const MATRIX = [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000];

export function mp4Box(type, parts = []) {
  let len = 8;
  for (const p of parts) len += p.length;
  const w = new MuxByteWriter(len);
  if (len >= TWO32) {
    w.u32(1).ascii(type).u64(len + 8);
  } else {
    w.u32(len).ascii(type);
  }
  for (const p of parts) w.bytes(p);
  return w.finish();
}

export function mp4FullBox(type, version, flags, parts = []) {
  const head = new MuxByteWriter(4).u8(version).u24(flags).finish();
  return mp4Box(type, [head, ...parts]);
}

function writeMatrix(w) {
  for (const v of MATRIX) w.u32(v);
}

export function mp4Ftyp() {
  const w = new MuxByteWriter(24).ascii("isom").u32(0x200).ascii("isomiso2avc1mp41");
  return mp4Box("ftyp", [w.finish()]);
}

// Times and durations go in 32 bits (version 0) unless a duration needs 64 bits (version 1).
function timeFields(w, wide, timescale, duration) {
  if (wide) w.u64(0).u64(0);
  else w.u32(0).u32(0);
  if (timescale !== null) w.u32(timescale);
  return w;
}

export function mp4Mvhd(timescale, duration, nextTrackId) {
  const wide = duration >= TWO32;
  const w = timeFields(new MuxByteWriter(100), wide, timescale, duration);
  if (wide) w.u64(duration);
  else w.u32(duration);
  w.u32(0x00010000).u16(0x0100).zeros(10);
  writeMatrix(w);
  w.zeros(24).u32(nextTrackId);
  return mp4FullBox("mvhd", wide ? 1 : 0, 0, [w.finish()]);
}

export function mp4Tkhd({ trackId, duration, width = 0, height = 0, audio = false }) {
  const wide = duration >= TWO32;
  const w = timeFields(new MuxByteWriter(92), wide, null, duration);
  w.u32(trackId).u32(0);
  if (wide) w.u64(duration);
  else w.u32(duration);
  w.zeros(8).u16(0).u16(0).u16(audio ? 0x0100 : 0).u16(0);
  writeMatrix(w);
  w.u32(width * 65536).u32(height * 65536);
  return mp4FullBox("tkhd", wide ? 1 : 0, 3, [w.finish()]);
}

export function mp4Mdhd(timescale, duration) {
  const wide = duration >= TWO32;
  const w = timeFields(new MuxByteWriter(32), wide, timescale, duration);
  if (wide) w.u64(duration);
  else w.u32(duration);
  w.u16(0x55c4).u16(0);
  return mp4FullBox("mdhd", wide ? 1 : 0, 0, [w.finish()]);
}

export function mp4Hdlr(audio) {
  const name = audio ? "SoundHandler" : "VideoHandler";
  const w = new MuxByteWriter(40).u32(0).ascii(audio ? "soun" : "vide").zeros(12).utf8(name).u8(0);
  return mp4FullBox("hdlr", 0, 0, [w.finish()]);
}

export function mp4Minf(audio, stbl) {
  const header = audio
    ? mp4FullBox("smhd", 0, 0, [new Uint8Array(4)])
    : mp4FullBox("vmhd", 0, 1, [new Uint8Array(8)]);
  const url = mp4FullBox("url ", 0, 1);
  const dref = mp4FullBox("dref", 0, 0, [new MuxByteWriter(4).u32(1).finish(), url]);
  return mp4Box("minf", [header, mp4Box("dinf", [dref]), stbl]);
}

function visualEntry(type, width, height, configBoxes) {
  const w = new MuxByteWriter(78).zeros(6).u16(1).u16(0).u16(0).zeros(12);
  w.u16(width).u16(height).u32(0x00480000).u32(0x00480000).u32(0).u16(1);
  w.zeros(32).u16(0x18).i16(-1);
  return mp4Box(type, [w.finish(), ...configBoxes]);
}

function audioEntry(type, channels, sampleRate, configBoxes) {
  const w = new MuxByteWriter(28).zeros(6).u16(1).zeros(8).u16(channels).u16(16).u16(0).u16(0);
  w.u32(Math.min(sampleRate, 65535) * 65536);
  return mp4Box(type, [w.finish(), ...configBoxes]);
}

// MPEG-4 descriptor with its length in 7-bit groups.
function descriptor(tag, parts) {
  const body = concatBytes(parts);
  const len = [];
  for (let n = body.length; ; n = Math.floor(n / 128)) {
    len.unshift(n % 128);
    if (n < 128) break;
  }
  for (let i = 0; i < len.length - 1; i++) len[i] |= 0x80;
  return concatBytes([Uint8Array.of(tag, ...len), body]);
}

function esds(asc) {
  const dcd = new MuxByteWriter(13).u8(0x40).u8(0x15).u24(0).u32(0).u32(0).finish();
  const dec = descriptor(0x04, [dcd, descriptor(0x05, [asc])]);
  const es = descriptor(0x03, [Uint8Array.of(0, 0, 0), dec, descriptor(0x06, [Uint8Array.of(2)])]);
  return mp4FullBox("esds", 0, 0, [es]);
}

function dOps({ channels, sampleRate, preSkip = 3840 }) {
  if (!(channels === 1 || channels === 2)) throw new Error("muxMp4: Opus in MP4 supports 1 or 2 channels (mapping family 0)");
  const w = new MuxByteWriter(11).u8(0).u8(channels).u16(preSkip).u32(sampleRate).i16(0).u8(0);
  return mp4Box("dOps", [w.finish()]);
}

function vpcC({ profile = 0, level = 31, bitDepth = 8 }) {
  const w = new MuxByteWriter(8).u8(profile).u8(level).u8((bitDepth << 4) | (1 << 1));
  w.u8(1).u8(1).u8(1).u16(0);
  return mp4FullBox("vpcC", 1, 0, [w.finish()]);
}

function videoSampleEntry(video) {
  const { codec, width, height, description } = video;
  if (!(width > 0 && height > 0)) throw new Error("muxMp4: video width and height are required");
  if (codec === "avc1") {
    if (!(description instanceof Uint8Array) || description[0] !== 1) {
      throw new Error("muxMp4: avc1 needs description, the avcC record from VideoEncoder decoderConfig (avc format)");
    }
    return visualEntry("avc1", width, height, [mp4Box("avcC", [description])]);
  }
  if (codec === "vp09") return visualEntry("vp09", width, height, [vpcC(video)]);
  if (codec === "av01") {
    if (!(description instanceof Uint8Array) || description[0] !== 0x81) {
      throw new Error("muxMp4: av01 needs description, an AV1CodecConfigurationRecord (av1C) starting with 0x81");
    }
    return visualEntry("av01", width, height, [mp4Box("av1C", [description])]);
  }
  throw new Error(`muxMp4: unsupported video codec "${codec}" (use avc1, vp09 or av01)`);
}

function audioSampleEntry(audio) {
  if (audio.codec === "mp4a") {
    if (!(audio.description instanceof Uint8Array) || !audio.description.length) {
      throw new Error("muxMp4: mp4a needs description, the AudioSpecificConfig bytes");
    }
    return audioEntry("mp4a", audio.channels, audio.sampleRate, [esds(audio.description)]);
  }
  if (audio.codec === "Opus") return audioEntry("Opus", audio.channels, 48000, [dOps(audio)]);
  throw new Error(`muxMp4: unsupported audio codec "${audio.codec}" (use mp4a or Opus)`);
}

export function mp4Stsd(track) {
  const entry = track.audio ? audioSampleEntry(track.config) : videoSampleEntry(track.config);
  return mp4FullBox("stsd", 0, 0, [new MuxByteWriter(4).u32(1).finish(), entry]);
}

