// Writes WebM files (Matroska subset) from already encoded video and audio chunks, such as the
// output of WebCodecs VideoEncoder (VP8, VP9, AV1) and AudioEncoder (Opus). Also builds the
// 19-byte OpusHead that WebM and Ogg carry as Opus codec setup.

import { concatBytes, muxUtf8 } from "./media-bytes.js";

const ID = {
  EBML: 0x1a45dfa3, EBMLVersion: 0x4286, EBMLReadVersion: 0x42f7, EBMLMaxIDLength: 0x42f2,
  EBMLMaxSizeLength: 0x42f3, DocType: 0x4282, DocTypeVersion: 0x4287, DocTypeReadVersion: 0x4285,
  Segment: 0x18538067, SeekHead: 0x114d9b74, Seek: 0x4dbb, SeekID: 0x53ab, SeekPosition: 0x53ac,
  Info: 0x1549a966, TimecodeScale: 0x2ad7b1, MuxingApp: 0x4d80, WritingApp: 0x5741, Duration: 0x4489,
  Tracks: 0x1654ae6b, TrackEntry: 0xae, TrackNumber: 0xd7, TrackUID: 0x73c5, TrackType: 0x83,
  FlagLacing: 0x9c, CodecID: 0x86, CodecPrivate: 0x63a2, CodecDelay: 0x56aa, SeekPreRoll: 0x56bb,
  Video: 0xe0, PixelWidth: 0xb0, PixelHeight: 0xba, Audio: 0xe1, SamplingFrequency: 0xb5, Channels: 0x9f,
  Cluster: 0x1f43b675, Timecode: 0xe7, SimpleBlock: 0xa3,
  Cues: 0x1c53bb6b, CuePoint: 0xbb, CueTime: 0xb3, CueTrackPositions: 0xb7, CueTrack: 0xf7,
  CueClusterPosition: 0xf1,
};
const VIDEO_CODECS = ["V_VP8", "V_VP9", "V_AV1"];
const APP_NAME = "CMMNS";

// Element ids are written as given, marker bits included.
function idBytes(id) {
  const out = [];
  for (let v = id; v > 0; v = Math.floor(v / 256)) out.unshift(v % 256);
  return Uint8Array.from(out);
}

// EBML variable-length size; the all-ones value of each length is reserved for "unknown".
function sizeBytes(n) {
  let len = 1;
  while (len < 8 && n >= 2 ** (7 * len) - 1) len++;
  const out = new Uint8Array(len);
  let v = n;
  for (let i = len - 1; i >= 0; i--) {
    out[i] = v % 256;
    v = Math.floor(v / 256);
  }
  out[0] |= 0x80 >> (len - 1);
  return out;
}

function uintBytes(v, width = 0) {
  const out = [];
  for (let x = v; x > 0; x = Math.floor(x / 256)) out.unshift(x % 256);
  while (out.length < Math.max(1, width)) out.unshift(0);
  return Uint8Array.from(out);
}

function piecesLength(pieces) {
  let n = 0;
  for (const p of pieces) n += p.length;
  return n;
}

// An element is a flat list of byte pieces: id, size, then the payload pieces.
function el(id, payload) {
  const pieces = payload instanceof Uint8Array ? [payload] : payload;
  const out = [idBytes(id), sizeBytes(piecesLength(pieces))];
  for (const p of pieces) out.push(p);
  return out;
}

const elUint = (id, v) => el(id, uintBytes(v));
const elStr = (id, s) => el(id, muxUtf8(s));
function elFloat(id, v) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, v, false);
  return el(id, b);
}

export function opusHead({ channels, sampleRate, preSkip = 3840 }) {
  if (!(channels === 1 || channels === 2)) {
    throw new Error("opusHead: only 1 or 2 channels use mapping family 0; pass the encoder's OpusHead as codecPrivate for more channels");
  }
  const b = new Uint8Array(19);
  b.set(muxUtf8("OpusHead"), 0);
  const dv = new DataView(b.buffer);
  dv.setUint8(8, 1);
  dv.setUint8(9, channels);
  dv.setUint16(10, preSkip, true);
  dv.setUint32(12, sampleRate, true);
  dv.setInt16(16, 0, true);
  dv.setUint8(18, 0);
  return b;
}

