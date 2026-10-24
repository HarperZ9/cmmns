"""Browser check for the 3.6.0 media toolkit and ad blocking, in headless Chrome with a fresh profile.
Development tool only; nothing here ships in the extension.

    python scripts/qa/media_check.py <fixture folder> <out folder>

The fixture folder is served at http://127.0.0.1:8765/ (index.html with an image, a GIF, a video, a
sound file, an HLS stream, an AES-128 HLS stream and a video with ClearKey MediaKeys attached). The
extension is loaded unpacked from a copy of src/ext whose manifest also grants http://127.0.0.1, since
a script cannot click the browser's permission prompt. Two ad hosts are answered by a stub when a
request reaches the network; every other outside request is aborted and logged.
Writes screenshots, the converted files and media-check.json to the out folder.
"""
import asyncio
import base64
import functools
import http.server
import json
import pathlib
import shutil
import socket
import subprocess
import sys
import tempfile
import threading

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
SITE = "http://127.0.0.1:8765/"
ADS = ("securepubads.g.doubleclick.net", "www.google-analytics.com")


def serve(folder):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(folder))
    handler.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8765), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


async def poll(page, fn, timeout=120):
    """page.wait_for_function evaluates a string, which an extension page's CSP forbids; this polls instead."""
    for _ in range(int(timeout * 5)):
        if await page.evaluate(fn):
            return True
        await asyncio.sleep(0.2)
    raise TimeoutError(fn)


def ext_copy():
    d = pathlib.Path(tempfile.mkdtemp(prefix="dc-media-ext-")) / "ext"
    shutil.copytree(ROOT / "src" / "ext", d)
    m = json.loads((d / "manifest.json").read_text(encoding="utf-8"))
    m["host_permissions"] = m["host_permissions"] + ["http://127.0.0.1/*"]
    m["optional_host_permissions"] = m["optional_host_permissions"] + ["http://*/*"]
    (d / "manifest.json").write_text(json.dumps(m, indent=2), encoding="utf-8")
    return d


async def launch(p, ext, port=9341):
    prof = tempfile.mkdtemp(prefix="dc-media-prof-")
    proc = subprocess.Popen([CHROME, "--headless=new", f"--user-data-dir={prof}", f"--remote-debugging-port={port}", "--enable-unsafe-extension-debugging",
                             "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required", "about:blank"])
    for _ in range(100):
        try:
            socket.create_connection(("127.0.0.1", port), 0.2).close()
            break
        except OSError:
            await asyncio.sleep(0.2)
    browser = await p.chromium.connect_over_cdp(f"http://127.0.0.1:{port}")
    ctx = browser.contexts[0]
    cdp = await browser.new_browser_cdp_session()
    ext_id = (await cdp.send("Extensions.loadUnpacked", {"path": str(ext)}))["id"]
    for _ in range(50):
        sws = [w for w in ctx.service_workers if ext_id in w.url]
        if sws:
            return proc, browser, ctx, ext_id, sws[0]
        await asyncio.sleep(0.2)
    raise RuntimeError("the service worker did not start")


async def route(log, r):
    u = r.request.url
    if u.startswith(("chrome-extension://", "data:", "blob:", SITE)):
        return await r.continue_()
    host = u.split("/")[2]
    log.append(u)
    if host in ADS:
        return await r.fulfill(status=200, body="/* stub */", content_type="text/javascript")
    return await r.abort()


async def save_flow(ctx, ext, page_tab_url, where, board=None, tags="", pick=None, shot=None, out=None):
    helper = await ctx.new_page()
    await helper.goto(f"chrome-extension://{ext}/collections.html")
    async with ctx.expect_page() as info:
        await helper.evaluate("""async (u) => { const [t] = await chrome.tabs.query({ url: u + '*' }); return chrome.runtime.sendMessage({ type: 'pb-media-scan', tab: t }); }""", page_tab_url)
    save = await info.value
    await save.wait_for_selector("#found li")
    await save.evaluate("""(pick) => { for (const b of document.querySelectorAll('#found input[type=checkbox]')) {
        const li = b.closest('li'); const t = li.textContent; b.checked = !b.disabled && (!pick || pick.some((p) => t.includes(p))); } }""", pick)
    await save.check(f"input[name=where][value={where}]")
    if board:
        await save.fill("#board-new", board)
    await save.fill("#tags", tags)
    if shot:
        await save.screenshot(path=str(out / f"{shot}-before.png"), full_page=True)
    await save.click("#save")
    await poll(save, "() => { const t = document.getElementById('status').textContent; return t.startsWith('Done') || t.includes('permission'); }")
    if shot:
        await save.screenshot(path=str(out / f"{shot}-after.png"), full_page=True)
    found = await save.evaluate("[...document.querySelectorAll('#found li')].map((li) => li.textContent.slice(0, 200))")
    results = await save.evaluate("[...document.querySelectorAll('#results li')].map((li) => li.textContent)")
    await helper.close()
    await save.close()
    return {"found": found, "results": results}


