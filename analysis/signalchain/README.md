# signalchain

One measurement API for a signal and for what a transform does to it: spectrum, entropy, signal-to-noise, envelope, resonance and decay of one signal, and gain and loss through a transform. Every measure it returns has passed a recovery gate: planted values must come back, and estimators that only look right must fail. Requires numpy.

```python
from signalchain import measure, through

measure(image, "image")     # 2D or HxWxC array, 0 to 255
measure(wave, "audio")      # 1D array
measure(log, "series")      # 1D array: a mood log, a per-frame value
measure(text, "text")       # a string
through(x, y)               # gain_db, coherent_gain, loss_nmse, loss_bits for y = T(x)
```

## Run the tests

```
python -m pip install -r analysis/requirements.txt
python -m pytest analysis/signalchain          # about 3 minutes
SIGNALCHAIN_SLOW=1 python -m pytest analysis/signalchain   # adds a 4-minute control
```

## The recovery gate

For each of 40 seeds the gate plants a value, synthesises a signal from it and measures it. The observed error is the median absolute error over seeds. A seed-shuffled null pairs each recovered value with another seed's planted value, 1000 times. A measure counts when its error is below the 5th percentile of the null medians, at most half the null median, and, for a vector measure such as the envelope, when both hold for every component.

Four false-success controls must fail, and the tests assert they do: a constant estimator; unigram Shannon entropy asked for a Markov source's entropy rate; the plain autocorrelation decay on reverb tails; and an envelope fitted to a shuffled profile.

## What it measures

| Module | Measures |
|---|---|
| `spectrum` | radial image spectrum and slope, STFT, dominant frequency, series slope, Zipf exponent of a text |
| `gainloss` | level gain in dB, coherent gain, NMSE after an affine map back, information loss in bits |
| `entropy` | Shannon entropy with the Miller-Madow correction, order-1 conditional entropy, an lzma cross-check |
| `snr` | reference SNR, blind 1D SNR, blind image SNR (Immerkaer 1996) |
| `envelope` | attack, decay, sustain and release fitted to any 1D profile, a radial image profile or sentence lengths |
| `resdecay` | resonance Q from a fitted second-order section, autocorrelation decay time, reverb size |
| `changepoint`, `regime`, `tvar`, `timefreq`, `timescale`, `modes` | measures for non-stationary series, gated the same way in `tests/test_nonstationary.py` |
| `synth`, `cases`, `ns_cases`, `ns_cases_ts`, `recovery` | the planted-value generators, the case tables and the gate itself |

## Limits

- Text compression entropy fails the gate: lzma on word ids overstates a Zipf source's entropy by 1.6 to 2.1 bits, so the API reports no compression value for text. The case stays in the table so it is rechecked.
- Resonance Q reads high by about 18 percent (bandpass) and 10 percent (lowpass), and reverb size reads low by about 9 percent. Both still pass the gate.
- Blind SNR assumes white noise. On an image, fine texture reads as noise.
- The reverb size is valid for a sparse impulsive dry source with exponential tails.
