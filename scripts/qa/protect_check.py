"""Browser check of source protection, Share clean and the self-audit in Chrome with the unpacked
extension. Development only.

    python scripts/qa/protect_check.py <work folder>

A local server serves a page with a photo full of metadata and three X-like profile pages (your own
signed-in profile, someone else's, signed out). The server logs every request it receives, and the
browser's own network events are recorded too, so the check counts what went out:
  1. protection off: Save to Daylight downloads the photo again (the control: a request is seen);
  2. protection on: the same save, the right-click Download and an evidence lookup make zero requests;
     the toolbar badge reads P;
  3. Share clean from Collections, one file and the whole case as a zip, with no metadata left;
  4. the self-audit refuses a signed-out page and someone else's profile, and runs on your own.
Writes protect-check.json and screenshots to <work>/out.
"""
import asyncio
import http.server
import json
import pathlib
import shutil
import sys
import threading
import zipfile

from playwright.async_api import async_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from quick_save_check import launch, ROOT  # noqa: E402

FIX = ROOT / "tests" / "fixtures" / "clean"
LOG = []
PROFILE = '<!doctype html><html data-pb-fixture="own-profile"><head><meta charset="utf-8"><title>{t}</title></head><body>{nav}<main><h1>{t}</h1>{edit}</main></body></html>'
NAV = '<nav><a data-testid="AppTabBar_Profile_Link" href="/me_test">Profile</a></nav>'


def site(root):
    root.mkdir(parents=True, exist_ok=True)
    # A photo big enough for the save page (48 px or more a side), with EXIF, GPS and a comment.
    sys.path.insert(0, str(ROOT / "scripts"))
    fx = __import__("clean-fixtures")
    fx.picture(320, 240).save(root / "photo.jpg", "JPEG", quality=90, exif=fx.exif(), comment=b"DLSECRET-JPEGCOMMENT")
    (root / "media.html").write_text('<!doctype html><html><head><meta charset="utf-8"><title>Media</title></head><body><img id="p" src="/photo.jpg" width="200"></body></html>', encoding="utf-8")
    (root / "me_test").write_text(PROFILE.format(t="me_test", nav=NAV, edit='<a data-testid="editProfileButton" href="/settings/profile">Edit profile</a>'), encoding="utf-8")
    (root / "someone_else").write_text(PROFILE.format(t="someone_else", nav=NAV, edit=""), encoding="utf-8")
    (root / "signed_out").write_text(PROFILE.format(t="signed_out", nav="", edit=""), encoding="utf-8")


def serve(root):
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(root), **k)

        def log_message(self, fmt, *a):
            LOG.append(self.path)

        def guess_type(self, path):
            return "text/html" if "." not in pathlib.Path(path).name else super().guess_type(path)

        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            super().end_headers()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


async def save_from(ctx, ext, base, net):
    """Opens the media page, asks the extension to scan it (as the toolbar's Save media does), and saves into the case."""
    page = await ctx.new_page()
    await page.goto(base + "/media.html")
    await page.wait_for_timeout(500)
    opener = await ctx.new_page()
    await opener.goto(f"chrome-extension://{ext}/options.html")
    async with ctx.expect_page() as got:
        await opener.evaluate("async (u) => { const [t] = await chrome.tabs.query({ url: u + '/media.html' }); return chrome.runtime.sendMessage({ type: 'pb-media-scan', tab: t }); }", base)
    save = await got.value
    await save.wait_for_load_state()
    errors = []
    save.on("console", lambda m: errors.append(m.text))
    try:
        await save.wait_for_selector("#found input[type=checkbox]", state="attached", timeout=15000)
    except Exception:
        raise RuntimeError(f"save page {save.url}: {await save.inner_text('#from')} {errors}")
    mark_log, mark_net = len(LOG), len(net)
    await save.click("#save")
    await save.wait_for_function("() => document.getElementById('status').textContent.length > 0", timeout=20000)
    await save.wait_for_timeout(1500)
    result = await save.inner_text("#results")
    hits = [p for p in LOG[mark_log:] if "photo.jpg" in p]
    browser_hits = [u for u in net[mark_net:] if u.startswith(base)]
    return save, page, opener, {"result": result.strip(), "server_requests_after_click": hits, "browser_requests_after_click": browser_hits}


