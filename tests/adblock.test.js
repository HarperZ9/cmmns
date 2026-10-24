// Tests the EasyList and EasyPrivacy compiler on hand-written filters and checks the committed rulesets.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { compileFilters, selectWithinCap } from "../scripts/adblock-compile.mjs";
import { mergeHostRules, pruneSubdomains } from "../scripts/adblock-merge.mjs";
import { DNR_TYPES } from "../scripts/adblock-options.mjs";
import { STATIC_RULE_CAP, validateRule, validateRulesets } from "../scripts/adblock-validate.mjs";
import { LISTS, buildOutputs, planBudgets, readHeader } from "../scripts/adblock-build.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const FIXTURE = [
  "[Adblock Plus 2.0]", "! comment", "", "example.com##.ad", "example.com#@#.ad", "example.com#?#div:has(.ad)",
  "example.com#$#abort-on-property-read x", "example.com#%#window.x=1", 'example.com$$script[tag-content="ad"]',
  "/banner[0-9]+/", "||ads.example.com^", "||ads.example.com^", "||sub.ads.example.com^", "||tracker.test^$third-party",
  "/adframe/*$subdocument,~third-party", "-ad-banner.$image,~image", "/pixel.gif$~image,3p",
  "@@||cdn.example.com/ads.js$script,domain=news.example|~sport.news.example",
  "@@||site.example^$document", "@@||site2.example^$document,script", "||page.example^$document",
  "||bad.example/x.js$important,script,1p", "/MixedCase.js$match-case,xhr", "|https://a.example/b|",
  "*", "ab^", "||*.x.example/ads", "a|b.example/x", "/añuncio.js", "/ads.js$domain=bücher.example",
  "/ad.js$domain=google.*", "/ad.js$csp=script-src 'none'", "/ad.js$redirect=noop.js", "/ad.js$removeparam=utm",
  "/ad.js$popup", "@@||x.example^$generichide", "/ad.js$badfilter", "/ad.js$to=x.example", "/ad.js$method=post",
  "/ad.js$denyallow=x.example", "/ad.js$sitekey=abc", "/ad.js$webrtc", "/ad.js$header=x",
  "*ad-unit*$websocket,ping,font,media,object,other,stylesheet",
].join("\n");

const NO_PAGE = { excludedResourceTypes: ["main_frame"] };
const block = (id, condition, priority = 1) => ({ id, priority, action: { type: "block" }, condition });
const url = (urlFilter, rest = {}, isUrlFilterCaseSensitive = false) => ({ urlFilter, isUrlFilterCaseSensitive, ...rest });

const EXPECTED_RULES = [
  block(10, { requestDomains: ["ads.example.com"], ...NO_PAGE }),
  block(11, { requestDomains: ["tracker.test"], ...NO_PAGE, domainType: "thirdParty" }),
  block(12, url("/adframe/", { resourceTypes: ["sub_frame"], domainType: "firstParty" })),
  block(13, url("/pixel.gif", { excludedResourceTypes: ["image", "main_frame"], domainType: "thirdParty" })),
  {
    id: 14, priority: 2, action: { type: "allow" },
    condition: url("||cdn.example.com/ads.js", {
      resourceTypes: ["script"], initiatorDomains: ["news.example"], excludedInitiatorDomains: ["sport.news.example"],
    }),
  },
  {
    id: 15, priority: 2, action: { type: "allowAllRequests" },
    condition: { requestDomains: ["site.example"], resourceTypes: ["main_frame", "sub_frame"] },
  },
  block(16, url("||bad.example/x.js", { resourceTypes: ["script"], domainType: "firstParty" }), 3),
  block(17, url("/MixedCase.js", { resourceTypes: ["xmlhttprequest"] }, true)),
  block(18, url("|https://a.example/b|", NO_PAGE)),
  block(19, url("/ads.js", { ...NO_PAGE, initiatorDomains: ["xn--bcher-kva.example"] })),
  block(20, url("ad-unit", { resourceTypes: ["font", "media", "object", "other", "ping", "stylesheet", "websocket"] })),
];

