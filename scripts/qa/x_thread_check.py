"""Regression check for the 3.6.0 thread defect, in Chrome with x.com mapped to a local fixture.
Development tool only.

    python scripts/qa/x_thread_check.py <work folder> <source folder>

A profile page draws four unrelated posts by one author: saving the first must give no
"Continued by the author". A status page loads X-shaped post data through the page's own fetch (which
sniff.js reads, as on x.com) with a self-thread of two replies and another account's reply between:
saving the first post must give exactly the two parts, in order, with thread_complete: true.
"""
import asyncio
import json
import os
import pathlib
import subprocess
import sys

os.environ["DC_MAP_X"] = "1"
from playwright.async_api import async_playwright  # noqa: E402

import quick_fixture as fx  # noqa: E402
import quick_save_check as q  # noqa: E402


def article(handle, pid, text, likes):
    return f"""<article style="position:relative;padding:12px;border-bottom:1px solid #ccc"><a href="/{handle}">{handle}</a>
 <a href="/{handle}/status/{pid}"><time datetime="2026-10-2{pid[-1]}T10:00:00.000Z">Oct</time></a><div lang="en">{text}</div>
 <div role="group"><button data-testid="reply" aria-label="2 Replies. Reply">r</button><button data-testid="like" aria-label="{likes} Likes. Like">l</button></div></article>"""


def tweet(pid, handle, text, reply_to=None):
    return {"__typename": "Tweet", "rest_id": pid, "core": {"user_results": {"result": {"legacy": {"screen_name": handle}}}},
            "legacy": {"full_text": text, "created_at": "Fri Oct 24 10:00:00 +0000 2026", "in_reply_to_status_id_str": reply_to, "favorite_count": 12, "reply_count": 2}}


def build(site):
    x = site / "xsite"
    (x / "i" / "api" / "graphql" / "q").mkdir(parents=True, exist_ok=True)
    unrelated = [("100", "Rubik's cube: 1,260 moves back to start."), ("101", "This robot knee throws away 99.7% of its motor's energy."),
                 ("102", "RSA keys from two primes."), ("103", "Buffon's needle gives pi.")]
    (x / "profile.html").write_text("<!doctype html><title>mathverse (@mathverse) / X</title><main>" + "".join(article("mathverse", p, t, "1.2K") for p, t in unrelated) + "</main>", encoding="utf-8")
    status = [article("ana", "200", "1/ How I glaze: thin the slip.", "40"), article("ana", "201", "2/ Fire slow through 573 C.", "9"),
              article("bob", "203", "Nice tiles!", "1"), article("ana", "202", "3/ Cool overnight.", "7")]
    (x / "status.html").write_text("<!doctype html><title>ana on X</title><main>" + "".join(status) + "</main><script>fetch('/i/api/graphql/q/TweetDetail');</script>", encoding="utf-8")
    data = {"data": {"threaded_conversation": [tweet("200", "ana", "1/ How I glaze: thin the slip."), tweet("201", "ana", "2/ Fire slow through 573 C.", "200"),
                                               tweet("203", "bob", "Nice tiles!", "200"), tweet("202", "ana", "3/ Cool overnight.", "201")]}}
    (x / "i" / "api" / "graphql" / "q" / "TweetDetail").write_text(json.dumps(data), encoding="utf-8")


async def save_first(ctx, sw, url, pid):
    page = await ctx.new_page()
    await page.goto(url)
    await asyncio.sleep(3)
    before, read = await q.newest_ids(sw), await q.note_reader(sw, url)
    await page.locator(f'article:has(a[href$="/status/{pid}"]) .dc-dl:not(.dc-study)').click()
    done, note = await q.wait_downloads(sw, before, read, want=1, timeout=30)
    await page.close()
    mds = [pathlib.Path(d["filename"]) for d in done if d["filename"].endswith(".md")]
    return {"note": note, "md": mds[0].read_text(encoding="utf-8") if mds else None}


async def main(work, src):
    work.mkdir(parents=True, exist_ok=True)
    site = fx.build(work, src)
    build(site)
    servers = fx.serve(site, work)
    out = {}
    async with async_playwright() as p:
        proc, browser, ctx, sw, dl = await q.launch(p, work)
        try:
            prof = await save_first(ctx, sw, "https://x.com/mathverse", "100")
            stat = await save_first(ctx, sw, "https://x.com/ana/status/200", "200")
            out["profile_no_continuation"] = bool(prof["md"]) and "Continued by the author" not in prof["md"]
            md = stat["md"] or ""
            out["status_thread_in_order"] = md.find("2/ Fire slow") > 0 and md.find("3/ Cool") > md.find("2/ Fire slow") and "Nice tiles" not in md
            out["status_thread_complete_true"] = "\nthread_complete: true\n" in md
            out["engagement_recorded"] = "engagement:" in md
            out["profile_md"], out["status_md"] = prof["md"], md
        finally:
            (work / "x-thread-check.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
            await browser.close()
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True) if sys.platform == "win32" else proc.terminate()
            for s in servers:
                s.shutdown()
    print(json.dumps({k: v for k, v in out.items() if not k.endswith("_md")}))


if __name__ == "__main__":
    asyncio.run(main(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])))
