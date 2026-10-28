// cmmns case from the command line, end to end on local files only: init, add, claim, trace,
// timeline, edge, network, lead, absent, actor, label, export in all three profiles, verify-export,
// a tampered export failing, versioning with CHANGES.md, redaction, the legal bundle withholding a
// private account's capture, and the worked Musk and Ukraine example verifying offline.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validate } from "../bin/lib/jsonschema.mjs";

const ROOT = join(import.meta.dirname, "..");
const CLI = join(ROOT, "bin", "radar.mjs");
const SCHEMA = JSON.parse(readFileSync(join(ROOT, "schema", "evidence.v2.json"), "utf8"));
const dir = mkdtempSync(join(tmpdir(), "case-cli-"));
const KEY = join(dir, "key.jwk"), CASE = join(dir, "harbour");
const env = { ...process.env, DAYLIGHT_CASE_NOW: "2026-10-23T12:00:00Z", DAYLIGHT_CASE_REPLAY: join(dir, "no-network.json") };
writeFileSync(env.DAYLIGHT_CASE_REPLAY, "{}");
const run = (...args) => {
  const r = spawnSync(process.execPath, [CLI, "case", ...args, ...(args[0] === "init" ? [] : ["--case", CASE])], { encoding: "utf8", env });
  assert.equal(r.status, 0, `${args.join(" ")}\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
};
test.after(() => rmSync(dir, { recursive: true, force: true }));

const PAGE = '<html><head><title>Council sells parcel</title></head><body><p>The council voted 7-2 on October 19, 2026 to sell the harbour land for $4 million.</p></body></html>';
const POST = JSON.stringify({ id_str: "1900000000000000001", created_at: "2026-10-20T15:00:00.000Z", text: "They sold the harbour for $40 million! via @private_person", user: { screen_name: "private_person" }, quoted_tweet: { id_str: "1900000000000000000", user: { screen_name: "city_desk" } } });

test("a case built from local files only, from init to a verified export", () => {
  writeFileSync(join(dir, "page.html"), PAGE);
  writeFileSync(join(dir, "post.json"), POST);
  assert.match(run("init", "Harbour sale", "--dir", CASE), /opened in .* \(its own git repository\)/);
  assert.match(run("add", join(dir, "page.html"), "--date", "2026-10-19"), /^S01 captured: \d+ bytes, sha256 [0-9a-f]{64}\. local file/);
  assert.match(run("add", join(dir, "post.json")), /^S02 captured.*Also recorded: edge N01/);
  run("claim", "The council voted 7-2 on October 19 to sell the harbour land for $4 million", "--source", "S01", "--rung", "documented", "--date", "2026-10-19");
  run("claim", "They sold the harbour for $40 million", "--source", "S02", "--rung", "contradicted", "--retells", "C01");
  const trace = run("trace", "C02");
  assert.match(trace, /C01 -> C02: .*\[-\$4-\] \[\+\$40\+\]/);
  assert.match(trace, /Independent origins: 1/);
  assert.match(run("timeline"), /2026-10-19 {2}C01/);
  run("edge", "--from", "@private_person", "--to", "@city_desk", "--type", "mention", "--source", "S02");
  assert.match(run("network", "--html", join(dir, "net.html")), /@private_person -> @city_desk {2}quote x1/);
  run("lead", "Who bought the land?", "--record", "the sale deed", "--holder", "the land registry", "--decisive", "5", "--access", "request", "--claims", "C01");
  assert.match(run("leads"), /^1\. L01 \[score 4\]/);
  run("absent", "the council's closed-session notes", "--status", "sealed", "--custodian", "the city clerk");
  assert.match(run("absent"), /A01 SEALED: the council's closed-session notes\. Custodian: the city clerk/);
  run("actor", "@city_desk", "--public-figure");
  run("label", "C01", "--labeller", "a", "--rung", "documented");
  run("label", "C01", "--labeller", "b", "--rung", "documented");
  assert.match(run("labels"), /Agreement 1/);
  assert.doesNotMatch(run("claims", "--blind"), /documented|contradicted/);
  assert.match(run("export", "--profile", "all", "--key-file", KEY), /newsroom: v001 written.*\nlegal: v001 written.*\nresearch: v001 written/);
  for (const p of ["newsroom", "legal", "research"]) assert.match(run("verify-export", join(CASE, "exports", p, "v001")), /Export verified: signed by key [0-9a-f]{16}, every file matches\./);
});

test("exports redact private accounts, withhold their captures, fit the schema and record changes", () => {
  const news = join(CASE, "exports", "newsroom", "v001");
  const md = readFileSync(join(news, "DOSSIER.md"), "utf8");
  assert.doesNotMatch(md, /private_person/);
  assert.match(md, /\[acct-[0-9a-f]{10}\]/);
  assert.match(md, /@city_desk/);
  assert.ok(md.indexOf("## Claims") < md.indexOf("## Timeline"), "claims lead");
  const legal = join(CASE, "exports", "legal", "v001");
  assert.ok(existsSync(join(legal, "captures", "S01.html")));
  assert.ok(!existsSync(join(legal, "captures", "S02.json")), "a private account's post is withheld");
  assert.match(readFileSync(join(legal, "CUSTODY.md"), "utf8"), /unchanged since collection[\s\S]*Handling log[\s\S]*case add S01/);
  const research = join(CASE, "exports", "research", "v001");
  const cr = JSON.parse(readFileSync(join(research, "croissant.json"), "utf8"));
  assert.equal(cr.conformsTo, "http://mlcommons.org/croissant/1.0");
  assert.ok(cr.distribution.every((d) => /^[0-9a-f]{64}$/.test(d.sha256)));
  assert.ok(JSON.parse(readFileSync(join(research, "prov.jsonld"), "utf8"))["@graph"].some((g) => g["@type"] === "prov:Activity"));
  const bundle = JSON.parse(readFileSync(join(news, "case.evidence-bundle.json"), "utf8"));
  assert.deepEqual(validate(SCHEMA, bundle), []);
  assert.match(run("export", "--profile", "newsroom", "--key-file", KEY), /unchanged since v001/);
  run("claim", "The deed names Example Holdings", "--source", "S01", "--rung", "unproven");
  run("export", "--profile", "newsroom", "--key-file", KEY);
  assert.match(readFileSync(join(CASE, "exports", "newsroom", "v002", "CHANGES.md"), "utf8"), /claims: added C03 "The deed names Example Holdings"/);
});

test("a changed export file or bundle fails verification", () => {
  const v = join(CASE, "exports", "newsroom", "v001");
  appendFileSync(join(v, "DOSSIER.md"), "\nAdded later.\n");
  const r = spawnSync(process.execPath, [CLI, "case", "verify-export", v, "--case", CASE], { encoding: "utf8", env });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL DOSSIER\.md: DOES NOT MATCH/);
  const elsewhere = spawnSync(process.execPath, [CLI, "case", "verify-export", join(CASE, "exports", "legal", "v001")], { encoding: "utf8", env, cwd: dir });
  assert.match(elsewhere.stdout, /Export verified/, "an export checks from outside its case folder");
  const verify = spawnSync(process.execPath, [CLI, "verify", join(CASE, "exports", "research", "v001", "case.evidence-bundle.json")], { encoding: "utf8" });
  assert.equal(verify.status, 0, verify.stdout);
});

test("every case change is a commit in the case's own repository", () => {
  const log = spawnSync("git", ["log", "--format=%s"], { cwd: CASE, encoding: "utf8" }).stdout;
  for (const m of ["case init", "case add S01", "case claim C02", "case export"]) assert.match(log, new RegExp(m));
});

test("the worked Musk and Ukraine example verifies offline and keeps its findings", () => {
  const ex = join(ROOT, "examples", "musk-ukraine-case");
  const out = (...a) => spawnSync(process.execPath, [CLI, "case", ...a, "--case", ex], { encoding: "utf8", env }).stdout;
  const v = readdirSync(join(ex, "exports", "newsroom")).filter((n) => /^v\d+$/.test(n)).sort().pop();
  assert.match(out("verify-export", join(ex, "exports", "newsroom", v)), /Export verified/);
  assert.match(out("trace", "C02"), /Independent origins: 2/);
  assert.match(out("trace", "C16"), /certainty added: real/);
  assert.match(out("labels"), /kappa/);
  const sources = readFileSync(join(ex, "sources.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(sources.length, 47);
  assert.ok(sources.filter((s) => s.capture && s.capture.sha256).length >= 40);
});
