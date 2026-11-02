"""Recovery tests for the non-stationary measures (time-frequency, change points, time-varying
AR, regime switching, DMD, irregular-sampling timescales). Same gate and ratio rule as
test_recovery.py: every case must pass and be 'strong'; every control and every recorded
failure must not be strong.
Run: python -I tests/test_nonstationary.py   (about 2 min; SIGNALCHAIN_SLOW=1 adds the 4 min
regime-shuffle control)"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np  # noqa: E402

from signalchain import changepoint as C  # noqa: E402
from signalchain import timescale as S  # noqa: E402
from signalchain.ns_cases import CASES, CONTROLS, FAILED  # noqa: E402
from signalchain.recovery import run  # noqa: E402

CEILING = {
    "tf.stft_chirp": 0.01, "tf.cwt_chirp": 0.12, "tf.stft_jump": 0.01, "tf.cwt_jump": 0.02,
    "cp.mean_location": 0.01, "cp.var_location_ratio": 0.1, "cp.count": 0.5,
    "tvar.ar1_drift": 0.12, "tvar.drift_q": 0.7, "regime.ms_ar1": 0.15,
    "modes.dmd_two": 0.05, "modes.windowed_growth": 0.05, "ts.ou_tau": 0.5,
    "ts.haar_bands_90d": 0.1, "ts.fast_share_60d": 0.1,
}
MAX_DROPPED = {"cp.var_location_ratio": 4}
SLOW = {"control.regime_shuffled"}


def _run(table, name):
    draw, make, measure, transform, _ = table[name]
    return run(draw, make, measure, trials=40, transform=transform)


class TestNonStationary(unittest.TestCase):
    def test_every_case_has_a_ceiling(self):
        self.assertEqual(set(CASES), set(CEILING))

    def test_pelt_finds_planted_changes_and_none_in_white_noise(self):
        rng = np.random.default_rng(11)
        x = np.r_[rng.standard_normal(200), 3 + rng.standard_normal(200)]
        self.assertEqual(C.pelt(x), [200])
        self.assertLessEqual(C.false_positive_rate(rng, n=500, trials=100), 0.06)

    def test_pelt_overcounts_on_autocorrelated_noise(self):
        # The stated limit: the independent-noise cost overcounts on AR(1) noise, which is why
        # real series are judged against AR(1) surrogates.
        rng = np.random.default_rng(12)
        self.assertGreater(C.false_positive_rate(rng, n=500, trials=40, phi=0.6), 0.5)

    def test_minute_scale_dynamics_read_as_noise_at_esm_rate(self):
        rng = np.random.default_rng(13)
        t = S.esm_times(rng, days=20)
        fit = S.fit_ou(t, S.ou_at(rng, t, 10 / 60))  # a 10-minute time constant, no noise added
        self.assertTrue(fit["tau"] < S.within_day_gap(t) or fit["rho"] >= 0.8)


def _case(name):
    def test(self):
        res = _run(CASES, name)
        self.assertTrue(res["strong"], f"{name}: {res.get('ratio')} {res.get('per_component')}")
        self.assertLessEqual(res["dropped"], MAX_DROPPED.get(name, 0))
        self.assertLess(res["median_error"], CEILING[name])
    return test


def _not_strong(table, name):
    def test(self):
        if name in SLOW and not os.environ.get("SIGNALCHAIN_SLOW"):
            self.skipTest("slow control; set SIGNALCHAIN_SLOW=1")
        self.assertFalse(_run(table, name)["strong"], f"{name} passed: recheck it")
    return test


for _n in CASES:
    setattr(TestNonStationary, "test_" + _n.replace(".", "_"), _case(_n))
for _n in CONTROLS:
    setattr(TestNonStationary, "test_" + _n.replace(".", "_"), _not_strong(CONTROLS, _n))
for _n in FAILED:
    setattr(TestNonStationary, "test_failed_" + _n.replace(".", "_"), _not_strong(FAILED, _n))


if __name__ == "__main__":
    unittest.main(verbosity=1)
