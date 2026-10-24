// Compiles Adblock Plus filter list text into declarativeNetRequest rules, with skip counts by reason.
import { mergeHostRules } from "./adblock-merge.mjs";
import { parseOptions, typeFields } from "./adblock-options.mjs";

// Priorities: allow beats block, and an $important block beats allow.
export const PRIORITY = { block: 1, allow: 2, important: 3 };

// Cap tiers, kept in this order when a list produces more rules than fit.
export const TIERS = ["allow", "host", "other"];

const COSMETIC_RE = /#@?(\$\?|[?$%])?#/;
const HOST_ONLY_RE = /^\|\|[a-z0-9.-]+\^$/;

// Returns the skip reason for a line that is not a network filter, or null for a network filter.
export function lineKind(line) {
  if (line.startsWith("!")) return "comment";
  if (line.startsWith("[")) return "header";
  if (COSMETIC_RE.test(line)) return "cosmetic";
  if (line.includes("$$")) return "html-filter";
  return null;
}

// Splits a filter body into its pattern and its option text at the last "$".
function splitFilter(body) {
  const at = body.lastIndexOf("$");
  if (at < 0) return { pattern: body, options: "" };
  return { pattern: body.slice(0, at), options: body.slice(at + 1) };
}

// Turns an ABP pattern into a DNR urlFilter, or returns a skip reason.
export function toUrlFilter(pattern) {
  if (pattern.length > 1 && pattern.startsWith("/") && pattern.endsWith("/")) return { reason: "regex" };
  let p = pattern;
  if (!p.startsWith("|")) p = p.replace(/^\*+/, "");
  if (!p.endsWith("|")) p = p.replace(/\*+$/, "");
  if (!/^[\x21-\x7e]*$/.test(p)) return { reason: "non-ascii" };
  if (p.replace(/[|^*]/g, "").length < 4) return { reason: "too-short" };
  if (p.startsWith("||*")) return { reason: "bad-anchor" };
  const inner = p.slice(p.startsWith("||") ? 2 : p.startsWith("|") ? 1 : 0, p.endsWith("|") ? -1 : undefined);
  if (inner.includes("|")) return { reason: "bad-anchor" };
  return { urlFilter: p };
}

// Builds the action, priority and resource types for a parsed filter, or returns a skip reason.
function actionFields(isAllow, opts) {
  if (opts.document) {
    if (!isAllow) return { reason: "document-block" };
    if (opts.types.length || opts.notTypes.length) return { reason: "document-mixed" };
    return { type: "allowAllRequests", priority: PRIORITY.allow, types: { resourceTypes: ["main_frame", "sub_frame"] } };
  }
  const types = typeFields(opts, !isAllow);
  if (types.reason) return types;
  if (isAllow) return { type: "allow", priority: PRIORITY.allow, types };
  return { type: "block", priority: opts.important ? PRIORITY.important : PRIORITY.block, types };
}

// Compiles one network filter line into { rule, tier } without an id, or { reason }.
export function compileLine(line) {
  const isAllow = line.startsWith("@@");
  const { pattern, options } = splitFilter(isAllow ? line.slice(2) : line);
  const opts = parseOptions(options);
  if (opts.reason) return opts;
  const url = toUrlFilter(pattern);
  if (url.reason) return url;
  const act = actionFields(isAllow, opts);
  if (act.reason) return act;
  const condition = { urlFilter: url.urlFilter, isUrlFilterCaseSensitive: opts.caseSensitive, ...act.types };
  if (opts.domainType) condition.domainType = opts.domainType;
  if (opts.include.length) condition.initiatorDomains = [...new Set(opts.include)].sort();
  if (opts.exclude.length) condition.excludedInitiatorDomains = [...new Set(opts.exclude)].sort();
  const rule = { priority: act.priority, action: { type: act.type }, condition };
  const tier = act.type !== "block" ? "allow" : HOST_ONLY_RE.test(url.urlFilter) ? "host" : "other";
  return { rule, tier };
}

// Counts one skip reason in a plain object.
function bump(counts, reason, n = 1) {
  counts[reason] = (counts[reason] || 0) + n;
}

// Parses every line of a list into candidate rules in file order, dropping exact duplicates.
export function collectCandidates(text) {
  const skipped = {};
  const candidates = [];
  const seen = new Set();
  let read = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    read += 1;
    const kind = lineKind(line);
    if (kind) {
      bump(skipped, kind);
      continue;
    }
    const out = compileLine(line);
    if (out.reason) {
      bump(skipped, out.reason);
      continue;
    }
    const key = JSON.stringify(out.rule);
    if (seen.has(key)) {
      bump(skipped, "duplicate");
      continue;
    }
    seen.add(key);
    candidates.push(out);
  }
  return { read, skipped, candidates };
}

// Counts candidates per cap tier.
export function tierCounts(candidates) {
  const counts = { allow: 0, host: 0, other: 0 };
  for (const c of candidates) counts[c.tier] += 1;
  return counts;
}

// Keeps at most max candidates, filling tiers in TIERS order and keeping file order within the result.
export function selectWithinCap(candidates, max) {
  if (candidates.length <= max) return candidates;
  const keep = new Set();
  let left = max;
  for (const tier of TIERS) {
    for (const c of candidates) {
      if (left === 0) break;
      if (c.tier === tier) {
        keep.add(c);
        left -= 1;
      }
    }
  }
  return candidates.filter((c) => keep.has(c));
}

// Sorts an object's keys so the skip counts serialise in a stable order.
function sortedCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : 1)));
}

// Parses a list and merges its host-only filters: the candidate rules before ids and the cap.
export function prepareCandidates(text) {
  const { read, skipped, candidates } = collectCandidates(text);
  const merge = mergeHostRules(candidates);
  return { read, skipped, candidates: merge.candidates, merged: { filters: merge.absorbed, subdomainsPruned: merge.pruned } };
}

// Compiles list text into DNR rules with sequential ids from idStart, keeping at most max rules.
export function compileFilters(text, { idStart = 1, max = Infinity } = {}) {
  const { read, skipped, candidates, merged } = prepareCandidates(text);
  const kept = selectWithinCap(candidates, max);
  const rules = kept.map((c, i) => ({ id: idStart + i, ...c.rule }));
  const droppedByCap = candidates.length - kept.length;
  return { rules, skipped: sortedCounts(skipped), read, merged, droppedByCap, tiers: tierCounts(candidates) };
}
