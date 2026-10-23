"""Demonstration captures of the installed extension (scripts/demo/README.md). Development tool only.

    node scripts/demo/stage.mjs <stage dir>
    npm run package
    python scripts/demo/capture.py --stage <stage dir> --out docs/demo [--only stills|film|pages]

Installs dist/radar-chrome-<version>.zip into a fresh Chrome profile, answers x.com with the synthetic
stage, and writes PNG stills of each finding type, the extension's own pages in light and dark, a
screen recording (WebM and GIF) of install, page, badge, evidence, receipt and offline check, and
requests.json: every request the browser made and what happened to it.
"""
import argparse
import asyncio
import json
import pathlib
import subprocess

from playwright.async_api import async_playwright

from browser import Session
from record import Recorder, caption

ROOT = pathlib.Path(__file__).resolve().parents[2]
VERSION = json.loads((ROOT / "src/ext/manifest.json").read_text(encoding="utf-8"))["version"]
PACKAGE = ROOT / "dist" / f"radar-chrome-{VERSION}.zip"
FFMPEG = pathlib.Path.home() / "AppData/Local/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe"
# Evidence lookups are the only requests the demo lets out, and only to the services they name.
# The author's site serves the install page's shared style and navigation (the page itself comes
# from this checkout's docs/).
ALLOW = ("https://api.github.com/", "https://rdap.org/", "https://web.archive.org/", "https://harperz9.github.io/")
ARCHIVE = ["https://web.archive.org/*"]
INSTALL_URL = "https://harperz9.github.io/daylight-commons/install.html"
# Thread rows (stage.mjs THREAD order) and the window section whose first sign each still opens.
FINDINGS = [
    ("place", 2, "Place"),
    ("coordination", 3, "Coordination"),
    ("posting", 4, "Posting"),
    ("language", 5, "Language"),
    ("account", 6, "Account"),
    ("theory", 9, "Language"),
    ("fact-check", 10, "Sources"),
    ("sources", 11, "Sources"),
]


# Scrolls the window so the open sign sits just under its sticky tabs, with its section heading.
SCROLL_TO_SIGN = """(d) => {
  let p = d.parentElement;
  while (p && !(p.scrollHeight > p.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
  if (p) p.scrollTop += d.getBoundingClientRect().top - p.getBoundingClientRect().top - 95;
}"""


async def settle(pg, ms=1200):
    await pg.wait_for_timeout(ms)


async def open_window(pg, row):
    await pg.keyboard.press("Escape")
    await pg.mouse.move(5, 5)
    await settle(pg, 600)
    post = pg.locator('article[data-testid="tweet"]').nth(row)
    await post.scroll_into_view_if_needed()
    for _ in range(6):   # the first hover can land before the extension has read the page
        await post.locator('[data-testid="tweetText"]').hover(force=True, position={"x": 20, "y": 8})
        try:
            await pg.wait_for_selector(".pb-pop section.pb-sec h3", timeout=3000)
            break
        except Exception:
            await pg.mouse.move(5, 5)
            await settle(pg, 800)
    await settle(pg, 1500)


async def expand(pg, section):
    try:
        await pg.wait_for_selector(".pb-pop section.pb-sec h3", timeout=5000)
    except Exception as e:
        print("no window sections:", e)
    sec = pg.locator(".pb-pop section.pb-sec").filter(has=pg.locator("h3", has_text=section))
    sig = sec.locator("details summary")
    if not await sig.count():
        return False
    await sig.first.click()
    await settle(pg, 700)
    opened = pg.locator(".pb-pop details[open]")
    if await opened.count():   # the window redraws on click, so find the open sign again
        await opened.first.evaluate(SCROLL_TO_SIGN)
    await settle(pg, 300)
    return True


async def panel(pg):
    head = pg.locator(".pb-panel-head")
    await head.first.click()
    await settle(pg, 1500)


