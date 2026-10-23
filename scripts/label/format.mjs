// The labels file format, dc-label/1, for the campaign-lens labelling protocol
// (project-docs/EVALUATION.md, "Launch campaigns"; project-docs/LABELLING.md).
//
// One JSON object per line. A row is one labeller's reading of one case, or the lens's own status
// for one case, written by the coordinator. Rows hold structure only: an opaque case id, closed
// label sets, strata codes. A row with any other key, or a value outside its set, is refused, so a
// handle, a name, a bio, a link or post text cannot travel in a labels file by accident.

export const FORMAT = "dc-label/1";
export const CAMPAIGN = ["paid-disclosed", "paid-undisclosed", "organic", "unsure"];
export const PAID = new Set(["paid-disclosed", "paid-undisclosed"]);
export const SEEN = ["yes", "no", "cannot-tell"];
export const FAMILIES = ["shape", "bios", "joins", "topic", "quotes", "overlap"];
export const LENS = ["strong", "one", "thin", "coordinated", "none", "undefined"];
export const PLATFORMS = ["x", "reddit", "youtube", "instagram", "tiktok", "bluesky", "threads", "facebook", "linkedin"];
export const AUDIENCE = ["under-10k", "10k-100k", "100k-1m", "1m-plus"];
export const TOPICS = ["tech", "crypto", "entertainment", "politics", "sport", "other"];
// Paid-undisclosed needs evidence from outside Daylight Commons. The kind is recorded, never the
// document itself (the coordinator keeps that outside the repository).
export const EVIDENCE = ["agency-case-study", "platform-notice", "court-or-regulator", "company-statement"];

const CASE_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const LABELLER_ID = /^L[0-9]{1,2}$/;
const LANGUAGE = /^[a-z]{2,3}$/; // ISO 639-1 or 639-3
const REGION = /^([A-Z]{2}|[0-9]{3}|unstated)$/; // ISO 3166-1 alpha-2, UN M49 area, or unstated

const LABEL_KEYS = new Set(["format", "kind", "case", "labeller", "campaign", "evidence", "families", "strata"]);
const LENS_KEYS = new Set(["format", "kind", "case", "lens"]);
const STRATA_KEYS = new Set(["platform", "audience", "topic", "language", "region"]);

function fail(line, why) {
  throw new Error(`labels line ${line}: ${why}`);
}

function oneOf(line, name, value, set) {
  if (!set.includes(value)) fail(line, `${name} "${String(value).slice(0, 24)}" is not one of ${set.join(", ")}`);
}

function onlyKeys(line, obj, allowed, where) {
  for (const k of Object.keys(obj)) if (!allowed.has(k)) fail(line, `${where} key "${k}" is not part of ${FORMAT}; rows hold structure only, never text, handles or links`);
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

function checkLabel(line, r) {
  onlyKeys(line, r, LABEL_KEYS, "row");
  if (!LABELLER_ID.test(r.labeller || "")) fail(line, "labeller must be an opaque id such as L1");
  oneOf(line, "campaign", r.campaign, CAMPAIGN);
  if (r.campaign === "paid-undisclosed") oneOf(line, "evidence", r.evidence, EVIDENCE);
  else if (r.evidence !== undefined) fail(line, "evidence is recorded only for paid-undisclosed");
  const fam = r.families || {};
  onlyKeys(line, fam, new Set(FAMILIES), "families");
  for (const [k, v] of Object.entries(fam)) oneOf(line, `families.${k}`, v, SEEN);
  checkStrata(line, r.strata);
}

// Parse a dc-label/1 file. Returns { labels, lens } or throws on the first bad line.
export function parseLabels(text) {
  const labels = [], lens = [];
  const lines = String(text).split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim()) return;
    let r;
    try { r = JSON.parse(raw); } catch { fail(line, "not JSON"); }
    if (!r || typeof r !== "object" || Array.isArray(r)) fail(line, "not an object");
    if (r.format !== FORMAT) fail(line, `format must be ${FORMAT}`);
    if (!CASE_ID.test(r.case || "")) fail(line, "case must be an opaque id (lower-case letters, digits, hyphens)");
    if (r.kind === "label") { checkLabel(line, r); labels.push(r); }
    else if (r.kind === "lens") { onlyKeys(line, r, LENS_KEYS, "row"); oneOf(line, "lens", r.lens, LENS); lens.push(r); }
    else fail(line, 'kind must be "label" or "lens"');
  });
  return { labels, lens };
}
