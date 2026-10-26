// daylight case run: the whole pipeline on a fixture folder of three screenshots (one read by the
// built-in OCR, two with transcription files) and two URLs, served from a replay so nothing is
// fetched. A second run is killed in the middle of a stage, resumed, and must match the clean run.
// Then review, watch and a model provider plugged in through a command.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const CLI = join(ROOT, "bin", "radar.mjs");
const FX = join(ROOT, "tests", "fixtures", "case-run");
const dir = mkdtempSync(join(tmpdir(), "case-run-"));
const KEY = join(dir, "key.jwk");
const base = { ...process.env, DAYLIGHT_CASE_NOW: "2026-10-23T12:00:00Z", DAYLIGHT_CASE_REPLAY: join(FX, "replay", "map.json") };
const cli = (envExtra, ...args) => spawnSync(process.execPath, [CLI, "case", ...args], { encoding: "utf8", env: { ...base, ...envExtra } });
// --archive: this run checks the archive stage too, which is opt-in.
const runCase = (name, envExtra = {}) => cli(envExtra, "run", join(FX, "seeds"), "--case", join(dir, name), "--name", "Harbour sale", "--key-file", KEY, "--archive");
const lines = (p) => readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
test.after(() => rmSync(dir, { recursive: true, force: true }));

const TABLES = ["sources", "claims", "events", "edges", "leads", "absent", "actors", "posts", "proposals"];
// Everything a run produces except the signature, whose ECDSA nonce differs every time.
function snapshot(name) {
  const c = join(dir, name), out = {};
  for (const t of TABLES) out[t] = readFileSync(join(c, `${t}.jsonl`), "utf8");
  for (const p of ["newsroom", "research"]) for (const f of readdirSync(join(c, "exports", p, "v001")).filter((f) => f !== "case.evidence-bundle.json")) out[`${p}/${f}`] = readFileSync(join(c, "exports", p, "v001", f), "utf8");
  return out;
}