function ebmlHeader() {
  return el(ID.EBML, [
    ...elUint(ID.EBMLVersion, 1), ...elUint(ID.EBMLReadVersion, 1),
    ...elUint(ID.EBMLMaxIDLength, 4), ...elUint(ID.EBMLMaxSizeLength, 8),
    ...elStr(ID.DocType, "webm"), ...elUint(ID.DocTypeVersion, 4), ...elUint(ID.DocTypeReadVersion, 2),
  ]);
}

function videoEntry(video, number) {
  if (!VIDEO_CODECS.includes(video.codec)) throw new Error(`muxWebM: video codec must be one of ${VIDEO_CODECS.join(", ")}`);
  if (!(video.width > 0 && video.height > 0)) throw new Error("muxWebM: video width and height are required");
  const body = [
    ...elUint(ID.TrackNumber, number), ...elUint(ID.TrackUID, number), ...elUint(ID.TrackType, 1),
    ...elUint(ID.FlagLacing, 0), ...elStr(ID.CodecID, video.codec),
  ];
  if (video.codecPrivate && video.codecPrivate.length) body.push(...el(ID.CodecPrivate, video.codecPrivate));
  body.push(...el(ID.Video, [...elUint(ID.PixelWidth, video.width), ...elUint(ID.PixelHeight, video.height)]));
  return el(ID.TrackEntry, body);
}

function audioEntry(audio, number) {
  if (audio.codec !== "A_OPUS") throw new Error("muxWebM: audio codec must be A_OPUS");
  const head = audio.codecPrivate && audio.codecPrivate.length ? audio.codecPrivate : opusHead(audio);
  const preSkip = head.length >= 12 ? head[10] | (head[11] << 8) : 0;
  return el(ID.TrackEntry, [
    ...elUint(ID.TrackNumber, number), ...elUint(ID.TrackUID, number), ...elUint(ID.TrackType, 2),
    ...elUint(ID.FlagLacing, 0), ...elStr(ID.CodecID, "A_OPUS"), ...el(ID.CodecPrivate, head),
    ...elUint(ID.CodecDelay, Math.round((preSkip / 48000) * 1e9)), ...elUint(ID.SeekPreRoll, 80000000),
    ...el(ID.Audio, [...elFloat(ID.SamplingFrequency, audio.sampleRate), ...elUint(ID.Channels, audio.channels)]),
  ]);
}

function simpleBlock(trackNo, rel, key, data) {
  const head = new Uint8Array(4);
  head[0] = 0x80 | trackNo;
  head[1] = (rel >> 8) & 255;
  head[2] = rel & 255;
  head[3] = key ? 0x80 : 0;
  return el(ID.SimpleBlock, [head, data]);
}

// Groups sorted chunks into clusters. A cluster opens at each video keyframe, before the
// int16 relative timecode would overflow, and every 5 s when there is no video track.
function webmClusters(sorted, numbers, hasVideo) {
  const clusters = [];
  let cur = null;
  for (const c of sorted) {
    const ms = Math.round(c.timestampUs / 1000);
    const videoKey = hasVideo && c.track === "video" && c.key;
    const rel = cur ? ms - cur.time : 0;
    if (!cur || videoKey || rel > 32767 || (!hasVideo && rel >= 5000)) {
      cur = { time: ms, cue: !hasVideo || videoKey, blocks: [] };
      clusters.push(cur);
    }
    cur.blocks.push(...simpleBlock(numbers[c.track], ms - cur.time, c.key, c.data));
  }
  if (clusters.length && !clusters.some((cl) => cl.cue)) clusters[0].cue = true;
  return clusters.map((cl) => ({ ...cl, pieces: el(ID.Cluster, [...elUint(ID.Timecode, cl.time), ...cl.blocks]) }));
}

