"""3.7.0 check: the Boards page opens a 3.6.0 moodboard as a study board, keeps the lane and layout
on the moodboard (the migration), draws every layout, and saves one self-contained web page.
Development tool only.

    python scripts/qa/board_page_check.py <work folder>
"""
import asyncio
import json
import pathlib
import subprocess
import sys

from playwright.async_api import async_playwright

import quick_save_check as q

SEED = """async () => {
  const mb = await PBMediaStore.newBoard("Kilns and clay");
  const colours = ["#8f3a19", "#3a5a40", "#264653"];
  for (let i = 0; i < 3; i++) {
    const c = new OffscreenCanvas(640, 420), g = c.getContext("2d");
    g.fillStyle = colours[i]; g.fillRect(0, 0, 640, 420); g.fillStyle = "#ebe5d8"; g.font = "120px sans-serif"; g.fillText(String(i + 1), 260, 260);
    const blob = await c.convertToBlob({ type: "image/png" });
    const sha = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const rec = PB.savedRecord({ bytes: blob.size, mime: "image/png", url: `https://example.org/kiln-${i}.png`, page: `https://x.com/potter/status/${100 + i}`, pageTitle: `Kiln ${i + 1}`, alt: `kiln number ${i + 1}` },
      { sha256: sha, collection: { type: "moodboard", id: mb.id }, tags: ["clay", "fire"], note: i === 0 ? "the ash glaze" : "", now: new Date(Date.UTC(2026, 0, 1 + i * 9)).toISOString() });
    await PBMediaStore.put(rec, blob);
  }
  return mb.id;
}"""


async def main(work):
    work.mkdir(parents=True, exist_ok=True)
    out = {}
    async with async_playwright() as p:
        proc, browser, ctx, sw, dl = await q.launch(p, work)
        try:
            base = f"chrome-extension://{sw.ext_id}/"
            page = await ctx.new_page()
            await page.set_viewport_size({"width": 1280, "height": 1000})
            await page.goto(base + "collections.html")
            await asyncio.sleep(1)
            mb = await page.evaluate(SEED)
            await page.reload()
            await page.select_option("#which", "moodboard:" + mb)
            await asyncio.sleep(0.5)
            out["link"] = await page.get_attribute("#study-board", "href")
            await page.click("#study-board")
            await page.wait_for_load_state("load")
            await asyncio.sleep(1.5)
            out["status"] = await page.text_content("#status")
            frame = page.frame_locator("#view")
            out["plates_grid"] = await frame.locator("img").count()
            await page.screenshot(path=str(work / "boards-grid.png"))
            await page.fill("#lane", "design")
            await page.select_option("#layout", "book")
            await page.dispatch_event("#lane", "change")
            await asyncio.sleep(1)
            await page.screenshot(path=str(work / "boards-book.png"))
            out["head_right"] = await frame.locator("body").inner_text()
            out["head_right"] = "DESIGN" in out["head_right"]
            await page.select_option("#layout", "timeline")
            await asyncio.sleep(1)
            await page.screenshot(path=str(work / "boards-time.png"))
            out["moodboard_after"] = await page.evaluate("async (id) => (await PBMediaStore.boards()).find((b) => b.id === id)", mb)
            await page.click("#page")
            for _ in range(60):
                got = list(dl.rglob("*.html"))
                if got and not list(dl.rglob("*.crdownload")):
                    break
                await asyncio.sleep(0.5)
            out["page_status"] = await page.text_content("#status")
            out["downloads"] = await page.evaluate("async () => (await chrome.downloads.search({})).map((d) => [d.filename, d.state, d.error, d.url.slice(0, 40)])")
            got = list(dl.rglob("*.html"))
            out["saved"] = [str(g.relative_to(dl)) for g in got]
            if got:
                html = got[0].read_text(encoding="utf-8")
                out["saved_images_inline"] = html.count("data:image/png;base64,")
                out["saved_font_inline"] = "data:font/woff2" in html or "data:application/octet-stream" in html or "data:font" in html
                out["saved_has_script"] = "<script" in html.lower()
                v = await ctx.new_page()
                await v.goto(got[0].as_uri())
                await asyncio.sleep(1)
                await v.screenshot(path=str(work / "boards-saved.png"), full_page=False)
                out["saved_images_loaded"] = await v.evaluate("[...document.images].filter((i) => i.complete && i.naturalWidth > 0).length")
            # A folder of saves, through the same handle interface the folder picker gives (the
            # browser's private file system stands in for the picked folder).
            out["folder"] = await page.evaluate("""async () => {
              const root = await navigator.storage.getDirectory(), x = await root.getDirectoryHandle("x", { create: true });
              const put = async (d, n, data) => { const w = await (await d.getFileHandle(n, { create: true })).createWritable(); await w.write(data); await w.close(); };
              const c = new OffscreenCanvas(200, 120); c.getContext("2d").fillRect(0, 0, 200, 120);
              await put(x, "heron.png", await c.convertToBlob({ type: "image/png" }));
              const NL = String.fromCharCode(10), q = JSON.stringify;
              await put(x, "heron.png.md", ["---", "format: " + q("daylight.sidecar/1"), "site: " + q("x"), "files: " + q(["heron.png"]), "posted: " + q("2026-02-01T10:00:00Z"), "---", "", "> a heron at dawn", ""].join(NL));
              await put(await root.getDirectoryHandle("boards", { create: true }), "skip.md", ["---", "format: " + q("daylight.sidecar/1"), "---", ""].join(NL));
              const entries = await PBBoardsRead.fromFolder(root);
              const b = PB.boardFrom(entries, { title: "Shore" });
              return { entries: entries.length, plates: b.plates.length, text: b.plates[0].source.text, file: Object.keys(entries[0].file), kept_text: entries[0].text.length > 0 };
            }""")
            # The picked-folder path end to end: the picker hands over the same folder, then "Save as a
            # folder" writes boards/<title>/ beside the saves.
            await page.evaluate("() => { window.showDirectoryPicker = async () => navigator.storage.getDirectory(); }")
            await page.fill("#title", "")
            await page.click("#folder")
            await asyncio.sleep(1.5)
            await page.fill("#title", "Shore")
            await page.dispatch_event("#title", "change")
            out["folder_status"] = await page.text_content("#status")
            out["write_visible"] = await page.is_visible("#write")
            await page.click("#write")
            await asyncio.sleep(2)
            out["write_status"] = await page.text_content("#status")
            out["written"] = await page.evaluate("""async () => {
              const list = async (d, pre = "") => { const o = []; for await (const [n, h] of d.entries()) o.push(...(h.kind === "directory" ? await list(h, pre + n + "/") : [pre + n])); return o.sort(); };
              const root = await navigator.storage.getDirectory();
              return list(await (await root.getDirectoryHandle("boards")).getDirectoryHandle("shore"));
            }""")
            out["manifest"] = await page.evaluate("""async () => {
              const root = await navigator.storage.getDirectory();
              const d = await (await root.getDirectoryHandle("boards")).getDirectoryHandle("shore");
              return (await (await d.getFileHandle("MANIFEST.sha256")).getFile()).text();
            }""")
            errs = []
            page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            await page.reload()
            await asyncio.sleep(1)
            out["console_errors"] = errs
        finally:
            await browser.close()
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)], capture_output=True)
    print(json.dumps(out, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main(pathlib.Path(sys.argv[1])))
