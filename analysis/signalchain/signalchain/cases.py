"""Recovery cases: one per measure and medium. Each case is
(draw, make, measure, transform, unit). The runner and the tests both read this table."""
import numpy as np

from . import entropy as E
from . import envelope as V
from . import gainloss as G
from . import resdecay as R
from . import snr as S
from . import spectrum as P
from . import synth as Y


def _logu(rng, lo, hi):
    return float(np.exp(rng.uniform(np.log(lo), np.log(hi))))


def _adsr_vec(fit):
    return [fit["attack"], fit["decay"], fit["sustain"], fit["release"]]


def _gain_pair(rng, g_db):
    x = rng.standard_normal(20000)
    return x, 10 ** (g_db / 20) * x + 0.01 * rng.standard_normal(x.size)


def _coherent_pair(rng, g):
    x = rng.standard_normal(20000)
    return x, g * x + 0.5 * rng.standard_normal(x.size)


def _nmse_pair(rng, nmse):
    sigma = np.sqrt(4 * nmse / (1 - nmse))
    x = rng.standard_normal(20000)
    return x, 2 * x + 1 + sigma * rng.standard_normal(x.size)


def _mi_pair(rng, loss):
    x = rng.integers(0, 256, size=200000)
    return x, x // (2 ** int(loss))


def _tempered(rng, h_target, n=50000):
    """Find the temperature whose 64-symbol tempered Zipf source has entropy h_target."""
    lo, hi = 0.05, 50.0
    for _ in range(60):
        mid = np.sqrt(lo * hi)
        p = np.arange(1, 65, dtype=np.float64) ** (-1.0 / mid)
        p /= p.sum()
        if -(p * np.log2(p)).sum() < h_target:
            lo = mid
        else:
            hi = mid
    return Y.tempered_source(rng, np.sqrt(lo * hi), n=n)[0]


def _snr_image(rng, snr_db):
    clean = Y.power_law_image(rng, 3.5)
    sigma = np.sqrt(clean.var() / 10 ** (snr_db / 10))
    return clean + sigma * rng.standard_normal(clean.shape)


def _snr_ref_pair(rng, snr_db):
    s = Y.sine(rng, 0.013)
    return s, s + np.sqrt(0.5 / 10 ** (snr_db / 10)) * rng.standard_normal(s.size)


def _ref(pair):
    return S.snr_reference(*pair)


def _markov_make(rng, h):
    """Invert the entropy-rate draw: bisection on 'stay' (entropy falls as stay rises past 1/k)."""
    lo, hi = 1 / 16, 0.999
    for _ in range(60):
        mid = (lo + hi) / 2
        q = (1 - mid) / 15
        if -(mid * np.log2(mid) + 15 * q * np.log2(q)) > h:
            lo = mid
        else:
            hi = mid
    return Y.markov_source(rng, (lo + hi) / 2)[0]


