# Text inside images: research and design (2026-10-21)

Status: research only. Nothing in this document ships yet.

## The problem
Many claims arrive as pictures: a screenshot of a post, a cropped headline, a photographed memo, a
chart with a caption. Radar reads only the text the page gives it, so the rhetoric markers, named
theories, persuasion cues and fact-check matching never see the words in those images. A reader who
wants to know "has anyone checked this?" about a screenshot gets nothing from Radar today.

The goal: on a click, read the text in one image the page already loaded, on the device, and run the
same checks on it, each labelled as read from an image.

## Options compared
Sizes are measured from the published packages on 2026-10-21 unless marked otherwise. Radar's
unpacked extension is about 15 MB today, most of it data tables.

| Option | Licence | Added size | Where it runs | Status | Fit |
|---|---|---|---|---|---|
| Shape Detection API, `TextDetector` | browser built-in | 0 | the browser's own OCR | Behind `#enable-experimental-web-platform-features`; Chrome's article (last updated 2019-01-07) lists text detection as "In Progress". No later launch found; recheck chromestatus before relying on this. | Ideal if it ever ships, unusable for nearly all users now |
| Tesseract.js 7.0.0 (core 6.1.2) | Apache-2.0 | `tesseract-core-simd-lstm.wasm` 2.87 MB, worker and glue about 0.25 MB, English `tessdata_fast` 4.11 MB (Apache-2.0); `tessdata_best` would be 15.4 MB | WASM in a worker, CPU | Stable, widely used | Best fit: printed text on screenshots is its strong case |
| PaddleOCR (PP-OCR) on ONNX Runtime Web 1.30.0 | MIT runtime; models Apache-2.0 | runtime 14.2 MB (WASM) or 28.3 MB (WebGPU build), plus detection and recognition models of several MB each (from memory, low confidence) | WASM or WebGPU | Works; community browser wrappers are young | Better on photos and scene text; 3 to 5 times the size |
| Transformers.js 4.3.1 with an OCR or vision-language model (TrOCR, Florence-2) | Apache-2.0 library; models vary | library about 10 MB unpacked plus models of roughly 100 MB or more (from memory, low confidence) | WebGPU | Works on capable GPUs | Too large for a default install |
| Chrome built-in AI (Gemini Nano with image input) | browser built-in | 0 to Radar; the browser downloads its own model | on device | unknown for extensions in stable Chrome as of this writing; not checked | Recheck later; it would also tie Radar to one browser |
| The operating system's OCR (Windows.Media.Ocr, Apple Vision) | OS | 0 | OS | Not reachable from a web extension without a native helper | Out: a native helper breaks the install-and-go promise |

Rules this has to meet: nothing leaves the browser, shipped code free of dependencies where
possible, a small bundle, and every sign measured or labelled.

## Recommendation
1. Feature-detect `TextDetector` and use it when the browser offers it. It costs nothing.
2. Otherwise use Tesseract.js, vendored at a pinned version with its licence file and the SHA-256
   of each file recorded, English `tessdata_fast` only at first. About 7.2 MB added.
   - Run it in an extension page or offscreen document, never in the content script, so the page
     cannot reach the worker.
   - Load the core, worker and language data from the extension's own files. Tesseract.js points
     at a CDN by default; `corePath`, `workerPath` and `langPath` must be set to extension URLs, and
     a test must fail the build if any of them is remote.
   - Manifest V3 needs `'wasm-unsafe-eval'` in the extension pages' content security policy. That
     is the only policy change.
   - Load on the first click only, and end the worker after 60 seconds idle.
3. Defer PaddleOCR and the vision-language models until there is a measured need (photos of signs,
   handwriting) that Tesseract misses.

This adds the first vendored third-party code to the shipped extension. The standing preference is
to ship without dependencies, so this needs the author's decision. The alternative, an OCR engine
written for Radar, would take far longer and still trail Tesseract on accuracy.

## Targets (to measure before shipping)
Test set: synthetic images only. Radar renders its own text into screenshots of made-up posts,
headlines and documents at several sizes, fonts, backgrounds and JPEG qualities, so no one's real
post is used and every label is known. Run in Chrome on a 4-core laptop without a discrete GPU.

| Measure | Target |
|---|---|
| Character error rate, English, rendered text at 14 px or more | 5% or less |
| Word recall of the sign words (the theory terms, slurs, claim keywords) in those images | 90% or more |
| Precision of signs found in OCR text, against the same signs on the typed text | within 5 points of the typed text |
| Fact-check matches from OCR text that match the typed text's matches | 90% or more |
| Latency, 1200 by 1200 screenshot, after the engine has loaded | median 1.5 s or less, 95th percentile 4 s or less |
| First load of the engine | 2 s or less |
| Peak memory while reading | 200 MB or less |
| Added extension size | 8 MB or less |

Signs found in image text start as "not measured yet" and stay out of the thread report until a
labelled set of real screenshots exists.

## Privacy statement
Reading text in an image happens only when you click "Read text in this image" on one image. Radar
reads the image the page already loaded, from the same address the page used, with no cookies. The
text is read on your device by code shipped inside Radar. The image, the text and any hash of either
never leave your browser, and no language data is downloaded. The text stays in memory for that
window and is saved only if you save an evidence card. The feature is off until you turn it on in
the options page.

## What this does not settle
- OCR errors can create a sign that is not in the image, or miss one that is. Each sign found this
  way must say it was read from an image.
- A screenshot can be edited. Reading its text says nothing about whether the post in it was real;
  the Media area's Content Credentials and reverse search address that separately.
- The targets above are for English. Other scripts need their own language data and their own
  measurement.
