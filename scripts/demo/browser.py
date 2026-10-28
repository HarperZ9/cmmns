"""Install a packaged CMMNS build into a fresh Chrome profile and answer x.com with the demo
stage (scripts/demo/stage.mjs), for scripts/demo/capture.py. Development tool only: needs Playwright
for Python and Google Chrome; nothing here ships in the extension.

Branded Chrome no longer loads extensions from the command line, so the build is loaded through the
DevTools protocol (Extensions.loadUnpacked, behind --enable-unsafe-extension-debugging), the same
way a developer loads it unpacked. Every request that is not the stage, the extension itself or a
host the caller allows is aborted and logged, so the log shows exactly what left the browser.
"""
import asyncio
import json
import pathlib
import socket
import subprocess
import tempfile
import zipfile

CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"


class Session:
    def __init__(self, p, package, stage_dir, allow=(), port=9333, scale=1, grant=()):
        self.p, self.package, self.stage_dir, self.allow, self.port, self.scale = p, package, pathlib.Path(stage_dir), tuple(allow), port, scale
        self.grant = list(grant)
        self.stages = json.loads((self.stage_dir / "stages.json").read_text())
        self.stage = "thread"
        self.requests = []   # (url, outcome)

    async def start(self):
        ext = pathlib.Path(tempfile.mkdtemp(prefix="dc-ext-"))
        zipfile.ZipFile(self.package).extractall(ext)
        if self.grant:
            # A script cannot click the browser's permission prompt, so optional hosts the user would
            # grant from Options (web.archive.org for evidence lookups) are granted in this copy.
            m = json.loads((ext / "manifest.json").read_text(encoding="utf-8"))
            m["host_permissions"] = m["host_permissions"] + self.grant
            (ext / "manifest.json").write_text(json.dumps(m, indent=2), encoding="utf-8")
        self.profile = tempfile.mkdtemp(prefix="dc-prof-")
        self.proc = subprocess.Popen([CHROME, "--headless=new", f"--user-data-dir={self.profile}", f"--remote-debugging-port={self.port}",
                                      "--enable-unsafe-extension-debugging", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars",
                                      f"--force-device-scale-factor={self.scale}", "about:blank"])
        for _ in range(100):
            try:
                socket.create_connection(("127.0.0.1", self.port), 0.2).close()
                break
            except OSError:
                await asyncio.sleep(0.2)
        self.browser = await self.p.chromium.connect_over_cdp(f"http://127.0.0.1:{self.port}")
        self.ctx = self.browser.contexts[0]
        await self.ctx.route("**/*", self._route)
        cdp = await self.browser.new_browser_cdp_session()
        self.ext_id = (await cdp.send("Extensions.loadUnpacked", {"path": str(ext)}))["id"]
        for _ in range(50):
            sws = [w for w in self.ctx.service_workers if self.ext_id in w.url]
            if sws:
                self.sw = sws[0]
                break
            await asyncio.sleep(0.2)
        for _ in range(50):
            if await self.sw.evaluate("!!(globalThis.chrome && chrome.storage && globalThis.PB)"):
                break
            await asyncio.sleep(0.2)
        return self

    def url(self, page):
        return f"chrome-extension://{self.ext_id}/{page}"

    async def _route(self, r):
        u = r.request.url
        if u.startswith("chrome-extension://") or u.startswith("data:") or u.startswith("blob:"):
            return await r.continue_()
        if u.startswith("https://x.com/i/api/graphql/demo/"):
            op = u.split("/demo/")[1].split("?")[0]
            f = self.stage_dir / f"{self.stage}.{op}.json"
            self.requests.append((u, "stage"))
            if f.exists():
                return await r.fulfill(path=str(f), content_type="application/json")
            return await r.fulfill(status=404, body="")
        if u.startswith("https://x.com/"):
            for name, s in self.stages.items():
                if u.split("?")[0] in (s["url"], s["quotesUrl"], s["retweetsUrl"]):
                    self.stage = name
                    self.requests.append((u, "stage"))
                    return await r.fulfill(path=str(self.stage_dir / f"{name}.html"), content_type="text/html")
            self.requests.append((u, "stage 404"))
            return await r.fulfill(status=404, body="")
        if u.startswith("https://harperz9.github.io/cmmns/"):
            # The project's own pages, answered from this checkout's docs/.
            f = pathlib.Path(__file__).resolve().parents[2] / "docs" / u.split("/cmmns/")[1].split("?")[0].split("#")[0]
            self.requests.append((u, "local docs"))
            if f.is_file():
                return await r.fulfill(path=str(f))
            return await r.fulfill(status=404, body="")
        if any(u.startswith(a) for a in self.allow):
            self.requests.append((u, "network"))
            return await r.continue_()
        self.requests.append((u, "blocked"))
        return await r.abort()

    async def settings(self, patch):
        await self.sw.evaluate("(p) => chrome.storage.local.get('pb.settings').then((r) => chrome.storage.local.set({'pb.settings': {...(r['pb.settings'] || {}), ...p}}))", patch)

    async def page(self, w=1280, h=800, dark=False):
        pg = await self.ctx.new_page()
        await pg.set_viewport_size({"width": w, "height": h})
        await pg.emulate_media(color_scheme="dark" if dark else "light", reduced_motion="reduce")
        return pg

    async def close(self):
        try:
            await self.browser.close()
        finally:
            self.proc.kill()
