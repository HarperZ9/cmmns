// Unified multi-site download classification, filename sanitization, subfolder organization,
// canonical deduplication keys, and sister-tool workflow routing hints (gather, distill, crucible,
// DS-05). Pure ES module: no DOM, no network, no filesystem access.

import { stripTracking } from "./url-clean.js";
import { downloadName, slug } from "./media-name.js";
import { metaName, postTag, savePath } from "./media-meta.js";

export const SUPPORTED_SITES = Object.freeze([
  "x", "reddit", "youtube", "bluesky", "hackernews", "arxiv", "github",
  "instagram", "mastodon", "threads", "tiktok", "facebook",
]);
export const MEDIA_KINDS = Object.freeze(["whitepaper", "audio", "video", "image", "post"]);
export const TYPE_SUBFOLDERS = Object.freeze({
  whitepaper: "papers", audio: "audio", video: "video", image: "images", post: "posts",
});
export const WORKFLOW_HINTS = Object.freeze(["civic_audit", "distill_media", "research_verify"]);

const SITE_RULES = [
  ["x", /(^|\.)(x|twitter|twimg)\.com$/i],
  ["reddit", /(^|\.)(reddit\.com|redd\.it)$/i],
  ["youtube", /(^|\.)(youtube\.com|youtu\.be|ytimg\.com)$/i],
  ["bluesky", /(^|\.)bsky\.(app|social)$/i],
  ["hackernews", /^news\.ycombinator\.com$/i],
  ["arxiv", /(^|\.)(arxiv\.org|ar5iv\.labs\.arxiv\.org)$/i],
  ["github", /(^|\.)(github\.com|githubusercontent\.com)$/i],
  ["instagram", /(^|\.)(instagram\.com|cdninstagram\.com)$/i],
  ["threads", /(^|\.)threads\.(net|com)$/i],
  ["tiktok", /(^|\.)(tiktok\.com|tiktokcdn\.com)$/i],
  ["facebook", /(^|\.)(facebook\.com|fb\.com|fbcdn\.net)$/i],
  ["mastodon", /(^|\.)(mastodon\.\w+|hachyderm\.io|fosstodon\.org|infosec\.exchange)$/i],
];

const PAPER_HOSTS = /(^|\.)(arxiv\.org|ar5iv\.labs\.arxiv\.org|biorxiv\.org|medrxiv\.org|openreview\.net|aclanthology\.org|zenodo\.org|doi\.org|semanticscholar\.org)$/i;
const CIVIC_SITES = new Set(["x", "reddit", "youtube", "bluesky", "hackernews", "instagram", "mastodon", "threads", "tiktok", "facebook"]);
const AUDIO_EXT = /^(wav|flac|mp3|m4a|ogg|oga|opus|aac|weba)$/i;
const VIDEO_EXT = /^(mp4|m4v|webm|mov|mkv|ts|avi|ogv)$/i;
const IMAGE_EXT = /^(jpg|jpeg|jfif|png|webp|gif|avif|heic|heif|svg|bmp|tif|tiff|jxl|ico)$/i;

function hostOf(urlOrHost) {
  const s = String(urlOrHost || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) {
    try { return new URL(s).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
  }
  return s.toLowerCase().replace(/^www\./, "").replace(/\/.*$/, "");
}

export function classifySite(urlOrHost) {
  const h = hostOf(urlOrHost);
  if (!h) return "generic";
  if (SUPPORTED_SITES.includes(h)) return h;
  for (const [id, re] of SITE_RULES) if (re.test(h)) return id;
  return h;
}

function extFromUrl(url) {
  try {
    const m = /[.@]([a-z0-9]{2,5})$/i.exec(new URL(url).pathname);
    return m ? m[1].toLowerCase() : "";
  } catch { return ""; }
}

function isPaperSignal(url, host, mime, ext, page) {
  if (mime === "application/pdf" || ext === "pdf") return true;
  if (PAPER_HOSTS.test(host)) return true;
  if (/\/(pdf|abs)\/\d{4}\.\d{4,5}/i.test(String(url || ""))) return true;
  if (page && page.citation && (page.citation.citation_title || page.citation.citation_pdf_url || page.citation.citation_doi)) return true;
  if (page && Array.isArray(page.jsonLd) && page.jsonLd.some((n) => n && n.type === "ScholarlyArticle")) return true;
  return false;
}

export function classifyMediaKind({ url = "", mime = "", ext = "", kind = "", site = "", page = null } = {}) {
  const m = String(mime || "").toLowerCase().split(";")[0].trim();
  const e = String(ext || "").replace(/^\./, "").toLowerCase() || extFromUrl(url);
  const k = String(kind || "").toLowerCase();
  const h = hostOf(url) || hostOf(site);
  if (k === "whitepaper" || k === "paper" || isPaperSignal(url, h, m, e, page)) return "whitepaper";
  if (k === "audio" || m.startsWith("audio/") || AUDIO_EXT.test(e)) return "audio";
  if (k === "video" || m.startsWith("video/") || VIDEO_EXT.test(e) || classifySite(url || site) === "youtube") return "video";
  if (k === "image" || k === "gif" || m.startsWith("image/") || IMAGE_EXT.test(e)) return "image";
  return "post";
}

export const subfolderForKind = (mediaKind) => TYPE_SUBFOLDERS[mediaKind] || TYPE_SUBFOLDERS.post;

function extractSiteId(site, url) {
  const u = String(url || "");
  if (!u) return null;
  if (site === "arxiv") {
    const m = /\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+\/\d{7})/i.exec(u);
    if (m) return `arxiv:${m[1].replace(/\.pdf$/i, "")}`;
  }
  if (site === "hackernews") {
    const m = /[?&]id=(\d+)/.exec(u);
    if (m) return `hackernews:${m[1]}`;
  }
  if (site === "bluesky") {
    const m = /\/profile\/([^/]+)\/post\/([a-z0-9]+)/i.exec(u);
    if (m) return `bluesky:${m[1]}:${m[2]}`;
  }
  const tag = postTag({ postUrl: u });
  return tag ? `${site}:${tag}` : null;
}

