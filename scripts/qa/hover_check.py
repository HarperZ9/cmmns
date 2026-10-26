"""Browser check for the hover Download control (3.6.1). Development tool only.

    python scripts/qa/hover_check.py <work folder> <source folder> [axe.min.js] [case ...]

For each page: rest a real mouse pointer on the largest picture or video, wait, click the control's
Download button where it draws (a real click, no simulated menu), and record whether the control
showed, whether the page moved (scroll height and the media's box before and after), what was saved
and whether it opens. Uses the extension copy and launch from quick_save_check.py, signed out, with
<all_urls> standing in for the "every site" permission. With axe.min.js, also runs axe on the control
drawn with an open shadow root (the shipped control uses a closed one, which axe cannot read).
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

ROOT = pathlib.Path(__file__).resolve().parents[2]
LARGEST = """() => { const vis = [...document.querySelectorAll('img, video')].map((e) => [e, e.getBoundingClientRect()])
  .filter(([, r]) => r.width >= 160 && r.height >= 160 && r.top + r.height / 2 > 40 && r.top + r.height / 2 < innerHeight - 40 && r.left + r.width / 2 > 0 && r.left + r.width / 2 < innerWidth);
  vis.sort((a, b) => b[1].width * b[1].height - a[1].width * a[1].height);
  const m = vis[0]; if (!m) return null; const r = m[1];
  return { tag: m[0].tagName, x: r.left, y: r.top, w: r.width, h: r.height, src: (m[0].currentSrc || m[0].src || '').slice(0, 120) }; }"""
PICK = """() => { const all = [...document.querySelectorAll('img, video')].map((e) => [e, e.getBoundingClientRect()]).filter(([, r]) => r.width >= 160 && r.height >= 160 && r.top < 2600);
  all.sort((a, b) => b[1].width * b[1].height - a[1].width * a[1].height); if (all[0]) all[0][0].scrollIntoView({ block: 'center' }); }"""
SHAPE = "() => ({ sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, sy: scrollY })"

X_TEXT = "https://x.com/StarshipDad/status/2113697702823297061"
CASES = [
    {"name": "instagram", "url": "https://www.instagram.com/nasa/"},
    {"name": "pinterest", "url": "https://www.pinterest.com/ideas/"},
    {"name": "tumblr", "url": "https://www.tumblr.com/explore/trending"},
    {"name": "bluesky", "url": "https://bsky.app/profile/bsky.app"},
    {"name": "tiktok", "url": "https://www.tiktok.com/@nasa"},
    {"name": "facebook", "url": "https://www.facebook.com/NASA/"},
    {"name": "vimeo", "url": "https://vimeo.com/channels/staffpicks"},
    {"name": "imgur", "url": "https://imgur.com/"},
    {"name": "youtube", "url": "https://www.youtube.com/watch?v=aqz-KE-bpKQ"},
    {"name": "wikipedia", "url": "https://en.wikipedia.org/wiki/Mount_Rainier"},
    {"name": "plain-site", "url": "https://www.nasa.gov/image-of-the-day/"},
    {"name": "right-click-blocked", "url": "http://127.0.0.1:8765/noright.html"},
    {"name": "x-post-no-double", "url": "https://x.com/NASA/status/2113655288687431819", "expect_none": True},
]


async def hover_case(ctx, sw, out, case):
    page = await ctx.new_page()
    await page.set_viewport_size({"width": 1280, "height": 900})
    rec = {"name": case["name"], "url": case["url"]}
    try:
        await page.goto(case["url"], wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(case.get("settle", 9))
        rec["title"] = (await page.title())[:120]
        await page.evaluate(PICK)   # the largest picture or video on the page, scrolled to the middle
        await asyncio.sleep(2)
        m = await page.evaluate(LARGEST)
        rec["media"] = m
        if not m:
            rec["result"] = "no picture or video of 160 px or more on screen (sign-in wall or empty page)"
            return rec
        cx, cy = m["x"] + m["w"] / 2, m["y"] + m["h"] / 2
        before = await page.evaluate(SHAPE)
        await page.mouse.move(cx - 20, cy - 20)
        await page.mouse.move(cx, cy, steps=4)
        await asyncio.sleep(0.9)
        rec["control"] = await sw.evaluate("""async (u) => { const [t] = (await chrome.tabs.query({})).filter((x) => (x.url || '').startsWith(u));
          const r = await chrome.scripting.executeScript({ target: { tabId: t.id }, func: () => ({ hover: !!globalThis.PBHover, host: !!document.querySelector('daylight-hover') }) });
          return r[0].result; }""", page.url.split("#")[0])
        after = await page.evaluate(SHAPE)
        rec["layout_unchanged"] = before == after and m == await page.evaluate(LARGEST)
        before_ids = await q.newest_ids(sw)
        read = await q.note_reader(sw, page.url.split("#")[0])
        # The Download button: 8 px in from the media's top-right corner, first of two 28 px buttons.
        bx = min(max(m["x"] + m["w"] - 62 - 8, m["x"] + 4, 4), 1280 - 66) + 2 + 14
        by = min(max(m["y"] + 8, 4), 900 - 36) + 2 + 14
        await page.mouse.move(bx, by)
        await page.mouse.click(bx, by)
        if case.get("expect_none"):
            await asyncio.sleep(2)
            rec["result"] = "no hover control drawn (the X button covers this post)" if not rec["control"].get("host") else "hover control drawn over an X post"
            return rec
        done, rec["note"] = await q.wait_downloads(sw, before_ids, read, want=2, timeout=case.get("timeout", 120))
        rec["files"] = [dict(name=pathlib.Path(d["filename"]).name, folder=pathlib.Path(d["filename"]).parent.name, bytes=d["bytes"],
                             sniffed=q.sniff(d["filename"]) if pathlib.Path(d["filename"]).exists() else None) for d in done]
        for f, d in zip(rec["files"], done):
            if f["sniffed"] and not f["name"].endswith(".md"):
                f["check"] = await q.verify(ctx, d["filename"])
        await page.screenshot(path=str(out / f"hover-{case['name']}.png"))
    except Exception as e:  # recorded in the table, never hidden
        rec["error"] = f"{type(e).__name__}: {str(e)[:300]}"
    finally:
        await page.close()
    return rec


async def axe_control(ctx, axe_src):
    """Axe on the control and its open menu, drawn with an open shadow root on a blank page."""
    page = await ctx.new_page()
    await page.goto("http://127.0.0.1:8765/axe-control.html")
    ui = (ROOT / "src" / "ext" / "quick-hover-ui.js").read_text(encoding="utf-8").replace('mode: "closed"', 'mode: "open"')
    await page.add_script_tag(content=ui)
    await page.add_script_tag(content=pathlib.Path(axe_src).read_text(encoding="utf-8"))
    await page.evaluate("PBHoverUi.show(document.getElementById('m').getBoundingClientRect(), 'Download JPG picture', () => {})")
    res = {}
    for state in ("closed menu", "open menu"):
        if state == "open menu":
            await page.evaluate("document.querySelector('daylight-hover').shadowRoot.querySelectorAll('button')[1].click()")
        res[state] = await page.evaluate("axe.run(document, { resultTypes: ['violations'] }).then((r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length })))")
    res["targets"] = await page.evaluate("[...document.querySelector('daylight-hover').shadowRoot.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(); return [b.getAttribute('aria-label') || b.textContent, Math.round(r.width), Math.round(r.height)]; })")
    await page.close()
    return res


async def main(work, src, axe_src, only):
    work.mkdir(parents=True, exist_ok=True)
    out = work / "out"
    out.mkdir(exist_ok=True)
    site = fx.build(work, src)
    (site / "local" / "noright.html").write_text("""<!doctype html><title>No right-click here</title><body oncontextmenu="return false">
