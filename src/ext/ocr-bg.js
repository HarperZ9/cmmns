// Reading text in images, in the background worker (src/ocr through ocr.bundle.js). A content
// script sends the bytes of one image the page already loaded, after the user clicked "Read text
// in this image" with the feature on in the options page. The image is decoded and read here, in
// the extension's own context, which no web page can reach. Nothing is fetched except the weight
// file inside the extension; the weights are dropped after a minute without use.
(() => {
  "use strict";
  const IDLE_MS = 60000, MAX_BYTES = 25 * 1024 * 1024, MAX_SIDE = 2400;
  let model = null, loading = null, idle = 0;

  function load() {
    clearTimeout(idle);
    idle = setTimeout(() => { model = null; loading = null; }, IDLE_MS);
    if (model) return Promise.resolve(model);
    if (!loading) loading = fetch(chrome.runtime.getURL("ocr/latin.bin")).then((r) => r.arrayBuffer()).then((b) => (model = PBOCR.decodeWeights(b)))
      .catch((e) => { loading = null; throw e; });
    return loading;
  }

  function bytesOf(b64) {
    const s = atob(b64), out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  // Pixels of the image, scaled down when a side is longer than the reader takes.
  async function pixels(bytes) {
    const bmp = await createImageBitmap(new Blob([bytes]));
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const c = new OffscreenCanvas(w, h), g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return g.getImageData(0, 0, w, h);
  }

  async function read(msg) {
    const s = PB.normalizeSettings((await chrome.storage.local.get(PB.SETTINGS_KEY))[PB.SETTINGS_KEY]);
    if (!s.imageText) return { error: "reading text in images is off in Daylight Commons' options" };
    if (typeof msg.bytes !== "string" || msg.bytes.length > (MAX_BYTES * 4) / 3 + 4) return { error: "the image is larger than Daylight Commons reads" };
    const [m, img] = await Promise.all([load(), pixels(bytesOf(msg.bytes))]);
    const r = PBOCR.readImage(m, { data: img.data, width: img.width, height: img.height }, { now: () => performance.now() });
    return { text: r.text, confidence: r.confidence, ms: r.ms, lines: r.lines.map((l) => ({ text: l.text, confidence: l.confidence, low: l.low })) };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== "pb-ocr" || !sender.tab) return undefined;
    read(msg).then(sendResponse, (e) => {
      console.error("[daylight-commons] reading text in an image failed", e);
      sendResponse({ error: e && e.name === "InvalidStateError" ? "the browser could not decode this image" : "the reader failed on this image" });
    });
    return true;
  });
})();
