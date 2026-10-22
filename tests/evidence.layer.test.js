// The evidence layer (project-docs/EVIDENCE-LAYER.md): receipts, GitHub, RDAP and Wayback parsing,
// ad library links, the local ledger, the lookups on a stubbed fetch, and the seal with its
// tamper controls. No test touches the network.
import test from "node:test";
import assert from "node:assert/strict";
import { makeReceipt, verifyReceipt, canonical } from "../src/core/receipt.js";
import { reposIn, repoFacts, starPages, starBursts, STAR_MAX_PAGES } from "../src/core/evidence-github.js";
import { rdapFacts, waybackFirst, registrable, daysBefore } from "../src/core/evidence-domain.js";
import { adLibraryLinks } from "../src/core/evidence-ads.js";
import { recordCounts, ledgerGrowth, LEDGER_MIN_GAP_MS } from "../src/core/evidence-ledger.js";
import { lookupEvidence } from "../src/core/evidence-fetch.js";
import { emptySeal, appendSeal, verifySeal, exportSeal, verifyExport, merkleRoot, inclusionProof, verifyInclusion } from "../src/core/evidence-seal.js";

const RDAP = { objectClassName: "domain", ldhName: "EXAMPLE-LAUNCH.TEST", events: [{ eventAction: "registration", eventDate: "2026-09-30T10:00:00Z" }, { eventAction: "expiration", eventDate: "2027-09-30T10:00:00Z" }],
  entities: [{ roles: ["registrar"], vcardArray: ["vcard", [["version", {}, "text", "4.0"], ["fn", {}, "text", "Example Registrar Inc."]]] }, { roles: ["registrant"], vcardArray: ["vcard", [["fn", {}, "text", "A Private Person"]]] }] };
const CDX = [["timestamp", "original", "statuscode"], ["20261001120000", "http://example-launch.test/", "200"]];
const REPO = { full_name: "exampleorg/launchkit", created_at: "2026-10-01T00:00:00Z", pushed_at: "2026-10-21T00:00:00Z", stargazers_count: 150, forks_count: 3 };
const stars = (n, from, stepMs) => Array.from({ length: n }, (_, i) => ({ starred_at: new Date(Date.parse(from) + i * stepMs).toISOString() }));

function stubFetch(routes, log = []) {
  return async (url, opts) => {
    log.push({ url, opts });
    const hit = routes.find(([re]) => re.test(url));
    if (!hit) return { ok: false, status: 404, json: async () => ({}) };
    const [, status, body] = hit;
    return { ok: status === 200, status, json: async () => (typeof body === "function" ? body(url) : body) };
  };
}

