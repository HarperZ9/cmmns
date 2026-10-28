"""Timings for the Download buttons, in Chrome with the unpacked extension. Development tool only.

    python scripts/qa/download_timing.py <work folder> [label] [case ...]

x.com, pbs.twimg.com, video.twimg.com, www.instagram.com and news.example are mapped to local
fixtures (dl_fixture.py) behind a delay per request (DC_RTT_MS, 60) and a bandwidth cap (DC_MBIT, 80).
Inline cases click the X action-row Download button for real and record: the first visible
feedback, when the browser started each download (chrome.downloads startTime), the final note and
when every file finished. Hover cases move a real pointer along a still, jittery, drifting or
layered path and record whether and when the control drew. Writes <work>/timing-<label>.json.
"""
import asyncio
import json
import os
import pathlib
import subprocess
import sys
import time

import dl_fixture as dfx

os.environ["DC_MAP_HOSTS"] = ",".join(dfx.HOSTS)
from playwright.async_api import async_playwright  # noqa: E402

import dl_hover  # noqa: E402
import dl_probe as pr  # noqa: E402
import quick_save_check as q  # noqa: E402

STATUS = "https://x.com/ana/status/301"
DL = [None]   # the downloads folder, set at launch
SEED_SAVED = """(n) => { const all = {}; const now = Date.now(); for (let i = 0; i < n; i++) all['https://pbs.twimg.com/media/seed' + i + '?format=jpg&name=orig'] = ['ana-seed-' + i + '.jpg', now - i];
  return chrome.storage.local.set({ 'pb.saved.v1': all }).then(() => n); }"""


async def open_status(ctx):
    page = await ctx.new_page()
    await page.add_init_script(pr.PAGE_INIT)
    await page.goto(STATUS)
    await page.bring_to_front()
    await page.wait_for_selector('article[data-pid="304"] .dc-dl', timeout=30000)
    await asyncio.sleep(1.5)
    return page


async def click_inline(ctx, sw, pid, seed=0, cold=None):
    """One real click on the action-row Download button of post pid. Returns the timing summary."""
    await sw.evaluate("() => chrome.storage.local.remove('pb.saved.v1')")
    if seed:
        await sw.evaluate(SEED_SAVED, seed)
    page = await open_status(ctx)
    tab = await pr.tab_of(sw, STATUS)
    if cold:
        await pr.stop_worker(*cold[:2])
        await asyncio.sleep(0.5)
    btn = page.locator(f'article[data-pid="{pid}"] > div[role="group"] .dc-dl:not(.dc-study)')
    await btn.scroll_into_view_if_needed()
    await page.evaluate("() => { window.__toasts.length = 0; }")
    t0 = await page.evaluate("Date.now()")
    await btn.click()
    if cold:
        out = await pr.files_after(cold[2], t0, page)
        await page.close()
        return out
    final, dl = await pr.wait_final(sw, tab, page, t0)
    toasts = await page.evaluate("() => window.__toasts")
    out = pr.summary(t0, toasts, final, dl)
    await page.close()
    return out


async def redraw_cases(ctx, sw):
    """X redraws: the action row replaced after the button was drawn, and an article reused for another post."""
    page = await open_status(ctx)
    res = {}
    await page.evaluate("""() => { const a = document.querySelector('article[data-pid="301"]'); const row = a.querySelector(':scope > [role=group]');
      const fresh = row.cloneNode(false); for (const b of row.querySelectorAll('button[data-testid]')) fresh.append(b.cloneNode(true)); row.replaceWith(fresh); }""")
    await asyncio.sleep(0.6)
    res["row_replaced_button_back"] = await page.evaluate("() => !!document.querySelector('article[data-pid=\"301\"] > [role=group] .dc-dl')")
    late = await page.evaluate("""() => new Promise((ok) => { const a = document.createElement('article'); a.dataset.pid = '306';
      a.innerHTML = '<a href="/ana/status/306"><time>Oct</time></a><div data-testid="tweetText" lang="en">late row</div>' +
        '<img src="https://pbs.twimg.com/media/p301a?format=jpg&name=small" style="width:300px;height:200px">';
      document.querySelector('main').append(a);
      setTimeout(() => { const g = document.createElement('div'); g.setAttribute('role', 'group'); g.innerHTML = '<button data-testid="reply">r</button><button data-testid="like">l</button>'; a.append(g);
        setTimeout(() => ok({ inRow: !!g.querySelector('.dc-dl'), corner: !!a.querySelector(':scope > :not([role=group]) .dc-dl, :scope > .dc-dl') }), 600); }, 400); })""")
    res["late_row"] = late
    res["quoted"] = await page.evaluate("""() => { const outer = document.querySelector('article[data-pid="305"]'), inner = outer.querySelector('article[data-quoted]');
      return { outer_buttons: outer.querySelectorAll(':scope > [role=group] .dc-dl').length, inner_buttons: inner.querySelectorAll('.dc-dl').length }; }""")
    await page.close()
    return res


async def inline_cases(ctx, sw, browser, ext_id, which):
    out = {}
    plan = [("one_picture", "301", 0), ("gallery_4", "302", 0), ("video_mp4", "303", 0), ("video_hls", "304", 0), ("one_picture_20k_saved", "301", 20000)]
    for name, pid, seed in plan:
        if which and name not in which:
            continue
        out[name] = await click_inline(ctx, sw, pid, seed)
        print(name, json.dumps({k: v for k, v in out[name].items() if k != "files"}), flush=True)
    if not which or "cold_worker" in which:
        out["cold_worker"] = await click_inline(ctx, sw, "301", 0, cold=(browser, ext_id, DL[0]))
        print("cold_worker", json.dumps({k: v for k, v in out["cold_worker"].items() if k != "files"}), flush=True)
    return out


async def main(work, label, which):
    work.mkdir(parents=True, exist_ok=True)
    site = dfx.build(work)
    srv = dfx.serve(site, work)
    res = {"label": label, "rtt_ms": dfx.RTT_S * 1000, "mbit": dfx.BYTES_PER_S / 125000}
    async with async_playwright() as p:
        proc, browser, ctx, sw, DL[0] = await q.launch(p, work)
        ext_id = sw.ext_id
        try:
            await asyncio.sleep(2)
            if not which or any(not w.startswith("hover") for w in which):
                res["inline"] = await inline_cases(ctx, sw, browser, ext_id, which)
                if not which or "redraw" in which:
                    res["redraw"] = await redraw_cases(ctx, sw)
                    print("redraw", json.dumps(res["redraw"]), flush=True)
            if not which or any(w.startswith("hover") for w in which):
                res["hover"] = await dl_hover.run_all(ctx, sw, browser, ext_id, which)
        finally:
            (work / f"timing-{label}.json").write_text(json.dumps(res, indent=1) + "\n", encoding="utf-8")
            await browser.close()
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True) if sys.platform == "win32" else proc.terminate()
            srv.shutdown()


if __name__ == "__main__":
    asyncio.run(main(pathlib.Path(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else "run", sys.argv[3:]))
