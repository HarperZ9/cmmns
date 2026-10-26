"""The discourse checks on the demo stage's discourse thread (scripts/demo/stage.mjs), in the packaged
extension with the checks switched on: opens the window on the root post and on two replies, records
what each window says and takes screenshots. Development tool only.

    python scripts/qa/discourse_shot.py <stage dir> <package zip> <out dir>
"""
import asyncio
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "demo"))
from playwright.async_api import async_playwright  # noqa: E402
from browser import Session  # noqa: E402
from pressure_shot import open_window, settle  # noqa: E402

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))


async def window_text(pg):
    await pg.evaluate("document.querySelectorAll('.pb-pop details').forEach((d) => (d.open = true))")
    await settle(pg, 600)
    return await pg.evaluate("[...document.querySelectorAll('.pb-pop')].map((e) => e.innerText).join('\\n')")


async def main(stage, package, out):
    out.mkdir(parents=True, exist_ok=True)
    seen = {}
    async with async_playwright() as p:
        s = await Session(p, package, stage, port=9353).start()
        try:
            await s.settings({"auto": False, "onboarded": True, "discourse": True})
            pg = await s.page(1280, 1000)
            await pg.goto(s.stages["discourse"]["url"])
            await settle(pg, 3500)
            for row, name in [(0, "root"), (1, "counts"), (3, "list"), (4, "paraphrase"), (5, "misattributed")]:
                await pg.mouse.move(5, 5)
                await settle(pg, 900)
                await open_window(pg, row)
                await settle(pg, 2500)
                seen[name] = await window_text(pg)
                await pg.screenshot(path=str(out / f"discourse-{name}.png"))

            # Last, since the study save opens its note prompt: save the root post with its analysis.
            await pg.mouse.move(5, 5)
            await settle(pg, 900)
            await open_window(pg, 0)
            await window_text(pg)
            btn = pg.locator(".pb-pop button", has_text="Save the post with this analysis for study").first
            if await btn.count():
                await btn.click()
                await settle(pg, 2500)
                seen["study-toast"] = await pg.evaluate("document.body.innerText.slice(-600)")
                await pg.screenshot(path=str(out / "discourse-study.png"))
        finally:
            await s.close()
    (out / "discourse-windows.json").write_text(json.dumps(seen, indent=1, ensure_ascii=False), encoding="utf-8")
    checks = {
        "persona on the root": "uses the name of Arthur Schopenhauer" in seen.get("root", ""),
        "root quote found in Counsels and Maxims": "Counsels and Maxims" in seen.get("root", ""),
        "paraphrase placed in Long, Book VIII, 36": "Book VIII, section 36" in seen.get("paraphrase", ""),
        "correction reply raised": "bring a source or name an error" in seen.get("root", "") or "brings a source" in seen.get("root", ""),
        "counts with intervals": "95% interval" in seen.get("counts", ""),
        "list of sayings counted": "lines credited to names" in seen.get("list", ""),
        "misattribution named": "misattributed" in seen.get("misattributed", ""),
        "study save offered": "Save the post with this analysis for study" in seen.get("root", ""),
        "study saved": "for study" in seen.get("study-toast", ""),
    }
    for k, v in checks.items():
        print(("pass " if v else "FAIL ") + k)
    (out / "discourse-checks.json").write_text(json.dumps(checks, indent=1), encoding="utf-8")
    return all(checks.values())


if __name__ == "__main__":
    ok = asyncio.run(main(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])))
    sys.exit(0 if ok else 1)
