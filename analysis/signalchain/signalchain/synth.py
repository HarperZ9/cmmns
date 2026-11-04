"""Synthetic signals with planted values, for the recovery gate. Each takes an rng."""
import numpy as np

from .envelope import adsr_curve


def power_law_image(rng, alpha, size=256):
    """Gaussian field with power spectrum proportional to f^-alpha, scaled to 0..255."""
    fy = np.fft.fftfreq(size)[:, None]
    fx = np.fft.fftfreq(size)[None, :]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    amp = f ** (-alpha / 2)
    amp[0, 0] = 0
    z = rng.standard_normal((size, size)) + 1j * rng.standard_normal((size, size))
    g = np.real(np.fft.ifft2(z * amp))
    g = (g - g.mean()) / g.std()
    return np.clip(128 + 40 * g, 0, 255)


def power_law_series(rng, alpha, n=2 ** 15):
    f = np.fft.rfftfreq(n)
    f[0] = 1.0
    amp = f ** (-alpha / 2)
    amp[0] = 0
    z = rng.standard_normal(f.size) + 1j * rng.standard_normal(f.size)
    x = np.fft.irfft(z * amp, n)
    return x / x.std()


def zipf_tokens(rng, s, n=20000, vocab=5000):
    p = np.arange(1, vocab + 1, dtype=np.float64) ** (-s)
    p /= p.sum()
    return [f"w{i}" for i in rng.choice(vocab, size=n, p=p)]


def tempered_source(rng, temperature, k=64, n=50000):
    """Symbols drawn iid from p_i proportional to i^(-1/T); returns (symbols, true entropy)."""
    p = np.arange(1, k + 1, dtype=np.float64) ** (-1.0 / temperature)
    p /= p.sum()
    h = float(-(p * np.log2(p)).sum())
    return rng.choice(k, size=n, p=p), h


def markov_source(rng, stay, k=16, n=50000):
    """Order-1 chain: keep the symbol with probability 'stay', else uniform over the others.
    Returns (symbols, true entropy rate in bits)."""
    x = np.empty(n, dtype=np.int64)
    x[0] = 0
    u = rng.random(n)
    jump = rng.integers(1, k, size=n)
    for t in range(1, n):
        x[t] = x[t - 1] if u[t] < stay else (x[t - 1] + jump[t]) % k
    q = (1 - stay) / (k - 1)
    h = -(stay * np.log2(stay) + (k - 1) * q * np.log2(q))
    return x, float(h)


def sine(rng, freq, n=2 ** 15, snr_db=None):
    """Unit sine at freq cycles/sample with random phase; white noise at snr_db if given."""
    t = np.arange(n)
    s = np.sin(2 * np.pi * freq * t + rng.uniform(0, 2 * np.pi))
    if snr_db is None:
        return s
    sigma = np.sqrt(0.5 / 10 ** (snr_db / 10))
    return s + sigma * rng.standard_normal(n)


def random_adsr(rng):
    a, d, r = rng.uniform(0.04, 0.3, size=3)
    return float(a), float(d), float(rng.uniform(0.2, 0.8)), float(r)


def adsr_audio(rng, p, n=48000, carrier=0.02, noise=0.05):
    env = adsr_curve(*p, t=np.linspace(0, 1, n))
    return env * np.sin(2 * np.pi * carrier * np.arange(n)) + noise * rng.standard_normal(n)


def adsr_profile(rng, p, n=300, noise=0.05):
    return 3 + 10 * adsr_curve(*p, t=np.linspace(0, 1, n)) + noise * 10 * rng.standard_normal(n)


def adsr_image(rng, p, size=256, noise=10.0):
    yy, xx = np.mgrid[0:size, 0:size]
    rr = np.hypot(yy - (size - 1) / 2, xx - (size - 1) / 2)
    prof = adsr_curve(*p, t=(rr / rr.max()).ravel()).reshape(size, size)
    return np.clip(30 + 180 * prof + noise * rng.standard_normal((size, size)), 0, 255)


def adsr_text(rng, p, n_sent=160):
    lens = 3 + 25 * adsr_curve(*p, t=np.linspace(0, 1, n_sent))
    lens = np.maximum(1, rng.poisson(lens))
    words = ["the", "rain", "glass", "light", "street", "seat", "drop", "night"]
    return " ".join(" ".join(rng.choice(words, size=k)) + "." for k in lens)


def biquad_noise(rng, f0, q, kind="bandpass", n=2 ** 16):
    """White noise through an RBJ biquad (bandpass, constant peak gain, or lowpass),
    applied as the exact frequency response on the FFT grid."""
    w = 2 * np.pi * np.fft.rfftfreq(n)
    w0 = 2 * np.pi * f0
    al = np.sin(w0) / (2 * q)
    cw = np.cos(w0)
    if kind == "bandpass":
        b = [al, 0.0, -al]
    else:
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
    a = [1 + al, -2 * cw, 1 - al]
    z = np.exp(-1j * w)
    h = (b[0] + b[1] * z + b[2] * z * z) / (a[0] + a[1] * z + a[2] * z * z)
    return np.fft.irfft(np.fft.rfft(rng.standard_normal(n)) * h, n)


def ar1(rng, tau, n=20000):
    phi = np.exp(-1.0 / tau)
    e = rng.standard_normal(n) * np.sqrt(1 - phi * phi)
    x = np.empty(n)
    x[0] = rng.standard_normal()
    for t in range(1, n):
        x[t] = phi * x[t - 1] + e[t]
    return x


def reverb_impulses(rng, t_amp, n=2 ** 17, rate=1 / 2000):
    """Sparse impulses with random amplitude through a noise impulse response exp(-t/T)."""
    dry = np.zeros(n)
    k = rng.random(n) < rate
    dry[k] = rng.standard_normal(k.sum())
    m = int(min(n // 4, 12 * t_amp))
    ir = rng.standard_normal(m) * np.exp(-np.arange(m) / t_amp)
    size = 1 << int(np.ceil(np.log2(n + m)))
    return np.fft.irfft(np.fft.rfft(dry, size) * np.fft.rfft(ir, size), size)[:n]
