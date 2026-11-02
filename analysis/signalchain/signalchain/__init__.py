"""signalchain: one measurement API for signal moving through transforms.

    measure(x, medium)          spectrum, entropy, SNR, envelope, resonance, decay of one signal
    through(x, y)               gain and loss of a transform y = T(x), both in hand

medium is "image" (2D or HxWxC array, 0..255), "audio" (1D array, fs in samples), "series"
(1D array: a mood log, a per-frame measure) or "text" (a string). Definitions live in each
module's docstring and in README.md; every value returned here passed the recovery gate
in tests/test_recovery.py. Requires numpy; stdlib otherwise.
"""
import re

import numpy as np

from . import entropy as _E
from . import envelope as _V
from . import gainloss as _G
from . import resdecay as _R
from . import snr as _S
from . import spectrum as _P

__all__ = ["measure", "through"]


def _adsr(fit):
    return {k: round(fit[k], 4) for k in ("attack", "decay", "sustain", "release")}


def _image(x):
    g = np.asarray(x, dtype=np.float64)
    gy = g if g.ndim == 2 else _V.gray(g)
    rows = np.mean([_P.welch(r, min(512, r.size))[1] for r in gy[:: max(1, gy.shape[0] // 64)]],
                   axis=0)
    f = np.fft.rfftfreq(min(512, gy.shape[1]))
    sym = _E.image_symbols(gy)
    return {"spectrum_slope": _P.image_slope(gy), **_E.entropy_report(sym),
            "snr_db": _S.snr_blind_image(gy), "envelope_radial": _adsr(_V.fit_adsr(_V.radial_profile(gy))),
            "resonance_rows": _R.fit_resonance(f, rows),
            "decay_rows_px": float(np.nanmedian([_R.decay_time(r) for r in gy[:: max(1, gy.shape[0] // 32)]]))}


def _series(x, audio):
    x = np.asarray(x, dtype=np.float64).ravel()
    seg = 4096 if x.size >= 4 * 4096 else max(16, x.size // 4)
    out = {"spectrum_slope": _P.series_slope(x, seg), "peak_frequency": _P.peak_frequency(x, nperseg=seg),
           **_E.entropy_report(_E.series_symbols(x)), "snr_db": _S.snr_blind_1d(x, seg),
           "resonance": _R.fit_resonance(*_P.welch(x, seg)), "decay_samples": _R.decay_time(x)}
    env = _V.audio_envelope(x, max(1, x.size // 200)) if audio else x
    out["envelope"] = _adsr(_V.fit_adsr(env))
    if audio:
        out["reverb"] = _R.reverb_size(x)
    return out


def _text(s):
    toks = re.findall(r"[a-z0-9']+", s.lower())
    lens = _V.sentence_lengths(s)
    # Word entropy only: the order-1 conditional estimate needs N >> vocab^2 and lzma on word
    # ids failed recovery (README.md, Limits), so neither is reported for text. Shannon on words
    # is within 0.07 bits from 20000 tokens up; 'in_regime' says whether this text is there.
    out = {"tokens": len(toks), "vocab": len(set(toks)), "in_regime": len(toks) >= 20000,
           "zipf_exponent": _P.zipf_exponent(toks, min_count=3), "shannon_bits": _E.shannon(toks),
           "sentences": int(lens.size)}
    if lens.size >= 20:
        out["envelope_sentences"] = _adsr(_V.fit_adsr(lens))
        out["decay_sentences"] = _R.decay_time(lens)
    return out


def measure(x, medium):
    if medium == "image":
        return _image(x)
    if medium in ("audio", "series"):
        return _series(x, medium == "audio")
    if medium == "text":
        return _text(x)
    raise ValueError(f"unknown medium {medium!r}; use image, audio, series or text")


def through(x, y):
    return {"gain_db": _G.gain_db(x, y), "coherent_gain": _G.coherent_gain(x, y),
            "loss_nmse": _G.nmse(x, y), "loss_bits": _G.mi_loss_bits(x, y)}