async def convert(ctx, ext, rec_id, opts, shot, out):
    page = await ctx.new_page()
    await page.goto(f"chrome-extension://{ext}/convert.html#{rec_id}")
    await page.wait_for_selector("#options-box:not([hidden])")
    for k, v in opts.items():
        await page.select_option(f"#{k}", v) if k != "quality" else await page.fill("#quality", v)
    await page.click("#go")
    await poll(page, "() => /^(Done|Not converted)/.test(document.getElementById('status').textContent)", 300)
    status = await page.text_content("#status")
    size = await page.text_content("#size")
    await page.screenshot(path=str(out / f"{shot}.png"), full_page=True)
    data = await page.evaluate("""async () => { const a = document.getElementById('download'); if (!a.href.startsWith('blob:')) return null;
        const b = new Uint8Array(await (await fetch(a.href)).arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode(...b.subarray(i, i + 32768)); return { name: a.download, b64: btoa(s) }; }""")
    await page.close()
    if data:
        (out / data["name"]).write_bytes(base64.b64decode(data["b64"]))
    return {"status": status, "size": size, "file": data and data["name"]}


async def main(fixture, out):
    out.mkdir(parents=True, exist_ok=True)
    srv, ext_dir, log, report = serve(fixture), ext_copy(), [], {}
    async with async_playwright() as p:
        proc, browser, ctx, ext, sw = await launch(p, ext_dir)
        await ctx.route("**/*", functools.partial(route, log))
        try:
            await run_checks(ctx, ext, sw, out, report)
        finally:
            report["outside_requests"] = log
            (out / "media-check.json").write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8")
            await browser.close()
            proc.terminate()
            srv.shutdown()


async def run_checks(ctx, ext, sw, out, report):
    site = await ctx.new_page()
    await site.goto(SITE + "index.html")
    await site.wait_for_function("document.body.dataset.drm", timeout=20000)
    report["drm_fixture"] = await site.evaluate("document.body.dataset.drm")
    await site.screenshot(path=str(out / "01-fixture-page.png"), full_page=True)
    report["case_save"] = await save_flow(ctx, ext, SITE, "case", shot="02-save-case", out=out)
    report["board_save"] = await save_flow(ctx, ext, SITE, "moodboard", board="Harbour references", tags="night, test card", pick=["Image,", "GIF,"], shot="03-save-moodboard", out=out)
    col = await ctx.new_page()
    await col.goto(f"chrome-extension://{ext}/collections.html")
    items = await col.evaluate("PBMediaStore.items()")
    report["stored"] = [{k: i[k] for k in ("kind", "mime", "bytes", "sha256")} | {"collection": i["collection"]["type"]} for i in items]
    boards = await col.evaluate("PBMediaStore.boards()")
    await col.goto(f"chrome-extension://{ext}/collections.html?c=moodboard:{boards[0]['id']}")
    await col.wait_for_selector("#grid li.media-card")
    await col.click("#grid li.media-card button")
    await col.screenshot(path=str(out / "04-collections-moodboard.png"), full_page=True)
    case = {i["kind"] + ("-hls" if (i["source"].get("stream") or {}).get("type") else ""): i["id"] for i in items if i["collection"]["type"] == "case"}
    report["case_kinds"] = sorted(case)
    jobs = [("image", {"to": "webp", "quality": "0.8"}, "05-convert-image"), ("gif", {"to": "mp4", "bitrate": "1000000"}, "06-convert-gif"),
            ("video", {"to": "webm", "maxHeight": "480", "bitrate": "1000000"}, "07-compress-video"), ("audio", {"to": "ogg", "audioBitrate": "64000"}, "08-convert-audio"),
            ("video", {"to": "mp4", "maxHeight": "720", "bitrate": "2000000"}, "07b-convert-video-mp4")]
    report["conversions"] = {}
    for kind, opts, shot in jobs:
        if kind in case:
            report["conversions"][shot] = await convert(ctx, ext, case[kind], opts, shot, out)
    await col.goto(f"chrome-extension://{ext}/collections.html")
    report["lineage_problems"] = await col.evaluate("PBMediaStore.items().then((l) => PB.checkLineage(l))")
    await col.wait_for_selector("#grid li.media-card")
    await col.screenshot(path=str(out / "09-collections-case.png"), full_page=True)
    await adblock(ctx, ext, sw, site, out, report)


async def adblock(ctx, ext, sw, site, out, report):
    async def set_settings(patch):
        await sw.evaluate("""async (patch) => { const k = PB.SETTINGS_KEY; const s = PB.normalizeSettings((await chrome.storage.local.get(k))[k]); await chrome.storage.local.set({ [k]: PB.normalizeSettings({ ...s, ...patch }) }); }""", patch)
        await asyncio.sleep(1.5)

    async def ads():
        await site.reload()
        await site.wait_for_function("document.getElementById('ads').textContent.includes('analytics')", timeout=20000)
        return await site.text_content("#ads")
    report["adblock"] = {"off": await ads()}
    await set_settings({"adblock": True})
    report["adblock"]["enabled_rulesets"] = await sw.evaluate("chrome.declarativeNetRequest.getEnabledRulesets()")
    report["adblock"]["on"] = await ads()
    await set_settings({"adblockAllow": ["127.0.0.1"]})
    report["adblock"]["on_but_site_allowed"] = await ads()
    opts = await ctx.new_page()
    await opts.goto(f"chrome-extension://{ext}/options.html")
    await opts.wait_for_selector("#adblock .switch")
    await opts.locator("#h-adblock").scroll_into_view_if_needed()
    await opts.screenshot(path=str(out / "10-options-adblock.png"))
    await opts.locator("#reading").scroll_into_view_if_needed()
    await opts.screenshot(path=str(out / "11-options-pressure-lens.png"))


if __name__ == "__main__":
    asyncio.run(main(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])))
