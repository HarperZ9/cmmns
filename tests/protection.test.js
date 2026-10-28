// The Wayback fix and source-protection mode for cases (src/investigate/protection.js,
// bin/lib/case-protect.mjs, bin/lib/protect.mjs). Every network call goes through an injected
// fetch that records it, so each test can show exactly which requests a command made: none, in
// protection mode.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, copyFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runCaseCommand } from "../bin/lib/case.mjs";
import { protectCommand, cleanCommand } from "../bin/lib/protect.mjs";
import { globalProtection } from "../bin/lib/case-protect.mjs";
import { verifyBundle } from "../src/core/bundle-verify.js";
import { PROTECTION_LIMITS, ARCHIVE_REVEALS, anonHistory, modelIsLocal } from "../src/investigate/protection.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "clean");
const tmp = () => mkdtempSync(join(tmpdir(), "dl-protect-"));
const NOW = "2026-10-25T14:03:11.000Z";

// A fetch that answers every page with a small HTML page and every Wayback save with a snapshot,
// and records each address it was asked for.
function recorder() {
  const asked = [];
  const fetchFn = async (url) => {
    asked.push(String(url));
    const save = String(url).startsWith("https://web.archive.org/save/");
    const body = Buffer.from(save ? "" : "<html><title>Page</title><body>Words on the page.</body></html>");
    const headers = new Map([["content-type", "text/html"], ...(save ? [["content-location", "/web/20261025000000/" + String(url).slice(29)]] : [])]);
    return { ok: true, status: 200, url: String(url), headers: { get: (k) => headers.get(k.toLowerCase()) ?? null }, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length), text: async () => body.toString(), json: async () => ({}) };
  };
  return { asked, fetchFn };
}

async function newCase(home, extraEnv = {}) {
  const dir = join(tmp(), "case");
  const env = { DAYLIGHT_HOME: home, DAYLIGHT_CASE_NOW: NOW, ...extraEnv };
  await runCaseCommand(["init", "Test case", "--dir", dir, "--no-git"], { env });
  return { dir, env };
}
const cmd = (c, argv, base = {}) => runCaseCommand([...argv, "--case", c.dir, "--no-commit"], { env: c.env, sleep: async () => {}, ...base });

test("case add makes no Wayback request by default, and says how to ask for one", async () => {
  const c = await newCase(tmp()), net = recorder();
  const r = await cmd(c, ["add", "https://example.org/report"], net);
  assert.deepEqual(net.asked, ["https://example.org/report"], "only the page itself");
  assert.match(r.out, /archive not requested \(opt in with --archive\)/);
  const row = JSON.parse(readFileSync(join(c.dir, "sources.jsonl"), "utf8").trim());
  assert.equal(row.archive.service, null);
});

test("--archive and the case setting each ask for one snapshot; --no-archive still works", async () => {
  const c = await newCase(tmp()), net = recorder();
  await cmd(c, ["add", "https://example.org/a", "--archive"], net);
  assert.ok(net.asked.includes("https://web.archive.org/save/https://example.org/a"));
  const s = await cmd(c, ["settings", "archive", "on"]);
  assert.ok(s.out.includes(ARCHIVE_REVEALS), "the setting says what it reveals");
  await cmd(c, ["add", "https://example.org/b"], net);
  assert.ok(net.asked.includes("https://web.archive.org/save/https://example.org/b"));
  await cmd(c, ["add", "https://example.org/c", "--no-archive"], net);
  assert.ok(!net.asked.some((u) => u.endsWith("example.org/c") && u.includes("archive.org")));
  await assert.rejects(cmd(c, ["add", "https://example.org/d", "--archive", "--no-archive"], net), /contradict/);
});

test("a new case starts with archiving and protection off, written in case.json", async () => {
  const c = await newCase(tmp());
  const meta = JSON.parse(readFileSync(join(c.dir, "case.json"), "utf8"));
  assert.equal(meta.archive, false);
  assert.equal(meta.protection, false);
  assert.match(readFileSync(join(c.dir, "README.md"), "utf8"), /only with --archive/);
});

test("protection mode: case add of a URL is refused and no request goes out", async () => {
  const c = await newCase(tmp()), net = recorder();
  await cmd(c, ["settings", "protection", "on"]);
  await assert.rejects(cmd(c, ["add", "https://example.org/report"], net), /source-protection mode is on/);
  await assert.rejects(cmd(c, ["add", "https://example.org/report", "--archive"], net), /source-protection mode is on/);
  await assert.rejects(cmd(c, ["watch"], net), /source-protection mode is on/);
  assert.deepEqual(net.asked, [], "zero requests");
  const page = join(tmp(), "saved.html");
  writeFileSync(page, "<html><title>Saved in my browser</title><body>Text.</body></html>");
  const r = await cmd(c, ["add", page], net);
  assert.match(r.out, /S01 captured/);
  assert.deepEqual(net.asked, []);
});