async def main(work):
    work = pathlib.Path(work)
    out = work / "out"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    site(work / "site")
    srv, base = serve(work / "site")
    report = {}
    async with async_playwright() as p:
        proc, browser, ctx, sw, dl = await launch(p, work)
        net = []
        ctx.on("request", lambda r: net.append(r.url))
        ext = sw.ext_id
        # 1. Protection off: the control. The save downloads the photo again.
        save, page, opener, off = await save_from(ctx, ext, base, net)
        report["off_save"] = off
        await save.screenshot(path=str(out / "01-save-off.png"), full_page=True)
        # 3. Share clean from Collections.
        col = await ctx.new_page()
        await col.goto(f"chrome-extension://{ext}/collections.html")
        await col.wait_for_selector("#grid .media-card")
        before = set(p.name for p in dl.iterdir())
        await col.click("#grid .media-card button:has-text('Share clean')")
        await col.wait_for_function("() => /Share clean copy saved|Not cleaned/.test(document.getElementById('summary').textContent)", timeout=15000)
        await col.wait_for_timeout(1500)
        new = [p for p in dl.iterdir() if p.name not in before and not p.name.endswith(".crdownload")]
        one = new[0].read_bytes() if new else b""
        report["share_clean_one"] = {"summary": await col.inner_text("#summary"), "files": [p.name for p in new], "dlsecret_left": b"DLSECRET" in one, "exif_left": b"Exif\0\0" in one, "bytes": len(one)}
        await col.screenshot(path=str(out / "02-collections-share-clean.png"), full_page=True)
        before = set(p.name for p in dl.iterdir())
        await col.click("#clean-all")
        await col.wait_for_function("() => /share-clean.zip saved/.test(document.getElementById('summary').textContent)", timeout=15000)
        await col.wait_for_timeout(1500)
        zips = [p for p in dl.iterdir() if p.name not in before and p.suffix == ".zip"]
        names, secret = [], None
        if zips:
            with zipfile.ZipFile(zips[0]) as z:
                names = z.namelist()
                secret = any(b"DLSECRET" in z.read(n) for n in names)
        report["share_clean_all"] = {"zip": [p.name for p in zips], "entries": names, "dlsecret_left": secret}
        lineage = await col.evaluate("async () => (await PBMediaStore.items()).map((r) => (r.cleanCopies || []).length)")
        report["lineage_records_on_saved_file"] = lineage
        # 2. Protection on.
        await opener.evaluate("() => PBSettings.save({ protection: true })")
        await opener.wait_for_timeout(500)
        report["badge"] = await sw.evaluate("chrome.action.getBadgeText({})")
        for pg in (save, page):
            await pg.close()
        save, page, opener2, on = await save_from(ctx, ext, base, net)
        report["on_save"] = on
        await save.screenshot(path=str(out / "03-save-protection-on.png"), full_page=True)
        tab = await sw.evaluate("(u) => chrome.tabs.query({ url: u + '/media.html' }).then((l) => l[0])", base)
        mark_log, mark_net = len(LOG), len(net)
        dialogs = []
        page.on("dialog", lambda d: (dialogs.append(d.message), asyncio.ensure_future(d.dismiss())))
        await sw.evaluate("([t, u]) => PBQuickBg.onClick({ menuItemId: 'pb-dl', srcUrl: u + '/photo.jpg', frameId: 0 }, t)", [tab, base])
        await sw.evaluate("([u]) => PBQuickBg.download({ url: u + '/photo.jpg', filename: 'x.jpg' }).then(() => 'downloaded', (e) => e.message)", [base])
        await page.wait_for_timeout(1500)
        report["on_menu_download"] = {"server_requests": [p for p in LOG[mark_log:] if "photo.jpg" in p], "browser_requests": [u for u in net[mark_net:] if u.startswith(base)], "alert": dialogs}
        report["on_evidence_lookup"] = await opener2.evaluate("() => chrome.runtime.sendMessage({ type: 'pb-evidence', repos: ['a/b'], domains: ['example.org'] })")
        prot = await ctx.new_page()
        await prot.goto(f"chrome-extension://{ext}/protection.html")
        await prot.wait_for_timeout(500)
        report["protection_page_state"] = await prot.inner_text("#state")
        await prot.screenshot(path=str(out / "04-protection-page.png"), full_page=True)
        pop = await ctx.new_page()
        await pop.goto(f"chrome-extension://{ext}/popup.html")
        await pop.wait_for_timeout(800)
        report["popup_indicator_visible"] = await pop.is_visible("#protection-on")
        await pop.screenshot(path=str(out / "05-popup-protection.png"), full_page=True)
        # 4. The self-audit.
        await opener2.evaluate("""() => chrome.storage.local.set({ 'pb.about.v1': { me_test: { handle: 'me_test', display: 'Me Test', joinDate: '2020-01-02', basedIn: 'Portugal', connectedVia: 'Portugal App Store', nameChanges: 2, followersCount: 12, followingCount: 40,
          pattern: { posts: 60, days: 10, perDay: 6, clients: [{ name: 'X for iPhone', share: 0.7 }, { name: 'X Web App', share: 0.3 }], hourHist: Array.from({ length: 24 }, (_, h) => (h < 7 ? 0 : 3)) }, at: Date.now() } } })""")
        audits = {}
        for path in ("signed_out", "someone_else", "me_test"):
            prof = await ctx.new_page()
            await prof.goto(f"{base}/{path}")
            tid = await sw.evaluate("(u) => chrome.tabs.query({ url: u }).then((l) => l[0].id)", f"{base}/{path}")
            sa = await ctx.new_page()
            await sa.goto(f"chrome-extension://{ext}/selfaudit.html?tab={tid}")
            mark_log = len(LOG)
            await sa.click("#from-page")
            await sa.wait_for_function("() => document.getElementById('status').textContent.length > 0", timeout=10000)
            audits[path] = {"status": await sa.inner_text("#status"), "signals": await sa.locator("#signals li").count() if await sa.is_visible("#signals-box") else 0, "requests_during_audit": LOG[mark_log:]}
            await sa.screenshot(path=str(out / f"06-selfaudit-{path}.png"), full_page=True)
        report["self_audit"] = audits
        await browser.close()
        proc.terminate()
    srv.shutdown()
    ok = (off["server_requests_after_click"] and not on["server_requests_after_click"] and not on["browser_requests_after_click"]
          and not report["on_menu_download"]["server_requests"] and report["badge"] == "P"
          and report["share_clean_one"]["files"] and not report["share_clean_one"]["dlsecret_left"] and report["share_clean_all"]["dlsecret_left"] is False
          and audits["signed_out"]["signals"] == 0 and audits["someone_else"]["signals"] == 0 and audits["me_test"]["signals"] > 0)
    report["pass"] = bool(ok)
    (out / "protect-check.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "qa-protect")))
