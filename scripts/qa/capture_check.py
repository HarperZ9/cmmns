"""3.7.0 check: "Capture as evidence" on two public pictures saves each file, its note, a picture of
the visible page and a capture record; the custody chain in the browser has a line per capture; and
`cmmns capture verify` passes on the folder, then fails after one byte of a saved file changes.
Development tool only. The test copy of the extension carries <all_urls>, as the other checks do;
in use, the right-click itself grants the page picture (activeTab).

    python scripts/qa/capture_check.py <work folder>
"""
import asyncio
import json
import pathlib
import subprocess
import sys

from playwright.async_api import async_playwright

import hover_extra as hx
import quick_save_check as q

ROOT = pathlib.Path(__file__).resolve().parents[2]
PAGES = [("https://en.wikipedia.org/wiki/Mount_Rainier", ".infobox img"), ("https://en.wikipedia.org/wiki/Mount_Hood", ".infobox img"), ("https://x.com/NASA/status/2113655288687431819", "article img[src*='pbs.twimg.com/media']")]


async def main(work):
    work.mkdir(parents=True, exist_ok=True)
    out = {"captures": []}
    async with async_playwright() as p:
        proc, browser, ctx, sw, dl = await q.launch(p, work)
        try:
            await asyncio.sleep(3)
            for pg in list(ctx.pages):   # the welcome page opens on install and would be the visible tab
                if pg.url.startswith("chrome-extension://"):
                    await pg.close()
            for url, sel in PAGES:
                page = await ctx.new_page()
                await page.set_viewport_size({"width": 1280, "height": 900})
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                await page.bring_to_front()
                await asyncio.sleep(9 if "x.com" in url else 4)
                before, read = await q.newest_ids(sw), await q.note_reader(sw, url)
                await q.menu_click(sw, page, "pb-capture", selector=sel)
                try:
                    files, note = await hx.saved(sw, before, read, 4, timeout=90)
                except Exception as e:
                    files, note = [], {"text": f"harness: {e}"}
                out["captures"].append({"page": url, "note": (note or {}).get("text"), "files": sorted(f["name"] for f in files)})
                await page.close()
            out["custody_lines"] = await sw.evaluate("chrome.storage.local.get('pb.custody').then((r) => (r['pb.custody'] || []).map((l) => [l.seq, l.prev ? l.prev.slice(0, 8) : null, l.hash.slice(0, 8)]))")
        finally:
            await browser.close()
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)], capture_output=True)
    for f in sorted(dl.rglob("*.capture.json")):
        rec = json.loads(f.read_text(encoding="utf-8"))
        out.setdefault("transparency", {})[f.parent.name] = {"rows": [(r["property"], r["clarity"], r["kept"]) for r in rec["transparency"]["rows"]], "mean": [rec["transparency"]["mean"], rec["transparency"]["measured"], rec["transparency"]["of"]]}
    folder = next(dl.rglob("*.capture.json")).parent
    v = subprocess.run(["node", str(ROOT / "bin" / "radar.mjs"), "capture", "verify", str(dl)], capture_output=True, text=True)
    out["verify"] = [v.returncode, v.stdout.strip()]
    img = next(f for f in folder.iterdir() if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp") and ".capture." not in f.name)
    b = bytearray(img.read_bytes()); b[-1] ^= 1; img.write_bytes(bytes(b))
    v = subprocess.run(["node", str(ROOT / "bin" / "radar.mjs"), "capture", "verify", str(dl)], capture_output=True, text=True)
    out["verify_after_one_byte"] = [v.returncode, v.stdout.strip()]
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    asyncio.run(main(pathlib.Path(sys.argv[1])))
