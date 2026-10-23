"""Store screenshots from the real extension on real public posts (docs/store/README.md). Development
tool only. A fresh, signed-out Chrome profile with the packaged extension opens public posts by
organisations' own accounts, rests the pointer on a reply, and saves a 1280x800 PNG. Before each shot,
every reply author's picture, name and handle are blurred on the page and in Daylight Commons' window,
so no private person is identifiable; the organisation's own account stays readable. Nothing is
clicked on the sites and nothing is posted.

    python scripts/qa/store_shots.py --out docs/store/screenshots [--package dist/radar-chrome-<v>.zip]
"""
import argparse
import asyncio
import json
import pathlib
import sys

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "qa"))
from live_sites import Live  # noqa: E402

VERSION = json.loads((ROOT / "src/ext/manifest.json").read_text(encoding="utf-8"))["version"]
WINDOW = ".pb-pop section.pb-sec h3"
# Daylight Commons' own window names the account it describes; that line and its links are blurred.
OURS = ".pb-g-who, .pb-pop a, .pb-panel a"
# [file, caption, start page, link to follow, post selector, which post, blur CSS, what to show:
#  a window tab name, "panel" for the thread panel, or "link" to rest on a link for its site card]
# Every private person's picture, name and handle; the outlet's own account stays readable.
BSKY_BLUR = 'img[src*="avatar"], [data-testid^="postThreadItem-by-"] a[href^="/profile/"]:not([href^="/profile/apnews.com"]):not([href^="/profile/theguardian.com"])'
AP = "https://bsky.app/profile/apnews.com/post/3mykdskhcba23"          # 352 replies on 2026-10-23
GUARDIAN = "https://bsky.app/profile/theguardian.com/post/3myklzkfj2c2m"  # links theguardian.com directly
SHOTS = [
    ("01-reply-window-bluesky.png", "Rest the pointer on a reply: the words that carry a technique are marked, and the window names it. (Reading lens, with Every reading technique on.)",
     AP, None, '[data-testid^="postThreadItem-by-"]', "Fact check? anyone?", BSKY_BLUR, "Overview"),
    ("02-thread-panel-bluesky.png", "The thread panel: how many accounts it read, and the frames the thread repeats, counted across posts and authors.",
     AP, None, '[data-testid^="postThreadItem-by-"]', 3, BSKY_BLUR, "panel"),
    ("03-site-card-bluesky.png", "Rest the pointer on a link: who owns the site, its owner type and its fact-check record, in the fact-checkers' own words.",
     GUARDIAN, None, 'a[href*="theguardian.com/"]', 0, BSKY_BLUR, "link"),
    ("04-reply-window-mastodon.png", "On any Mastodon server you turn it on for: join dates, coordination and language signs beside each reply.",
     "https://mastodon.social/@Mastodon", 'a.status__relative-time, a[href*="/@Mastodon/1"]', "article", 2,
     ".account__avatar, .status__info, .display-name, .display-name__account, .detailed-status__display-name", "Account"),
    ("05-comment-window-youtube.png", "YouTube comments: when each comment was posted and how it was received, beside the comment, with coordination and language signs when they appear.",
     "https://www.youtube.com/watch?v=aqz-KE-bpKQ", None, "ytd-comment-thread-renderer", 1,
     "#author-thumbnail, #author-text, ytd-comment-view-model #header-author", "This post"),
]


async def hide(pg, selector):
    # Through the element's own style, which a page's style policy cannot refuse.
    # A second pass catches any handle the selectors missed: a short text that starts with "@" and is
    # not one of the organisations whose own posts these are.
    n = await pg.evaluate("""(sel) => { const blur = (e) => e.style.setProperty('filter', 'blur(7px)', 'important');
      const els = document.querySelectorAll(sel); els.forEach(blur);
      const orgs = /^@(Mastodon|apnews\.com|theguardian\.com)\b/i;
      for (const e of document.querySelectorAll('span, a, div')) {
        if (e.children.length) continue;
        const t = (e.textContent || '').trim();
        if (/^@[\w.-]{2,}/.test(t) && t.length < 60 && !orgs.test(t)) blur(e);
      }
      return els.length; }""", selector)
    await pg.wait_for_timeout(150)
    return n


