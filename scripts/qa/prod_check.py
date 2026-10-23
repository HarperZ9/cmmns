"""Production checks of the packaged extension (project-docs/PRODUCTION-READINESS.md). Development tool
only; nothing here ships. Needs Python 3 with Playwright, Google Chrome, and axe-core's axe.min.js
(for example from `npm pack axe-core`), passed with --axe.

    node scripts/demo/stage.mjs <stage dir>
    npm run package
    python scripts/qa/prod_check.py --stage <stage dir> --axe <axe.min.js> --out <dir>

Installs dist/radar-chrome-<version>.zip into a fresh Chrome profile (scripts/demo/browser.py), answers
x.com with the synthetic stage, and measures: first run to the first sign, the window's open time,
console errors on every page, axe on each page in light and dark, and a 600-post scroll soak with
the heap after garbage collection. Writes results.json to --out.
"""
import argparse
import asyncio
import json
import pathlib
import statistics
import sys
import time

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "demo"))
from browser import Session  # noqa: E402

VERSION = json.loads((ROOT / "src/ext/manifest.json").read_text(encoding="utf-8"))["version"]
PAGES = ["welcome.html", "options.html", "dashboard.html", "popup.html", "analyze.html", "history.html", "sites.html", "learn.html"]
SELECTOR_WINDOW = ".pb-pop section.pb-sec h3"


class Console:
    """Every console error and uncaught exception, per page, from the page and the extension."""
    def __init__(self):
        self.errors = []

    def watch(self, pg, name):
        pg.on("console", lambda m: m.type == "error" and self.errors.append({"page": name, "text": m.text[:300], "url": (m.location or {}).get("url", "")}))
        pg.on("pageerror", lambda e: self.errors.append({"page": name, "text": str(e)[:300], "url": "pageerror"}))

    def ours(self):
        # A stage page asks for responses the stage does not have; those 404s are the stage, not us.
        return [e for e in self.errors if "Failed to load resource" not in e["text"]]


async def axe(pg, src, context=None):
    await pg.evaluate(src)
    ctx = json.dumps(context) if context else "document"
    r = await pg.evaluate(f"axe.run({ctx}, {{resultTypes: ['violations']}}).then(r => r.violations.map(v => ({{id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, targets: v.nodes.slice(0, 3).map(n => n.target.join(' '))}})))")
    return r


async def first_run(s, con):
    """Welcome page to the first sign beside a reply: the clicks a person makes, timed."""
    t0 = time.perf_counter()
    pg = await s.page()
    con.watch(pg, "welcome")
    await pg.goto(s.url("welcome.html"))
    await pg.get_by_role("button", name="Start Daylight Commons").click()
    await pg.wait_for_selector("#done p", timeout=10000)
    t_started = time.perf_counter() - t0
    await pg.goto(s.stages["thread"]["url"])
    con.watch(pg, "x thread")
    # The first useful sign: rest the pointer on a reply and its window opens with a sign in it.
    post = pg.locator('article[data-testid="tweet"]').nth(2)
    t_sign = None
    while time.perf_counter() - t0 < 60:
        await post.locator('[data-testid="tweetText"]').hover(force=True, position={"x": 20, "y": 8})
        try:
            await pg.wait_for_selector(SELECTOR_WINDOW, timeout=1500)
            t_sign = time.perf_counter() - t0
            break
        except Exception:
            await pg.mouse.move(5, 5)
    if t_sign is None:
        return pg, {"seconds_to_started": round(t_started, 2), "seconds_to_first_sign": None, "error": "no sign within 60 s"}
    return pg, {"seconds_to_started": round(t_started, 2), "seconds_to_first_sign": round(t_sign, 2), "clicks": 1}


async def window_open_ms(pg, rows=(2, 3, 5, 6, 9, 10)):
    """Hover a reply; time from the hover to the window's first section heading, in the page's clock."""
    out = []
    for row in rows:
        await pg.keyboard.press("Escape")
        await pg.mouse.move(5, 5)
        await pg.wait_for_timeout(500)
        post = pg.locator('article[data-testid="tweet"]').nth(row)
        await post.scroll_into_view_if_needed()
        await pg.evaluate("""() => { window.__popAt = 0; const o = new MutationObserver(() => { if (!window.__popAt && document.querySelector('.pb-pop section.pb-sec h3')) { window.__popAt = performance.now(); o.disconnect(); } });
            o.observe(document.body, {childList: true, subtree: true}); window.__hoverAt = performance.now(); }""")
        await post.locator('[data-testid="tweetText"]').hover(force=True, position={"x": 20, "y": 8})
        try:
            await pg.wait_for_selector(SELECTOR_WINDOW, timeout=5000)
            await pg.wait_for_timeout(50)
            out.append(round(await pg.evaluate("window.__popAt - window.__hoverAt"), 1))
        except Exception:
            out.append(None)
    got = [x for x in out if x is not None and x >= 0]
    return {"samples_ms": out, "median_ms": statistics.median(got) if got else None, "max_ms": max(got) if got else None}