async def launch(s, pg, name):
    await pg.goto(s.stages[name]["retweetsUrl"])
    await settle(pg, 2500)
    await pg.goto(s.stages[name]["url"])
    await settle(pg, 3500)
    await panel(pg)


async def stills(s, out):
    log = {}
    pg = await s.page()
    await pg.goto(s.stages["thread"]["url"])
    await settle(pg, 3500)
    for name, row, words in FINDINGS:
        await open_window(pg, row)
        log[name] = await expand(pg, words)
        await pg.screenshot(path=str(out / f"finding-{name}.png"))
    await pg.mouse.move(5, 5)
    await settle(pg, 500)
    await panel(pg)
    await pg.screenshot(path=str(out / "finding-thread-report.png"))
    await pg.close()
    pg = await s.page()
    await launch(s, pg, "campaign")
    sec = pg.locator("#pb-panel .pb-psec", has_text="Launch campaign")
    if await sec.count():
        await sec.first.scroll_into_view_if_needed()
    await pg.screenshot(path=str(out / "finding-launch-campaign.png"))
    await pg.close()
    pg = await s.page()
    await launch(s, pg, "ours")
    ev = pg.locator("#pb-panel .pb-evidence")
    # The first lookup asks for consent; once given (the film gives it), the button is "Look up evidence".
    await pg.locator("#pb-panel .pb-evidence button", has_text="look up").or_(pg.locator("#pb-panel .pb-evidence button", has_text="Look up")).first.click()
    await settle(pg, 8000)
    await ev.first.evaluate("(e) => e.scrollIntoView({ block: 'start' })")
    await settle(pg, 400)
    await pg.screenshot(path=str(out / "finding-evidence.png"))
    async with pg.expect_download() as d:
        await pg.get_by_role("button", name="Save evidence chain").first.click()
    chain = out / "demo-evidence-chain.json"
    await (await d.value).save_as(str(chain))
    await pg.goto(s.url("analyze.html"))
    await settle(pg, 800)
    await pg.locator("#check").set_input_files(str(chain))
    await settle(pg, 1500)
    await pg.locator("#checks").evaluate("(e) => e.scrollIntoView({ block: 'center' })")
    await settle(pg, 400)
    await pg.screenshot(path=str(out / "finding-verify.png"))
    await pg.close()
    print("expanded:", log)


async def pages(s, out):
    for dark in (False, True):
        tone = "dark" if dark else "light"
        for page, w, h in (("welcome.html", 1280, 800), ("options.html", 1280, 800), ("popup.html", 380, 560), ("analyze.html", 1280, 800), ("privacy.html", 1280, 800)):
            pg = await s.page(w, h, dark=dark)
            await pg.goto(s.url(page))
            await settle(pg, 900)
            await pg.screenshot(path=str(out / f"page-{page.split('.')[0]}-{tone}.png"))
            await pg.close()


async def film(s, out, stage_dir):
    """Steps 1 to 5: install page, first run, a page, a reply's window and its evidence."""
    rec = Recorder()
    pg = await s.page()
    await rec.follow(pg)
    # The install page, served from this checkout. chrome://extensions is left out on purpose: it lists
    # every extension installed in the machine's Chrome.
    await pg.goto(INSTALL_URL)
    await settle(pg, 1500)
    await caption(pg, f"1. Install: download Daylight Commons {VERSION} from the release and load it.")
    await settle(pg, 3000)
    await pg.goto(s.url("welcome.html"))
    await settle(pg, 800)
    await caption(pg, "2. First run: what it shows, what it never does, and which sites it runs on.")
    await settle(pg, 3500)
    await pg.get_by_role("button", name="Start Daylight Commons").click()
    await settle(pg, 800)
    await s.settings({"auto": False})
    await pg.goto(s.stages["thread"]["url"])
    await settle(pg, 3000)
    await caption(pg, "3. A page: a synthetic thread. Every account here is invented.")
    await settle(pg, 2500)
    await open_window(pg, 2)
    await caption(pg, "4. A badge: rest the pointer on a reply and its window opens.")
    await settle(pg, 3000)
    await expand(pg, "Place")
    await caption(pg, "5. The evidence: each sign shows its source and what it does not prove.")
    await settle(pg, 4500)
    await pg.mouse.move(5, 5)
    await caption(pg, "")
    chain, bad = await film_receipts(s, pg, out)
    await rec.stop()
    seconds = rec.encode(str(FFMPEG), out / "demo-install-to-verify.webm", out / "demo-install-to-verify.gif")
    print(f"film: {seconds:.1f} s")
    return chain, bad


