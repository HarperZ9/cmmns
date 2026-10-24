// A growable big-endian byte writer and small byte helpers shared by the media muxers
// (WebM, MP4, Ogg). Plain Uint8Array and DataView only, so it runs in a browser page or Node.

const muxTextEncoder = new TextEncoder();
const TWO32 = 4294967296;

export class MuxByteWriter {
  constructor(capacity = 256) {
    this.buf = new Uint8Array(capacity);
    this.pos = 0;
  }
  ensure(n) {
    if (this.pos + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.pos + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.pos));
    this.buf = next;
  }
  u8(v) {
    this.ensure(1);
    this.buf[this.pos++] = v & 255;
    return this;
  }
  u16(v) {
    this.ensure(2);
    this.buf[this.pos++] = (v >>> 8) & 255;
    this.buf[this.pos++] = v & 255;
    return this;
  }
  u24(v) {
    this.ensure(3);
    this.buf[this.pos++] = (v >>> 16) & 255;
    this.buf[this.pos++] = (v >>> 8) & 255;
    this.buf[this.pos++] = v & 255;
    return this;
  }
  u32(v) {
    this.ensure(4);
    const x = v >>> 0;
    this.buf[this.pos++] = (x >>> 24) & 255;
    this.buf[this.pos++] = (x >>> 16) & 255;
    this.buf[this.pos++] = (x >>> 8) & 255;
    this.buf[this.pos++] = x & 255;
    return this;
  }
  u64(v) {
    const hi = Math.floor(v / TWO32);
    this.u32(hi);
    return this.u32(v - hi * TWO32);
  }
  i16(v) {
    return this.u16(v < 0 ? v + 65536 : v);
  }
  i32(v) {
    return this.u32(v < 0 ? v + TWO32 : v);
  }
  f64(v) {
    this.ensure(8);
    new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 8).setFloat64(0, v, false);
    this.pos += 8;
    return this;
  }
  bytes(arr) {
    this.ensure(arr.length);
    this.buf.set(arr, this.pos);
    this.pos += arr.length;
    return this;
  }
  zeros(n) {
    this.ensure(n);
    this.buf.fill(0, this.pos, this.pos + n);
    this.pos += n;
    return this;
  }
  // Four-character codes and other ASCII text, one byte per character.
  ascii(str) {
    this.ensure(str.length);
    for (let i = 0; i < str.length; i++) this.buf[this.pos++] = str.charCodeAt(i) & 255;
    return this;
  }
  utf8(str) {
    return this.bytes(muxTextEncoder.encode(str));
  }
  finish() {
    return this.buf.slice(0, this.pos);
  }
}

// Joins a list of Uint8Array pieces into one new Uint8Array.
export function concatBytes(list) {
  let total = 0;
  for (const part of list) total += part.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of list) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export function muxUtf8(str) {
  return muxTextEncoder.encode(str);
}

// Reads a big-endian unsigned integer of 1 to 8 bytes as a JavaScript number.
export function muxReadUint(bytes, start, length) {
  let v = 0;
  for (let i = 0; i < length; i++) v = v * 256 + bytes[start + i];
  return v;
}
