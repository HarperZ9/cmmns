// "Copy" and "Copy link" beside Download. Copy puts a picture on the clipboard as PNG, which every
// app can paste. Browsers let pages put only text and PNG pictures on the clipboard, so for a video
// or GIF, Copy gives its direct address instead and says so. Copy link gives the file's own address,
// or the post's address for a stream that has no single file. Nothing is sent anywhere.
globalThis.PBQuickCopy = globalThis.PBQuickCopy || (() => {
  "use strict";
  const toast = (t, o) => PBQuickToast.show(t, o);

  async function writeText(text) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* the page has no focus or no click: try the older way */ }
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    (document.body || document.documentElement).append(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("The browser did not allow the copy.");
  }

  async function pngOf(t, plan) {
    let blob;
    if (plan.action === "canvas") blob = await new Promise((res, rej) => t.el.toBlob((b) => (b ? res(b) : rej(new Error("The canvas is empty."))), "image/png"));
    else {
      const url = plan.url, same = /^(data|blob):/.test(url) || new URL(url).origin === location.origin;
      const res = await fetch(url, { credentials: same ? "include" : "omit", mode: "cors" });
      if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
      blob = await res.blob();
    }
    if (blob.type === "image/png") return blob;
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width; c.height = bmp.height;
    c.getContext("2d").drawImage(bmp, 0, 0);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("The picture could not be turned into PNG."))), "image/png"));
  }

  // The address worth sharing: the file's own, else the post's, else the page's.
  function linkOf(t, plan) {
    if (plan.url && /^https?:/i.test(plan.url)) return { text: plan.url, what: "the file's address" };
    if (t.url && /^https?:/i.test(t.url)) return { text: PB.fullSizeUrl(t.url), what: "the file's address" };
    const post = t.el && t.el.closest && (t.el.closest("article") || t.el.closest("shreddit-post"));
    const a = post && (post.getAttribute("permalink") || ([...post.querySelectorAll('a[href*="/status/"]')].find((x) => x.querySelector("time")) || {}).href);
    if (a) return { text: new URL(a, location.href).href, what: "the post's address (this video streams in parts and has no single file)" };
    return { text: location.href, what: "the page's address (this media has no single file)" };
  }

  async function copy(t, { link = false } = {}) {
    if (!t) { toast("No picture, GIF or video was found under the pointer.", { tone: "no" }); return { ok: false }; }
    const plan = PB.downloadPlan(t);
    if (plan.action === "refuse") { toast(`Protected, can't be copied. ${plan.reason}`, { tone: "no", stay: 7000 }); return { ok: false, protected: true }; }
    try {
      const still = !link && t.kind === "image" && ["url", "bytes", "canvas"].includes(plan.action) && typeof ClipboardItem !== "undefined";
      if (still) {
        try {
          const png = await pngOf(t, plan);
          await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
          toast("Copied the picture.", { tone: "ok" });
          return { ok: true, what: "image" };
        } catch (e) { console.warn("[daylight-commons] could not copy the picture itself; copying its address", e); }
      }
      const l = linkOf(t, plan);
      await writeText(l.text);
      toast(link ? `Copied ${l.what}.` : `Copied ${l.what}. Browsers let pages copy pictures, not video or GIF files.`, { tone: "ok" });
      return { ok: true, what: "link", text: l.text };
    } catch (e) {
      toast(`Not copied: ${e.message}`, { tone: "no", stay: 7000 });
      return { ok: false, error: e.message };
    }
  }

  return Object.freeze({ copy, linkOf });
})();
