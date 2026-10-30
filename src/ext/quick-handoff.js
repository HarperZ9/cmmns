// Bytes the page made (a stream put together, a GIF), handed to the worker in pieces when the
// browser cannot read the page's own blob address. One message per piece keeps each one far under
// the browser's message size limit, and the page never builds a number array the size of the file,
// which froze the tab on large videos. handoff-bg.js puts the pieces back together.
globalThis.PBQuickHandoff = globalThis.PBQuickHandoff || (() => {
  "use strict";
  const PIECE = 4 * 1024 * 1024;

  async function base64(blob) {
    const b = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode(...b.subarray(i, i + 32768));
    return btoa(s);
  }

  // meta: { filename, site, study, library, overwrite }. Resolves to the worker's answer, { filename }.
  async function send(bytes, mime, meta) {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime });
    const pieces = Math.max(1, Math.ceil(blob.size / PIECE));
    let answer = null;
    for (let i = 0; i < pieces; i++) {
      const data = await base64(blob.slice(i * PIECE, (i + 1) * PIECE));
      answer = await chrome.runtime.sendMessage({ type: "pb-qs-piece", id, i, pieces, data, mime, ...(i === pieces - 1 ? meta : {}) });
      if (!answer || answer.error) throw new Error(answer && answer.error ? answer.error : "CMMNS's background did not take the file.");
    }
    return answer;
  }

  return Object.freeze({ send, PIECE });
})();
