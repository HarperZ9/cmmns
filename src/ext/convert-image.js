// Still images for the convert page: decode with createImageBitmap, scale on an OffscreenCanvas (or a
// canvas where OffscreenCanvas cannot encode), and encode to PNG, JPEG, WebP or AVIF at a chosen
// quality. A browser that cannot encode a format hands back PNG instead; that is detected and said,
// never passed off as the format asked for. A GIF gives its first frame here.
globalThis.PBConvertImage = (() => {
  "use strict";
  const TYPES = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp", avif: "image/avif" };

  function fit(w, h, maxSide) {
    if (!maxSide || Math.max(w, h) <= maxSide) return [w, h];
    const k = maxSide / Math.max(w, h);
    return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
  }

  async function encode(bitmap, w, h, type, quality) {
    if (typeof OffscreenCanvas !== "undefined") {
      const c = new OffscreenCanvas(w, h), g = c.getContext("2d");
      if (type === "image/jpeg") { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); }
      g.drawImage(bitmap, 0, 0, w, h);
      return c.convertToBlob({ type, quality });
    }
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    if (type === "image/jpeg") { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); }
    g.drawImage(bitmap, 0, 0, w, h);
    return new Promise((res) => c.toBlob(res, type, quality));
  }

  // Which formats this browser can write, by trying a 2 by 2 image once.
  let probe = null;
  function writable() {
    if (!probe) probe = (async () => {
      const bmp = await createImageBitmap(new ImageData(new Uint8ClampedArray(16).fill(200), 2, 2));
      const out = {};
      for (const [k, t] of Object.entries(TYPES)) { const b = await encode(bmp, 2, 2, t, 0.8).catch(() => null); out[k] = !!b && b.type === t; }
      return out;
    })();
    return probe;
  }

  // { bytes, mime, width, height, params } for one image. to: png | jpeg | webp | avif.
  async function convert(blob, { to = "webp", quality = 0.8, maxSide = 0 } = {}) {
    const type = TYPES[to];
    if (!type) throw new Error(`Unknown image format ${to}.`);
    const bitmap = await createImageBitmap(blob).catch(() => { throw new Error("The browser could not decode this image."); });
    const [w, h] = fit(bitmap.width, bitmap.height, Number(maxSide) || 0);
    const out = await encode(bitmap, w, h, type, Number(quality));
    bitmap.close();
    if (!out || out.type !== type) throw new Error(`This browser cannot write ${to.toUpperCase()} images${out ? ` (it gave ${out.type})` : ""}. Try WebP or JPEG.`);
    return { bytes: new Uint8Array(await out.arrayBuffer()), mime: type, width: w, height: h, params: { to: type, quality: type === "image/png" ? null : Number(quality), width: w, height: h } };
  }

  return Object.freeze({ convert, writable, fit, TYPES });
})();
