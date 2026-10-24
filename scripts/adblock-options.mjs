// Parses the options after "$" in an Adblock Plus network filter into declarativeNetRequest condition fields.
import { domainToASCII } from "node:url";

// Resource types that both Chrome and Firefox accept in a declarativeNetRequest rule.
export const DNR_TYPES = new Set([
  "main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object",
  "xmlhttprequest", "ping", "csp_report", "media", "websocket", "other",
]);

// Filter type option name to DNR resource type. "document" is handled separately.
const TYPE_MAP = {
  script: "script", image: "image", stylesheet: "stylesheet", css: "stylesheet",
  xmlhttprequest: "xmlhttprequest", xhr: "xmlhttprequest", subdocument: "sub_frame",
  frame: "sub_frame", media: "media", font: "font", websocket: "websocket",
  ping: "ping", beacon: "ping", object: "object", other: "other",
};

// Options DNR cannot express. A filter that carries any of them is skipped whole.
const UNSUPPORTED = new Set([
  "csp", "redirect", "redirect-rule", "removeparam", "rewrite", "replace", "popup",
  "generichide", "ghide", "elemhide", "ehide", "specifichide", "shide", "genericblock",
  "badfilter", "header", "permissions", "cookie", "empty", "mp4", "inline-script",
  "inline-font", "webrtc", "to", "method", "denyallow",
]);

// Splits "domain=a.com|~b.com" into lowercase ASCII include and exclude lists, or returns a skip reason.
export function parseDomains(value) {
  const include = [];
  const exclude = [];
  for (const raw of value.split("|")) {
    const negated = raw.startsWith("~");
    const name = (negated ? raw.slice(1) : raw).trim().toLowerCase();
    if (!name) return { reason: "bad-domain" };
    if (name.includes("*") || name.includes("/")) return { reason: "domain-wildcard" };
    const ascii = domainToASCII(name);
    if (!ascii || !/^[a-z0-9.-]+$/.test(ascii)) return { reason: "bad-domain" };
    (negated ? exclude : include).push(ascii);
  }
  return { include, exclude };
}

// Applies one non-type option to the parse state. Returns a skip reason, or null when accepted.
function applyOption(state, name, value, negated) {
  if (UNSUPPORTED.has(name)) return `option:${name}`;
  if (name === "third-party" || name === "3p") {
    state.domainType = negated ? "firstParty" : "thirdParty";
  } else if (name === "first-party" || name === "1p") {
    state.domainType = negated ? "thirdParty" : "firstParty";
  } else if (name === "match-case" && !negated) {
    state.caseSensitive = true;
  } else if (name === "important" && !negated) {
    state.important = true;
  } else if ((name === "domain" || name === "from") && !negated && value) {
    const d = parseDomains(value);
    if (d.reason) return d.reason;
    state.include = d.include;
    state.exclude = d.exclude;
  } else {
    return "option:unknown";
  }
  return null;
}

// Parses an option string such as "script,~third-party,domain=a.com" into a state object or { reason }.
export function parseOptions(text) {
  const state = {
    types: [], notTypes: [], document: false, domainType: null,
    caseSensitive: false, important: false, include: [], exclude: [],
  };
  if (!text) return state;
  for (const part of text.split(",")) {
    const eq = part.indexOf("=");
    const key = (eq < 0 ? part : part.slice(0, eq)).trim().toLowerCase();
    const value = eq < 0 ? "" : part.slice(eq + 1).trim();
    const negated = key.startsWith("~");
    const name = negated ? key.slice(1) : key;
    if (!name) return { reason: "option:unknown" };
    if (name === "document" || name === "doc") {
      if (negated) return { reason: "option:unknown" };
      state.document = true;
      continue;
    }
    if (TYPE_MAP[name] && !value) {
      (negated ? state.notTypes : state.types).push(TYPE_MAP[name]);
      continue;
    }
    const reason = applyOption(state, name, value, negated);
    if (reason) return { reason };
  }
  return state;
}

// Turns parsed type options into resourceTypes or excludedResourceTypes for a block or allow rule.
export function typeFields(state, isBlock) {
  const not = new Set(state.notTypes);
  if (state.types.length) {
    const list = [...new Set(state.types)].filter((t) => !not.has(t)).sort();
    return list.length ? { resourceTypes: list } : { reason: "no-types" };
  }
  const excluded = new Set(not);
  if (isBlock) excluded.add("main_frame");
  return excluded.size ? { excludedResourceTypes: [...excluded].sort() } : {};
}
