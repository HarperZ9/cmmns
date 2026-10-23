"""Film stills of the extension on the media stage pages (scripts/media/README.md).

Drives headless Chromium through named states and writes one PNG a state at 3840x2160 (a 1280x720
page at device scale 3), plus states.json with the page rectangles a compositor needs (the reply
window, the panel, a row) in the same pixels. Development tool only: needs Playwright for Python
and a local server, `node scripts/serve.mjs 8743`. Nothing here ships in the extension.

    python scripts/media/capture.py --base http://127.0.0.1:8743 --out OUTDIR [--only launch|defs|verify]
"""
import argparse
import asyncio
import json
import pathlib

from playwright.async_api import async_playwright

W, H, SCALE = 1280, 720, 3


async def rect(page, selector):
    loc = page.locator(selector).first
    if not await loc.count():
        return None
    box = await loc.bounding_box()
    return [round(v * SCALE) for v in (box["x"], box["y"], box["width"], box["height"])] if box else None


async def snap(page, out, name, states, rects=None):
    await page.wait_for_timeout(350)
    await page.screenshot(path=str(out / f"{name}.png"))
    states[name] = {sel_name: await rect(page, sel) for sel_name, sel in (rects or {}).items()}
    print("captured", name)


async def launch(ctx, base, out, states):
    page = await ctx.new_page()
    await page.goto(f"{base}/scripts/media/stage-launch.html")
    await page.wait_for_function("window.STAGE_READY === true")
    await page.wait_for_timeout(2500)
    await snap(page, out, "launch-0-idle", states, {"pill": ".pb-panel-head", "root": "article.root"})
    posts = page.locator('article[data-testid="tweet"]')
    await posts.nth(0).hover()
    await page.wait_for_timeout(1200)
    await snap(page, out, "launch-1-root-window", states, {"window": ".pb-pop", "root": "article.root"})
    for i in (1, 2, 5):
        await page.mouse.move(5, 5)
        await page.wait_for_timeout(500)
        await posts.nth(i).hover()
        await page.wait_for_timeout(1200)
        await snap(page, out, f"launch-2-reply-{i}", states, {"window": ".pb-pop", "post": f'article[data-testid="tweet"] >> nth={i}'})
    await page.mouse.move(5, 5)
    await page.wait_for_timeout(500)
    await page.locator(".pb-panel-head").click()
    await page.wait_for_timeout(1200)
    await snap(page, out, "launch-3-panel", states, {"panel": "#pb-panel"})
    sec = page.locator("#pb-panel .pb-psec").filter(has_text="Launch campaign")
    if await sec.count():
        await sec.first.scroll_into_view_if_needed()
        await snap(page, out, "launch-4-campaign", states, {"panel": "#pb-panel", "campaign": "#pb-panel .pb-psec >> nth=0"})
    await page.close()


async def defs(ctx, base, out, states):
    page = await ctx.new_page()
    for entry, tag in (("us-ftc-endorsement-material-connection", "ftc"), ("uk-fraud-act-2006-s2", "fraud"), ("x-paid-partnerships", "x")):
        await page.goto(f"{base}/scripts/media/stage-definitions.html?entry={entry}")
        await page.wait_for_function("window.STAGE_READY === true")
        await page.wait_for_timeout(600)
        await snap(page, out, f"defs-{tag}-top", states, {"table": "table", "unseen": 'tr[data-status="not-observable"]'})
        await page.locator(".summary").scroll_into_view_if_needed()
        await snap(page, out, f"defs-{tag}-summary", states, {"summary": ".summary"})
    await page.close()


async def verify(ctx, base, out, states, good, edited):
    page = await ctx.new_page()
    await page.goto(f"{base}/tests/fixtures/analyze.html")
    await page.wait_for_selector("#check", state="attached")
    await page.wait_for_timeout(1200)
    await page.locator("#check").scroll_into_view_if_needed()
    await snap(page, out, "verify-0-page", states, {"check": "#check"})
    await page.set_input_files("#check", good)
    await page.wait_for_timeout(1500)
    await snap(page, out, "verify-1-pass", states, {"checks": "#checks"})
    await page.set_input_files("#check", edited)
    await page.wait_for_timeout(1500)
    await snap(page, out, "verify-2-fail", states, {"checks": "#checks"})
    await page.close()


async def install(ctx, base, out, states):
    """The install as a user sees it: the install page, then the extension's first-run page, run in
    an ordinary page with tests/fixtures/chrome-stub.js (headless Chromium does not load extensions)."""
    page = await ctx.new_page()
    await page.goto(f"{base}/docs/install.html")
    await page.wait_for_timeout(1200)
    await snap(page, out, "install-0-page", states)
    await page.add_init_script(path=str(pathlib.Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "chrome-stub.js"))
    await page.goto(f"{base}/src/ext/welcome.html")
    await page.wait_for_timeout(1500)
    await snap(page, out, "install-1-welcome", states)
    await page.close()


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8743")
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", default="all", help="all, launch, defs, verify or install")
    ap.add_argument("--bundle", help="a signed bundle for the verify states")
    ap.add_argument("--edited", help="the same bundle with one line changed")
    ap.add_argument("--scheme", default="light", choices=["light", "dark"])
    a = ap.parse_args()
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    states_path = out / "states.json"
    states = json.loads(states_path.read_text(encoding="utf-8")) if states_path.exists() else {}
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=SCALE, color_scheme=a.scheme, reduced_motion="no-preference")
        if a.only in ("all", "launch"):
            await launch(ctx, a.base, out, states)
        if a.only in ("all", "defs"):
            await defs(ctx, a.base, out, states)
        if a.only in ("all", "verify") and a.bundle and a.edited:
            await verify(ctx, a.base, out, states, a.bundle, a.edited)
        if a.only in ("all", "install"):
            await install(ctx, a.base, out, states)
        await browser.close()
    states_path.write_text(json.dumps(states, indent=1), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
