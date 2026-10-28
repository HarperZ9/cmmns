// The launch campaign lens (project-docs/CAMPAIGN-LENS.md): combines the engagement shape, the
// reposter and replier sample, the quote cluster and cross-launch overlap into a lead line and
// evidence rows, each with what it does not prove.
//
// The lead names inauthenticity indicators only. Coordination on its own is neutral context:
// fandoms, mutual aid, protest hashtags and diaspora communities coordinate in the open. Sampled
// accounts are never named: no handle of theirs is ever returned, and the lens never says "bot".
// The launch's own account is named only when the platform discloses it as an organisation.

import { engagementShape, SHAPE_DOES_NOT_PROVE } from "./campaign-shape.js";
import { sampleSigns, SAMPLE_DOES_NOT_PROVE, SAMPLE_MIN } from "./campaign-sample.js";
import { quoteCluster, QUOTES_DOES_NOT_PROVE, BUNCH_TIGHT_MS } from "./campaign-quotes.js";
import { OVERLAP_DOES_NOT_PROVE } from "./campaign-overlap.js";
import { campaignPlatform, CAMPAIGN_PLATFORMS } from "./campaign-platforms.js";

export const CAMPAIGN_DOES_NOT_PROVE = "These signs describe how this post's engagement looks in what your page loaded. Real people also write stock bios, join in waves and reshare launches.";
export const CAMPAIGN_LEADS = {
  strong: "This engagement is consistent with purchased amplification, and here is why.",
  one: "One sign of paid or fake-account amplification. One sign is weak evidence: read it as context.",
  coordinated: "The engagement looks coordinated. Coordination alone is common and often organic.",
  none: "Zero campaign signs in what this page loaded.",
  thin: "Too few accounts loaded to read. Open the post's reposts or quotes to load more.",
  undefined: "The campaign lens for this site is still to come.",
};
export const CAMPAIGN_DISPUTE = "Think this is wrong? Report it at https://github.com/HarperZ9/cmmns/issues. Corrections are made in the open.";

// The accusation ladder (project-docs/CAMPAIGN-LENS.md, "Accusation ladder"). Only an account the
// platform itself discloses as an organisation (X's gold Business or grey Government checkmark, or
// a Business professional profile) is ever named. Ordinary accounts are never named: they appear
// only inside counts. The ladder never claims a crime.
export function actorOf(reading) {
  const R = reading || {};
  const org = R.verifiedType === "Business" || R.verifiedType === "Government" || R.professionalType === "Business";
  return org && R.handle ? { handle: R.handle, kind: R.verifiedType === "Government" ? "official account" : "organisation" } : null;
}

// Held until a media lawyer reviews the ladder's wording (project-docs/CAMPAIGN-LENS.md, "Legal
// review before public release"): while true, no organisation is named and the blunt step-2 line
// ("paid buzz dressed as organic") is left out, so every claim reads "this launch". The evidence,
// the lead and the unnamed inference are unchanged. Set to false only after the review, in the
// same commit as its record.
export const NAMING_HELD = true;

// Ladder step 1 (documented fact) and step 2 (named inference), as lines above the evidence.
function ladder(status, families, qc, actor, held) {
  const who = actor && !held ? `@${actor.handle}'s launch` : "this launch";
  const out = [];
  if (qc.disclosed) out.push({ step: 1, text: `Documented: ${qc.disclosed} quote post${qc.disclosed === 1 ? "" : "s"} promoting ${who} carry X's Paid partnership label, the posters' own disclosure.` });
  if (status === "strong") {
    out.push({ step: 2, text: `Inference: the engagement on ${who} is consistent with purchased amplification (${families.length} independent signs below).` });
    if (families.includes("quotes") && !held) out.push({ step: 2, text: `Inference: paid buzz dressed as organic. Unlabelled quotes share the paid quotes' template and timing.` });
  }
  return out;
}