const EXPECTED_SKIPPED = {
  "bad-anchor": 2, comment: 1, cosmetic: 5, "document-block": 1, "document-mixed": 1, "domain-wildcard": 1,
  duplicate: 1, header: 1, "html-filter": 1, "no-types": 1, "non-ascii": 1, "option:badfilter": 1,
  "option:csp": 1, "option:denyallow": 1, "option:generichide": 1, "option:header": 1, "option:method": 1,
  "option:popup": 1, "option:redirect": 1, "option:removeparam": 1, "option:to": 1, "option:unknown": 1,
  "option:webrtc": 1, regex: 1, "too-short": 2,
};

test("fixture compiles to the exact expected rules", () => {
  const out = compileFilters(FIXTURE, { idStart: 10 });
  assert.deepEqual(out.rules, EXPECTED_RULES);
  assert.deepEqual(out.skipped, EXPECTED_SKIPPED);
  assert.deepEqual(out.merged, { filters: 4, subdomainsPruned: 1 });
  assert.equal(out.droppedByCap, 0);
  for (const rule of out.rules) assert.deepEqual(validateRule(rule), [], `rule ${rule.id}`);
});

test("every non-blank line is accounted for as a rule, a merged host or a skip", () => {
  const out = compileFilters(FIXTURE);
  const skipped = Object.values(out.skipped).reduce((a, b) => a + b, 0);
  const hostRules = out.rules.filter((r) => r.condition.requestDomains).length;
  assert.equal(out.read, 43);
  assert.equal(out.rules.length - hostRules + out.merged.filters + skipped, out.read);
});

test("the cap keeps allow rules first, then host blocks, in file order", () => {
  const cands = [
    { tier: "other", rule: { n: 1 } }, { tier: "allow", rule: { n: 2 } },
    { tier: "host", rule: { n: 3 } }, { tier: "allow", rule: { n: 4 } },
  ];
  assert.deepEqual(selectWithinCap(cands, 3).map((c) => c.rule.n), [2, 3, 4]);
  const out = compileFilters("/a/b/c.js\n||one.example^\n@@||two.example/x\n/d/e/f.js", { max: 2 });
  assert.equal(out.droppedByCap, 2);
  assert.deepEqual(out.rules.map((r) => r.id), [1, 2]);
  assert.equal(out.rules[0].condition.requestDomains[0], "one.example");
  assert.equal(out.rules[1].action.type, "allow");
});

test("planBudgets splits the shared cap tier by tier", () => {
  const counts = [{ allow: 2, host: 10, other: 50 }, { allow: 3, host: 10, other: 50 }];
  assert.deepEqual(planBudgets(counts, 1000), [62, 63]);
  assert.deepEqual(planBudgets(counts, 15), [7, 8]);
  assert.deepEqual(planBudgets(counts, 35), [17, 18]);
});

test("host merging chunks large groups and prunes covered subdomains", () => {
  assert.deepEqual(pruneSubdomains(["a.b.example", "b.example", "c.example", "b.example"]), ["b.example", "c.example"]);
  const cands = ["h1.example", "h2.example", "h3.example"].map((h) => ({
    tier: "host",
    rule: { priority: 1, action: { type: "block" }, condition: { urlFilter: `||${h}^`, isUrlFilterCaseSensitive: false } },
  }));
  const out = mergeHostRules(cands, 2);
  assert.equal(out.absorbed, 3);
  assert.deepEqual(out.candidates.map((c) => c.rule.condition.requestDomains), [["h1.example", "h2.example"], ["h3.example"]]);
});

