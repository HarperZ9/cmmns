"""Shared probes for scripts/qa/download_timing.py. Development tool only.

WRAP records every chrome.downloads.download call in the worker with its time, and when the browser
named and finished each file. PAGE_INIT records, in the page's main world, when the CMMNS note
first appears and when the hover control first covers a chosen point.
"""
import asyncio
import pathlib
import time

WRAP = """() => {
  if (!globalThis.__dlWrapped) {
    globalThis.__dlWrapped = true; globalThis.__dl = [];
    const real = chrome.downloads.download.bind(chrome.downloads);
    chrome.downloads.download = (o) => { const e = { t: Date.now(), url: String(o.url).slice(0, 100), filename: o.filename || null }; __dl.push(e);
      return real(o).then((id) => { e.id = id; return id; }, (err) => { e.err = String(err); throw err; }); };
    chrome.downloads.onChanged.addListener((d) => { const e = __dl.find((x) => x.id === d.id); if (!e) return;
      if (d.filename && d.filename.current) e.named = Date.now();
      if (d.state && d.state.current !== 'in_progress') { e.end = Date.now(); e.state = d.state.current; }
      if (d.error) e.error = d.error.current; });
  }
  globalThis.__dl.length = 0; return true; }"""

PAGE_INIT = """(() => {
  window.__toasts = []; window.__shown = null; window.__probe = null;
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.tagName === 'DAYLIGHT-TOAST') window.__toasts.push(Date.now()); })
    .observe(document, { childList: true, subtree: true });
  const tick = () => { const p = window.__probe; if (p && !window.__shown) { const e = document.elementFromPoint(p.x, p.y); if (e && e.tagName === 'DAYLIGHT-HOVER') window.__shown = Date.now(); } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})();"""

TOAST = """() => globalThis.PBQuickToast ? PBQuickToast.last() : null"""


async def tab_of(sw, url_start):
    return await sw.evaluate("async (u) => (await chrome.tabs.query({})).find((t) => t.url && t.url.startsWith(u)).id", url_start)


async def last_note(sw, tab):
    r = await sw.evaluate("""async (id) => { const r = await chrome.scripting.executeScript({ target: { tabId: id }, func: () => globalThis.PBQuickToast ? PBQuickToast.last() : null }); return r[0] && r[0].result; }""", tab)
    return r


async def wait_final(sw, tab, page, t0, timeout=90):
    """Waits until the note reports an outcome (ok, no, or "already") and no download is in progress."""
    seen, final = None, None
    end = time.time() + timeout
    while time.time() < end:
        note = await last_note(sw, tab)
        busy = await page.evaluate("() => [...document.querySelectorAll('.dc-dl')].some((b) => b.disabled)")
        if note and note != seen:
            seen = note
        if note and (note.get("tone") in ("ok", "no") or note.get("text", "").startswith("Already")) and not busy:
            final = {"note": note, "at_ms": int(time.time() * 1000) - t0}
            break
        await asyncio.sleep(0.05)
    for _ in range(int(timeout * 4)):
        dl = await since(sw, t0)
        if all(d.get("end") for d in dl):
            break
        await asyncio.sleep(0.25)
    return final, await since(sw, t0)


async def since(sw, t0):
    """Downloads started at or after t0 (ms), oldest first, with start and end in ms."""
    return await sw.evaluate("""(t0) => chrome.downloads.search({ orderBy: ['startTime'] }).then((l) => l.map((d) => ({ t: Date.parse(d.startTime),
      end: d.endTime ? Date.parse(d.endTime) : null, state: d.state, error: d.error || null, filename: d.filename, url: (d.finalUrl || d.url).slice(0, 100), bytes: d.fileSize }))
      .filter((d) => d.t >= t0 - 5))""", t0)


def summary(t0, toasts, final, dl):
    calls = [d["t"] - t0 for d in dl]
    return {"feedback_ms": (toasts[0] - t0) if toasts else None, "first_download_call_ms": calls[0] if calls else None,
            "last_download_call_ms": calls[-1] if calls else None, "final_note_ms": final and final["at_ms"],
            "all_finished_ms": max(((d.get("end") or 0) - t0 for d in dl), default=None),
            "note": final and final["note"], "files": [{"name": (d.get("filename") or d["url"]).split("/")[-1][-60:], "state": d.get("state"),
                                                         "error": d.get("error"), "bytes": d.get("bytes")} for d in dl]}


async def stop_worker(browser, ext_id):
    """Closes the extension's service worker, as Chrome does after 30 s idle. Playwright keeps a dead
    handle to it afterwards, so a cold case reads its result from the downloads folder instead."""
    cdp = await browser.new_browser_cdp_session()
    for t in (await cdp.send("Target.getTargets"))["targetInfos"]:
        if t["type"] == "service_worker" and ext_id in t["url"]:
            await cdp.send("Target.closeTarget", {"targetId": t["targetId"]})
    await cdp.detach()


async def files_after(folder, t0, page, want=2, timeout=30):
    """Waits for want finished files (not .crdownload) in folder, newer than t0 (ms)."""
    seen = {}
    end = time.time() + timeout
    while time.time() < end and len(seen) < want:
        for f in pathlib.Path(folder).rglob("*"):
            if f.is_file() and not f.name.endswith(".crdownload") and f.stat().st_mtime * 1000 >= t0 - 5 and f.name not in seen:
                seen[f.name] = int(time.time() * 1000) - t0
        await asyncio.sleep(0.03)
    toasts = await page.evaluate("() => window.__toasts")
    return {"feedback_ms": (toasts[0] - t0) if toasts else None, "files_seen_ms": seen}
