// Checks compiled declarativeNetRequest rules against the schema limits that can be tested offline.
import { DNR_TYPES } from "./adblock-options.mjs";

// Chrome's GUARANTEED_MINIMUM_STATIC_RULES. Both rulesets together stay at or under it.
export const STATIC_RULE_CAP = 30000;

const ACTIONS = new Set(["block", "allow", "allowAllRequests"]);
const DOMAIN_TYPES = new Set(["firstParty", "thirdParty"]);
const DOMAIN_RE = /^[a-z0-9.-]+$/;
const CONDITION_KEYS = new Set([
  "urlFilter", "isUrlFilterCaseSensitive", "resourceTypes", "excludedResourceTypes",
  "domainType", "initiatorDomains", "excludedInitiatorDomains", "requestDomains",
]);

// Returns the problems with one array field of a condition: empty, wrong element type, bad values.
function checkList(errors, name, list, ok) {
  if (list === undefined) return;
  if (!Array.isArray(list) || list.length === 0) errors.push(`${name} must be a non-empty array`);
  else if (!list.every(ok)) errors.push(`${name} has an invalid entry`);
}

// Checks the resource type fields, including the rule that a block never matches main_frame.
function checkTypes(errors, rule) {
  const c = rule.condition;
  const isType = (t) => DNR_TYPES.has(t);
  checkList(errors, "resourceTypes", c.resourceTypes, isType);
  checkList(errors, "excludedResourceTypes", c.excludedResourceTypes, isType);
  if (c.resourceTypes && c.excludedResourceTypes) errors.push("both type lists set");
  const type = rule.action.type;
  if (type === "allowAllRequests") {
    const frames = ["main_frame", "sub_frame"];
    if (!c.resourceTypes || !c.resourceTypes.every((t) => frames.includes(t))) {
      errors.push("allowAllRequests needs frame resourceTypes");
    }
  }
  if (type === "block") {
    const blocksPage = c.resourceTypes
      ? c.resourceTypes.includes("main_frame")
      : !(c.excludedResourceTypes || []).includes("main_frame");
    if (blocksPage) errors.push("block rule can match main_frame");
  }
}

// Returns a list of problems with one rule. An empty list means the rule passed.
export function validateRule(rule) {
  const errors = [];
  if (!Number.isInteger(rule.id) || rule.id < 1) errors.push("id must be a positive integer");
  if (!Number.isInteger(rule.priority) || rule.priority < 1) errors.push("bad priority");
  if (!rule.action || !ACTIONS.has(rule.action.type)) errors.push("bad action type");
  const c = rule.condition;
  if (!c || typeof c !== "object") return [...errors, "missing condition"];
  for (const key of Object.keys(c)) if (!CONDITION_KEYS.has(key)) errors.push(`unknown key ${key}`);
  if (c.urlFilter !== undefined) {
    if (typeof c.urlFilter !== "string" || !c.urlFilter) errors.push("empty urlFilter");
    else if (!/^[\x20-\x7e]+$/.test(c.urlFilter)) errors.push("urlFilter not ASCII");
    else if (c.urlFilter.startsWith("||*")) errors.push("urlFilter starts with ||*");
    if (c.isUrlFilterCaseSensitive === undefined) errors.push("case sensitivity not explicit");
  }
  if (c.isUrlFilterCaseSensitive !== undefined && typeof c.isUrlFilterCaseSensitive !== "boolean") {
    errors.push("isUrlFilterCaseSensitive must be boolean");
  }
  if (c.domainType !== undefined && !DOMAIN_TYPES.has(c.domainType)) errors.push("bad domainType");
  const isDomain = (d) => typeof d === "string" && DOMAIN_RE.test(d);
  checkList(errors, "initiatorDomains", c.initiatorDomains, isDomain);
  checkList(errors, "excludedInitiatorDomains", c.excludedInitiatorDomains, isDomain);
  checkList(errors, "requestDomains", c.requestDomains, isDomain);
  if (rule.action) checkTypes(errors, rule);
  return errors;
}

// Validates several rulesets together: every rule, ids unique across all of them, and the shared cap.
export function validateRulesets(rulesets, cap = STATIC_RULE_CAP) {
  const errors = [];
  const seen = new Set();
  let total = 0;
  for (const [name, rules] of Object.entries(rulesets)) {
    if (!Array.isArray(rules)) {
      errors.push(`${name}: not an array`);
      continue;
    }
    total += rules.length;
    for (const rule of rules) {
      for (const e of validateRule(rule)) errors.push(`${name} rule ${rule.id}: ${e}`);
      if (seen.has(rule.id)) errors.push(`${name}: duplicate id ${rule.id}`);
      seen.add(rule.id);
    }
  }
  if (total > cap) errors.push(`${total} rules exceed the cap of ${cap}`);
  return errors;
}