test("the validator rejects rules DNR would refuse or that block whole pages", () => {
  const ok = { id: 1, priority: 1, action: { type: "block" }, condition: url("/ads/x", NO_PAGE) };
  assert.deepEqual(validateRule(ok), []);
  const bad = (condition, extra = {}) => validateRule({ ...ok, ...extra, condition });
  assert.ok(bad({ urlFilter: "/ads/x", isUrlFilterCaseSensitive: false }).includes("block rule can match main_frame"));
  assert.ok(bad(url("/ads/x", { resourceTypes: ["main_frame"] })).includes("block rule can match main_frame"));
  assert.ok(bad(url("/ads/x", { resourceTypes: [] })).some((e) => e.includes("non-empty")));
  assert.ok(bad(url("/ads/x", { resourceTypes: ["beacon"] })).some((e) => e.includes("invalid entry")));
  assert.ok(bad({ urlFilter: "/ads/x", ...NO_PAGE }).includes("case sensitivity not explicit"));
  assert.ok(bad(url("/ads/x", NO_PAGE), { id: 0 }).includes("id must be a positive integer"));
  assert.ok(bad(url("/ads/x", NO_PAGE), { action: { type: "redirect" } }).includes("bad action type"));
  assert.ok(bad(url("/ads/x", { ...NO_PAGE, initiatorDomains: ["Bad.Example"] })).some((e) => e.includes("initiatorDomains")));
  const dup = validateRulesets({ a: [ok], b: [ok] });
  assert.ok(dup.some((e) => e.includes("duplicate id 1")));
  assert.ok(validateRulesets({ a: [ok, { ...ok, id: 2 }] }, 1).some((e) => e.includes("exceed the cap")));
});

test("list headers are read verbatim", () => {
  const h = readHeader("[Adblock Plus 2.0]\n! Version: 1\n! Last modified: today\n! Homepage: https://e.example/\n! Licence: https://e.example/l\n");
  assert.deepEqual(h, { version: "1", lastModified: "today", homepage: "https://e.example/", licenceLine: "! Licence: https://e.example/l" });
});

const lock = JSON.parse(read("data/adblock-lock.json"));
const rulesets = Object.fromEntries(LISTS.map((l) => [l.id, JSON.parse(read(l.out))]));

test("committed rulesets are valid, share unique ids and fit the cap together", () => {
  assert.deepEqual(validateRulesets(rulesets), []);
  const all = Object.values(rulesets).flat();
  assert.ok(all.length > 0 && all.length <= STATIC_RULE_CAP);
  assert.equal(new Set(all.map((r) => r.id)).size, all.length);
  for (const r of all) {
    const c = r.condition;
    for (const t of [...(c.resourceTypes || []), ...(c.excludedResourceTypes || [])]) assert.ok(DNR_TYPES.has(t), t);
    if (r.action.type === "block") {
      assert.ok(c.resourceTypes ? !c.resourceTypes.includes("main_frame") : c.excludedResourceTypes.includes("main_frame"));
    }
  }
});

test("the lock records licence, version and hash, and its counts match the files", () => {
  assert.equal(lock.lists.length, 2);
  assert.equal(lock.total_rules, Object.values(rulesets).flat().length);
  for (const entry of lock.lists) {
    assert.match(entry.licence_line, /^! Licence: https:\/\/easylist\.to\/pages\/licence\.html$/);
    assert.match(entry.licence, /GPL-3\.0-or-later OR CC-BY-SA-3\.0/);
    assert.match(entry.version, /^\d{12}$/);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/);
    assert.equal(entry.rules_written, rulesets[entry.id].length);
    assert.equal(entry.id_first, rulesets[entry.id][0].id);
    assert.equal(entry.id_last, rulesets[entry.id].at(-1).id);
  }
});

const cached = LISTS.map((l) => new URL(`../.cache/adblock/${l.id}.txt`, import.meta.url));
test("committed output matches a rebuild from the cached lists", { skip: !cached.every(existsSync) && "no .cache/adblock lists" }, () => {
  const texts = cached.map((u) => readFileSync(u, "utf8"));
  const { files } = buildOutputs(texts);
  for (const [path, body] of Object.entries(files)) assert.equal(body, read(path), path);
});
