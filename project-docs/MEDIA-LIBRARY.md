# Media library

One import for any tool that needs to save media the way the extension does:

```js
import { chooseType, downloadName, largestSource, downloadPlan, assembleStream, encodeGif } from "daylight-commons/media";
```

The modules live in `src/core/` and have no browser-extension calls. They run in Node 20 and later
and in any browser. Network access is passed in, so a command line tool, a test or another extension
decides how files are fetched. The extension bundles each module into `core.bundle.js`; the entry
point is `src/core/media-lib.js`.

## What a file is and what to call it (`media-name.js`)

| Function | Takes | Gives |
|---|---|---|
| `sniffMime(bytes)` | the first 16 to 512 bytes | the MIME type the bytes show (PNG, JPEG, GIF, WebP, AVIF, HEIC, MP4, MOV, WebM, Matroska, Ogg, MP3, AAC, FLAC, WAV, MPEG-TS, SVG, JPEG XL, TIFF, BMP, ICO, HLS, DASH, PDF), or `null` |
| `chooseType({ bytes, contentType, url })` | any of the three | `{ mime, ext, from }`; `from` is `bytes`, `header`, `address` or `none` (then `ext` is `bin`) |
| `downloadName({ title, url, index, total, ext })` | the page or post title and the file's address | a name safe on Windows, macOS and Linux: `title-medianame[-n].ext` |
| `downloadExt(mime)`, `slug(text)` | | the extension for a type; a filename-safe form of any text |

The bytes win over the server's type, and the server's type wins over the address, so a WebP served
from an address ending in `.jpg` is named `.webp`.

## Which file a page offers (`media-pick.js`)

| Function | Gives |
|---|---|
| `parseSrcset(text)` | `[{ url, w, x, h }]`, parsed as the HTML standard does (commas inside an address stay in it) |
| `largestSource({ src, currentSrc, srcset, sources, layoutWidth, naturalWidth }, { base, supports })` | the address of the largest candidate across a `<picture>`'s sources and the image's own `srcset` |
| `fullSizeUrl(url)` | the original on hosts that serve a smaller copy by default: X pictures (`name=orig`), Reddit previews (`i.redd.it`), Imgur's low-quality `_lq.mp4` |
| `downloadPlan(target, { asGif })` | what to do with one target: `url`, `bytes`, `canvas`, `stream`, `gif`, `none` with a reason, or `refuse` for protected media with the toolkit's sentence |
| `referenceOf({ page, title, poster, images, previews, reason })` | a reference to protected media: what the page shows in the clear, with the label "Protected source. Reference only, not for redistribution." |

A target is `{ kind, url, streams, protected, canvas, gifUrl }`, the shape the extension's in-page
resolver (`src/ext/quick-resolve.js`) builds from what is under the pointer.

## Streams (`media-assemble.js`, `media-demux.js`)

`assembleStream({ type: "hls" | "dash", url }, { get, onProgress })` fetches the playlist or manifest,
the best variant or representation and its separate sound, and returns
`{ files: [{ bytes, mime, role }], note }`. `get(url, { range, as })` answers `{ bytes, type }`, or the
text when `as` is `"text"`. Separate MP4 video and sound (Reddit's DASH, X's HLS) come back as one MP4
with both tracks. Where the codecs cannot be rewrapped (VP9, HEVC, Opus in MP4) or the parts are
MPEG-TS, the parts come back as separate files and `note` says why.

An encrypted HLS key, a DASH `ContentProtection` element or MP4 and WebM encryption markers throw
`MediaProtected` before any segment past the playlist is fetched. Nothing here decrypts anything.

`demuxMp4(bytes)` reads the samples of a plain or fragmented MP4 without decoding them;
`remuxMp4([file, file])` writes them into one plain MP4 with the toolkit's muxer (`media-mp4.js`).

```js
import { assembleStream } from "daylight-commons/media";
const get = async (url, { range, as } = {}) => {
  const res = await fetch(url, { headers: range ? { Range: `bytes=${range.offset}-${range.offset + range.length - 1}` } : {} });
  return as === "text" ? res.text() : { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get("content-type") };
};
const { files } = await assembleStream({ type: "hls", url: "https://example.org/master.m3u8" }, { get });
```

## GIFs (`media-gif-encode.js`)

`encodeGif({ width, height, frames: [{ rgba, delayMs }] })` writes a looping GIF with one median-cut
palette of up to 256 colours for the whole animation. `gifPalette(frames)` and `gifLzwEncode(indices,
minCodeSize)` are the two steps on their own. The output reads back through `decodeGif` in
`media-gif.js`, which the tests check frame by frame.

## The post's words with the file (`media-meta.js`, `media-embed.js`)

| Function | Gives |
|---|---|
| `postMeta({ site, text, authorName, handle, postUrl, mediaUrl, postedAt, alt, quoted, parent, thread, subreddit, title, index, total })` | one record; the text keeps its line breaks; hashtags and links are read from it; X's placeholder alt text ("Image") is dropped |
| `sidecarMarkdown(meta, fileName)`, `sidecarJson(meta, fileName)` | the `.md` file a person reads (the post's text first, quoted or parent post, the author's own continuation, alt text, addresses, times) and the `.json` for tools |
| `metaName(meta, ext)` | `<handle>_<date>_<words-from-the-text>[-n].<ext>`, cut at a word boundary, so a folder sorts by person and day |
| `captionText(meta, link)` | the post's words, the handle and the link, for "Copy with caption" |
| `embedText(meta)` | one paragraph for inside the file |
| `embedDescription(bytes, mime, { description, creator, source })` | the file with the description inside, or `null`: XMP for JPEG (APP1), PNG (iTXt) and WebP (VP8X and an XMP chunk), a comment, description and artist in MP4 (`moov/udta/meta/ilst`, every chunk offset moved), a comment block in GIF. Pixels and samples are untouched; a file with its own XMP or MP4 metadata is left alone |
| `readDescription(bytes)` | the description read back from any of those |

## Tests

`tests/media-meta.test.js` (sidecars for an X post with alt text, a quote post and a Reddit gallery
item; the description written into and read back from JPEG, PNG, WebP, GIF and MP4 with every sample
unchanged), `tests/media-quicksave.test.js` (types, names, srcset, full-size addresses, plans, DRM refusal, GIF
round trip) and `tests/media-demux.test.js` (plain and fragmented MP4, rewrapping, stream assembly
with a fake `get`, protected streams stopping before segments are fetched).
