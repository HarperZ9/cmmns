"""Self-contained HTML report: data, style and script inline, no external host.

The page reads nothing at load time; every number is written in from the run's report.json (the dict r,
produced by run.py), whose keys this module reads: n, d, ordered, seconds, config, valid, controls, k,
k_found, lenses, survivors, n_survivors, order, external_check. The look comes from the workshop's site
kit (kit.css and kit.js, inlined by its inline.py). The kit is not part of this repository; set
LATENT_SITE_KIT to a folder that holds it. Without it the page is written with its own minimal style only.
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
from scipy import signal

from . import svg
from .svg import esc

KIT = Path(os.environ.get("LATENT_SITE_KIT", "__absent__"))

# Tokens for a page written without the site kit, light and dark, so the report stays readable alone.
# When the kit is inlined its own tokens come later in the page and take over.
FALLBACK = """
:root{--wall:#f4f2ec;--mat:#fbfaf6;--soft:#5d5a52;--line:#d8d4c8;--ink:#1d1c19;--tide-2:#2f5f8a;--s1:#c9c4b4;--s2:#7d8a99;
--s3:#a7b3bf;--s4:#4b5866;--verified:#1f6b3a;--drift:#9a2a1f;--unverifiable:#6b5d1f;--red:#9a2a1f;
--face-still:system-ui,sans-serif;--face-utility:ui-monospace,monospace;--fs-2:0.9rem;--sp-2:0.5rem;--sp-3:1rem;--sp-4:1.5rem}
body{font-family:var(--face-still);margin:0;padding:var(--sp-3)}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--wall:#151513;--mat:#1d1d1a;--soft:#a9a597;--line:#3a3934;
--ink:#ecebe6;--tide-2:#8fb6d9;--verified:#7fcf98;--drift:#f08a7e;--unverifiable:#d9c77f;--red:#f08a7e}}
:root[data-theme="dark"]{--wall:#151513;--mat:#1d1d1a;--soft:#a9a597;--line:#3a3934;--ink:#ecebe6;--tide-2:#8fb6d9;
--verified:#7fcf98;--drift:#f08a7e;--unverifiable:#d9c77f;--red:#f08a7e}
"""

CSS = """
:root{--ground:var(--wall);--panel:var(--mat);--muted:var(--soft);--rule:var(--line);--white:var(--soft);--blue:var(--tide-2);
--bar:var(--s2);--barn:var(--s1);--pass:var(--verified);--fail:var(--drift);--untest:var(--unverifiable)}
body{background:var(--ground);color:var(--ink)}
.k-page{max-width:1120px}
p{max-width:72ch}.m{color:var(--muted)}.num,td{font-family:var(--face-utility);font-size:var(--fs-2)}
.panel{background:var(--panel);box-shadow:0 0 0 1px var(--rule);padding:var(--sp-3);margin:var(--sp-3) 0}
.panel h3{margin-top:0}.verdict-box{box-shadow:0 0 0 1px var(--rule),inset 3px 0 0 var(--ink)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:var(--sp-3)}
table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}
th,td{white-space:nowrap}
.pass{color:var(--pass);font-weight:700}.fail{color:var(--fail);font-weight:700}.untest{color:var(--untest)}
.chart{width:100%;max-width:560px;height:auto}.mini{width:260px;height:auto}.spark{width:200px;height:36px}
.ax{stroke:var(--muted);stroke-width:1}.tk{fill:var(--muted);font:10px var(--face-utility)}
.lb{fill:var(--muted);font:11px var(--face-still)}.tg{fill:var(--ink);font:10px var(--face-utility)}
.ln{fill:none;stroke-width:1.6}.s1{stroke:var(--s1)}.s2{stroke:var(--s2)}.s3{stroke:var(--s3)}.s4{stroke:var(--s4)}
.sq{stroke:var(--muted);stroke-dasharray:3 3}
.pt{fill:var(--white);opacity:.55}.pt.red{fill:var(--red)}.pt.blue{fill:var(--blue)}
.pt.lat{opacity:1;stroke:var(--ink);stroke-width:1}.bp{fill:var(--bar)}.bn{fill:var(--barn)}
.toy{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:var(--sp-4);align-items:start}
#lt-field{width:100%;aspect-ratio:1;display:block;cursor:crosshair;touch-action:none;background:var(--mat)}
.toy fieldset > div{display:flex;flex-wrap:wrap;gap:6px}
.toy .near{font:400 var(--fs-2)/1.5 var(--face-utility);margin:var(--sp-2) 0}
#lt-build{width:100%;height:auto;display:block}
#lt-build text{fill:var(--soft);font:14px var(--face-still)}#lt-build .zero{stroke:var(--line)}
#lt-build .up{fill:var(--s2)}#lt-build .dn{fill:var(--s1)}
@media (max-width:860px){.toy{grid-template-columns:minmax(0,1fr)}}
"""


def _v(ok):
    return '<span data-verdict="pass">PASS</span>' if ok else '<span data-verdict="fail">FAIL</span>'


def _f(x, nd=3):
    try:
        return f"{float(x):.{nd}f}"
    except (TypeError, ValueError):
        return "n/a"


def _head(r, title):
    c = r.get("controls")
    valid = ("<span data-verdict='open'>controls not run</span>" if c is None else
             ("<span data-verdict='pass'>VALID</span>" if r["valid"] else "<span data-verdict='fail'>INVALID</span>"))
    surv = ", ".join(f"{s['lens']}#{s['index']}" for s in r["survivors"]) or "none"
    return (f"<header class='k-head'><h1>{esc(title)}</h1><p class='k-lede'>{r['n']} rows by {r['d']} variables, "
            f"{'ordered as a time series' if r['ordered'] else 'unordered'}.</p><p class='k-meta'>Seed "
            f"{r['config']['seed']}; {r['seconds']} s.</p><hr class='k-horizon'></header>", (
            f"<div class='panel verdict-box'><b>Run validity:</b> {valid}. "
            f"<b>Latents counted (linear lenses):</b> <span class='num'>{r['k_found']}</span>. "
            f"<b>Survivors:</b> <span class='num'>{esc(surv)}</span></div>"))


def _k(r):
    k = r["k"]
    ks = sorted(int(x) for x in k["cv_loglik"])
    pa = svg.lines([{"x": list(range(1, len(k["pa_eig"]) + 1)), "y": k["pa_eig"], "cls": "s1", "label": "eigenvalue"},
                    {"x": list(range(1, len(k["pa_q95"]) + 1)), "y": k["pa_q95"], "cls": "sq", "label": "null q95"}],
                   "rank", "eigenvalue", "Parallel analysis: eigenvalues against the null q95")
    cv = svg.lines([{"x": ks, "y": [k["cv_loglik"][str(x)] for x in ks], "cls": "s2", "label": "held-out log-lik"}],
                   "k", "held-out PPCA log-likelihood per row", "Held-out PPCA curve")
    tl = k["two_lines"]
    return (f"<h2>Take apart: how many latents</h2><div class='grid'><div class='panel'>{pa}<p class='m'>"
            f"Parallel analysis ({k['pa_null']} null): k = <span class='num'>{k['k_pa']}</span>. Solid line: "
            f"eigenvalues; dashed: null q95.</p></div><div class='panel'>{cv}<p class='m'>Held-out PPCA argmax k = "
            f"<span class='num'>{k['k_cv_argmax']}</span>. Two-lines test: {esc(tl.get('direction', tl.get('why', 'n/a')))}, "
            f"interior optimum {'confirmed' if k['cv_interior_optimum'] else 'not confirmed'}; CV count used "
            f"<span class='num'>{k['k_cv']}</span>. Fitted k = <span class='num'>{k['k_fit']}</span> "
            f"(cap {k['k_max']}).</p></div></div>")


def _latent_rows(r, a):
    L = r["lenses"][a]
    out = []
    for x in L["latents"]:
        bp, ix = x["best_partner"], x["index"]
        pr = x["partners"].get(bp, {}) if bp else {}
        top = [(t["variable"], t["weight"]) for t in x["loadings"]["top"][:6]]
        sc = [row[ix] for row in L["scores"]]
        out.append(f"<tr><td>{a}#{x['index']}</td><td>{_f(x['p_found'])}</td><td>{_f(x['q_found'])}</td>"
                   f"<td>{_f(x['gain_over_shuffle'], 4)}</td><td>{esc(bp or 'none')}</td><td>{_f(pr.get('r2_ridge'))}</td>"
                   f"<td>{_f(pr.get('r2_knn'))}</td><td>{_f(pr.get('shuffle_q95'))}</td>"
                   f"<td>{'yes' if x['decoder_dependent'] else 'no'}</td><td>{_v(x['survives'])}</td>"
                   f"<td>{svg.bars(top, a + ' ' + str(ix) + ' loadings')}</td>"
                   f"<td>{svg.spark(sc, a + ' ' + str(ix) + ' scores')}</td></tr>")
    return "".join(out)


def _latents(r):
    head = ("<tr><th>latent</th><th>found p</th><th>BH q</th><th>held-out R² gain over shuffled latent</th>"
            "<th>best other lens</th><th>ridge R²</th><th>kNN R²</th><th>shuffle q95</th><th>decoder-dependent</th>"
            "<th>survives</th><th>top loadings</th><th>scores along rows</th></tr>")
    body = "".join(_latent_rows(r, a) for a in r["lenses"])
    rec = "".join(f"<tr><td>{a}</td><td>{_f(L['r2_heldout_all'])}</td><td>{_f(L['r2_heldout_kept'])}</td>"
                  f"<td>{r['n_survivors'][a]}</td></tr>" for a, L in r["lenses"].items())
    return (f"<h2>The latents and the lens check</h2><p class='m'>Found: the held-out prediction of hidden columns "
            f"gets worse when this latent's scores are shuffled (p over {r['config']['n_perm']} shuffles, BH across "
            f"every latent of every lens at q {r['config']['q']}). Lens-stable: another lens's found latents predict "
            f"its scores out of sample, ridge R² at least {r['config']['r2_min']} and above the row-shuffle q95. "
            f"Survives: both.</p><table>{head}{body}</table><h2>Put back together</h2><table><tr><th>lens</th>"
            f"<th>held-out R², all fitted latents</th><th>held-out R², survivors only</th><th>survivors</th></tr>{rec}"
            f"</table>")


def _psd(y):
    y = np.asarray(y, float)
    nper = int(min(len(y), max(64, 2 ** int(np.log2(len(y) / 4)))))
    f, p = signal.welch(y, nperseg=nper, detrend="linear")
    keep = (f > 0) & (p > 0)
    return np.log10(f[keep]).tolist(), np.log10(p[keep]).tolist()


def _spectra(r):
    if not r["ordered"]:
        return ""
    series, cls = [], ["s1", "s2", "s3", "s4"]
    for i, s in enumerate(r["survivors"][:8]):
        y = [row[s["index"]] for row in r["lenses"][s["lens"]]["scores"]]
        fx, py = _psd(y)
        series.append({"x": fx, "y": py, "cls": cls[i % 4], "label": f"{s['lens']}#{s['index']}"})
    if not series:
        return "<h2>Spectra</h2><p>No latent survived, so no latent spectrum is drawn.</p>"
    rows = {(o["lens"], o["index"]): o for o in r["order"]["latents"]}
    leg = "".join(f"<tr><td><svg width='22' height='8' aria-hidden='true'><line x1='0' y1='4' x2='22' y2='4' "
                  f"class='ln {s['cls']}'/></svg> {esc(s['label'])}</td>"
                  f"<td>{_f(rows[(s['label'].split('#')[0], int(s['label'].split('#')[1]))]['beta'])}</td></tr>"
                  for s in series)
    return (f"<h2>Spectra of the surviving latents</h2><div class='panel'>"
            f"{svg.lines(series, 'log10 frequency (cycles per row)', 'log10 Welch power', 'Latent spectra')}"
            f"<p class='m'>The first eight survivors; colours repeat after four.</p><table><tr><th>latent</th><th>beta, welch_beta (F74)</th></tr>{leg}</table></div>")


def _order(r):
    o = r["order"]
    if not o["ordered"]:
        rows = "".join(f"<tr><td>{x['lens']}#{x['index']}</td><td>{_f(x['excess_kurtosis'])}</td>"
                       f"<td>{_f(x['gauss_q95'])}</td><td>{_f(x['p_heavy'])}</td></tr>" for x in o["latents"])
        return (f"<h2>Order and disorder</h2><p>{esc(o['note'])}.</p><table><tr><th>latent</th>"
                f"<th>excess kurtosis</th><th>Gaussian q95</th><th>p heavy tails</th></tr>{rows}</table>")
    pts = [{"x": v["beta"], "y": v["ceiling"], "cls": v["colour"], "label": f"{v['variable']}: {v['colour']}"}
           for v in o["variables"]]
    surv = {(x["lens"], x["index"]) for x in r["survivors"]}
    lat = [v for v in o["latents"] if (v["lens"], v["index"]) in surv]
    pts += [{"x": v["beta"], "y": v["ceiling"], "cls": v["colour"] + " lat", "r": 4.5,
             "label": f"{v['lens']}#{v['index']}: {v['colour']}",
             "tag": f"{v['lens']}#{v['index']}" if i < 6 else None}
            for i, v in enumerate(lat)]
    cnt = {c: sum(v["colour"] == c for v in o["variables"]) for c in ("red", "white", "blue")}
    nl = sum(v["nonlinear_order"] for v in o["variables"])
    rows = "".join(f"<tr><td>{v['lens']}#{v['index']}</td><td>{'yes' if (v['lens'], v['index']) in surv else 'no'}</td>"
                   f"<td>{_f(v['beta'])}</td><td>{_f(v['beta_shuffle_q95'])}</td>"
                   f"<td>{_f(v['ceiling'])}</td><td>{_f(v['ceiling_shuffle_q95'])}</td><td>{_f(v['diff_ratio'])}</td>"
                   f"<td>{_f(v['diff_ratio_phase_q05'])}</td><td>{v['colour']}</td>"
                   f"<td>{'yes' if v['nonlinear_order'] else 'no'}</td></tr>" for v in o["latents"])
    return (f"<h2>Order and disorder map</h2><div class='panel'>"
            f"{svg.scatter(pts, 'spectral exponent beta (F74)', 'predictability ceiling, 1 - flatness (F76)', 'Order map')}"
            f"<p class='m'>Small dots: original variables; ringed dots: surviving latents (the first six named). Colour: red when beta and the ceiling "
            f"both sit above their shuffled surrogates (BH), blue when beta sits below, white otherwise. Variables: "
            f"red {cnt['red']}, white {cnt['white']}, blue {cnt['blue']}; nonlinear order beyond the spectrum (difference "
            f"compression below the phase surrogates' q05, BH): {nl} of {len(o['variables'])}.</p></div>"
            f"<table><tr><th>latent</th><th>survives</th><th>beta</th><th>shuffle q95</th><th>ceiling</th><th>shuffle q95</th>"
            f"<th>difference compression ratio (F61)</th><th>phase q05</th><th>colour</th><th>nonlinear order</th></tr>"
            f"{rows}</table>")


def _controls(r):
    c = r.get("controls")
    if c is None:
        return "<h2>Controls</h2><p><span data-verdict='fail'>Controls were not run; this run is not a result.</span></p>"
    p, n = c["positive"], c["negative"]
    r2 = ", ".join(_f(x) for x in p["recovery"]["r2"])
    return (f"<h2>Controls</h2><div class='grid'><div class='panel'><h3>Planted structure {_v(p['pass'])}</h3>"
            f"<p>{p['k_planted']} latents planted at this size, noise share <span class='num'>{_f(p['noise_share'])}</span>"
            f"{', noise lag-1 ' + _f(p['noise_phi']) if r['ordered'] else ''}. Counted <span class='num'>{p['k_found']}</span>. "
            f"Recovery R² per planted latent: <span class='num'>{r2}</span> (threshold {p['recovery']['threshold']}); "
            f"recovery rate <span class='num'>{_f(p['recovery']['rate'], 2)}</span>, pass at 0.80.</p></div>"
            f"<div class='panel'><h3>Pure noise {_v(n['pass'])}</h3><p>The data with each column scrambled on its own "
            f"({esc(n['scramble'])}). Survivors per lens: <span class='num'>"
            f"{esc(', '.join(f'{a} {v}' for a, v in n['n_survivors'].items()) or 'none fitted')}</span>; pass only at "
            f"zero.</p></div></div>")


LIMITS = ("A latent that survives these controls is a stable pattern in these data, not a cause. Naming what it "
          "means is a separate step that needs domain evidence. PCA and ICA span the same subspace, so they never "
          "confirm each other; stability needs the autoencoder or NMF. Held-out prediction "
          "is linear through each lens's decoder. Spectra need ordered rows and say nothing below a series' length.")


def _external(r):
    x = r.get("external_check")
    if not x:
        return ""
    key = next((k for k in ("r", "eta2", "dev") if x["rows"] and k in x["rows"][0]), None)
    top = sorted(x["rows"], key=lambda row: -abs(row[key]))[:8] if key else []
    rows = "".join(f"<tr><td>{esc(t['latent'])}</td><td>{_f(t[key])}</td></tr>" for t in top)
    return (f"<h2>External check</h2><p>A label the instrument never saw, tested on every survivor: maximum "
            f"<span class='num'>{_f(x['max_abs'])}</span> against a null q95 of <span class='num'>"
            f"{_f(x.get('null_q95'))}</span> built the same way (maximum over the same survivors), p "
            f"<span class='num'>{_f(x['p'])}</span>.</p><table><tr><th>latent</th><th>{esc(key or '')}</th></tr>"
            f"{rows}</table>")


TOY_ROWS = 400  # the toy carries at most this many rows, taken at an even stride, so the page stays small


def _toy_data(r):
    """Two latents of one lens, their scores for a stride of rows, and their top loadings: all from report.json."""
    surv = r["survivors"]
    lens = next((a for a in r["lenses"] if sum(s["lens"] == a for s in surv) >= 2), next(iter(r["lenses"])))
    pick = [s["index"] for s in surv if s["lens"] == lens][:2]
    lat = {x["index"]: x for x in r["lenses"][lens]["latents"]}
    for i in sorted(lat):
        if len(pick) == 2:
            break
        if i not in pick:
            pick.append(i)
    scores = r["lenses"][lens]["scores"]
    step = max(1, -(-len(scores) // TOY_ROWS))
    rows = [[i, round(scores[i][pick[0]], 4), round(scores[i][pick[1]], 4)] for i in range(0, len(scores), step)]
    load = [[[t["variable"], round(t["weight"], 4)] for t in lat[j]["loadings"]["top"]] for j in pick]
    return {"lens": lens, "latents": pick, "survives": [any(s["lens"] == lens and s["index"] == j for s in surv) for j in pick],
            "rows": rows, "n": len(scores), "loadings": load}


TOY_JS = r"""
(()=>{const T=JSON.parse(document.getElementById('lt-data').textContent),cv=document.getElementById('lt-field'),g=cv.getContext('2d');
const W=cv.width,PAD=36,NEAR=5,on=[true,true];let probe=[0,0];
const far=T.rows.reduce((b,r)=>Math.hypot(r[1],r[2])>Math.hypot(b[1],b[2])?r:b,T.rows[0]),start=()=>[far[1]*0.6,far[2]*0.6];probe=start();
const xs=T.rows.map(r=>r[1]),ys=T.rows.map(r=>r[2]),span=a=>{const m=Math.max(...a.map(Math.abs))||1;return m*1.1};
const sx=span(xs),sy=span(ys),X=v=>W/2+(W/2-PAD)*v/sx,Y=v=>W/2-(W/2-PAD)*v/sy,iX=p=>(p-W/2)/(W/2-PAD)*sx,iY=p=>-(p-W/2)/(W/2-PAD)*sy;
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const pos=r=>[on[0]?r[1]:0,on[1]?r[2]:0];
const pr=()=>[on[0]?probe[0]:0,on[1]?probe[1]:0];
function near(){const p=pr();return T.rows.map(r=>{const q=pos(r);return[Math.hypot((q[0]-p[0])/sx,(q[1]-p[1])/sy),r[0]]}).sort((a,b)=>a[0]-b[0]).slice(0,NEAR).map(d=>d[1]);}
function field(){const ink=css('--ink'),soft=css('--soft'),line=css('--line');g.clearRect(0,0,W,W);
 g.strokeStyle=line;g.lineWidth=1;for(let k=1;k<8;k++){const t=k*W/8;g.beginPath();g.moveTo(t,0);g.lineTo(t,W);g.moveTo(0,t);g.lineTo(W,t);g.stroke();}
 const nr=new Set(near());for(const r of T.rows){const q=pos(r),hit=nr.has(r[0]);g.fillStyle=hit?ink:soft;g.globalAlpha=hit?1:.35;g.beginPath();g.arc(X(q[0]),Y(q[1]),hit?5:2.4,0,7);g.fill();}
 g.globalAlpha=1;const p=pr();g.strokeStyle=css('--red');g.lineWidth=2;g.beginPath();g.moveTo(X(p[0]),0);g.lineTo(X(p[0]),W);g.moveTo(0,Y(p[1]));g.lineTo(W,Y(p[1]));g.stroke();
 g.fillStyle=css('--wall');g.beginPath();g.arc(X(p[0]),Y(p[1]),9,0,7);g.fill();g.stroke();
 cv.setAttribute('aria-label',`Rows of the data as dots, placed by latent ${T.latents[0]} across and latent ${T.latents[1]} up. The cross sits at ${p[0].toFixed(2)}, ${p[1].toFixed(2)}; nearest rows ${[...nr].join(', ')}.`);
 document.getElementById('lt-near').textContent=`Nearest rows: ${[...nr].join(', ')}`;build();}
function build(){const p=pr(),v={};T.loadings.forEach((L,j)=>L.forEach(([n,w])=>{v[n]=(v[n]||0)+p[j]*w}));
 const e=Object.entries(v).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,8),m=Math.max(1e-9,...e.map(x=>Math.abs(x[1]))),RH=26,L0=210,HALF=140,MID=L0+HALF;
 const svg=document.getElementById('lt-build');
 svg.innerHTML=`<line class="zero" x1="${MID}" y1="0" x2="${MID}" y2="${e.length*RH}"/>`+e.map(([n,x],i)=>{const w=Math.abs(x)/m*HALF,x0=x<0?MID-w:MID;
 const t=n.length>26?n.slice(0,25)+'.':n;return `<text x="0" y="${i*RH+18}">${t.replace(/[<&]/g,'')}</text><rect class="${x<0?'dn':'up'}" x="${x0}" y="${i*RH+5}" width="${w}" height="${RH-9}"/>`}).join('');
 svg.setAttribute('viewBox',`0 0 ${MID+HALF} ${Math.max(RH,e.length*RH)}`);}
let drag=false;const at=e=>{const b=cv.getBoundingClientRect();probe=[iX((e.clientX-b.left)/b.width*W),iY((e.clientY-b.top)/b.height*W)];field();};
cv.addEventListener('pointerdown',e=>{drag=true;cv.setPointerCapture(e.pointerId);at(e)});cv.addEventListener('pointermove',e=>{if(drag)at(e)});
cv.addEventListener('pointerup',()=>drag=false);cv.addEventListener('pointercancel',()=>drag=false);
const STEP=0.04,COARSE=0.2;
cv.addEventListener('keydown',e=>{const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[e.key];if(!d)return;e.preventDefault();const k=e.shiftKey?COARSE:STEP;probe=[probe[0]+d[0]*k*sx,probe[1]+d[1]*k*sy];field();});
document.querySelectorAll('[data-axis]').forEach(b=>b.addEventListener('click',()=>{const i=+b.dataset.axis;on[i]=!on[i];b.setAttribute('aria-pressed',on[i]);field();}));
document.getElementById('lt-reset').addEventListener('click',()=>{on[0]=on[1]=true;probe=start();document.querySelectorAll('[data-axis]').forEach(b=>b.setAttribute('aria-pressed','true'));field();});
Kit.on(field);field();})();
"""


def _json(o):
    return json.dumps(o, separators=(",", ":")).replace("</", "<\\/")


def _toy(r):
    t = _toy_data(r)
    a, b = t["latents"]
    lens = esc(t["lens"])
    keep = lambda ok: "kept by every check" if ok else "fitted, not a survivor"  # noqa: E731
    return (f"<section class='k-layer' data-layer='toy' aria-labelledby='h-toy'><div class='k-layer-head'><h2 id='h-toy'>Play</h2>"
            f"<span class='k-depth'>1x</span></div><div class='toy'><figure class='k-frame' style='margin:0'>"
            f"<canvas id='lt-field' width='560' height='560' tabindex='0'></canvas></figure><div class='k-toy'>"
            f"<p>Every dot is one row of the data. Drag the cross, or use the arrow keys on the field.</p>"
            f"<fieldset><legend>Take it apart</legend><div>"
            f"<button type='button' data-axis='0' aria-pressed='true'>{lens} {a} across</button>"
            f"<button type='button' data-axis='1' aria-pressed='true'>{lens} {b} up</button>"
            f"<button type='button' id='lt-reset' class='k-primary'>Put it back</button></div></fieldset>"
            f"<p class='near' id='lt-near' aria-live='polite'></p><h3>What the cross rebuilds</h3>"
            f"<svg id='lt-build' role='img' aria-label='Measured columns rebuilt from the cross position' viewBox='0 0 490 176'></svg>"
            f"<p class='k-meta'>Illustrative: the rebuild uses only the top eight loadings of each latent, not the full decoder. "
            f"{lens} {a} is {keep(t['survives'][0])}; {lens} {b} is {keep(t['survives'][1])}. "
            f"Showing {len(t['rows'])} of {t['n']} rows.</p></div></div>"
            f"<script id='lt-data' type='application/json'>{_json(t)}</script><script>{TOY_JS}</script></section>")


def _message(r):
    # the class is double-quoted because build_map.py in the site kit reads it that way
    fitted = sum(len(L["latents"]) for L in r["lenses"].values())
    return (f"<p class=\"k-message\">These {r['d']} measured columns fold into {r['k_found']} hidden directions; of the "
            f"{fitted} directions {len(r['lenses'])} methods fitted, {len(r['survivors'])} held up under every check.</p>")


PLAIN = ("<section class='k-layer k-plain' data-layer='plain' aria-labelledby='h-plain'><div class='k-layer-head'>"
         "<h2 id='h-plain'>In plain words</h2><span class='k-depth'>10x</span></div>"
         "<p>A table with many columns often moves in only a few ways. Those ways are the hidden directions.</p>"
         "<p>The instrument finds them, then tries to break each one: it shuffles it, asks a different method to "
         "find it again, and plants fake ones to see whether it catches them.</p>"
         "<p>A direction that survives is a steady pattern in this data. It is not yet a cause, and it has no name "
         "until someone who knows the field gives it one.</p></section>")


def page(r, title, out=None):
    """The report page. out is where it will be written, so the kit's font paths resolve from there."""
    head, validity = _head(r, title)
    pro = validity + _k(r) + _latents(r) + _spectra(r) + _order(r) + _controls(r) + _external(r)
    body = (head + _toy(r) + _message(r) + PLAIN
            + "<section class='k-layer' data-layer='pro' aria-labelledby='h-pro'><div class='k-layer-head'>"
              "<h2 id='h-pro'>The working</h2><span class='k-depth'>100x</span></div>" + pro
            + f"<h2>Limits</h2><p>{esc(LIMITS)}</p></section>")
    html = (f"<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' "
            f"content='width=device-width,initial-scale=1'><title>{esc(title)}</title>"
            f"<!-- Latent report. Data contract: the run's report.json beside this page (keys in "
            f"latent/report_html.py); every number here is written in from it. The toy's data, "
            f"script#lt-data, is _toy_data(): two latents of one lens, their scores for a stride of rows and "
            f"their top loadings. -->"
            f"<!-- site-kit:begin --><!-- site-kit:end -->"
            f"<style>{FALLBACK}{CSS}</style></head><body data-region='grid'><main class='k-page'>{body}"
            f"</main></body></html>")
    if (KIT / "inline.py").exists():
        sys.path.insert(0, str(KIT))
        from inline import inline_kit
        html = inline_kit(html, out or Path.cwd() / "report.html")
    return html
