"""End-to-end check of one-click downloads in Chrome with the unpacked extension. Development only.
Chrome runs with a window placed off screen: X answers headless Chrome with an error page.

    python scripts/qa/quick_save_check.py <work folder> <source folder with bbb.mp4, v.mp4, a.mp4>

Real public pages (X signed out, Giphy, Tenor, Wikipedia, w3schools, the hls.js demo) and the local
fixtures from quick_fixture.py. A script cannot open Chrome's own right-click menu, so each case
right-clicks the page for real (the page sees the event and the pointer) and then calls the menu
handler in the service worker with the information Chrome passes on a click. The test copy of the
extension also holds <all_urls>, standing in for the access a real menu click grants (activeTab).
Writes quick-save-check.json and one screenshot per case to <work>/out.
"""
import asyncio
import json
import pathlib
import shutil
import socket
import subprocess
import sys
import tempfile

from playwright.async_api import async_playwright

import quick_fixture as fx

ROOT = pathlib.Path(__file__).resolve().parents[2]
CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
MAGIC = [(b"\x89PNG", "png"), (b"\xff\xd8\xff", "jpeg"), (b"GIF8", "gif"), (b"\x1aE\xdf\xa3", "webm"), (b"#EXTM3U", "m3u8")]


def sniff(path):
    b = pathlib.Path(path).read_bytes()[:16]
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "webp"
    if b[4:8] == b"ftyp":
        return "mp4/" + b[8:12].decode("latin1").strip()
    if b[:1] == b"G" and len(pathlib.Path(path).read_bytes()) > 188 and pathlib.Path(path).read_bytes()[188:189] == b"G":
        return "mpeg-ts"
    return next((n for m, n in MAGIC if b.startswith(m)), "unknown " + b[:8].hex())


def ext_copy(work):
    d = work / "ext"
    shutil.rmtree(d, ignore_errors=True)
    shutil.copytree(ROOT / "src" / "ext", d)
    m = json.loads((d / "manifest.json").read_text(encoding="utf-8"))
    m["host_permissions"] = m["host_permissions"] + ["<all_urls>"]
    (d / "manifest.json").write_text(json.dumps(m, indent=2), encoding="utf-8")
    return d


async def launch(p, work, port=9361):
    prof = pathlib.Path(tempfile.mkdtemp(prefix="dc-qs-prof-", dir=work))
    dl = work / "downloads"
    shutil.rmtree(dl, ignore_errors=True)
    dl.mkdir(parents=True)
    (prof / "Default").mkdir(parents=True)
    (prof / "Default" / "Preferences").write_text(json.dumps({"download": {"default_directory": str(dl), "prompt_for_download": False}}), encoding="utf-8")
    rules = ", ".join(f"MAP {h} 127.0.0.1:8443" for h in fx.REDDIT_HOSTS)
    proc = subprocess.Popen([CHROME, "--window-position=-2400,0", f"--user-data-dir={prof}", f"--remote-debugging-port={port}", "--enable-unsafe-extension-debugging",
                             f"--host-resolver-rules={rules}", "--ignore-certificate-errors", "--no-first-run", "--no-default-browser-check",
                             "--autoplay-policy=no-user-gesture-required", "--window-size=1280,900", "about:blank"])
    for _ in range(100):
        try:
            socket.create_connection(("127.0.0.1", port), 0.2).close()
            break
        except OSError:
            await asyncio.sleep(0.2)
    browser = await p.chromium.connect_over_cdp(f"http://127.0.0.1:{port}")
    ctx = browser.contexts[0]
    cdp = await browser.new_browser_cdp_session()
    ext_id = (await cdp.send("Extensions.loadUnpacked", {"path": str(ext_copy(work))}))["id"]
    await cdp.send("Browser.setDownloadBehavior", {"behavior": "default"})   # Chrome's own downloads, with the names asked for
    await cdp.send("Browser.grantPermissions", {"permissions": ["clipboardReadWrite", "clipboardSanitizedWrite"]})
    for _ in range(50):
        sws = [w for w in ctx.service_workers if ext_id in w.url]
        if sws:
            return proc, browser, ctx, sws[0], dl
        await asyncio.sleep(0.2)
    raise RuntimeError("the service worker did not start")


async def newest_ids(sw):
    return await sw.evaluate("chrome.downloads.search({}).then((l) => l.map((d) => d.id))")


async def wait_downloads(sw, before, page_frame_note, want=1, timeout=90):
    """Waits for `want` new finished downloads, or for the page's note to report a refusal or failure."""
    for _ in range(timeout * 4):
        items = await sw.evaluate("chrome.downloads.search({}).then((l) => l.map((d) => ({ id: d.id, state: d.state, filename: d.filename, bytes: d.fileSize, mime: d.mime, error: d.error || null, url: d.finalUrl || d.url })))")
        new = [d for d in items if d["id"] not in before]
        done = [d for d in new if d["state"] != "in_progress"]
        note = await page_frame_note()
        if len(done) >= want:
            return done, note
        if note and note.get("tone") == "no" and not new:
            return [], note
        await asyncio.sleep(0.25)
    return [d for d in new], await page_frame_note()


