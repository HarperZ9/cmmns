// The page's reads of a media file for a save (quick-save.js). One request per file: the first 64 KB
// decide the type and whether the file is protected, and when the post's words go inside the file the
// same answer is read on to the end. Before this change a file was asked for twice, a 64 KB range to look
// at it and then the whole file, one more round trip to the host for every picture.
globalThis.PBQuickFetch = globalThis.PBQuickFetch || (() => {
  "use strict";
  const HEAD = 65536, HEAD_WAIT_MS = 10000;
  const size = (n) => PB.sizeText(n);

  // Opens url and reads its first 64 KB. Resolves to { missing: status } for an error answer, null when
  // the host does not let the page read it (the address and the browser then decide), else
  // { bytes, type, total, rest(onProgress, limit), cancel() }. rest() reads on to the end and resolves
  // to { bytes, type } with every byte, or to null without reading when the file is over limit.
  // The 10 s limit covers the answer and its first 64 KB only, never a long file's whole body.
  async function open(url) {
    const ac = new AbortController(), timer = setTimeout(() => ac.abort(), HEAD_WAIT_MS);
    try {
      const res = await fetch(url, { credentials: "omit", mode: "cors", signal: ac.signal });
      if (!res.ok) { clearTimeout(timer); res.body && res.body.cancel().catch(() => {}); return { missing: res.status }; }
      const reader = res.body.getReader(), parts = [];
      let n = 0, done = false;
      while (n < HEAD) { const r = await reader.read(); if (r.done) { done = true; break; } parts.push(r.value); n += r.value.length; }
      clearTimeout(timer);
      const type = res.headers.get("content-type") || "", total = Number(res.headers.get("content-length") || 0) || (done ? n : 0);
      const cancel = () => { if (!done) reader.cancel().catch(() => {}); };
      async function rest(onProgress = null, limit = 0) {
        if (limit && total > limit) { cancel(); return null; }
        let shown = 0;
        while (!done) {
          const r = await reader.read();
          if (r.done) { done = true; break; }
          parts.push(r.value); n += r.value.length;
          if (onProgress && total >= 2097152 && Date.now() - shown > 250) { shown = Date.now(); onProgress(`Reading ${size(n)} of ${size(total)}`); }
        }
        return { bytes: PB.concatBytes(parts), type };
      }
      return { bytes: PB.concatBytes(parts).subarray(0, HEAD), type, total, rest, cancel };
    } catch { clearTimeout(timer); return null; }
  }

  // A file's bytes, read whole. With onProgress, a file over 2 MB reports "Reading 3.1 MB of 12.0 MB".
  // With a limit, a file whose length is over it is not read: resolves to null.
  async function bytesOf(url, onProgress = null, limit = 0) {
    const res = await fetch(url, { credentials: /^(data|blob):/.test(url) || new URL(url).origin === location.origin ? "include" : "omit" });
    if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
    const type = res.headers.get("content-type") || "", total = Number(res.headers.get("content-length") || 0);
    if (limit && total > limit) { if (res.body) res.body.cancel().catch(() => {}); return null; }
    if (!onProgress || !res.body || total < 2097152) return { bytes: new Uint8Array(await res.arrayBuffer()), type };
    const reader = res.body.getReader(), parts = [];
    let n = 0, shown = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value); n += value.length;
      if (Date.now() - shown > 250) { shown = Date.now(); onProgress(`Reading ${size(n)} of ${size(total)}`); }
    }
    return { bytes: PB.concatBytes(parts), type };
  }

  return Object.freeze({ open, bytesOf });
})();