test("case run builds a dossier from three screenshots and two URLs with no network", () => {
  const r = runCase("clean");
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const c = join(dir, "clean");
  const sources = lines(join(c, "sources.jsonl"));
  assert.deepEqual(sources.map((s) => s.kind), ["screenshot", "screenshot", "screenshot", "web", "x-post", "x-post", "web"]);
  assert.match(sources[0].read_mode, /built-in OCR/);
  assert.equal(sources[0].author, "@made_up_account");
  assert.match(sources[3].archive.url, /^https:\/\/web\.archive\.org\/web\/20261023120000\//);
  assert.equal(sources[6].tier, "primary record candidate (government record)");
  const claims = lines(join(c, "claims.jsonl"));
  assert.ok(claims.length >= 6 && claims.every((x) => x.status === "proposed" && x.spans.length));
  const drift = claims.find((x) => /\$40 million and the council/.test(x.text));
  assert.ok(drift.retells, "the $40 million post is linked to the $4 million line it retells");
  const md = readFileSync(join(c, "exports", "newsroom", "v001", "DOSSIER.md"), "utf8");
  assert.match(md, /## Proposed claims, not yet reviewed by a person/);
  assert.match(md, /names a theory: Chemtrails/);
  assert.doesNotMatch(md, /made_up_account|harbour_watch/);
  const v = cli({}, "verify-export", join(c, "exports", "legal", "v001"), "--case", c);
  assert.match(v.stdout, /Export verified/);
  assert.match(cli({}, "network", "--case", c).stdout, /quote x1/);
});

test("a run killed mid-stage resumes and matches the clean run", () => {
  // Same case salt as the clean run, so pseudonyms match; everything else comes from the run.
  cli({}, "init", "Harbour sale", "--dir", join(dir, "resumed"));
  const meta = JSON.parse(readFileSync(join(dir, "clean", "case.json"), "utf8"));
  writeFileSync(join(dir, "resumed", "case.json"), JSON.stringify(meta, null, 2));
  const killed = runCase("resumed", { DAYLIGHT_CASE_CRASH_AT: "claims:3" });
  assert.equal(killed.status, 99, killed.stderr);
  assert.match(killed.stderr, /simulated crash in claims after item 3/);
  const again = runCase("resumed");
  assert.equal(again.status, 0, again.stderr);
  const a = snapshot("clean"), b = snapshot("resumed");
  assert.deepEqual(Object.keys(b).sort(), Object.keys(a).sort());
  for (const k of Object.keys(a)) assert.equal(b[k], a[k], k);
  const third = runCase("resumed");
  assert.match(third.stdout, /export: 0 items/, "a finished run does nothing the second time");
});

test("review accepts or rejects each proposal, and the dossier says who accepted it", () => {
  const c = join(dir, "clean");
  const q = JSON.parse(cli({}, "review", "--json", "--case", c).stdout);
  const claim = q.find((x) => x.table === "claims"), lead = q.find((x) => x.table === "leads");
  assert.match(cli({}, "review", "--accept", claim.id, "--reject", lead.id, "--by", "Ada", "--case", c).stdout, /2 decided by Ada/);
  cli({}, "export", "--profile", "newsroom", "--key-file", KEY, "--case", c);
  const md = readFileSync(join(c, "exports", "newsroom", "v002", "DOSSIER.md"), "utf8");
  assert.match(md, new RegExp(`### ${claim.id}\\.[^\\n]*\\n\\n- Rung: \\*\\*Unproven, investigation open\\*\\*\\. Accepted by Ada\\.`));
  assert.doesNotMatch(md, new RegExp(`settles ${lead.claims[0]}:`));
  assert.match(readFileSync(join(c, "exports", "newsroom", "v002", "CHANGES.md"), "utf8"), /\(proposed -> accepted\)/);
});

test("watch flags an edited page and a deleted post, and writes a dated changelog", () => {
  const c = join(dir, "watched");
  cpSync(join(dir, "clean"), c, { recursive: true });
  const replay = join(dir, "replay2");
  cpSync(join(FX, "replay"), replay, { recursive: true });
  writeFileSync(join(replay, "news.html"), readFileSync(join(replay, "news.html"), "utf8").replace("$4 million", "$4.5 million"));
  const map = JSON.parse(readFileSync(join(replay, "map.json"), "utf8"));
  map["x:1900000000000000000"] = { status: 404, body: "" };
  map["https://archive.org/wayback/available?url=" + encodeURIComponent("https://council.example.gov/minutes/2026-10-19")] = { body: "{}", type: "application/json" };
  writeFileSync(join(replay, "map.json"), JSON.stringify(map));
  const r = cli({ DAYLIGHT_CASE_REPLAY: join(replay, "map.json"), DAYLIGHT_CASE_NOW: "2026-10-24T07:00:00Z" }, "watch", "--case", c);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /edited S04: .*numbers \+\$4\.5 -\$4/);
  assert.match(r.stdout, /deleted S06/);
  const log = readFileSync(join(c, "CHANGELOG.md"), "utf8");
  assert.match(log, /## 2026-10-24/);
  assert.ok(lines(join(c, "absent.jsonl")).some((a) => a.status === "deleted" && a.source === "S06"));
  assert.match(cli({}, "watch", "--schedule").stdout, /schtasks \/Create/);
});

test("a model plugged in through a command proposes claims; each keeps its quote span", () => {
  const c = join(dir, "model");
  const fake = join(dir, "fake-model.mjs");
  writeFileSync(fake, `let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{const m=s.match(/sell the harbour land for \\$4 million/);process.stdout.write(JSON.stringify(m?[{claim:"The council agreed a $4 million sale",quote:m[0]}]:[]));});`);
  cli({}, "init", "Model case", "--dir", c);
  const meta = JSON.parse(readFileSync(join(c, "case.json"), "utf8"));
  writeFileSync(join(c, "case.json"), JSON.stringify({ ...meta, models: { provider: "command", command: process.execPath, args: [fake] } }));
  const r = cli({}, "run", "https://www.example-news.test/harbour-sale", "--case", c, "--no-follow", "--key-file", KEY);
  assert.equal(r.status, 0, r.stderr);
  const claims = lines(join(c, "claims.jsonl"));
  assert.equal(claims.length, 1);
  assert.match(claims[0].proposed_by, /^command:/);
  assert.equal(claims[0].spans[0].text, "sell the harbour land for $4 million");
});
