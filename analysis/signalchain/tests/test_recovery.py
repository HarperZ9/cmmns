"""Recovery tests: every measure must pass the seed-shuffled gate; every false-success control
must fail it, and so must each measure recorded as FAILED. A measure counts when it passes
the pipeline rule (error below the null q05) AND the ratio rule (error <= 0.5 x null median).
Run: python -I tests/test_recovery.py   (about 45 s, mostly the resonance fits)"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np  # noqa: E402

from signalchain.cases import CASES, CONTROLS, FAILED  # noqa: E402
from signalchain.recovery import gate, run  # noqa: E402

# Accuracy ceilings in each case's own unit (median absolute error over 40 seeds). These are
# looser than the observed values recorded with the first study so a seed change does not flake, and
# tight enough that a broken estimator trips them before the gate does.
CEILING = {
    "spectrum.image_slope": 0.2, "spectrum.series_slope": 0.05, "spectrum.audio_peak": 0.01,
    "spectrum.text_zipf": 0.05, "gain.level_db": 0.05, "gain.coherent": 0.02, "loss.nmse": 0.01,
    "loss.mutual_information": 0.02, "entropy.shannon": 0.02, "entropy.compression": 0.3,
    "entropy.conditional": 0.03, "entropy.image": 0.02, "snr.reference": 0.1,
    "snr.blind_1d": 0.2, "snr.blind_image": 0.2, "envelope.audio": 0.05,
    "envelope.profile_1d": 0.05, "envelope.image_radial": 0.05, "envelope.text_sentences": 0.06,
    "resonance.bandpass_q": 0.3, "resonance.lowpass_q": 0.2, "decay.ar1_tau": 0.1,
    "reverb.size_T": 0.3, "entropy.text_words": 0.12,
}


def _run(table, name):
    draw, make, measure, transform, _ = table[name]
    return run(draw, make, measure, trials=40, transform=transform)


class TestMeasuresRecover(unittest.TestCase):
    def test_every_case_has_a_ceiling(self):
        self.assertEqual(set(CASES), set(CEILING))


def _make_case_test(name):
    def test(self):
        res = _run(CASES, name)
        self.assertTrue(res["pass"], f"{name} failed the gate: {res}")
        self.assertTrue(res["strong"], f"{name} passed the gate but not the 0.5 ratio rule")
        self.assertEqual(res["dropped"], 0, f"{name} dropped trials")
        self.assertLess(res["median_error"], CEILING[name])
    return test


def _make_control_test(name):
    def test(self):
        res = _run(CONTROLS, name)
        self.assertFalse(res["strong"], f"false-success control {name} passed: the gate is weak")
    return test


for _n in CASES:
    setattr(TestMeasuresRecover, "test_" + _n.replace(".", "_"), _make_case_test(_n))
for _n in CONTROLS:
    setattr(TestMeasuresRecover, "test_" + _n.replace(".", "_"), _make_control_test(_n))


def _make_failed_test(name):
    def test(self):
        res = _run(FAILED, name)
        self.assertFalse(res["strong"], f"{name} now passes: re-check it and move it to CASES")
    return test


for _n in FAILED:
    setattr(TestMeasuresRecover, "test_" + _n.replace(".", "_"), _make_failed_test(_n))


class TestApi(unittest.TestCase):
    """measure() runs on every medium and returns the measure names README.md lists."""

    def test_media(self):
        from signalchain import measure, through
        from signalchain import synth as Y
        rng = np.random.default_rng(3)
        img = measure(Y.power_law_image(rng, 2.0), "image")
        self.assertAlmostEqual(img["spectrum_slope"], -2.0, delta=0.3)
        aud = measure(Y.adsr_audio(rng, (0.1, 0.2, 0.5, 0.2)), "audio")
        self.assertAlmostEqual(aud["envelope"]["sustain"], 0.5, delta=0.1)
        ser = measure(Y.ar1(rng, 20.0), "series")
        self.assertAlmostEqual(np.log(ser["decay_samples"]), np.log(20.0), delta=0.2)
        txt = measure(Y.adsr_text(rng, (0.1, 0.2, 0.5, 0.2)), "text")
        self.assertIn("envelope_sentences", txt)
        x = rng.standard_normal(5000)
        self.assertAlmostEqual(through(x, 2 * x)["gain_db"], 20 * np.log10(2), places=6)
        with self.assertRaises(ValueError):
            measure(x, "smell")


class TestGate(unittest.TestCase):
    def test_constant_estimator_equals_null(self):
        p = np.linspace(0, 1, 30)
        res = gate(p, np.full(30, 0.5))
        self.assertFalse(res["pass"])
        self.assertAlmostEqual(res["median_error"], res["null_median"])

    def test_perfect_estimator_passes(self):
        p = np.random.default_rng(0).uniform(0, 1, 30)
        self.assertTrue(gate(p, p)["pass"])

    def test_too_few_finite_is_not_a_pass(self):
        r = np.full(30, np.nan)
        r[:5] = 1
        self.assertFalse(gate(np.ones(30), r)["pass"])


if __name__ == "__main__":
    unittest.main(verbosity=1)
