"""Further 3.6.1 browser checks, run from hover_check.py. Development tool only.

Text: a real X text post saved with its button (a note with no file), a selection on Wikipedia saved
from the hover control, a text card from the right-click handler. Also: the side panel showing a
post window and running its button in the page, and the Alt+Shift+D handler on a picture.
"""
import asyncio
import pathlib

import quick_save_check as q


async def tab_id(sw, url_start):
    return await sw.evaluate("async (u) => ((await chrome.tabs.query({})).find((t) => (t.url || '').startsWith(u)) || {}).id", url_start)


async def saved(sw, before, read, want, timeout=60):
    done, note = await q.wait_downloads(sw, before, read, want=want, timeout=timeout)
    files = []
    for d in done:
        p = pathlib.Path(d["filename"])
        f = {"name": p.name, "folder": "/".join(p.parts[-3:-1]), "bytes": d["bytes"], "sniffed": q.sniff(d["filename"]) if p.exists() else None}
        if p.suffix == ".md" and p.exists():
            text = p.read_text(encoding="utf-8")
            f["front"] = text.split("\n---\n")[0][:600]
        files.append(f)
    return files, note


async def x_text_post(ctx, sw, url):
    page = await ctx.new_page()
    await page.set_viewport_size({"width": 1280, "height": 900})
    rec = {"name": "x-text-post", "url": url}
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(9)
        before, read = await q.newest_ids(sw), await q.note_reader(sw, url)
        sid = url.rstrip("/").split("/")[-1]
        btn = page.locator(f'article:has(a[href$="/status/{sid}"]) .dc-dl:not(.dc-study)').last
        await btn.scroll_into_view_if_needed(timeout=20000)
        rec["button"] = await btn.get_attribute("title")
        await btn.click()
        rec["files"], rec["note"] = await saved(sw, before, read, 1)
    except Exception as e:  # recorded in the table, never hidden
        rec["error"] = f"{type(e).__name__}: {str(e)[:300]}"
    finally:
        await page.close()
    return rec


async def selection(ctx, sw, url="https://en.wikipedia.org/wiki/Mount_Rainier"):
    page = await ctx.new_page()
    await page.set_viewport_size({"width": 1280, "height": 900})
    rec = {"name": "selection-wikipedia", "url": url}
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(4)
        # Select the first long paragraph's opening words, then release Shift, as a keyboard selection ends.
        await page.evaluate("""() => { const p = [...document.querySelectorAll('#mw-content-text p')].find((x) => x.textContent.length > 200);
          p.scrollIntoView({ block: 'center' }); const t = document.createTreeWalker(p, NodeFilter.SHOW_TEXT).nextNode();
          const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, Math.min(t.length, 120)); getSelection().removeAllRanges(); getSelection().addRange(r); }""")
        await asyncio.sleep(0.5)
        await page.keyboard.press("Shift")
        await asyncio.sleep(0.6)
        rec["selected"] = (await page.evaluate("getSelection().toString()"))[:120]
        end = await page.evaluate("(() => { const r = [...getSelection().getRangeAt(0).getClientRects()].pop(); return { x: r.right, y: r.bottom }; })()")
        before, read = await q.newest_ids(sw), await q.note_reader(sw, url)
        await page.mouse.click(end["x"] + 2 + 14, end["y"] + 2 + 8 + 2 + 14)
        rec["files"], rec["note"] = await saved(sw, before, read, 1)
    except Exception as e:
        rec["error"] = f"{type(e).__name__}: {str(e)[:300]}"
    finally:
        await page.close()
    return rec


async def card(ctx, sw, url):
    page = await ctx.new_page()
    await page.set_viewport_size({"width": 1280, "height": 900})
    rec = {"name": "text-card", "url": url}
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(9)
        sid = url.rstrip("/").split("/")[-1]
        box = await page.locator(f'article:has(a[href$="/status/{sid}"])').last.bounding_box()
        await page.mouse.move(box["x"] + 40, box["y"] + 60)
        before, read = await q.newest_ids(sw), await q.note_reader(sw, url)
        rec["info"] = await q.menu_click(sw, page, "pb-card", point=(box["x"] + 40, box["y"] + 60))
        rec["files"], rec["note"] = await saved(sw, before, read, 2)
    except Exception as e:
        rec["error"] = f"{type(e).__name__}: {str(e)[:300]}"
    finally:
        await page.close()
    return rec


async def side_panel(ctx, sw, ext_id, url):
    page = await ctx.new_page()
    rec = {"name": "side-panel", "url": url}
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(6)
        tid = await tab_id(sw, url)
        panel = await ctx.new_page()
        await panel.goto(f"chrome-extension://{ext_id}/sidepanel.html?tab={tid}")
        await asyncio.sleep(1.5)
        await sw.evaluate("""async (id) => chrome.scripting.executeScript({ target: { tabId: id }, func: () => {
          globalThis.__sideTest = 0;
          PBPop.show(document.body, [{ glance: { who: 'Side panel check' } }, { tab: 'overview', title: 'Check', rows: [['Row', 'shown in the side panel'], ['', { actions: [['Press', () => { globalThis.__sideTest++; }]] }]] }]);
          return true; } })""", tid)
        await asyncio.sleep(1.5)
        rec["panel_text"] = (await panel.evaluate("document.getElementById('view').innerText"))[:200]
        rec["in_page_window"] = await page.evaluate("!!document.querySelector('.pb-pop')")
        await panel.click("text=Press")
        await asyncio.sleep(1)
        r = await sw.evaluate("async (id) => (await chrome.scripting.executeScript({ target: { tabId: id }, func: () => globalThis.__sideTest }))[0].result", tid)
        rec["button_ran_in_page"] = r == 1
        await panel.close()
        await asyncio.sleep(1)
        rec["after_close"] = await sw.evaluate("async (id) => (await chrome.scripting.executeScript({ target: { tabId: id }, func: () => PBSide.isOpen() }))[0].result", tid)
    except Exception as e:
        rec["error"] = f"{type(e).__name__}: {str(e)[:300]}"
    finally:
        await page.close()
    return rec


async def shortcut(ctx, sw, url="https://en.wikipedia.org/wiki/Mount_Rainier"):
    page = await ctx.new_page()
    await page.set_viewport_size({"width": 1280, "height": 900})
    rec = {"name": "shortcut-alt-shift-d", "url": url}
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(4)
        box = await (await page.wait_for_selector(".infobox img")).bounding_box()
        await page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, steps=3)
        await asyncio.sleep(0.4)
        before, read = await q.newest_ids(sw), await q.note_reader(sw, url)
        tid = await tab_id(sw, url)
        await sw.evaluate("async (id) => PBHoverBg.onCommand('save-media', await chrome.tabs.get(id))", tid)
        rec["files"], rec["note"] = await saved(sw, before, read, 2)
    except Exception as e:
        rec["error"] = f"{type(e).__name__}: {str(e)[:300]}"
    finally:
        await page.close()
    return rec
