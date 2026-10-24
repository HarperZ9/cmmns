"""Screenshots of the pressure lens on the demo stage's pressure thread (scripts/demo/stage.mjs), in the
packaged extension with the lens switched on. Development tool only.

    python scripts/qa/pressure_shot.py <stage dir> <package zip> <out dir>
"""
import asyncio
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "demo"))
from playwright.async_api import async_playwright  # noqa: E402
from browser import Session  # noqa: E402


async def settle(pg, ms=1200):
    await pg.wait_for_timeout(ms)


async def open_window(pg, row):
    """Rests the pointer on one post until its window shows, as scripts/demo/capture.py does."""
    post = pg.locator('article[data-testid="tweet"]').nth(row)
    await post.scroll_into_view_if_needed()
    for _ in range(6):
        await post.locator('[data-testid="tweetText"]').hover(force=True, position={"x": 20, "y": 8})
        try:
            await pg.wait_for_selector(".pb-pop section.pb-sec h3", timeout=3000)
            break
        except Exception:
            await pg.mouse.move(5, 5)
            await settle(pg, 800)
    await settle(pg, 1500)


async def expand(pg, section):
    sec = pg.locator(".pb-pop section.pb-sec").filter(has=pg.locator("h3", has_text=section))
    sig = sec.locator("details summary")
    if await sig.count():
        await sig.first.click()
        await settle(pg, 900)


async def main(stage, package, out):
    out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        s = await Session(p, package, stage, port=9351).start()
        try:
            await s.settings({"auto": False, "onboarded": True, "pressureLens": True})
            pg = await s.page(1280, 900)
            await pg.goto(s.stages["pressure"]["url"])
            await settle(pg, 3500)
            await pg.screenshot(path=str(out / "12-pressure-thread.png"))
            await open_window(pg, 1)
            await expand(pg, "Language")
            await pg.screenshot(path=str(out / "13-pressure-window.png"))
            marks = await pg.evaluate("[...(CSS.highlights ? CSS.highlights.keys() : [])]")
            texts = await pg.evaluate("[...document.querySelectorAll('.pb-pop')].map((e) => e.innerText.slice(0, 1500))")
            print(marks, texts)
        finally:
            await s.close()


if __name__ == "__main__":
    asyncio.run(main(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])))