async def shot(s, out, name, caption, start, follow, post_sel, nth, blur, show):
    pg = await s.page(1280, 800)
    r = {"file": name, "caption": caption}
    try:
        await pg.goto(start, wait_until="domcontentloaded", timeout=45000)
        await pg.wait_for_timeout(5000)
        if follow:
            href = await pg.locator(follow).first.get_attribute("href")
            await pg.goto(href if href.startswith("http") else "/".join(pg.url.split("/")[:3]) + href, wait_until="domcontentloaded", timeout=45000)
            await pg.wait_for_timeout(6000)
        r["url"] = pg.url
        posts = pg.locator(post_sel)
        if isinstance(nth, str):   # the post that says these words
            posts, nth = posts.filter(has_text=nth), 0
        for _ in range(8):
            if await posts.count() > nth:
                break
            await pg.mouse.wheel(0, 900)
            await pg.wait_for_timeout(1500)
        post = posts.nth(nth)
        await post.scroll_into_view_if_needed()
        await pg.wait_for_timeout(2500)
        if show == "panel":
            await pg.locator(".pb-panel-head").first.click()
            await pg.wait_for_timeout(2000)
        else:
            text = post.locator('[data-testid="postText"], #content-text, .status__content')
            target = text.first if show != "link" and await text.count() else post
            # On the post's text, clear of the author's name and picture (which open the site's own card).
            at = (lambda b: (b["x"] + 20, b["y"] + min(10, b["height"] / 2))) if target is not post or show == "link" else (lambda b: (b["x"] + b["width"] * 0.45, b["y"] + b["height"] * 0.5))
            for _ in range(6):
                box = await target.bounding_box()
                await pg.mouse.move(*at(box))
                try:
                    await pg.wait_for_selector(WINDOW if show != "link" else ".pb-pop", timeout=2500)
                    break
                except Exception:
                    await pg.mouse.move(5, 5)
                    await pg.wait_for_timeout(800)
            tips = pg.get_by_role("button", name="No more tips")
            if await tips.count():
                await tips.first.click()
                await pg.wait_for_timeout(600)
                await pg.mouse.move(*at(await target.bounding_box()))
                await pg.wait_for_selector(".pb-pop", timeout=4000)
            if show not in ("link", "Overview"):
                tab = pg.locator(".pb-pop .pb-tab", has_text=show)
                if await tab.count():
                    await tab.first.click()
            await pg.wait_for_timeout(1200)
        await hide(pg, blur + ", " + OURS)
        await pg.screenshot(path=str(out / name))
        r["ok"] = True
    except Exception as e:
        r["ok"] = False
        r["error"] = str(e)[:300]
        await pg.screenshot(path=str(out / ("FAILED-" + name)))
    await pg.close()
    return r


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--package", default=str(ROOT / "dist" / f"radar-chrome-{VERSION}.zip"))
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    stage = out / ".stage"
    stage.mkdir(exist_ok=True)
    (stage / "stages.json").write_text("{}", encoding="utf-8")
    results = []
    async with async_playwright() as p:
        s = await Live(p, a.package, stage, grant=["https://mastodon.social/*"], port=9555).start()
        try:
            await s.settings({"onboarded": True, "lensAll": True})
            opt = await s.page()
            await opt.goto(s.url("options.html"))
            await opt.evaluate("chrome.runtime.sendMessage({ type: 'pb-instance-add', host: 'mastodon.social' })")
            await opt.close()
            for spec in SHOTS:
                if a.only and a.only not in spec[0]:
                    continue
                r = await shot(s, out, *spec)
                print(json.dumps(r), flush=True)
                results.append(r)
        finally:
            await s.close()
    (out / "shots.json").write_text(json.dumps(results, indent=1), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