// Indicator id -> independent family. bio-template and stock-persona both read bios, so they count once.
const FAMILY = { "shape-outlier-own": "shape", "bio-template": "bios", "stock-persona": "bios", "join-cluster": "joins", "topic-mismatch": "topic", "undisclosed-lookalike": "quotes", "cross-launch": "overlap" };
const pct = (x) => `${Math.round(x * 100)}%`;
const r2 = (x) => (x === Infinity ? "no likes" : Math.round(x * 100) / 100);
const mins = (ms) => (ms < 3600000 ? `${Math.max(1, Math.round(ms / 60000))} minutes` : `${Math.round(ms / 360000) / 10} hours`);

function shapeRows(sh) {
  if (!sh || sh.tooFew) return { ind: [], ctx: [] };
  const v = sh.shape.repostsPerLike, ind = [], ctx = [];
  const own = sh.own.insufficient ? `Too few of this account's own posts seen on this device to compare (${sh.own.n} of 5).` : `This account's other posts: median ${r2(sh.own.median)} reposts per like, highest ${r2(sh.own.max)} (${sh.own.n} posts).`;
  const line = `Reposts per like: ${r2(v)} (${sh.shape.counts.reposts} reposts, ${sh.shape.counts.likes} likes). ${own}`;
  (sh.outlier ? ind : ctx).push({ id: sh.outlier ? "shape-outlier-own" : "shape", text: line, dnp: SHAPE_DOES_NOT_PROVE });
  ctx.push({ id: "shape-baseline", text: sh.current ? `Against ${sh.current.n} ordinary posts in the ${sh.stratum} stratum: ${sh.current.position}.` : `Insufficient baseline for this platform today${sh.stratum ? ` (${sh.stratum})` : ""}: no labelled modern sample yet.`, dnp: "A baseline describes posts that were collected as ordinary." });
  const h = sh.historical;
  if (h && !h.noStratum) ctx.push({ id: "shape-historical", text: `Historical reference: ${h.source}, ${h.label}: ${h.position} (median ${h.q.q50}, 95th percentile ${h.q.q95}).`, dnp: "Breaking news in 2014 and 2015 was reposted more than liked. Today's platform and topics differ, so this line stays context." });
  return { ind, ctx };
}

function sampleRows(s) {
  if (!s || !s.enough) return { ind: [], ctx: [] };
  const text = {
    "bio-template": (x) => `${x.accounts} of ${x.of} bios fall into ${x.groups} shared template${x.groups === 1 ? "" : "s"} (largest ${x.largest}).`,
    "stock-persona": (x) => `${x.n} of ${x.of} accounts (${pct(x.share)}) have stock-persona bios: age, passion, crypto slogan, pet or filler phrases together.`,
    "join-cluster": (x) => `${x.n} of ${x.of} accounts with a join date joined within 14 days (${x.from} to ${x.to}).`,
    "topic-mismatch": (x) => `${x.n} of ${x.of} bios with a clear topic are about ${x.families.slice(0, 2).join(" and ")}, a different topic from this post.`,
    "random-suffix": (x) => `Context: ${x.n} of ${x.of} handles end in a number-and-letter tail. People choose these for privacy too; this stays context.`,
    "default-avatar": (x) => `Context: ${x.n} of ${x.of} accounts use the default picture.`,
  };
  const row = (x) => ({ id: x.id, text: text[x.id](x), dnp: SAMPLE_DOES_NOT_PROVE[x.id] });
  return { ind: s.indicators.map(row), ctx: [{ id: "sample", text: `Sample: ${s.n} accounts from the lists this page loaded, ${s.bios} with a bio.`, dnp: "CMMNS reads what the platform showed you, in the order it chose." }, ...s.context.map(row)] };
}

