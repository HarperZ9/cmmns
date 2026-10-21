"""Draw Radar's icons: the aperture, a luminous orb inside fine concentric line-work on an ink disk.

Writes the SVG sources to assets/icons/ and PNG renders at 16, 32, 48 and 128 px to src/ext/icons/,
for three toolbar states: idle, reading (one warm mark on the outer ring) and paused (the orb
closed to a thin ring). Small sizes drop the finest rings so the form survives at 16 px.

    python scripts/render-icons.py

Needs Python Playwright with Chromium (development only; the extension ships the PNGs).
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SVG_DIR, PNG_DIR = ROOT / "assets" / "icons", ROOT / "src" / "ext" / "icons"
SIZES = (16, 32, 48, 128)
INK, LINE, HOT, PAUSED_GROUND = "#0f1419", "#e7e9ea", "#fb923c", "#3a4148"


def rings(detail: bool, opacity: float) -> str:
    radii = (24, 33, 42, 51) if detail else (36, 50)
    width = 1.6 if detail else 4.5
    return "".join(
        f'<circle cx="64" cy="64" r="{r}" fill="none" stroke="{LINE}" stroke-opacity="{opacity * (0.55 + 0.1 * i):.2f}" stroke-width="{width}"/>'
        for i, r in enumerate(radii)
    )


def blades(detail: bool) -> str:
    """Six short tangent strokes between the rings: the aperture's blades, seen edge on."""
    if not detail:
        return ""
    out = []
    for i in range(6):
        out.append(f'<line x1="64" y1="18" x2="80" y2="27" stroke="{LINE}" stroke-opacity="0.35" stroke-width="1.4" stroke-linecap="round" transform="rotate({i * 60} 64 64)"/>')
    return "".join(out)


def svg(state: str, detail: bool) -> str:
    ground = PAUSED_GROUND if state == "paused" else INK
    defs = (
        '<defs><radialGradient id="orb" cx="0.5" cy="0.46" r="0.5">'
        '<stop offset="0" stop-color="#fffdf7"/><stop offset="0.45" stop-color="#f1ede4"/>'
        '<stop offset="0.8" stop-color="#cfd6dc" stop-opacity="0.55"/><stop offset="1" stop-color="#cfd6dc" stop-opacity="0"/>'
        "</radialGradient></defs>"
    )
    if state == "paused":
        core = f'<circle cx="64" cy="64" r="{16 if detail else 20}" fill="none" stroke="{LINE}" stroke-opacity="0.9" stroke-width="{3 if detail else 9}"/>'
        art = rings(detail, 0.45) + core
    else:
        core = f'<circle cx="64" cy="64" r="{30 if detail else 34}" fill="url(#orb)"/><circle cx="64" cy="64" r="{11 if detail else 14}" fill="#fffdf7"/>'
        art = rings(detail, 0.8) + blades(detail) + core
    mark = ""
    if state == "reading":
        r = 51 if detail else 50
        mark = f'<circle cx="{64 + r * 0.7071:.1f}" cy="{64 - r * 0.7071:.1f}" r="{10 if detail else 21}" fill="{HOT}" stroke="{ground}" stroke-width="{3 if detail else 5}"/>'
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">'
        f"{defs}<circle cx=\"64\" cy=\"64\" r=\"60\" fill=\"{ground}\" stroke=\"#8b98a5\" stroke-opacity=\"0.5\" stroke-width=\"{2 if detail else 4}\"/>{art}{mark}</svg>"
    )


def main() -> None:
    SVG_DIR.mkdir(parents=True, exist_ok=True)
    PNG_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        for state in ("idle", "reading", "paused"):
            suffix = "" if state == "idle" else f"-{state}"
            for detail in (True, False):
                (SVG_DIR / f"radar{suffix}{'' if detail else '-small'}.svg").write_text(svg(state, detail), encoding="utf-8", newline="\n")
            for n in SIZES:
                markup = svg(state, n >= 48).replace('width="128" height="128"', f'width="{n}" height="{n}"')
                page.set_viewport_size({"width": n, "height": n})
                page.set_content(f'<html><body style="margin:0;background:transparent">{markup}</body></html>')
                page.locator("svg").screenshot(path=str(PNG_DIR / f"radar{suffix}-{n}.png"), omit_background=True)
        browser.close()


if __name__ == "__main__":
    main()
