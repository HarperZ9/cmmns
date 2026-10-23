// The labelling formats, dc-label/2, for the campaign-lens labelling protocol
// (project-docs/LABELLING.md, docs/LABELLING-RUN.md).
//
// Four JSON-lines files, each refused on the first bad line:
// - the case file: one row per case, an opaque id, the post's URL, an archive copy's URL, strata
//   codes and the SHA-256 of the page text captured for that case (the capture itself stays outside
//   the repository, with the raw captures);
// - one labels file per labeller: A is Claude, B an open-weight model of another family;
// - the resolution file: Claude's final label and written reason for each case where A and B differ;
// - the lens file: the detector's status per case, joined only after the labels are hashed.
// Rows hold structure only. Any key outside a row's set is refused, so post text, a handle or a
// name cannot travel in these files by accident.

export const FORMAT = "dc-label/2";
export const CAMPAIGN = ["paid-disclosed", "paid-undisclosed", "organic", "unsure"];
export const PAID = new Set(["paid-disclosed", "paid-undisclosed"]);
export const SEEN = ["yes", "no", "cannot-tell"];
export const FAMILIES = ["shape", "bios", "joins", "topic", "quotes", "overlap"];
export const LENS = ["strong", "one", "thin", "coordinated", "none", "undefined"];
export const PLATFORMS = ["x", "reddit", "youtube", "instagram", "tiktok", "bluesky", "threads", "facebook", "linkedin"];
export const AUDIENCE = ["under-10k", "10k-100k", "100k-1m", "1m-plus"];
export const TOPICS = ["tech", "crypto", "entertainment", "politics", "sport", "other"];
export const EVIDENCE = ["agency-case-study", "platform-notice", "court-or-regulator", "company-statement"];
export const LABELLERS = { A: "claude", B: "open-weight" };

const CASE_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9.:_/-]{0,63}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const LANGUAGE = /^[a-z]{2,3}$/;
const REGION = /^([A-Z]{2}|[0-9]{3}|unstated)$/;
const HTTPS = /^https:\/\/[^\s"<>]{3,2000}$/;
const ARCHIVE = /^https:\/\/(web\.archive\.org|archive\.(ph|today|is|org))\/[^\s"<>]+$/;

const KEYS = {
  case: new Set(["format", "kind", "case", "url", "archive", "capture", "strata"]),
  label: new Set(["format", "kind", "case", "labeller", "model", "campaign", "evidence", "families"]),
  resolution: new Set(["format", "kind", "case", "final", "evidence", "reason"]),
  lens: new Set(["format", "kind", "case", "lens"]),
};
const STRATA_KEYS = new Set(["platform", "audience", "topic", "language", "region"]);

export function fail(line, why) {
  throw new Error(`line ${line}: ${why}`);
}

function oneOf(line, name, value, set) {
  if (!set.includes(value)) fail(line, `${name} "${String(value).slice(0, 24)}" is not one of ${set.join(", ")}`);
}

function onlyKeys(line, obj, allowed, where) {
  for (const k of Object.keys(obj)) if (!allowed.has(k)) fail(line, `${where} key "${k}" is not part of ${FORMAT}; rows hold structure only, never post text, handles or names`);
}

function checkStrata(line, s) {
  if (!s || typeof s !== "object") fail(line, "strata missing");
  onlyKeys(line, s, STRATA_KEYS, "strata");
  oneOf(line, "platform", s.platform, PLATFORMS);
  oneOf(line, "audience", s.audience, AUDIENCE);
  oneOf(line, "topic", s.topic, TOPICS);
  if (!LANGUAGE.test(s.language || "")) fail(line, "language must be an ISO 639 code");
  if (!REGION.test(s.region || "")) fail(line, "region must be an ISO 3166 code, a UN M49 area or unstated");
}

function checkEvidence(line, campaign, evidence) {
  if (campaign === "paid-undisclosed") oneOf(line, "evidence", evidence, EVIDENCE);
  else if (evidence !== undefined) fail(line, "evidence is recorded only for paid-undisclosed");
}

// A reason is Claude's own words about the evidence. It may not quote a handle or a link.
export function checkReason(line, reason) {
  if (typeof reason !== "string" || reason.trim().length < 20) fail(line, "a resolution needs a written reason of at least 20 characters");
  if (reason.length > 800) fail(line, "a reason is at most 800 characters; it explains, it does not quote");
  if (/@[A-Za-z0-9_]{2,}|https?:\/\/|www\./.test(reason)) fail(line, "a reason may not carry a handle or a link");
}

const CHECK = {
  case(line, r) {
    if (!HTTPS.test(r.url || "")) fail(line, "url must be an https link to the public post");
    if (!ARCHIVE.test(r.archive || "")) fail(line, "archive must be an https link to an archive copy (Wayback Machine or archive.today)");
    if (!SHA256.test(r.capture || "")) fail(line, "capture must be the SHA-256 of the page text captured for this case");
    checkStrata(line, r.strata);
  },
  label(line, r) {
    if (!(r.labeller in LABELLERS)) fail(line, "labeller must be A (Claude) or B (the open-weight model)");
    if (!MODEL_ID.test(r.model || "")) fail(line, "model must name the labelling model, such as claude-opus-5-5 or qwen3:8b");
    oneOf(line, "campaign", r.campaign, CAMPAIGN);
    checkEvidence(line, r.campaign, r.evidence);
    const fam = r.families || {};
    onlyKeys(line, fam, new Set(FAMILIES), "families");
    for (const [k, v] of Object.entries(fam)) oneOf(line, `families.${k}`, v, SEEN);
  },
  resolution(line, r) {
    oneOf(line, "final", r.final, CAMPAIGN);
    checkEvidence(line, r.final, r.evidence);
    checkReason(line, r.reason);
  },
  lens(line, r) { oneOf(line, "lens", r.lens, LENS); },
};

// Parse one dc-label/2 file whose rows must all be of `kind`. Returns the rows.
export function parseRows(text, kind) {
  const rows = [], seen = new Set();
  String(text).split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim()) return;
    let r;
    try { r = JSON.parse(raw); } catch { fail(line, "not JSON"); }
    if (!r || typeof r !== "object" || Array.isArray(r)) fail(line, "not an object");
    if (r.format !== FORMAT) fail(line, `format must be ${FORMAT}`);
    if (r.kind !== kind) fail(line, `this file holds ${kind} rows, not ${r.kind}`);
    if (!CASE_ID.test(r.case || "")) fail(line, "case must be an opaque id (lower-case letters, digits, hyphens)");
    onlyKeys(line, r, KEYS[kind], "row");
    CHECK[kind](line, r);
    if (seen.has(r.case)) fail(line, `case ${r.case} appears twice`);
    seen.add(r.case);
    rows.push(r);
  });
  return rows;
}