function quoteRows(q) {
  if (!q || !q.n) return { ind: [], ctx: [] };
  const ind = [], ctx = [];
  if (q.lookalikes) ind.push({ id: "undisclosed-lookalike", text: `${q.lookalikes} quote${q.lookalikes === 1 ? "" : "s"} without a Paid partnership label share a template with labelled quotes or with each other inside two hours.`, dnp: QUOTES_DOES_NOT_PROVE });
  if (q.disclosed) ctx.push({ id: "disclosed-paid", text: `${q.disclosed} of ${q.n} quotes carry X's Paid partnership label. Disclosed promotion is the honest path.`, dnp: "The label is the poster's own disclosure; who paid and how much stay off the page." });
  // Any launch with five quotes has a narrowest window; only a tight one is coordination context.
  if (q.bunch.kWindowMs != null) ctx.push({ id: q.bunch.kWindowMs <= BUNCH_TIGHT_MS ? "quote-bunching" : "quote-timing", text: `${q.bunch.k} quotes within ${mins(q.bunch.kWindowMs)}; busiest hour ${q.bunch.hourMax} of ${q.n}.`, dnp: QUOTES_DOES_NOT_PROVE });
  for (const c of q.cues.slice(0, 2)) ctx.push({ id: "promo-cue", text: `${c.n} quotes use the "${c.id}" phrasing (${c.source === "radar-local" ? "CMMNS' local list" : c.source}).`, dnp: QUOTES_DOES_NOT_PROVE });
  return { ind, ctx };
}

function overlapRows(o) {
  if (!o || !o.launches) return { ind: [], ctx: [] };
  const row = { id: o.indicator ? "cross-launch" : "overlap", text: `${o.repeat} of ${o.n} sampled accounts were seen amplifying 2 or more of the ${o.launches} other launches you opened (stored on this device only).`, dnp: OVERLAP_DOES_NOT_PROVE };
  return o.indicator ? { ind: [row], ctx: [] } : { ind: [], ctx: o.repeat ? [row] : [] };
}

// input: { platform, post: counts + { followers, text }, ownPosts, accounts, quotes, overlap, actor, timePrecision }
// timePrecision: how precise the quote times are (src/core/precision.js); inferred from them when absent.
// actor: actorOf(the launch author's reading), or null; only a disclosed organisation is named.
export function campaignLens(input) {
  const def = campaignPlatform(input && input.platform);
  if (!def) return { status: "undefined", lead: CAMPAIGN_LEADS.undefined, notes: (CAMPAIGN_PLATFORMS[input && input.platform] || {}).notes || null, indicators: [], context: [], dnp: CAMPAIGN_DOES_NOT_PROVE };
  const sh = input.post ? engagementShape(input.platform, input.post, input.ownPosts) : null;
  const sm = sampleSigns(input.accounts, input.post && input.post.text);
  const qc = quoteCluster(input.quotes, { precision: input.timePrecision });
  const parts = [shapeRows(sh), sampleRows(sm), quoteRows(qc), overlapRows(input.overlap)];
  const indicators = parts.flatMap((p) => p.ind), context = parts.flatMap((p) => p.ctx);
  const families = [...new Set(indicators.map((i) => FAMILY[i.id]))];
  const coordinated = context.some((c) => ["quote-bunching", "overlap", "promo-cue", "disclosed-paid"].includes(c.id));
  const thin = sm.n < SAMPLE_MIN && !qc.n;
  const status = families.length >= 2 ? "strong" : families.length === 1 ? "one" : thin ? "thin" : coordinated ? "coordinated" : "none";
  // input.reviewed lets a test exercise the reviewed wording; the extension never passes it.
  const held = input.reviewed === true ? false : NAMING_HELD;
  const claims = ladder(status, families, qc, input.actor || null, held);
  return { status, lead: CAMPAIGN_LEADS[status], claims, naming: held ? "held" : "on", families, indicators, context, sample: sm.n, quotes: qc.n, dnp: CAMPAIGN_DOES_NOT_PROVE, dispute: CAMPAIGN_DISPUTE };
}