test("receipts hash their whole body, keep only a hash of the raw fragment, and fail when edited", async () => {
  const r = await makeReceipt({ kind: "k", subject: "s", observed: { a: 1 }, source: "src", url: "https://x.test", dnp: "does not prove much", raw: { secret: "whole response" } });
  assert.ok(await verifyReceipt(r));
  assert.ok(!JSON.stringify(r).includes("whole response"));
  assert.match(r.capture.rawHash, /^[0-9a-f]{64}$/);
  assert.ok(await verifyReceipt(JSON.parse(JSON.stringify(r))), "survives storage");
  assert.equal(await verifyReceipt({ ...r, observed: { a: 2 } }), false);
  assert.equal(await verifyReceipt({ ...r, dnp: "" }), false);
  await assert.rejects(makeReceipt({ kind: "k", source: "s" }), /does-not-prove/);
  assert.equal(canonical({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
});

test("GitHub parsing: repo links, facts, page plan and bursts", () => {
  assert.deepEqual(reposIn("try it https://github.com/ExampleOrg/launch-kit. and github.com/sponsors/x"), [{ owner: "ExampleOrg", repo: "launch-kit" }]);
  assert.equal(repoFacts(REPO).created, "2026-10-01T00:00:00Z");
  assert.deepEqual(starPages(250).pages, [1, 2, 3]);
  const big = starPages(100000);
  assert.equal(big.pages.length, STAR_MAX_PAGES);
  assert.equal(big.pages.at(-1), 1000);
  const steady = starBursts([...stars(30, "2026-01-01T00:00:00Z", 86400000)].map((x) => x.starred_at));
  assert.equal(steady.burst, false);
  const burst = starBursts([...stars(30, "2026-01-01T00:00:00Z", 86400000), ...stars(400, "2026-03-01T00:00:00Z", 60000)].map((x) => x.starred_at));
  assert.equal(burst.burst, true);
  assert.equal(burst.busiest.n, 400);
});

test("RDAP keeps the registrar organisation and never a contact person; Wayback first capture", () => {
  const f = rdapFacts(RDAP);
  assert.equal(f.registered, "2026-09-30T10:00:00Z");
  assert.equal(f.registrar, "Example Registrar Inc.");
  assert.ok(!JSON.stringify(f).includes("Private Person"));
  assert.equal(waybackFirst(CDX).first, "2026-10-01T12:00:00Z");
  assert.equal(waybackFirst([["timestamp"]]), null);
  assert.equal(registrable("www.shop.example.co.uk"), "example.co.uk");
  assert.equal(daysBefore("2026-09-30T00:00:00Z", "2026-10-22T00:00:00Z"), 22);
});

test("ad libraries are links the user opens, each saying what its API needs", () => {
  const links = adLibraryLinks({ name: "Example Launch", domain: "example-launch.test" });
  assert.equal(links.length, 5);
  for (const l of links) { assert.match(l.url, /^https:\/\//); assert.ok(l.api.length > 10); }
  assert.ok(links.find((l) => l.id === "google").url.includes("domain=example-launch.test"));
  assert.deepEqual(adLibraryLinks({}), []);
});

test("ledger keeps counts per visit, collapses rapid refreshes, and reports the largest step", () => {
  const t0 = Date.parse("2026-10-22T10:00:00Z");
  let L = recordCounts({}, "p1", { reposts: 100, likes: 50 }, t0);
  L = recordCounts(L, "p1", { reposts: 120, likes: 52 }, t0 + 60000);
  assert.equal(L.p1.points.length, 1, "a refresh inside the gap replaces the point");
  L = recordCounts(L, "p1", { reposts: 5100, likes: 60 }, t0 + LEDGER_MIN_GAP_MS + 3600000);
  const g = ledgerGrowth(L.p1);
  assert.equal(g.counts.reposts.largestStep.by, 4980);
  assert.equal(g.counts.likes.largestStep.by, 8);
  assert.ok(!JSON.stringify(L).match(/handle|text/));
});

test("lookups: receipts per source, no token means no star list, limits stop and are reported", async () => {
  const log = [];
  const f = stubFetch([[/\/stargazers/, 200, stars(150, "2026-10-21T00:00:00Z", 30000)], [/api\.github\.com\/repos\//, 200, REPO], [/rdap\.org/, 200, RDAP], [/web\.archive\.org\/cdx/, 200, CDX]], log);
  const noToken = await lookupEvidence(f, { repos: [{ owner: "exampleorg", repo: "launchkit" }], domains: ["example-launch.test"], postedAt: "2026-10-22T00:00:00Z" });
  assert.deepEqual(noToken.receipts.map((r) => r.kind), ["github-repo", "domain-registration", "wayback-first"]);
  assert.ok(noToken.notes.some((n) => /own GitHub token/.test(n)));
  assert.ok(!log.some((x) => /stargazers/.test(x.url)));
  for (const r of noToken.receipts) assert.ok(await verifyReceipt(r));
  assert.equal(noToken.receipts[1].observed.daysBeforePost, 21);
  log.length = 0;
  const withToken = await lookupEvidence(f, { repos: [{ owner: "exampleorg", repo: "launchkit" }], token: "test-token", postedAt: "2026-10-22T00:00:00Z" });
  assert.ok(withToken.receipts.some((r) => r.kind === "github-stars"));
  const starCalls = log.filter((x) => /stargazers/.test(x.url));
  assert.equal(starCalls.length, 2);
  assert.ok(starCalls.every((x) => x.opts.headers.Authorization === "Bearer test-token" && x.opts.credentials === "omit"));
  assert.ok(!log.filter((x) => !/api\.github\.com/.test(x.url)).some((x) => x.opts.headers.Authorization), "the token goes to GitHub only");
  const limited = await lookupEvidence(stubFetch([[/\/stargazers/, 403, {}], [/api\.github\.com\/repos\//, 200, REPO]]), { repos: [{ owner: "a", repo: "b" }], token: "t" });
  assert.ok(limited.notes.some((n) => /does not retry/.test(n)));
  const many = await lookupEvidence(stubFetch([]), { domains: ["a.test", "b.test", "c.test", "d.test"] });
  assert.ok(many.notes.some((n) => /first 2 repositories and 3 domains/.test(n)));
});

test("Merkle proofs verify for every size and fail when moved", async () => {
  for (const n of [1, 2, 3, 5, 8, 13]) {
    const hs = Array.from({ length: n }, (_, i) => `${i}`.padStart(64, "a"));
    const root = await merkleRoot(hs);
    for (let m = 0; m < n; m++) assert.ok(await verifyInclusion(hs[m], await inclusionProof(hs, m), root), `${n}/${m}`);
    if (n > 1) assert.equal(await verifyInclusion(hs[0], await inclusionProof(hs, 1), root), false);
  }
});

test("seal: verifies when intact; edited, removed, reordered or re-rooted exports are rejected", async () => {
  let seal = emptySeal();
  for (let i = 0; i < 4; i++) seal = await appendSeal(seal, await makeReceipt({ kind: "k", subject: `s${i}`, observed: { i }, source: "src", dnp: "does not prove much" }));
  assert.ok((await verifySeal(seal)).ok);
  const x = await exportSeal(seal, { title: "t" });
  assert.ok((await verifyExport(x)).ok);
  const clone = () => JSON.parse(JSON.stringify(x));
  const edited = clone(); edited.seal.entries[1].receipt.observed.i = 99;
  assert.equal((await verifyExport(edited)).ok, false);
  const rehashed = clone(); rehashed.seal.entries[1].receipt = await makeReceipt({ kind: "k", subject: "forged", observed: {}, source: "src", dnp: "does not prove much" });
  assert.equal((await verifyExport(rehashed)).ok, false, "a valid but substituted receipt breaks the chain");
  const removed = clone(); removed.seal.entries.splice(2, 1);
  assert.equal((await verifyExport(removed)).ok, false);
  const reordered = clone(); [reordered.seal.entries[0], reordered.seal.entries[1]] = [reordered.seal.entries[1], reordered.seal.entries[0]];
  assert.equal((await verifyExport(reordered)).ok, false);
  const rerooted = clone(); rerooted.root = "f".repeat(64);
  assert.equal((await verifyExport(rerooted)).ok, false);
  assert.equal((await verifyExport({ format: "other" })).ok, false);
});

test("Merkle root matches Flywheel's harness/merkle.py on a pinned vector", async () => {
  // python: merkle_root([str(i).rjust(64, "a").encode() for i in range(5)]).hex(), run 2026-10-22
  const hs = Array.from({ length: 5 }, (_, i) => String(i).padStart(64, "a"));
  assert.equal(await merkleRoot(hs), "28a114934a1f378512d2dd0eaaebbb5fbcc19ee7055a18b963bcd3d3ff4756d1");
});

test("data model: private subjects are pseudonyms, content mode is features, labelled rows keep labeller and stratum", async () => {
  const { pseudonymFor } = await import("../src/core/receipt.js");
  const a = await pseudonymFor("salt-a", "SomeHandle"), b = await pseudonymFor("salt-b", "somehandle");
  assert.match(a, /^acct-[0-9a-f]{16}$/);
  assert.notEqual(a, b);
  assert.equal(a, await pseudonymFor("salt-a", "somehandle"));
  const r = await makeReceipt({ kind: "label", subject: a, subjectKind: "private-pseudonym", observed: { persona: true }, source: "hand label", dnp: "a label is one person's reading", labeller: "L1", stratum: { platform: "x", language: "ja" }, catalogue: "radar-catalogue/0" });
  assert.equal(r.content, "features");
  assert.equal(r.labeller, "L1");
  assert.ok(await verifyReceipt(r));
  await assert.rejects(makeReceipt({ kind: "k", source: "s", dnp: "d", subjectKind: "person" }), /unknown subject kind/);
});
