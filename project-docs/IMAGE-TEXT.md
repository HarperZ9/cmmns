# Text inside images: design, build and measurement

Research 2026-10-21; built and measured 2026-10-21. Status: built, off by default, runs only on a
click. Latin script only.

## The problem
Many claims arrive as pictures: a screenshot of a post, a cropped headline, a photographed memo, a
chart with a caption. Radar reads only the text the page gives it, so the rhetoric markers, named
theories, persuasion cues and fact-check matching never see the words in those images. A reader who
wants to know "has anyone checked this?" about a screenshot gets nothing from Radar unless it can
read the picture.

The goal: on a click, read the text in one image the page already loaded, on the device, and run the
same checks on it, each labelled as read from an image.

## Decision
The research below recommended vendoring Tesseract.js. The author chose otherwise on 2026-10-21, in
answer to "Reading text inside screenshots needs on-device OCR. Your rule is to ship
dependency-free. Which way?": "Build our own OCR (Recommended)". The standing rule is to use any tool
for research and to ship no dependency. Radar now ships its own recogniser: its own JavaScript, its
own WebAssembly kernel and weights it trained. Tesseract stays a research baseline and is not in the
extension.

## What was built
The target is narrower than general OCR: screenshots of rendered interface text (posts, documents,
headlines, captions), mostly horizontal, in common interface fonts, on flat or simple backgrounds.

| Stage | File | What it does |
|---|---|---|
| Ink mask | `src/ocr/binarize.js` | Background per 16-pixel tile from the median of its 48-pixel block; a pixel is ink when it differs by more than 40 levels from its own tile and its three nearest tiles. Works the same for dark-on-light and light-on-dark, and ignores the edges between flat panels. |
| Character boxes | `src/ocr/components.js` | Connected components; drops specks, rules, frames drawn around text and solid blocks. |
| Lines and words | `src/ocr/segment.js` | Groups boxes into lines by height and overlap, joins i-dots and accents, splits lines that touch through descenders, keeps columns apart, orders rows top to bottom. Words split on a two-group gap test. |
| Two sizes | `src/ocr/read.js` | Small and medium text is found at full size, large text (48 pixels and up) on a half-size copy, where thick strokes behave like small text. |
| Line image | `src/ocr/image.js` | Crop with a margin, background to 0 and ink to 1 whatever the colours, resize to 32 pixels high with the same triangle filter as Pillow, which the training used. |
| Recogniser | `src/ocr/model.js`, `gemm.js` | A convolutional network read by CTC (below), 8-bit weights. Convolutions run as a blocked matrix product in a 546-byte WebAssembly SIMD kernel written for Radar (`scripts/ocr/gemm.wat`), with a plain JavaScript kernel where WebAssembly is not allowed. |
| Weights | `src/ext/ocr/latin.bin` | 270,032 bytes: 263,568 int8 weights with one scale per output channel, batch norm folded in. Format in `src/ocr/weights.js`. |

The network takes a line 32 pixels high and any width. Four 3x3 convolutions (16, 32, 64 and 96
channels) with max pooling bring it to 2 rows at a quarter of the width; the rows become 192
features per column; three 1D convolutions of width 3 and 128 channels (two residual) give context
along the line; a last layer scores 102 classes per column: the CTC blank, printable ASCII, and
`… • · € £ °`. Curly quotes and dashes are read as `'` `"` and `-`. Greedy CTC decoding gives each
character a probability; a line whose mean is under 0.6 is kept in the result but left out of the
text the matchers see. Lines with no letter or digit (icons, rules, decorations) are dropped.

### Training (research tools, nothing ships)
`scripts/ocr/`: `corpus.py` builds text from the author's own documents only (Radar's docs and
lessons, the workspace notes); `text.py` adds made-up interface strings (names, handles, times,
counts, links, prices) and random characters; `synth.py` draws each line in one of 50 font faces on
light, dark or coloured backgrounds, with neighbouring lines, gradients, noise, rescaling, blur and
JPEG at quality 25 to 92, then crops and normalises it with `prep.py`, the numpy copy of the
extension's own crop and normalisation. `tests/ocr.parity.test.js` checks that the JavaScript and
the training pipeline produce the same line image and the same text. `train.py` trained for 25,000
steps of 96 lines (2.4 million lines) with CTC loss on one RTX 4090 in about 35 minutes (PyTorch
2.6), under the shared GPU lock. `export.py` writes the weight file and the parity fixture.