function seekEntry(target, pos) {
  return el(ID.Seek, [...el(ID.SeekID, idBytes(target)), ...el(ID.SeekPosition, uintBytes(pos, 8))]);
}

function seekHead(infoPos, tracksPos, cuesPos) {
  const body = [...seekEntry(ID.Info, infoPos), ...seekEntry(ID.Tracks, tracksPos)];
  if (cuesPos !== null) body.push(...seekEntry(ID.Cues, cuesPos));
  return el(ID.SeekHead, body);
}

function webmCues(clusters, firstPos, cueTrack) {
  const points = [];
  let pos = firstPos;
  for (const cl of clusters) {
    if (cl.cue) {
      points.push(...el(ID.CuePoint, [
        ...elUint(ID.CueTime, cl.time),
        ...el(ID.CueTrackPositions, [...elUint(ID.CueTrack, cueTrack), ...elUint(ID.CueClusterPosition, pos)]),
      ]));
    }
    pos += piecesLength(cl.pieces);
  }
  return el(ID.Cues, points);
}

function checkChunks(chunks, numbers) {
  for (const c of chunks) {
    if (!numbers[c.track]) throw new Error(`muxWebM: chunk for missing track "${c.track}"`);
    if (!(c.data instanceof Uint8Array)) throw new Error("muxWebM: chunk data must be a Uint8Array");
    if (!Number.isFinite(c.timestampUs)) throw new Error("muxWebM: chunk timestampUs must be a number");
  }
}

function totalDurationUs(chunks, durationUs) {
  if (Number.isFinite(durationUs)) return durationUs;
  let end = 0;
  for (const c of chunks) end = Math.max(end, c.timestampUs + (c.durationUs || 0));
  return end;
}

// Time order; on a tie video goes first so a keyframe opens its cluster before the audio.
function webmOrder(a, b) {
  return a.timestampUs - b.timestampUs || (a.track === b.track ? 0 : a.track === "video" ? -1 : 1);
}

export function muxWebM({ video, audio, chunks = [], durationUs } = {}) {
  if (!video && !audio) throw new Error("muxWebM: needs a video or an audio track");
  const numbers = {};
  const entries = [];
  if (video) entries.push(...videoEntry(video, (numbers.video = 1)));
  if (audio) entries.push(...audioEntry(audio, (numbers.audio = video ? 2 : 1)));
  checkChunks(chunks, numbers);
  const sorted = chunks.slice().sort(webmOrder);
  const info = el(ID.Info, [
    ...elUint(ID.TimecodeScale, 1000000), ...elStr(ID.MuxingApp, APP_NAME), ...elStr(ID.WritingApp, APP_NAME),
    ...elFloat(ID.Duration, totalDurationUs(chunks, durationUs) / 1000),
  ]);
  const tracks = el(ID.Tracks, entries);
  const clusters = webmClusters(sorted, numbers, Boolean(video));
  const hasCues = clusters.length > 0;
  const seekLen = piecesLength(seekHead(0, 0, hasCues ? 0 : null));
  const infoPos = seekLen;
  const tracksPos = infoPos + piecesLength(info);
  const firstCluster = tracksPos + piecesLength(tracks);
  let cuesPos = firstCluster;
  for (const cl of clusters) cuesPos += piecesLength(cl.pieces);
  const cues = hasCues ? webmCues(clusters, firstCluster, video ? numbers.video : numbers.audio) : [];
  const body = [...seekHead(infoPos, tracksPos, hasCues ? cuesPos : null), ...info, ...tracks];
  for (const cl of clusters) for (const p of cl.pieces) body.push(p);
  for (const p of cues) body.push(p);
  return concatBytes([...ebmlHeader(), ...el(ID.Segment, body)]);
}
