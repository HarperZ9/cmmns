"""Planted irregular-sampling families for the timescale measures (ESM-like schedules).
Read by ns_cases.py."""
import numpy as np

from . import timescale as S


def _logu(rng, lo, hi):
    return float(np.exp(rng.uniform(np.log(lo), np.log(hi))))


# ---- timescales of irregular series -----------------------------------------------------
def _ou_esm(rng, ltau):
    t = S.esm_times(rng)
    return t, S.ou_at(rng, t, np.exp(ltau)) * np.sqrt(0.8) + np.sqrt(0.2) * rng.standard_normal(t.size)


def _tau_hat(ty):
    return float(np.log(S.fit_ou(*ty)["tau"]))


def _shuffled_tau(ty):
    t, y = ty
    return float(np.log(S.fit_ou(t, np.random.default_rng(5).permutation(y))["tau"]))


def _draw_bands(r):
    return {"tf": _logu(r, 0.5, 6), "ts": _logu(r, 48, 400), "w": r.uniform(0.1, 0.9)}


def _theory_shares(t, p, rho=0.1):
    lag, _ = S.pair_lags(t, np.zeros(t.size))
    sf_lag = rho + (1 - rho) * (p["w"] * (1 - np.exp(-lag / p["tf"])) + (1 - p["w"]) * (1 - np.exp(-lag / p["ts"])))
    return S.haar_bands(t, None, lag, sf_lag)["share"]


def _bands_case(days=90, scalar=False):
    """(draw, make) for planted band shares. The planted value is the theoretical share vector
    of the drawn two-OU spectrum on the drawn schedule; make looks the draw up by its first
    share, which is unique to the draw."""
    cache = {}

    def draw(r):
        p = _draw_bands(r)
        t = S.esm_times(np.random.default_rng(int(r.integers(1 << 30))), days=days)
        sh = _theory_shares(t, p)
        v = [sh["within_day"], sh["day_to_day"], sh["week"]]
        cache[v[0]] = (t, p)
        return v[0] if scalar else v

    def make(rng, planted):
        t, p = cache[float(planted if scalar else planted[0])]
        y = np.sqrt(0.9) * (np.sqrt(p["w"]) * S.ou_at(rng, t, p["tf"]) + np.sqrt(1 - p["w"]) * S.ou_at(rng, t, p["ts"]))
        return t, y + np.sqrt(0.1) * rng.standard_normal(t.size)
    return draw, make


def _read_bands(ty):
    s = S.haar_bands(*ty)["share"]
    return [s["within_day"], s["day_to_day"], s["week"]]


def _powerlaw_esm(rng, alpha, days=20):
    n = days * 24 * 6
    f = np.fft.rfftfreq(n, d=1 / 6)
    amp = np.where(f > 0, f ** (-alpha / 2), 0)
    z = np.fft.irfft(amp * (rng.standard_normal(f.size) + 1j * rng.standard_normal(f.size)), n)
    t = S.esm_times(rng, days=days)
    return t, z[np.minimum((t * 6).astype(int), n - 1)] / z.std()


def _ls_slope(ty):
    f, p, T_ = S.spectrum(*ty)
    return -S.slope(f, p, T_)


def _two_tau(rng, lt):
    t = S.esm_times(rng, days=40, beeps=6)
    y = np.sqrt(0.45) * (S.ou_at(rng, t, np.exp(lt[0])) + S.ou_at(rng, t, np.exp(lt[1])))
    return t, y + np.sqrt(0.1) * rng.standard_normal(t.size)


def _read_two_tau(ty):
    f = S.fit_ou2(*ty)
    return [np.log(f["tau1"]), np.log(f["tau2"])]


_B90, _B60, _B60S, _B30 = _bands_case(90), _bands_case(60), _bands_case(60, True), _bands_case(30)
