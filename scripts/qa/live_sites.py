"""Live-site smoke check of the packaged extension (project-docs/PRODUCTION-READINESS.md). Development
tool only. Opens one public page per supported site in a fresh, signed-out Chrome profile with the
extension installed, and records for each: whether the page loaded, whether Daylight Commons' reader
found posts, every error the extension's own scripts raised, and every warning it logged. It reads
only what a signed-out visitor sees and clicks nothing on the sites. Writes live.json to --out.

    python scripts/qa/live_sites.py --out <dir> [--package dist/radar-chrome-<version>.zip]
"""
import argparse
import asyncio
import json
import pathlib
import sys

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "demo"))
from browser import Session  # noqa: E402

VERSION = json.loads((ROOT / "src/ext/manifest.json").read_text(encoding="utf-8"))["version"]
# Public pages a signed-out visitor can open. Where a site lists posts, the first post link is opened.
SITES = [
    ("X", "https://x.com/NASA", None),
    ("YouTube", "https://www.youtube.com/watch?v=aqz-KE-bpKQ", None),
    ("Reddit", "https://www.reddit.com/r/AskHistorians/top/?t=week", 'a[href*="/comments/"]'),
    ("Bluesky", "https://bsky.app/profile/bsky.app", 'a[href*="/post/"]'),
    ("Mastodon", "https://mastodon.social/@Mastodon", 'a.status__relative-time, a[href*="/@Mastodon/1"]'),
    ("Threads", "https://www.threads.com/@threads", 'a[href*="/post/"]'),
    ("Facebook", "https://www.facebook.com/NASA", None),
    ("Instagram", "https://www.instagram.com/nasa/", None),
    ("TikTok", "https://www.tiktok.com/@nasa", None),
]
PROBE = """(() => { try { const s = globalThis.PBSites && PBSites.current(); const items = s ? s.items() : [];
  return JSON.stringify({ site: s ? s.id : null, thread: s ? !!s.onThread() : null, items: items.length,
    read: items.filter((n) => { try { return !!s.read(n); } catch (e) { return false; } }).length,
    failures: globalThis.PBGuard ? PBGuard.recent() : null }); } catch (e) { return JSON.stringify({ error: String(e) }); } })()"""


class Live(Session):
    """The demo session with every request let through: these are the real sites."""
    async def _route(self, r):
        self.requests.append((r.request.url, "network"))
        return await r.continue_()


async def visit(s, name, url, follow):
    pg = await s.page()
    cdp = await pg.context.new_cdp_session(pg)
    ours, contexts, log = set(), {}, []
    cdp.on("Runtime.executionContextCreated", lambda e: contexts.setdefault(e["context"]["id"], e["context"]["name"]))
    cdp.on("Runtime.exceptionThrown", lambda e: log.append(("exception", e["exceptionDetails"].get("executionContextId"), str(e["exceptionDetails"].get("exception", {}).get("description", e["exceptionDetails"].get("text")))[:300])))
    cdp.on("Runtime.consoleAPICalled", lambda e: e["type"] in ("error", "warning") and log.append((e["type"], e.get("executionContextId"), " ".join(str(a.get("value", a.get("description", ""))) for a in e["args"])[:300])))
    await cdp.send("Runtime.enable")
    out = {"site": name, "url": url}
    try:
        await pg.goto(url, wait_until="domcontentloaded", timeout=45000)
        await pg.wait_for_timeout(6000)
        if follow:
            link = pg.locator(follow).first
            if await link.count():
                href = await link.get_attribute("href")
                out["opened"] = href
                await pg.goto(href if href.startswith("http") else pg.url.split("/", 3)[0] + "//" + pg.url.split("/")[2] + href, wait_until="domcontentloaded", timeout=45000)
                await pg.wait_for_timeout(8000)
        await pg.mouse.wheel(0, 2500)
        await pg.wait_for_timeout(3000)
        out["final_url"] = pg.url
        for cid, cname in list(contexts.items()):
            if cname == "Daylight Commons":
                ours.add(cid)
                try:
                    r = await cdp.send("Runtime.evaluate", {"expression": PROBE, "contextId": cid, "returnByValue": True})
                    out["reader"] = json.loads(r["result"].get("value") or "{}")
                except Exception as e:  # the context went away on navigation
                    out.setdefault("probe_errors", []).append(str(e)[:120])
        out["extension_errors"] = [t for kind, cid, t in log if cid in ours and kind in ("exception", "error")]
        out["extension_warnings"] = [t for kind, cid, t in log if cid in ours and kind == "warning"]
        out["page_errors_not_ours"] = sum(1 for kind, cid, t in log if cid not in ours and kind in ("exception", "error"))
        out["content_script_ran"] = bool(ours)
    except Exception as e:
        out["error"] = str(e)[:300]
    await pg.close()
    return out


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--package", default=str(ROOT / "dist" / f"radar-chrome-{VERSION}.zip"))
    ap.add_argument("--stage", default=str(ROOT / "scripts" / "demo"))
    a = ap.parse_args()
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    stage = out / "stage"
    stage.mkdir(exist_ok=True)
    (stage / "stages.json").write_text("{}", encoding="utf-8")
    results = []
    async with async_playwright() as p:
        # Mastodon runs only on servers the user turned on; the copy is granted mastodon.social the way
        # the Options switch would, and the server is registered the same way.
        s = await Live(p, a.package, stage, grant=["https://mastodon.social/*"], port=9444).start()
        sw_errors = []
        s.sw.on("console", lambda m: m.type == "error" and sw_errors.append(m.text[:300]))
        opt = await s.page()
        await opt.goto(s.url("options.html"))
        mast = await opt.evaluate("chrome.runtime.sendMessage({ type: 'pb-instance-add', host: 'mastodon.social' })")
        await opt.close()
        if not (mast and mast.get("ok")):
            sw_errors.append(f"could not turn on mastodon.social: {mast}")
        try:
            for name, url, follow in SITES:
                r = await visit(s, name, url, follow)
                results.append(r)
                print(json.dumps({k: r.get(k) for k in ("site", "content_script_ran", "reader", "extension_errors", "error")}))
        finally:
            await s.close()
    (out / "live.json").write_text(json.dumps({"version": VERSION, "sites": results, "service_worker_errors": sw_errors}, indent=1), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
