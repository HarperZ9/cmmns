"""Render SVG files to PNG with Chrome, at their own size. Development tool only.

    python scripts/demo/render_svg.py <file.svg> [...]
"""
import asyncio
import pathlib
import re
import sys

from playwright.async_api import async_playwright

CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"


async def main(files):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, headless=True)
        for f in map(pathlib.Path, files):
            m = re.search(r'width="(\d+)" height="(\d+)"', f.read_text(encoding="utf-8"))
            w, h = int(m.group(1)), int(m.group(2))
            pg = await b.new_page(viewport={"width": w, "height": h})
            await pg.goto(f.resolve().as_uri())
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=str(f.with_suffix(".png")))
            await pg.close()
            print("rendered", f.with_suffix(".png"))
        await b.close()


asyncio.run(main(sys.argv[1:]))