async def note_reader(sw, tab_url):
    async def read():
        return await sw.evaluate("""async (u) => { const [t] = await chrome.tabs.query({}).then((l) => l.filter((x) => x.url && x.url.startsWith(u)));
          if (!t) return null; const r = await chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, func: () => globalThis.PBQuickToast ? PBQuickToast.last() : null });
          return (r.find((x) => x.result && x.result.tone) || r.find((x) => x.result) || {}).result || null; }""", tab_url)
    return read


async def menu_click(sw, page, menu, point=None, selector=None, frame_url=None):
    """Right-clicks at the point (or the element's centre), then runs the menu handler as Chrome would."""
    frame = page
    if frame_url:
        frame = next(f for f in page.frames if f.url.startswith(frame_url))
    if selector == "largest":
        await frame.evaluate("""() => { const vis = [...document.querySelectorAll('img, video')].map((e) => [e, e.getBoundingClientRect()]).filter(([, r]) => r.width > 60 && r.height > 60);
          vis.sort((a, b) => b[1].width * b[1].height - a[1].width * a[1].height); if (vis[0]) vis[0][0].setAttribute('data-qs', '1'); }""")
        selector = "[data-qs]"
    if selector:
        await (await frame.wait_for_selector(selector, timeout=30000)).scroll_into_view_if_needed()
        await asyncio.sleep(1)
        box = await (await frame.wait_for_selector(selector, timeout=30000)).bounding_box()
        point = (box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        if frame_url:
            fb = await (await page.query_selector("iframe")).bounding_box()
            point = (point[0] + fb["x"], point[1] + fb["y"])
    await page.mouse.move(*point)
    await page.mouse.click(*point, button="right")
    local = point
    if frame_url:
        fb = await (await page.query_selector("iframe")).bounding_box()
        local = (point[0] - fb["x"], point[1] - fb["y"])
    src = await frame.evaluate("([x, y]) => { const e = document.elementFromPoint(x, y); return e && ['IMG','VIDEO','AUDIO'].includes(e.tagName) ? (e.currentSrc || e.src) : null; }", list(local))
    info = await sw.evaluate("""async ([u, menu, src, frameUrl]) => {
      const [t] = (await chrome.tabs.query({})).filter((x) => x.url && x.url.startsWith(u));
      let frameId = 0;
      if (frameUrl) { const r = await chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, func: () => location.href }); frameId = r.find((x) => x.result.startsWith(frameUrl)).frameId; }
      const info = { menuItemId: menu, frameId, pageUrl: t.url, ...(src ? { srcUrl: src, mediaType: 'image' } : {}) };
      await PBQuickBg.onClick(info, t); return info; }""", [page.url, menu, src, frame_url])
    return info


async def run_case(ctx, sw, out, case):
    page = await ctx.new_page()
    await page.set_viewport_size({"width": 1280, "height": 900})
    rec = {"name": case["name"], "url": case["url"]}
    try:
        await page.goto(case["url"], wait_until="domcontentloaded", timeout=60000)
        if case.get("discover"):
            await asyncio.sleep(6)
            href = await page.evaluate(case["discover"])
            rec["discovered"] = href
            await page.goto(href, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(case.get("settle", 6))
        rec["title"] = await page.title()
        before = await newest_ids(sw)
        read = await note_reader(sw, page.url.split("#")[0])
        if case.get("inline"):
            await page.locator(case["inline"]).first.scroll_into_view_if_needed(timeout=30000)
            await page.locator(case["inline"]).first.click(timeout=30000)
            rec["action"] = "inline Download button"
        else:
            rec["info"] = await menu_click(sw, page, case["menu"], selector=case.get("selector"), frame_url=case.get("frame"))
            rec["action"] = case["menu"]
        if not case.get("inline") and case["menu"] in ("pb-copy", "pb-copy-link"):
            await asyncio.sleep(3)
            rec["note"] = await read()
            rec["clipboard"] = await page.evaluate("navigator.clipboard.read().then(async (items) => items.map((i) => i.types)).catch((e) => String(e))")
            rec["clipboard_text"] = await page.evaluate("navigator.clipboard.readText().catch((e) => String(e))")
        else:
            done, rec["note"] = await wait_downloads(sw, before, read, want=case.get("want", 1), timeout=case.get("timeout", 90))
            rec["files"] = [dict(d, sniffed=sniff(d["filename"]) if d.get("filename") and pathlib.Path(d["filename"]).exists() else None) for d in done]
        await page.screenshot(path=str(out / f"{case['name']}.png"))
    except Exception as e:  # recorded, never hidden: the table shows the failure
        rec["error"] = f"{type(e).__name__}: {e}"
    finally:
        await page.close()
    return rec


async def main(work, src):
    from quick_cases import CASES
    work.mkdir(parents=True, exist_ok=True)
    out = work / "out"
    out.mkdir(exist_ok=True)
    site = fx.build(work, src)
    servers = fx.serve(site, work)
    only = set(sys.argv[3:])
    report = []
    async with async_playwright() as p:
        proc, browser, ctx, sw, dl = await launch(p, work)
        try:
            for case in CASES:
                if only and case["name"] not in only:
                    continue
                rec = await run_case(ctx, sw, out, case)
                report.append(rec)
                print(json.dumps(rec)[:600], flush=True)
        finally:
            (out / "quick-save-check.json").write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8")
            await browser.close()
            proc.terminate()
            for s in servers:
                s.shutdown()


if __name__ == "__main__":
    asyncio.run(main(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])))