export function dedupKeyOf(meta = {}, { sha256 = null, mediaUrl = null } = {}) {
  const targetUrl = meta.postUrl || meta.pageUrl || mediaUrl || meta.mediaUrl || "";
  const site = classifySite(meta.site || targetUrl);
  const siteId = extractSiteId(site, meta.postUrl || meta.pageUrl || "");
  if (siteId) return siteId;
  if (sha256) return sha256.startsWith("sha256:") ? sha256 : `sha256:${sha256}`;
  const clean = stripTracking(mediaUrl || meta.mediaUrl || targetUrl);
  return clean ? `url:${clean}` : `${site}:unknown`;
}

export function deriveWorkflowHints({ mediaKind = "post", sourceSite = "generic", meta = {}, links = [] } = {}) {
  const hints = new Set();
  if (mediaKind === "audio" || mediaKind === "video" || mediaKind === "image") hints.add("distill_media");
  const allLinks = [meta.postUrl, meta.pageUrl, meta.mediaUrl, ...(meta.links || []), ...(links || [])].filter(Boolean).map(String);
  const hasResearchLink = allLinks.some((u) => PAPER_HOSTS.test(hostOf(u)) || /(^|\.)github\.com$/i.test(hostOf(u)));
  if (mediaKind === "whitepaper" || sourceSite === "arxiv" || sourceSite === "github" || hasResearchLink) hints.add("research_verify");
  if (mediaKind === "post" || CIVIC_SITES.has(sourceSite)) hints.add("civic_audit");
  return [...hints].sort();
}

export function sidecarRoutingMeta(meta = {}, { url = "", mime = "", ext = "", kind = "", sha256 = null } = {}) {
  const probeUrl = url || meta.mediaUrl || meta.postUrl || meta.pageUrl || "";
  const source_site = classifySite(meta.site || probeUrl);
  const media_kind = classifyMediaKind({ url: probeUrl, mime, ext, kind: kind || (meta.kind === "text" ? "post" : meta.kind), site: source_site, page: meta.page });
  const dedup_key = dedupKeyOf({ ...meta, site: source_site }, { sha256, mediaUrl: url || meta.mediaUrl });
  const workflow_hints = deriveWorkflowHints({ mediaKind: media_kind, sourceSite: source_site, meta });
  return { media_kind, source_site, dedup_key, workflow_hints, deconstruct_ready: true };
}

export function sanitizeFilename(name) {
  const raw = String(name || "media.bin").split(/[\\/]/).pop() || "media.bin";
  const m = /^(.*?)(\.[a-z0-9]{1,8})?$/i.exec(raw);
  const base = (slug((m && m[1]) || "media", 100) || "media").toLowerCase();
  const ext = ((m && m[2]) || "").replace(/[^.a-z0-9]/gi, "").toLowerCase();
  return `${base}${ext}`;
}

export function planStreamlinedDownload({
  meta = {}, url = "", mime = "", ext = "", kind = "", settings = null, sha256 = null,
  index = 0, total = 1, nameTag = undefined, study = false, library = null, organizeByType = null,
} = {}) {
  const routing = sidecarRoutingMeta(meta, { url, mime, ext, kind, sha256 });
  const subfolder = subfolderForKind(routing.media_kind);
  const useSub = organizeByType === null ? !!(settings && settings.mediaOrganizeByType) : !!organizeByType;
  const folder = savePath(settings, routing.source_site, study, library, useSub ? subfolder : null);
  const chosenExt = String(ext || extFromUrl(url) || (routing.media_kind === "whitepaper" ? "pdf" : routing.media_kind === "post" ? "md" : "bin")).replace(/^\./, "");
  const rawName = meta.author && meta.author.handle
    ? metaName({ ...meta, site: routing.source_site }, chosenExt, nameTag)
    : downloadName({ title: meta.title || meta.text || routing.source_site, url, index, total, ext: chosenExt });
  const filename = sanitizeFilename(rawName);
  return {
    sourceSite: routing.source_site,
    mediaKind: routing.media_kind,
    subfolder,
    folder,
    filename,
    path: `${folder}${filename}`,
    dedupKey: routing.dedup_key,
    workflowHints: routing.workflow_hints,
    deconstructReady: true,
  };
}
