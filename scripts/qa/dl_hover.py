"""Hover-control cases for scripts/qa/download_timing.py. Development tool only.

Each trial moves a real pointer (Playwright's mouse, which Chrome sees as a mouse) and records
whether the hover control drew over the target picture within the trial and how long after the
pointer first reached it. Paths: direct (the pointer appears on the picture in one move and stops,
the control case), across (arrive in five steps across the post, then stop), jitter (a hand on a mouse: 1 to 3 px
every 16 ms), drift (a slow 1 px per 16 ms glide), layered (arrive over a clear layer above the
caption, then move onto a picture under the same layer), late (rest on a picture that is 40 px
tall until it loads to 300 px, with a small jitter). Also the first and a later click on a site
CMMNS does not name, from the click to the browser starting the download.
"""
import asyncio
import os
import random
import time

import dl_probe as pr

IG = "https://www.instagram.com/"
TRIAL_MS = 1500


async def rect(page, sel):
    return await page.evaluate("(s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }", sel)


async def arm(page, r):
    """Watches the point where the control's Download button draws over rect r."""
    await page.evaluate("(p) => { window.__shown = null; window.__probe = p; }", {"x": r["r"] - 70 + 14, "y": r["t"] + 8 + 14})


async def move_path(page, kind, cx, cy, rnd):
    end = time.time() + TRIAL_MS / 1000
    x, y = cx, cy
    while time.time() < end:
        if kind == "jitter":
            x, y = cx + rnd.choice((-3, -2, -1, 1, 2, 3)), cy + rnd.choice((-3, -2, -1, 1, 2, 3))
        elif kind == "drift":
            x, y = x + 1, y + 0.5
        else:
            await asyncio.sleep(0.05)
            continue
        await page.mouse.move(x, y)
        await asyncio.sleep(0.016)


async def trial(page, kind, rnd):
    await page.mouse.move(2, 2)
    await asyncio.sleep(0.35)
    # A control still on screen from the last trial reads as shown before arrival (the 3.9.0 hide defect).
    await arm(page, await rect(page, "#a"))
    await asyncio.sleep(0.05)
    stale = await page.evaluate("() => window.__shown")
    if stale:
        return "stale"
    sel = "#c" if kind == "late" else "#a"
    if kind == "late":
        await page.goto(IG + "?late=1500")
        await asyncio.sleep(0.3)
    r = await rect(page, sel)
    cx, cy = (r["l"] + r["r"]) / 2, (r["t"] + r["b"]) / 2
    if kind == "layered":
        hr = await rect(page, "header")
        await page.mouse.move(hr["l"] + 300, hr["t"] + 60)
        await asyncio.sleep(0.4)
    # Only "across" and "layered" cross the post on the way; the others land on the picture at once.
    await page.mouse.move(cx, cy, steps=5 if kind in ("across", "layered") else 1)
    if kind == "late":
        await asyncio.sleep(1.4)   # the picture grows to 300 px under the resting pointer
        r = await rect(page, sel)
    await arm(page, r)
    t0 = await page.evaluate("Date.now()")
    await move_path(page, "jitter" if kind == "late" else kind, cx, cy, rnd)
    shown = await page.evaluate("() => window.__shown")
    return (shown - t0) if shown else None


async def hover_paths(ctx, which, n=10):
    page = await ctx.new_page()
    await page.add_init_script(pr.PAGE_INIT)
    await page.goto(IG)
    await page.bring_to_front()   # a background tab gets its timers held to once a second
    await asyncio.sleep(1.5)
    rnd, out = random.Random(7), {}
    for kind in ("direct", "across", "jitter", "drift", "layered", "late"):
        if which and f"hover-{kind}" not in which and "hover" not in which:
            continue
        times = [await trial(page, kind, rnd) for _ in range(n)]
        if os.environ.get("DC_DEBUG"):
            print(kind, times, flush=True)
        got = sorted(t for t in times if isinstance(t, int))
        out[kind] = {"shown": f"{len(got)}/{n}", "stale_before_arrival": times.count("stale"),
                     "median_ms": got[len(got) // 2] if got else None, "max_ms": got[-1] if got else None}
        print("hover", kind, out[kind], flush=True)
        if kind == "late":
            await page.goto(IG)
            await asyncio.sleep(1)
    await page.close()
    return out


async def first_click(ctx, sw, browser, ext_id):
    """Click to download start for the hover control on a site CMMNS does not name: first, then again."""
    page = await ctx.new_page()
    await page.add_init_script(pr.PAGE_INIT)
    await page.goto("https://news.example/")
    await page.bring_to_front()
    await asyncio.sleep(1.5)
    out = {}
    for name in ("first_click", "second_click"):
        await sw.evaluate("() => chrome.storage.local.remove('pb.saved.v1')")
        r = await rect(page, "#m")
        await page.mouse.move(2, 2)
        await asyncio.sleep(0.3)
        await page.mouse.move((r["l"] + r["r"]) / 2, (r["t"] + r["b"]) / 2, steps=4)
        await arm(page, r)
        await asyncio.sleep(0.8)
        shown = await page.evaluate("() => window.__shown")
        t0 = await page.evaluate("Date.now()")
        await page.mouse.click(r["r"] - 70 + 14, r["t"] + 8 + 14)
        dl = []
        for _ in range(200):
            dl = await pr.since(sw, t0)
            if dl:
                break
            await asyncio.sleep(0.05)
        out[name] = {"control_shown": bool(shown), "download_start_ms": (dl[0]["t"] - t0) if dl else None}
        print("hover", name, out[name], flush=True)
        await asyncio.sleep(1.5)
    await page.close()
    return out


async def run_all(ctx, sw, browser, ext_id, which):
    res = {"paths": await hover_paths(ctx, which)}
    if not which or "hover" in which or "hover-click" in which:
        res["click"] = await first_click(ctx, sw, browser, ext_id)
    return res