async def keyboard(pg):
    """Keyboard only: focus a reply, Alt+R into its window, Tab inside it, Esc out."""
    await pg.keyboard.press("Escape")
    await pg.mouse.move(5, 5)
    await pg.locator('article[data-testid="tweet"]').nth(2).focus()
    r = {}
    try:
        await pg.wait_for_selector(SELECTOR_WINDOW, timeout=4000)
        r["focus_opens_window"] = True
    except Exception:
        r["focus_opens_window"] = False
    await pg.keyboard.press("Alt+r")
    await pg.wait_for_timeout(300)
    r["alt_r_moves_into_window"] = await pg.evaluate("!!(document.activeElement && document.activeElement.closest('.pb-pop'))")
    await pg.keyboard.press("Tab")
    r["tab_stays_in_window"] = await pg.evaluate("!!(document.activeElement && document.activeElement.closest('.pb-pop'))")
    r["focus_visible"] = await pg.evaluate("(() => { const e = document.activeElement; if (!e) return false; const s = getComputedStyle(e); return s.outlineStyle !== 'none' || s.boxShadow !== 'none'; })()")
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(400)
    r["esc_closes_window"] = await pg.evaluate("!document.querySelector('.pb-pop section.pb-sec h3')")
    return r


async def heap(cdp):
    await cdp.send("HeapProfiler.collectGarbage")
    m = {x["name"]: x["value"] for x in (await cdp.send("Performance.getMetrics"))["metrics"]}
    return {"heap_mb": round(m["JSHeapUsedSize"] / 1048576, 2), "nodes": int(m["Nodes"]), "script_s": round(m["ScriptDuration"], 3)}


async def soak(s, con, on=True):
    """Scroll the 600-reply stage to the end; heap after garbage collection at checkpoints."""
    await s.settings({"sites": {"x": on}})
    pg = await s.page()
    con.watch(pg, f"long thread ({'on' if on else 'off'})")
    cdp = await pg.context.new_cdp_session(pg)
    await cdp.send("Performance.enable")
    await pg.goto(s.stages["long"]["url"])
    await pg.wait_for_timeout(2500)
    total = await pg.evaluate("__stage.total")
    marks, want = [], [n for n in range(100, total, max(100, total // 10))] + [total]
    marks.append({"posts": await pg.evaluate("__stage.rendered()"), **await heap(cdp)})
    t0 = time.perf_counter()
    while want:
        await pg.mouse.wheel(0, 1800)
        await pg.wait_for_timeout(350)
        n = await pg.evaluate("__stage.rendered()")
        if n >= want[0]:
            await pg.wait_for_timeout(1200)
            marks.append({"posts": n, **await heap(cdp)})
            want.pop(0)
        if time.perf_counter() - t0 > 900:
            marks.append({"error": "scroll did not reach the end in 900 s"})
            break
    badges = await pg.locator(".pb-bar").count()
    await pg.close()
    return {"marks": marks, "badges_in_page_at_end": badges}


async def pages_axe(s, con, axe_src):
    out = {}
    for name in PAGES:
        for dark in (False, True):
            pg = await s.page(dark=dark)
            con.watch(pg, name)
            await pg.goto(s.url(name))
            await pg.wait_for_timeout(1200)
            out[f"{name} {'dark' if dark else 'light'}"] = await axe(pg, axe_src)
            await pg.close()
    return out


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", required=True)
    ap.add_argument("--axe", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--package", default=str(ROOT / "dist" / f"radar-chrome-{VERSION}.zip"))
    ap.add_argument("--only", default="first,window,keyboard,axe,pages,soak", help="comma list of stages")
    a = ap.parse_args()
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    axe_src = pathlib.Path(a.axe).read_text(encoding="utf-8")
    con, res = Console(), {"version": VERSION, "package": a.package}
    async with async_playwright() as p:
        s = await Session(p, a.package, a.stage).start()
        try:
            sw_errors = []
            s.sw.on("console", lambda m: m.type == "error" and sw_errors.append(m.text[:300]))
            res["install_opened"] = [pg.url.split("/")[-1] for pg in s.ctx.pages if s.ext_id in pg.url]
            only = set(a.only.split(","))
            say = lambda m: print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)
            say("first run")
            pg, res["first_run"] = await first_run(s, con)
            say(f"first run: {res['first_run']}")
            await pg.wait_for_timeout(2000)
            if "window" in only:
                res["window_open"] = await window_open_ms(pg)
                say(f"window: {res['window_open']}")
            if "keyboard" in only:
                res["keyboard"] = await keyboard(pg)
                say(f"keyboard: {res['keyboard']}")
            if "axe" in only:
                await pg.locator('article[data-testid="tweet"]').nth(2).locator('[data-testid="tweetText"]').hover(force=True, position={"x": 20, "y": 8})
                await pg.wait_for_selector(SELECTOR_WINDOW, timeout=5000)
                res["axe_window"] = await axe(pg, axe_src, {"include": [[".pb-pop"]]})
                await pg.keyboard.press("Escape")
                head = pg.locator(".pb-panel-head")
                if await head.count():
                    await head.first.click()
                    await pg.wait_for_timeout(1200)
                    res["axe_panel"] = await axe(pg, axe_src, {"include": [[".pb-panel"]]})
                say("axe on window and panel done")
            await pg.close()
            if "pages" in only:
                res["axe_pages"] = await pages_axe(s, con, axe_src)
                say("axe on pages done")
            if "soak" in only:
                res["soak_on"] = await soak(s, con, on=True)
                say(f"soak on: {res['soak_on']['marks'][-1]}")
                res["soak_off"] = await soak(s, con, on=False)
                say(f"soak off: {res['soak_off']['marks'][-1]}")
            res["service_worker_errors"] = sw_errors
        finally:
            res["console_errors"] = con.ours()
            res["blocked_requests"] = sorted({u.split("?")[0] for u, how in s.requests if how == "blocked"})
            await s.close()
    (out / "results.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
    print("console errors:", len(res["console_errors"]))


if __name__ == "__main__":
    asyncio.run(main())