test("protection mode: a whole run with URL seeds sends nothing, and the attempts are blocked", async () => {
  const home = tmp(), c = await newCase(home, { DAYLIGHT_PROTECT: "1" }), net = recorder();
  const r = await cmd(c, ["run", "https://example.org/one", "https://example.org/two", "--key-file", join(home, "k.jwk")], net);
  assert.deepEqual(net.asked, [], "the user's fetch was never called");
  assert.match(r.out, /Source-protection mode is on: no request was made, and 2 addresses were not captured/);
  await assert.rejects(cmd(c, ["run", "https://example.org/x", "--archive"], net), /source-protection/);
  writeFileSync(join(c.dir, "case.json"), JSON.stringify({ ...JSON.parse(readFileSync(join(c.dir, "case.json"), "utf8")), models: { provider: "http", url: "https://api.example.com/v1/chat/completions", model: "m" } }));
  await assert.rejects(cmd(c, ["run", join(home, "none")], net), /model endpoint is not on this device/);
  assert.equal(modelIsLocal({ provider: "http", url: "http://localhost:8080/v1" }), true);
});

test("protection mode: exports are Share clean, carrier-safe, day-only and name no investigator", async () => {
  const home = tmp(), c = await newCase(home, { DAYLIGHT_PROTECT: "1" });
  const photo = join(tmp(), "photo.jpg");
  copyFileSync(join(FIX, "photo.jpg"), photo);
  await cmd(c, ["add", photo]);
  await cmd(c, ["actor", "@mayor", "--public-figure"]);
  await cmd(c, ["claim", "The mayor @mayor signed it", "--source", "S01", "--rung", "documented"]);
  const r = await cmd(c, ["export", "--profile", "legal"]);
  assert.match(r.out, /one-time key/);
  assert.match(r.out, /writing style can identify you/i);
  const out = join(c.dir, "exports", "legal", "v001");
  const cap = readFileSync(join(out, "captures", "S01.jpg"));
  assert.ok(!cap.includes(Buffer.from("DLSECRET")), "the capture in the export is Share clean");
  assert.ok(readFileSync(join(c.dir, "captures", "S01.jpg")).includes(Buffer.from("DLSECRET")), "the evidence copy keeps everything");
  const lineage = readFileSync(join(c.dir, "lineage", "clean.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(lineage[0].export, "captures/S01.jpg");
  assert.ok(!readdirSync(out, { recursive: true }).some((f) => String(f).includes("lineage")), "the lineage stays out of the export");
  const bundle = JSON.parse(readFileSync(join(out, "case.evidence-bundle.json"), "utf8"));
  assert.equal(bundle.profile, "carrier-safe");
  assert.equal(bundle.savedAt, "2026-10-25");
  assert.equal((await verifyBundle(bundle)).ok, true);
  const all = readdirSync(out, { recursive: true }).filter((f) => /\.(md|json)$/.test(f)).map((f) => readFileSync(join(out, f), "utf8")).join("\n");
  assert.ok(!all.includes("14:03"), "no time of day");
  assert.ok(!all.includes("@mayor"), "public figures are pseudonyms too in protection mode");
  assert.match(readFileSync(join(out, "SHARE-CLEAN.md"), "utf8"), /EXIF/);
});

test("--clean on an ordinary export cleans files and lists what it left out", async () => {
  const home = tmp(), c = await newCase(home);
  const bin = join(tmp(), "data.bin");
  writeFileSync(bin, Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]));
  await cmd(c, ["add", bin]);
  const r = await cmd(c, ["export", "--profile", "legal", "--clean", "--key-file", join(home, "k.jwk")]);
  assert.match(r.out, /1 files left out because Share clean cannot read them/);
  assert.match(readFileSync(join(c.dir, "exports", "legal", "v001", "SHARE-CLEAN.md"), "utf8"), /data|S01/);
});

test("the global switch, its status and the limits screen", () => {
  const home = tmp(), env = { DAYLIGHT_HOME: home };
  assert.equal(globalProtection(env), false);
  const on = protectCommand("on", env);
  assert.match(on, /on for every case/);
  for (const must of ["This device", "The network", "Tor Browser", "platforms' own logs", "Screenshots", "SecureDrop", "Access Now Digital Security Helpline", "writing style", "not yet been independently reviewed"]) assert.ok(PROTECTION_LIMITS.includes(must), must);
  assert.equal(globalProtection(env), true);
  assert.equal(globalProtection({ ...env, DAYLIGHT_PROTECT: "0" }), false, "the variable decides while set");
  protectCommand("off", env);
  assert.equal(globalProtection(env), false);
  assert.throws(() => protectCommand("maybe", env), /on", "off"/);
});

test("history lines lose the name and the time of day", () => {
  assert.deepEqual(anonHistory(["abc123 2026-10-25T14:03:11+02:00 Jane Reporter: case add S01"]), ["abc123 2026-10-25 investigator: case add S01"]);
});

test("cmmns clean writes the copy beside the original and the lineage beside the evidence copy", async () => {
  const d = tmp(), src = join(d, "photo.jpg");
  copyFileSync(join(FIX, "photo.jpg"), src);
  const out = await cleanCommand(src, {}, () => NOW);
  const name = out.match(/written to (.+)\.\n/)[1];
  assert.ok(existsSync(name));
  assert.match(name, /clean-[0-9a-f]{12}\.jpg$/);
  assert.ok(!readFileSync(name).includes(Buffer.from("DLSECRET")));
  assert.ok(readFileSync(src).includes(Buffer.from("DLSECRET")), "the original is untouched");
  const l = JSON.parse(readFileSync(join(d, "clean-lineage.jsonl"), "utf8"));
  assert.equal(l.original_file, "photo.jpg");
  await assert.rejects(cleanCommand(src, { out: src }), /must not be the original/);
  const txt = join(d, "note.txt");
  writeFileSync(txt, "plain words");
  await assert.rejects(cleanCommand(txt, {}), /not cleaned/);
});
