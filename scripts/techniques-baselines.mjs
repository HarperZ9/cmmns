// Organic baselines for the technique signs of project-docs/TECHNIQUES.md: how often the flooding
// sign and the cross-language sign fire in ordinary threads, by thread size.
//   node scripts/techniques-baselines.mjs [--data <dir>]   (default: $RADAR_DATA or ../radar-data)
// Input: <data>/pheme/prepared/pheme-techniques.jsonl from scripts/eval/prep-pheme-techniques.py
// (PHEME, Zubiaga et al., CC BY 4.0; no text, hashed account ids). Writes
// project-docs/evidence/technique-baselines.json and src/core/techniques-data.js. Only counts leave.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { floodSign } from "../src/core/flooding.js";
import { crossLanguage } from "../src/core/crosslang.js";
import { timingBursts } from "../src/core/timing.js";
import { swarmSign } from "../src/core/swarming.js";
import { NEW_ACCOUNT_DAYS, HIGH_VOLUME_PER_DAY } from "../src/core/flags.js";
import { wilson } from "../src/core/report.js";
import { SIZE_BINS, sizeBin } from "../src/core/baselines-bins.js";
import { splitOf } from "./eval/corpora.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DATA = arg("--data", process.env.RADAR_DATA || "../radar-data");
const FILE = join(DATA, "pheme", "prepared", "pheme-techniques.jsonl");
const RAW = join(DATA, "pheme", "PHEME_veracity.tar.bz2");

const rate = (k, n) => ({ k, n, share: n ? Math.round((k / n) * 10000) / 10000 : null, ci: n ? wilson(k, n).map((x) => Math.round(x * 10000) / 10000) : null });
const iso = (t) => new Date(t * 1000).toISOString();

// One thread's signs, with the account rate at the time of each reply, as Daylight Commons reads it at view time.
export function threadSigns(th) {
  const replies = th.replies.filter((r) => r.user && Number.isFinite(r.t));
  const rows = replies.map((r, i) => ({ id: String(i), author: r.user, posted: iso(r.t), lang: r.lang, text: "", links: r.links || [], media: (r.media || []).map((m) => ({ url: m })), claims: [] }));
  const rates = new Map();
  for (const r of replies) if (Number.isFinite(r.posts) && Number.isFinite(r.joined)) rates.set(r.user.toLowerCase(), r.posts / Math.max(1, (r.t - r.joined) / 86400));
  const bursts = timingBursts(rows);
  const f = floodSign(rows, (h) => rates.get(h) ?? null, { bursts });
  // Swarming: new means joined under NEW_ACCOUNT_DAYS before the reply; flagged here can only be the
  // very-high-rate flag, the one flag PHEME's account fields allow.
  const info = new Map(replies.map((r) => [r.user.toLowerCase(), r]));
  const markOf = (h) => { const r = info.get(h); if (!r || !Number.isFinite(r.joined) || !Number.isFinite(r.posts)) return null; const age = (r.t - r.joined) / 86400; return { new: age < NEW_ACCOUNT_DAYS, flagged: r.posts / Math.max(1, age) >= HIGH_VOLUME_PER_DAY }; };
  const swarm = !!swarmSign(rows, markOf);
  return { n: rows.length, swarm, flood: !!f, volume: !!(f && f.volume), speed: !!(f && f.speed), cross: crossLanguage(rows, { root: { links: th.root.links || [], media: (th.root.media || []).map((m) => ({ url: m })) } }).length > 0, multilingual: new Set(rows.map((r) => r.lang).filter(Boolean)).size >= 2 };
}

export function summarise(threads) {
  const out = { flood: {}, floodVolume: {}, floodSpeed: {}, cross: {}, multilingual: {}, swarm: {}, bySplit: {} };
  const acc = {};
  for (const th of threads) {
    const s = threadSigns(th), bin = sizeBin(s.n);
    if (!bin) continue;
    for (const key of [bin.id, "split:" + splitOf("pheme", th.id)]) {
      const A = (acc[key] = acc[key] || { n: 0, flood: 0, volume: 0, speed: 0, cross: 0, multilingual: 0, swarm: 0 });
      A.n++; A.flood += s.flood; A.volume += s.volume; A.speed += s.speed; A.cross += s.cross; A.multilingual += s.multilingual; A.swarm += s.swarm;
    }
  }
  for (const b of SIZE_BINS) {
    const A = acc[b.id] || { n: 0 };
    out.flood[b.id] = rate(A.flood || 0, A.n); out.floodVolume[b.id] = rate(A.volume || 0, A.n); out.floodSpeed[b.id] = rate(A.speed || 0, A.n);
    out.cross[b.id] = rate(A.cross || 0, A.n); out.multilingual[b.id] = rate(A.multilingual || 0, A.n); out.swarm[b.id] = rate(A.swarm || 0, A.n);
  }
  for (const sp of ["dev", "test"]) { const A = acc["split:" + sp] || { n: 0 }; out.bySplit[sp] = { flood: rate(A.flood || 0, A.n), cross: rate(A.cross || 0, A.n), swarm: rate(A.swarm || 0, A.n) }; }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!existsSync(FILE)) { console.error(`missing ${FILE}: run python -I scripts/eval/prep-pheme-techniques.py <data>/pheme`); process.exit(1); }
  const threads = readFileSync(FILE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const S = summarise(threads);
  const sha = existsSync(RAW) ? createHash("sha256").update(readFileSync(RAW)).digest("hex") : null;
  const source = { name: "PHEME rumour and non-rumour threads (Zubiaga et al.)", url: "https://doi.org/10.6084/m9.figshare.6392078.v1", licence: "CC BY 4.0", years: "2014 to 2015", site: "Twitter", threads: threads.length, sha256: sha };
  const results = { generated: "2026-10-21", source, sizeBins: SIZE_BINS, ...S };
  writeFileSync(join(root, "project-docs/evidence/technique-baselines.json"), JSON.stringify(results, null, 1) + "\n");
  writeFileSync(join(root, "src/core/techniques-data.js"), `// Generated by scripts/techniques-baselines.mjs from project-docs/evidence/technique-baselines.json. Do not edit.\nexport const TECHNIQUE_BASELINES = ${JSON.stringify({ generated: results.generated, flood: S.flood, cross: S.cross, multilingual: S.multilingual, swarm: S.swarm })};\n`);
  console.log(JSON.stringify(S, null, 1));
}