## Measured
All runs in headless Chrome 155 on a desktop (Intel i7-13700KF), on the shipped code and weights.
Character error rate (CER) = edit distance between what Radar read and the page's own text, plus
every character Radar read outside any line of text, over the true characters. Each recognised word
is scored against the true line its position falls in. Intervals are 95% bootstrap intervals over
pages.

Test sets (none used in training, none containing anyone's real post):
- **Synthetic screenshots**: 120 pages of made-up posts, headlines, documents and captions, 1200 by
  1200, rendered by Chrome at device scale 1 or 2, a third saved as JPEG at quality 70. Text from
  held-out documents. Half in faces training never saw (Lato, Trebuchet MS, Candara, Hanken Grotesk,
  Conso), half in system interface faces (Segoe UI, Arial, Verdana, Georgia, Tahoma) drawn by
  Chrome's rasteriser rather than the training renderer. 19,590 characters at 14 px or more.
- **Real interface screenshots**: 22 screenshots of Radar's own published pages
  (`docs/privacy.html`, `docs/transparency.html`) at scale 1 and 2: real layout, tables, charts and
  decorations, in Hanken Grotesk and Conso. 24,675 characters. Two pages only, so the screenshots are
  not independent of each other. No licence-clean set of real social media screenshots was found;
  posts from X are never used.
- **Signs**: 48 made-up posts carrying a named theory's stock line or a claim from Radar's own
  fact-check table, to compare the signs found in the typed text with those found in the image.

| Measure | Target | Radar | Tesseract.js 7.0.0 (eng, defaults, research only) |
|---|---|---|---|
| CER, synthetic screenshots, text 14 px or more | 5% or less | **1.03%** (0.56 to 1.66) | 5.76% (3.38 to 8.94) |
| CER, synthetic, unseen faces / system faces | | 0.66% / 1.42% | 6.24% / 5.26% |
| CER, synthetic, JPEG quality 70 | | 0.61% | 7.17% |
| CER, real interface screenshots | 5% or less | **3.00%** (2.13 to 4.20) | 4.03% (3.00 to 5.25) |
| Words read exactly, synthetic / real | | 97.8% / 96.0% | 92.4% / 96.5% |
| Language signs (theories, rhetoric, persuasion) also found in image text | 90% or more | 36 of 36 | not run |
| Fact-check matches also found in image text | 90% or more | 30 of 34 (88%) | not run |
| Signs found only in image text, not in the typed text | within 5 points of typed precision | 0 | not run |
| Median latency, synthetic (bytes to text, after load) | 1.5 s or less | **0.16 s**; 0.72 s at 4x CPU slowdown | 0.23 s (in Node) |
| 95th percentile, synthetic | 4 s or less | 0.29 s; 1.44 s at 4x slowdown | 0.62 s (in Node) |
| Median / 95th percentile, real (dense text pages) | 1.5 s / 4 s | 0.50 s / 1.29 s; **2.58 s / 7.37 s at 4x slowdown** | 2.07 s / 3.72 s (in Node) |
| Loading the weights | 2 s or less | 10 to 47 ms | not comparable |
| Added extension size | 8 MB or less | about 0.3 MB (weights 270 KB, code 33 KB) | 7.2 MB if vendored |
| Peak memory while reading | 200 MB or less | not measured yet | not measured |

The 4x slowdown is Chrome's CPU throttling, used as a stand-in for a slow laptop; the targets were
written for a 4-core laptop without a discrete GPU, which was not available. On dense full-page text
the slowed run misses the latency targets. Fact-check matching from image text uses a tolerant mode
(`matchClaims(..., { fuzzy: true })`): a word of four or more characters that no claim uses is
replaced by the single claim word one edit away. Without it, 26 of 34 matched. On 3,284 unrelated
sentences the tolerant mode added no match. The signs set is small; read 30 of 34 as a direction, not
a rate.

Signs found in image text are labelled "in image:", stay at info level, carry the recogniser's
confidence and their own does-not-prove line, read "not measured yet", and never count toward the
thread report.

## How it runs in the extension
- Off by default: "Read text in images" in the options page. When on, the window's Media area shows
  "Read text in this image" under each image of a post. Nothing runs until that click, and never on
  every image.
- The content script re-reads the image the page already loaded, from the same address, without
  cookies (as the Content Credentials check does), and sends the bytes to Radar's own background
  worker (`src/ext/ocr-bg.js`). The image is decoded and read there, in the extension's own context,
  which no page can reach. The worker loads `ocr/latin.bin` from inside the extension on first use
  and drops it after a minute idle.
- The text goes to the same rhetoric, theory and persuasion matchers in the content script and to
  the fact-check index in the worker.
- The only policy change is `'wasm-unsafe-eval'` for extension pages, to compile Radar's own kernel.

## Privacy statement
Reading text in an image happens only when you click "Read text in this image" on one image, with
the feature turned on in the options page. Radar reads the image the page already loaded, from the
same address the page used, with no cookies. The text is read on your device by code shipped inside
Radar. The image, the text and any hash of either never leave your browser, and no language data is
downloaded. The text stays in memory for that window and is saved only if you save an evidence card.

## What this does not settle
- OCR errors can create a sign that is not in the image, or miss one that is. Each sign found this
  way says it was read from an image.
- A screenshot can be edited. Reading its text says nothing about whether the post in it was real;
  the Media area's Content Credentials and reverse search address that separately.
- Not read: handwriting, text on photographs, rotated or curved text, text under about 10 pixels
  high, text with less than 40 levels of contrast, emoji, and every script other than Latin.
  Avatars and decorations can still yield a stray character or two.
- No real social media screenshots were measured. The real set is Radar's own two pages.

## Other scripts: what each would take
- **Cyrillic** (Russian, Ukrainian, and others): the same network and pipeline. Add about 80 letters
  (with ґ є і ї ў) and train Latin and Cyrillic together, so look-alike letters (а and a) are decided
  by context. Every training face here already covers Cyrillic. Needs Cyrillic text with a clear
  licence (Radar's own Russian and Ukrainian lexicons are too short alone). About 15 KB more weights;
  about a day of work and a run of training.
- **Arabic**: right to left and joined, with letter shapes that change by position. Pillow on this
  machine has no text shaping (raqm), so training lines would have to be drawn by Chrome itself.
  Read each line mirrored, so CTC runs in reading order, and train on shaped text with dots and
  marks. Word gaps in Arabic are not reliable, so words come from the recogniser's spaces. A
  separate model of about 300 KB; two to three days.
- **Chinese, Japanese, Korean**: thousands of classes (about 3,500 common Chinese characters, kana
  plus about 2,000 kanji, about 2,400 common Hangul syllables). The convolutional part can stay; the
  last layer grows to about 0.5 to 1 MB per script in int8, so each script is a separate weight file
  loaded only when used. Characters are square, so a 32-pixel line gives about 8 columns each, which
  CTC handles. Vertical text needs its own path. Windows faces (Microsoft YaHei, Yu Gothic, Malgun
  Gothic) can draw the training lines. Several days per script.
- **Choosing the script**: a small classifier on the line image, or reading with Latin first and
  trying another model when confidence is low.

## Next for Latin
- Run lines in parallel workers from an offscreen document, so dense pages meet the latency
  targets on a slow laptop.
- Measure peak memory, and measure on real screenshots of social media with a usable licence if a
  set appears.
- Text on photographs and memes with outlined letters.

## Reproduce
```
python scripts/ocr/corpus.py DATA/text
python scripts/ocr/train.py --text DATA/text --out DATA/run1 --steps 25000
OCR_TEXT=DATA/text python scripts/ocr/export.py DATA/run1/final.pt src/ext/ocr/latin.bin tests/fixtures
python scripts/ocr/pages.py DATA/text DATA/pages 120
node scripts/ocr/eval.mjs DATA/pages DATA/eval [--throttle 4]
node scripts/ocr/real.mjs DATA/real && node scripts/ocr/eval.mjs DATA/pages DATA/real --skip-capture
node scripts/ocr/signs.mjs make DATA/signpages && node scripts/ocr/eval.mjs DATA/signpages DATA/signs && node scripts/ocr/signs.mjs score DATA/signs
TESSERACT_DIR=... node scripts/ocr/baseline-tesseract.mjs DATA/eval
WABT_DIR=... node scripts/ocr/build-wasm.mjs
```
