"""Small inline-SVG charts. Colours come from CSS custom properties, so light and dark themes both work."""
import html
import math

W, H, PAD = 560, 230, 52


def esc(s):
    return html.escape(str(s), quote=True)


def _scale(v, lo, hi, a, b):
    if hi <= lo:
        return (a + b) / 2
    return a + (v - lo) * (b - a) / (hi - lo)


def _ticks(lo, hi, n=4):
    if hi <= lo:
        return [lo]
    return [lo + i * (hi - lo) / n for i in range(n + 1)]


def _fmt(lo, hi):
    span = abs(hi - lo) or 1.0
    nd = int(max(0, min(4, 2 - math.floor(math.log10(span)))))
    return "{:.%df}" % nd


def axes(xlo, xhi, ylo, yhi, xlabel, ylabel):
    out = [f'<line x1="{PAD}" y1="{H - PAD}" x2="{W - 24}" y2="{H - PAD}" class="ax"/>',
           f'<line x1="{PAD}" y1="10" x2="{PAD}" y2="{H - PAD}" class="ax"/>']
    fx, fy = _fmt(xlo, xhi), _fmt(ylo, yhi)
    for t in _ticks(xlo, xhi):
        x = _scale(t, xlo, xhi, PAD, W - 24)
        out.append(f'<text x="{x:.1f}" y="{H - PAD + 14}" class="tk" text-anchor="middle">{fx.format(t)}</text>')
    for t in _ticks(ylo, yhi):
        y = _scale(t, ylo, yhi, H - PAD, 10)
        out.append(f'<text x="{PAD - 4}" y="{y + 3:.1f}" class="tk" text-anchor="end">{fy.format(t)}</text>')
    out.append(f'<text x="{(W + PAD) / 2}" y="{H - 6}" class="lb" text-anchor="middle">{esc(xlabel)}</text>')
    out.append(f'<text x="10" y="{(H - PAD) / 2}" class="lb" text-anchor="middle" '
               f'transform="rotate(-90 10 {(H - PAD) / 2})">{esc(ylabel)}</text>')
    return out


def frame(parts, title):
    return (f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="{esc(title)}" class="chart">'
            f'<title>{esc(title)}</title>{"".join(parts)}</svg>')


def _bounds(vals, pad=0.05):
    v = [x for x in vals if x is not None and math.isfinite(x)]
    if not v:
        return 0.0, 1.0
    lo, hi = min(v), max(v)
    d = (hi - lo) or 1.0
    return lo - pad * d, hi + pad * d


def lines(series, xlabel, ylabel, title):
    """series: [{"x": [...], "y": [...], "cls": "s1", "label": str}]"""
    xlo, xhi = _bounds([x for s in series for x in s["x"]], 0)
    ylo, yhi = _bounds([y for s in series for y in s["y"]])
    parts = axes(xlo, xhi, ylo, yhi, xlabel, ylabel)
    for s in series:
        pts = " ".join(f'{_scale(x, xlo, xhi, PAD, W - 24):.1f},{_scale(y, ylo, yhi, H - PAD, 10):.1f}'
                       for x, y in zip(s["x"], s["y"]) if math.isfinite(y))
        parts.append(f'<polyline points="{pts}" class="ln {s.get("cls", "s1")}"><title>{esc(s.get("label", ""))}'
                     f'</title></polyline>')
    return frame(parts, title)


def scatter(points, xlabel, ylabel, title):
    """points: [{"x", "y", "cls", "r", "label"}]"""
    xlo, xhi = _bounds([p["x"] for p in points])
    ylo, yhi = _bounds([p["y"] for p in points])
    parts = axes(xlo, xhi, ylo, yhi, xlabel, ylabel)
    for p in points:
        if not (math.isfinite(p["x"]) and math.isfinite(p["y"])):
            continue
        cx, cy = _scale(p["x"], xlo, xhi, PAD, W - 24), _scale(p["y"], ylo, yhi, H - PAD, 10)
        parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{p.get("r", 2.5)}" class="pt {p.get("cls", "")}">'
                     f'<title>{esc(p.get("label", ""))}</title></circle>')
        if p.get("tag"):
            parts.append(f'<text x="{cx + 6:.1f}" y="{cy - 4:.1f}" class="tg">{esc(p["tag"])}</text>')
    return frame(parts, title)


def bars(rows, title, lo=None, hi=None, w=260, h=None):
    """Horizontal bars: rows [(label, value)]; negative values extend left of zero."""
    h = h or 16 * len(rows) + 8
    vals = [v for _, v in rows]
    lo = min(0.0, min(vals)) if lo is None else lo
    hi = max(0.0, max(vals)) if hi is None else hi
    left, right = 120, w - 44
    z = _scale(0, lo, hi, left, right)
    parts = [f'<line x1="{z:.1f}" y1="2" x2="{z:.1f}" y2="{h - 4}" class="ax"/>']
    for i, (lab, v) in enumerate(rows):
        y = 6 + 16 * i
        x = _scale(v, lo, hi, left, right)
        a, b = min(x, z), abs(x - z)
        cls = "bp" if v >= 0 else "bn"
        parts.append(f'<text x="{left - 4}" y="{y + 9}" class="tk" text-anchor="end">{esc(str(lab)[:18])}</text>'
                     f'<rect x="{a:.1f}" y="{y}" width="{max(b, 0.5):.1f}" height="11" class="{cls}"/>'
                     f'<text x="{max(x, z) + 3:.1f}" y="{y + 9}" class="tk">{v:.2f}</text>')
    return (f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="{esc(title)}" class="mini">'
            f'<title>{esc(title)}</title>{"".join(parts)}</svg>')


def spark(y, title, w=200, h=36):
    v = [x for x in y if math.isfinite(x)]
    if len(v) < 2:
        return ""
    lo, hi = min(v), max(v)
    step = max(1, len(y) // 400)
    yy = y[::step]
    pts = " ".join(f'{_scale(i, 0, len(yy) - 1, 2, w - 2):.1f},{_scale(t, lo, hi, h - 2, 2):.1f}'
                   for i, t in enumerate(yy))
    return (f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="{esc(title)}" class="spark">'
            f'<title>{esc(title)}</title><polyline points="{pts}" class="ln s1"/></svg>')
