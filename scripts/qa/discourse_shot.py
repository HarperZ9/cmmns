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
        s = await Session(p, package, stage, port=9357).start()
        try:
            await s.settings({"auto": False, "onboarded": True, "discourse": True})
            pg = await s.page(1280, 1000)
            await pg.goto(s.stages["discourse"]["url"])
            # the first answer loads and checks the signed data in the worker, which can take seconds
            await settle(pg, 8000)
            for row, name in [(0, "root"), (1, "counts"), (3, "list"), (4, "paraphrase"), (5, "misattributed")]:
                await pg.mouse.move(5, 5)
                await settle(pg, 900)
                await open_window(pg, row)
                await settle(pg, 2500)
                seen[name] = await window_text(pg)
                await pg.screenshot(path=str(out / f"discourse-{name}.png"))

            # The sheets: the root post over the reply that links the Gutenberg text, over that text.
            await pg.mouse.move(5, 5)
            await settle(pg, 900)
            await open_window(pg, 0)
            await window_text(pg)
            sb = pg.locator(".pb-pop button", has_text="Open the post and what lies under it as sheets").first
            if await sb.count():
                async with pg.context.expect_page() as info:
                    await sb.click()
                sp = await info.value
                await sp.wait_for_load_state()
                await settle(sp, 1500)
                await sp.set_viewport_size({"width": 1100, "height": 900})
                seen["sheets"] = await sp.evaluate("document.body.innerText")
                await sp.screenshot(path=str(out / "discourse-sheets.png"))
                lift = sp.locator("button", has_text="Lift to see under it").first
                if await lift.count():
                    await lift.click()
                    await settle(sp, 900)
                    seen["sheets-lifted"] = await sp.evaluate("document.body.innerText")
                    await sp.screenshot(path=str(out / "discourse-sheets-lifted.png"))
                await sp.close()
            # The worked example's shape: the 230,300-view claim over the 627-view correction over the report.
            await pg.goto(s.stages["sheets"]["url"])
            await settle(pg, 3500)
            await open_window(pg, 0)
            seen["k-root"] = await window_text(pg)
            kb = pg.locator(".pb-pop button", has_text="Open the post and what lies under it as sheets").first
            logs = []
            pg.on("console", lambda m: logs.append(m.text))
            if await kb.count():
                async with pg.context.expect_page(timeout=12000) as info:
                    await kb.click()
                sp = await info.value
                await sp.wait_for_load_state()
                await settle(sp, 1500)
                await sp.set_viewport_size({"width": 1100, "height": 1000})
                seen["k-sheets"] = await sp.evaluate("document.body.innerText")
                await sp.screenshot(path=str(out / "discourse-sheets-example.png"))
                await sp.close()
            await pg.goto(s.stages["discourse"]["url"])
            await settle(pg, 3500)
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
        "sheets page drawn": "Under this post" in seen.get("sheets", "") and "depth 1" in seen.get("sheets", ""),
        "a sheet lifts": "sheet lifted" in seen.get("sheets-lifted", ""),
        "example: correction raised over likes": "brings a source or names an error" in seen.get("k-root", ""),
        "example: correction is 0.27% of the claim": "0.27%" in seen.get("k-sheets", ""),
        "example: the report is the ground": "dni.gov" in seen.get("k-sheets", "").split("\nground\n")[-1],
    }
    for k, v in checks.items():
        print(("pass " if v else "FAIL ") + k)
    (out / "discourse-checks.json").write_text(json.dumps(checks, indent=1), encoding="utf-8")
    return all(checks.values())


if __name__ == "__main__":
    ok = asyncio.run(main(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])))
    sys.exit(0 if ok else 1)