<div style="position:relative;width:480px;height:360px"><img src="/pic.png" width="480" height="360" alt="harbour" style="user-select:none" draggable="false">
<div style="position:absolute;inset:0" onmousedown="event.preventDefault()"></div></div></body>""", encoding="utf-8")
    (site / "local" / "axe-control.html").write_text('<!doctype html><html lang="en"><title>Control</title><main><img id="m" src="/pic.png" width="480" height="360" alt="harbour"></main></html>', encoding="utf-8")
    servers = fx.serve(site, work)
    report = {"cases": []}
    async with async_playwright() as p:
        proc, browser, ctx, sw, dl = await q.launch(p, work)
        # The local fixture is http: the control runs there through a test-only registration.
        await sw.evaluate("chrome.scripting.registerContentScripts([{ id: 'pb-hover-test', matches: ['http://127.0.0.1/*', 'http://localhost/*'], js: ['quick-hover-ui.js', 'quick-hover.js'], allFrames: true, runAt: 'document_idle' }]).then(() => true)")
        try:
            for case in CASES:
                if only and case["name"] not in only:
                    continue
                rec = await hover_case(ctx, sw, out, case)
                report["cases"].append(rec)
                print(json.dumps(rec)[:500], flush=True)
            extras = [("x-text-post", lambda: hx.x_text_post(ctx, sw, X_TEXT)), ("selection-wikipedia", lambda: hx.selection(ctx, sw)),
                      ("text-card", lambda: hx.card(ctx, sw, X_TEXT)), ("side-panel", lambda: hx.side_panel(ctx, sw, sw.ext_id, X_TEXT)), ("shortcut-alt-shift-d", lambda: hx.shortcut(ctx, sw)), ("protection-on", lambda: hx.protection(ctx, sw))]
            for name, run in extras:
                if only and name not in only:
                    continue
                rec = await run()
                report["cases"].append(rec)
                print(json.dumps(rec)[:700], flush=True)
            if axe_src:
                report["axe"] = await axe_control(ctx, axe_src)
                print(json.dumps(report["axe"]), flush=True)
        finally:
            (out / "hover-check.json").write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8")
            await browser.close()
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True) if sys.platform == "win32" else proc.terminate()
            for s in servers:
                s.shutdown()


if __name__ == "__main__":
    args = sys.argv[1:]
    axe = args[2] if len(args) > 2 and args[2].endswith(".js") else None
    rest = args[3:] if axe else args[2:]
    asyncio.run(main(pathlib.Path(args[0]), pathlib.Path(args[1]), axe, set(rest)))
