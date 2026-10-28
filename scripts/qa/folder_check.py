"""3.6.2 check: every save path lands in Downloads/CMMNS/<site>/ on a profile that carries
3.6.0 settings, and a tab left open across an extension update still saves into the folder.
Development tool only.

    python scripts/qa/folder_check.py <work folder> <source folder>

Paths: right-click Download, hover Download, the X button, the Reddit button (replica on mapped
hosts), Study, a text note and a text card. Then the extension is reloaded with the X tab open (what
an update does) and the X button is pressed again without reloading the page.
"""
import asyncio
import json
import pathlib
import subprocess
import sys

from playwright.async_api import async_playwright

import hover_extra as hx
import quick_fixture as fx
import quick_save_check as q

V360 = {"paused": False, "feeds": True, "auto": True, "sites": {}, "areas": {}, "historyDays": 60, "aboutDays": 14, "calm": False, "large": False, "onboarded": True,
        "search": {}, "coverage": False, "feedConsent": False, "outlets": {}, "customFeeds": [], "imageText": False, "evidence": False, "lensAll": False, "pressureLens": False,
        "adblock": False, "adblockAllow": [], "mediaButtons": True, "mediaAskWhere": False, "mediaSidecar": True, "mediaEmbed": True, "mediaSidecarJson": False, "mediaFolder": "Daylight"}
WIKI, X_PHOTO, X_TEXT = "https://en.wikipedia.org/wiki/Mount_Rainier", "https://x.com/NASA/status/2113655288687431819", "https://x.com/StarshipDad/status/2113697702823297061"


async def click_button(ctx, sw, url, selector, want=2):
    page = await ctx.new_page()
    await page.set_viewport_size({"width": 1280, "height": 900})
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)
    await asyncio.sleep(9)
    before, read = await q.newest_ids(sw), await q.note_reader(sw, url)
    await page.locator(selector).last.click()
    files, note = await hx.saved(sw, before, read, want, timeout=60)
    return page, files, note


async def right_click(ctx, sw, url, menu, selector, want=2):
    page = await ctx.new_page()
    await page.set_viewport_size({"width": 1280, "height": 900})
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)
    await asyncio.sleep(5)
    before, read = await q.newest_ids(sw), await q.note_reader(sw, url)
    await q.menu_click(sw, page, menu, selector=selector)
    files, note = await hx.saved(sw, before, read, want, timeout=60)
    await page.close()
    return files, note


async def main(work, src):
    work.mkdir(parents=True, exist_ok=True)
    site = fx.build(work, src)
    servers = fx.serve(site, work)
    out = []
    async with async_playwright() as p:
        proc, browser, ctx, sw, dl = await q.launch(p, work)
        await sw.evaluate("(v) => chrome.storage.local.set({ 'pb.settings': v })", V360)
        try:
            runs = [
                ("right-click", lambda: right_click(ctx, sw, WIKI, "pb-dl", ".infobox img")),
                ("study", lambda: right_click(ctx, sw, "https://en.wikipedia.org/wiki/Mount_Hood", "pb-study", ".infobox img")),
                ("text-card", lambda: right_click(ctx, sw, X_TEXT, "pb-card", 'article:has(a[href$="/status/2113697702823297061"])')),
                ("hover", lambda: hover(ctx, sw)),
            ]
            for name, run in runs:
                files, note = await run()
                out.append({"path": name, "note": (note or {}).get("text"), "files": files})
            for name, url, sel, want in [("x-button", X_PHOTO, "article .dc-dl:not(.dc-study)", 2),
                                          ("text-note", X_TEXT, 'article:has(a[href$="/status/2113697702823297061"]) .dc-dl:not(.dc-study)', 1),
                                          ("reddit-button", "https://www.reddit.com/r/test/comments/g1/photos/", "#gal .dc-dl:not(.dc-study)", 4)]:
                page, files, note = await click_button(ctx, sw, url, sel, want)
                out.append({"path": name, "note": (note or {}).get("text"), "files": files})
                if name == "x-button":
                    # An update with the tab still open: reload the extension, then press the button again.
                    cdp = await browser.new_browser_cdp_session()
                    await cdp.send("Extensions.loadUnpacked", {"path": str(work / "ext")})   # same id, as an update
                    await asyncio.sleep(6)
                    before, read = await q.newest_ids(sw), await q.note_reader(sw, url)
                    await page.locator("article .dc-dl:not(.dc-study)").first.click()
                    files2, note2 = await hx.saved(sw, before, read, 2, timeout=40)
                    out.append({"path": "x-button-after-update", "note": (note2 or {}).get("text"), "files": files2})
                await page.close()
        finally:
            loose = [x.name for x in dl.iterdir() if x.is_file()]
            out.append({"downloads_root_files": loose})
            (work / "folder-check.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
            await browser.close()
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True) if sys.platform == "win32" else proc.terminate()
            for s in servers:
                s.shutdown()
    for r in out:
        print(json.dumps({k: (v if k != "files" else [(f["folder"], f["name"][:50]) for f in v]) for k, v in r.items()}, ensure_ascii=False))


async def hover(ctx, sw):
    page = await ctx.new_page()
    await page.set_viewport_size({"width": 1280, "height": 900})
    url = "https://en.wikipedia.org/wiki/Mount_St._Helens"
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)
    await asyncio.sleep(4)
    box = await (await page.wait_for_selector(".infobox img")).bounding_box()
    await page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, steps=3)
    await asyncio.sleep(0.9)
    before, read = await q.newest_ids(sw), await q.note_reader(sw, url)
    bx = min(max(box["x"] + box["width"] - 70, box["x"] + 4, 4), 1280 - 66) + 16
    by = min(max(box["y"] + 8, 4), 900 - 36) + 16
    await page.mouse.move(bx, by)
    await page.mouse.click(bx, by)
    files, note = await hx.saved(sw, before, read, 2, timeout=40)
    await page.close()
    return files, note


if __name__ == "__main__":
    asyncio.run(main(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])))