async def film_receipts(s, pg, out):
    """Steps 6 to 9: the run-it-on-us lookup, its receipts, the saved chain and the offline check."""
    await pg.goto(s.stages["ours"]["retweetsUrl"])
    await settle(pg, 2000)
    await pg.goto(s.stages["ours"]["url"])
    await settle(pg, 3000)
    await panel(pg)
    sec = pg.locator("#pb-panel .pb-evidence")
    await sec.first.scroll_into_view_if_needed()
    await caption(pg, "6. Run it on us: a synthetic post linking Daylight Commons' own repository and site.")
    await settle(pg, 3000)
    await pg.get_by_role("button", name="Allow and look up").first.click()
    await settle(pg, 8000)
    await sec.first.scroll_into_view_if_needed()
    await caption(pg, "7. Receipts: GitHub and the Internet Archive answer, each fact hashed and sealed.")
    await settle(pg, 4500)
    async with pg.expect_download() as d:
        await pg.get_by_role("button", name="Save evidence chain").first.click()
    chain = out / "demo-evidence-chain.json"
    await (await d.value).save_as(str(chain))
    edited = json.loads(chain.read_text(encoding="utf-8"))
    if edited["seal"]["entries"]:
        edited["seal"]["entries"][0]["receipt"]["observed"]["daysBeforePost"] = 900
    bad = out / "demo-evidence-chain-edited.json"
    bad.write_text(json.dumps(edited, indent=2), encoding="utf-8")
    await pg.goto(s.url("analyze.html"))
    await settle(pg, 800)
    await pg.locator("#check").scroll_into_view_if_needed()
    await caption(pg, "8. Check it offline: the saved chain, opened on the Analyse a file page.")
    await settle(pg, 1500)
    await pg.locator("#check").set_input_files(str(chain))
    await settle(pg, 1500)
    await pg.locator("#checks").scroll_into_view_if_needed()
    await settle(pg, 3500)
    await caption(pg, "9. One number changed in a copy: the check fails.")
    await pg.locator("#check").set_input_files(str(bad))
    await settle(pg, 1500)
    await pg.locator("#checks").scroll_into_view_if_needed()
    await settle(pg, 4000)
    return chain, bad


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", choices=["stills", "film", "pages"])
    a = ap.parse_args()
    out, stage_dir = pathlib.Path(a.out), pathlib.Path(a.stage)
    out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        s = await Session(p, PACKAGE, stage_dir, allow=ALLOW, grant=ARCHIVE).start()
        try:
            if a.only in (None, "pages"):
                await pages(s, out)
            if a.only in (None, "film"):
                chain, bad = await film(s, out, stage_dir)
                for f in (chain, bad):
                    # Run from the output folder with bare file names, so no local path lands in the text.
                    r = subprocess.run(["node", str(ROOT / "bin/radar.mjs"), "verify", f.name], capture_output=True, text=True, cwd=out)
                    (out / f"verify-{f.stem}.txt").write_text(r.stdout + r.stderr, encoding="utf-8")
                    print(f.name, "exit", r.returncode)
            if a.only in (None, "stills"):
                await stills(s, out)
        finally:
            (out / "requests.json").write_text(json.dumps([{"url": u, "outcome": o} for u, o in s.requests], indent=1), encoding="utf-8")
            await s.close()


asyncio.run(main())
