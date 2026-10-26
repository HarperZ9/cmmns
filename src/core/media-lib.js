// The media library, one import for any tool: what a file is, what to call it, which picture or
// stream a page offers, how to put a stream together and how to make a GIF. Pure modules with no
// browser-extension calls; network access is passed in (assembleStream's get). Documented in
// project-docs/MEDIA-LIBRARY.md. Not part of the extension bundle (each module is bundled itself).
export { sniffMime, chooseType, downloadName, downloadExt, slug } from "./media-name.js";
export { parseSrcset, largestSource, fullSizeUrl, sizeLadder, downloadPlan, referenceOf, REFERENCE_LABEL } from "./media-pick.js";
export { demuxMp4, remuxMp4 } from "./media-demux.js";
export { assembleStream, combineParts, MediaProtected } from "./media-assemble.js";
export { encodeGif, gifPalette, gifLzwEncode } from "./media-gif-encode.js";
export { decodeGif, isGif } from "./media-gif.js";
export { muxMp4 } from "./media-mp4.js";
export { fileProtection, mediaProtection, PROTECTED_LINE } from "./media-protect.js";
export { parseM3u8, hlsProtection, pickVariant } from "./media-hls.js";
export { parseMpd, dashProtection, pickRepresentation } from "./media-dash.js";
export { postMeta, sidecarMarkdown, sidecarJson, metaName, captionText, embedText, textTags } from "./media-meta.js";
export { embedDescription, readDescription, xmpPacket } from "./media-embed.js";
export { saveFolder, SIDECAR_FORMAT } from "./media-meta.js";
export { wrapLines, cardPlan, CARD, CARD_FOOT } from "./media-card.js";
export { threadChain, continuationStatus } from "./media-thread.js";
