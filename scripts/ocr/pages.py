"""Synthetic screenshot pages for the held-out test: made-up posts, headlines, documents and
captions, rendered later by Chrome (scripts/ocr/eval.mjs). Every line of text is its own
non-wrapping element with a data-line attribute, so the truth for each line is known exactly.
No real post is used: names, handles and counts are generated; sentences come from the held-out
part of the author's own documents. R&D only.

    python scripts/ocr/pages.py TEXT_DIR OUT_DIR [N]
"""
import html
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fonts import CSS_TEST, CSS_UI  # noqa: E402
from text import Texts, name, handle, count, ui  # noqa: E402

THEMES = [("#ffffff", "#0f1419", "#536471"), ("#000000", "#e7e9ea", "#71767b"), ("#15202b", "#f7f9f9", "#8b98a5"),
          ("#f7f7f2", "#1a1a1a", "#5f5f5f"), ("#ffffff", "#202124", "#5f6368")]


def wrap(r, texts, width_chars, n):
    words = " ".join(texts.sentence(40) for _ in range(n + 2)).split()
    lines, cur = [], []
    for w in words:
        if len(" ".join(cur + [w])) > width_chars and cur:
            lines.append(" ".join(cur)); cur = []
            if len(lines) == n:
                break
        cur.append(w)
    return lines or ["(empty)"]


def line(text, size, colour, weight=400, extra=""):
    return f'<div data-line data-size="{size}" style="white-space:nowrap;font-size:{size}px;color:{colour};font-weight:{weight};{extra}">{html.escape(text)}</div>'


def post(r, t, fg, mut):
    body = wrap(r, t, r.randint(40, 70), r.randint(1, 6))
    head = f'<div style="display:flex;gap:6px;align-items:baseline">{line(name(r), 15, fg, 700)}{line(handle(r) + " · " + str(r.randint(1, 59)) + r.choice("mhd"), 15, mut)}</div>'
    photo = '<div style="height:180px;border-radius:14px;margin:10px 0;background:linear-gradient(135deg,#7a9,#d84 60%,#246)"></div>' if r.random() < 0.4 else ""
    foot = line(ui(r) if r.random() < 0.5 else f"{count(r)} Reposts   {count(r)} Likes", 13, mut)
    size = r.choice([15, 15, 16, 17, 20])
    return f'<div style="display:flex;gap:12px;padding:16px;max-width:600px"><div style="width:48px;height:48px;border-radius:50%;flex:none;background:radial-gradient(#fc8,#a46)"></div><div>{head}{"".join(line(b, size, fg) for b in body)}{photo}{foot}</div></div>'


def headline(r, t, fg, mut):
    title = wrap(r, t, r.randint(28, 45), r.randint(1, 3))
    stand = wrap(r, t, r.randint(60, 80), r.randint(1, 2))
    size = r.choice([28, 32, 36, 42])
    return (f'<div style="padding:24px;max-width:900px">{line(t.sentence(3).upper(), 13, mut, 700, "letter-spacing:1px")}'
            + "".join(line(x, size, fg, 800, "line-height:1.15") for x in title)
            + "".join(line(x, 18, mut) for x in stand) + line(f"By {name(r)} · {ui(r).split(' · ')[0]}", 13, mut) + "</div>")


def document(r, t, fg, mut):
    size = r.choice([14, 15, 16, 18])
    paras = "".join('<div style="margin-bottom:12px">' + "".join(line(x, size, fg, 400, "line-height:1.5") for x in wrap(r, t, r.randint(70, 95), r.randint(2, 5))) + "</div>" for _ in range(r.randint(1, 3)))
    return f'<div style="padding:28px;max-width:1000px">{line(t.sentence(6), size + 8, fg, 700)}{paras}</div>'


def caption(r, t, fg, mut):
    bg = r.choice(["#c0392b", "#1d9bf0", "#2c3e50", "#f1c40f", "#16a085", "#ffffff"])
    ink = "#111" if bg in ("#f1c40f", "#ffffff") else "#fff"
    size = r.choice([22, 26, 30, 36])
    return f'<div style="padding:30px;background:{bg};max-width:800px;text-align:center">' + "".join(line(x, size, ink, 700) for x in wrap(r, t, r.randint(20, 34), r.randint(1, 4))) + "</div>"


KINDS = {"post": post, "headline": headline, "document": document, "caption": caption}


def main(text_dir, out_dir, n=120):
    r = random.Random(2026)
    t = Texts(os.path.join(text_dir, "test.txt"), 2026)
    t.r = r
    os.makedirs(out_dir, exist_ok=True)
    pages = []
    for i in range(int(n)):
        kind = r.choice(list(KINDS))
        split = "unseen-font" if i % 2 == 0 else "ui-font"
        family = r.choice(CSS_TEST if split == "unseen-font" else CSS_UI)
        bg, fg, mut = r.choice(THEMES)
        body = KINDS[kind](r, t, fg, mut)
        doc = f'<!doctype html><meta charset="utf-8"><style>body{{margin:0;background:{bg};font-family:"{family}"}}</style><body>{body}</body>'
        name_ = f"page-{i:03d}.html"
        open(os.path.join(out_dir, name_), "w", encoding="utf-8").write(doc)
        pages.append({"file": name_, "kind": kind, "split": split, "family": family, "scale": r.choice([1, 1, 2]), "jpeg": r.random() < 0.33})
    json.dump(pages, open(os.path.join(out_dir, "pages.json"), "w"), indent=1)
    print(f"{len(pages)} pages in {out_dir}")


if __name__ == "__main__":
    main(*sys.argv[1:])