CASES = {
    "spectrum.image_slope": (lambda r: r.uniform(1, 4), Y.power_law_image,
                             lambda x: -P.image_slope(x), None, "alpha"),
    "spectrum.series_slope": (lambda r: r.uniform(0, 3), Y.power_law_series,
                              lambda x: -P.series_slope(x), None, "alpha"),
    "spectrum.audio_peak": (lambda r: _logu(r, 0.005, 0.4),
                            lambda r, f: Y.sine(r, f, snr_db=0.0),
                            P.peak_frequency, np.log, "ln cycles/sample"),
    "spectrum.text_zipf": (lambda r: r.uniform(0.8, 1.6), Y.zipf_tokens,
                           P.zipf_exponent, None, "Zipf exponent"),
    "gain.level_db": (lambda r: r.uniform(-20, 20), _gain_pair,
                      lambda xy: G.gain_db(*xy), None, "dB"),
    "gain.coherent": (lambda r: r.uniform(-3, 3), _coherent_pair,
                      lambda xy: G.coherent_gain(*xy), None, "ratio"),
    "loss.nmse": (lambda r: r.uniform(0.01, 0.6), _nmse_pair,
                  lambda xy: G.nmse(*xy), None, "fraction of variance"),
    "loss.mutual_information": (lambda r: float(r.integers(1, 8)), _mi_pair,
                                lambda xy: G.mi_loss_bits(*xy), None, "bits"),
    "entropy.shannon": (lambda r: r.uniform(1.0, 5.9), _tempered, E.shannon, None, "bits"),
    "entropy.compression": (lambda r: r.uniform(1.0, 5.9), _tempered,
                            E.compression, None, "bits"),
    "entropy.conditional": (lambda r: r.uniform(0.6, 3.9), _markov_make, E.conditional, None, "bits"),
    "entropy.image": (lambda r: r.uniform(1.0, 5.9),
                      lambda r, h: (_tempered(r, h, 65536) * 4).reshape(256, 256),
                      lambda im: E.shannon(E.image_symbols(im)), None, "bits"),
    "snr.reference": (lambda r: r.uniform(-5, 25), _snr_ref_pair, _ref, None, "dB"),
    "snr.blind_1d": (lambda r: r.uniform(-5, 25),
                     lambda r, s: Y.sine(r, r.uniform(0.01, 0.4), snr_db=s),
                     S.snr_blind_1d, None, "dB"),
    "snr.blind_image": (lambda r: r.uniform(0, 30), _snr_image, S.snr_blind_image, None, "dB"),
    "envelope.audio": (Y.random_adsr, Y.adsr_audio,
                       lambda x: _adsr_vec(V.fit_adsr(V.audio_envelope(x, 480))), None, "fraction"),
    "envelope.profile_1d": (Y.random_adsr, Y.adsr_profile,
                            lambda x: _adsr_vec(V.fit_adsr(x)), None, "fraction"),
    "envelope.image_radial": (Y.random_adsr, Y.adsr_image,
                              lambda im: _adsr_vec(V.fit_adsr(V.radial_profile(im))), None,
                              "fraction"),
    "envelope.text_sentences": (Y.random_adsr, Y.adsr_text,
                                lambda t: _adsr_vec(V.fit_adsr(V.sentence_lengths(t))), None,
                                "fraction"),
    "resonance.bandpass_q": (lambda r: _logu(r, 2, 40),
                             lambda r, q: Y.biquad_noise(r, r.uniform(0.05, 0.2), q),
                             lambda x: R.resonance_q(x)["q"], np.log, "ln Q"),
    "resonance.lowpass_q": (lambda r: _logu(r, 2, 20),
                            lambda r, q: Y.biquad_noise(r, r.uniform(0.05, 0.2), q, "lowpass"),
                            lambda x: R.resonance_q(x)["q"], np.log, "ln Q"),
    "decay.ar1_tau": (lambda r: _logu(r, 2, 100), Y.ar1, R.decay_time, np.log, "ln samples"),
    "reverb.size_T": (lambda r: _logu(r, 50, 1500), Y.reverb_impulses,
                      lambda x: R.reverb_size(x)["T"], np.log, "ln samples"),
}


def zipf_entropy(s, vocab=5000):
    p = np.arange(1, vocab + 1, dtype=np.float64) ** (-s)
    p /= p.sum()
    return float(-(p * np.log2(p)).sum())


def _zipf_text_for_h(rng, h, n=20000):
    """Invert zipf_entropy by bisection on s, then sample n word tokens."""
    lo, hi = 0.3, 3.0
    for _ in range(50):
        mid = (lo + hi) / 2
        if zipf_entropy(mid) > h:
            lo = mid
        else:
            hi = mid
    return Y.zipf_tokens(rng, (lo + hi) / 2, n=n)


CASES["entropy.text_words"] = (lambda r: r.uniform(zipf_entropy(1.4), zipf_entropy(0.8)),
                               _zipf_text_for_h, E.shannon, None, "bits")

# Measures that FAIL recovery in the stated regime. Kept as cases so the failure is
# re-checked, not forgotten; nothing reports these values as measured.
FAILED = {
    "entropy.text_words_compression": (CASES["entropy.text_words"][0], _zipf_text_for_h,
                                       E.compression, None, "bits"),
}


def _shuffled_profile_fit(x):
    rng = np.random.default_rng(7)
    return _adsr_vec(V.fit_adsr(rng.permutation(np.asarray(x))))


# False-success controls: plausible estimators that must FAIL the gate. If one passes, the
# gate (or the synthetic family) is too weak to trust.
CONTROLS = {
    "control.constant_estimator": (lambda r: r.uniform(1, 4), Y.power_law_image,
                                   lambda x: 2.5, None, "alpha"),
    "control.unigram_entropy_on_markov": (lambda r: r.uniform(0.6, 3.9), _markov_make,
                                          E.shannon, None, "bits"),
    "control.raw_acf_on_reverb": (lambda r: _logu(r, 50, 1500), Y.reverb_impulses,
                                  R.decay_time, np.log, "ln samples"),
    "control.envelope_shuffled_profile": (Y.random_adsr, Y.adsr_profile,
                                          _shuffled_profile_fit, None, "fraction"),
}
