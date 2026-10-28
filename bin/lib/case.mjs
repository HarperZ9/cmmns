// `cmmns case <command>`: an investigation folder from the command line. Every command except
// `add <url>`, `run` and `watch` works offline. project-docs/INVESTIGATE.md documents the format.
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { initCase, slug } from "../../src/investigate/layout.js";
import { loadCase, addRow, updateRow, byId, isCase } from "../../src/investigate/store.js";
import { addSource } from "../../src/investigate/add.js";
import { inboxUrls } from "../../src/investigate/ingest.js";
import { addClaim, addLabel, labelAgreement } from "../../src/investigate/claims.js";
import { traceClaim, traceLines } from "../../src/investigate/trace.js";
import { buildTimeline, timelineLines } from "../../src/investigate/timeline.js";
import { buildNetwork, networkLines, networkHtml, checkEdge } from "../../src/investigate/network.js";
import { rankLeads, leadLines, checkLead, checkAbsence, absentLines } from "../../src/investigate/records.js";
import { clock, network, gitInit, gitCommit } from "./case-env.mjs";
import { RUN_COMMANDS } from "./case-run.mjs";
import { SCHEDULE_HELP } from "../../src/investigate/watch.js";
import { CASE_HELP, helpText } from "./help.mjs";
import { ProtectionBlocked } from "../../src/investigate/protection.js";
import { protectEnv, settings } from "./case-protect.mjs";

export const CASE_USAGE = `Usage: cmmns case <command> [--case <folder>] [--json]
  init <name> [--dir <folder>]                 a new case folder with its own git repository
  add <url|file> [--archive | --no-archive] [--origin O] [--tier T] [--date D] [--what W]
  claim "<text>" --source S01 --rung documented|inference|unproven|contradicted
        [--retells C01 | --corroborates C01] [--self-sourced] [--date D] [--key K]
  claims [--blind]                             the inventory; --blind hides rungs for labellers
  label <claim> --labeller <name> --rung R     a blind label;  labels  shows agreement
  trace <claim>                                origin and drift chain, independent origins
  event "<text>" --date D --source S [--key K] timeline  [--gap days]
  edge --from A --to B --type quote|reply|repost|mention|link --source S
  network [--html out.html]
  lead "<question>" --record R --holder H --decisive 1-5 [--access public|request|legal|unknown] [--claims C01,C02]
  leads                                        ranked by how decisive the record would be
  absent ["<what>" --status deleted|edited|sealed|withheld|missing --custodian C [--source S]]
  actor @handle [--name N] [--public-figure] [--keep-name]  only public figures keep their handle
                                               in exports; in protection mode only --keep-name
  export --profile newsroom|legal|research     signed, versioned; verify-export <folder>
  read                                         the Reading lens over every capture
  run <seed...> [--archive] [--stop <stage>]   the whole pipeline; resumes after a crash
  review [--accept ids] [--reject ids]         the queue of machine proposals
  watch [--export]                             re-check captures and leads; see --schedule
  import <old-case-folder> [--with-captures]   a hand-made case into this format
  settings [archive on|off] [protection on|off] Wayback requests (off by default) and
                                               source-protection mode for this case
  export ... [--clean]                         Share clean every file in the export
`;

const VALUE = new Set(["case", "dir", "source", "rung", "retells", "corroborates", "date", "key", "labeller", "gap", "from", "to", "type", "html", "record", "holder", "decisive", "access", "claims", "status", "custodian", "name", "profile", "origin", "tier", "what", "stop", "accept", "reject", "by", "key-file", "note", "path"]);

export function parseCaseArgs(argv) {
  const out = { _: [], f: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const [k, v] = a.slice(2).split(/=(.*)/s);
    out.f[k] = v !== undefined ? v : VALUE.has(k) ? argv[++i] : true;
  }
  return out;
}

const list = (s) => (typeof s === "string" && s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);
const asJson = (x) => JSON.stringify(x, null, 2) + "\n";

function init(env, { _: [name], f }) {
  const dir = resolve(typeof f.dir === "string" ? f.dir : slug(name || ""));
  const meta = initCase(dir, name, env.now());
  const git = f["no-git"] ? false : gitInit(dir);
  return `Case "${meta.name}" opened in ${dir}${git ? " (its own git repository)" : ""}.\n`;
}

// A Wayback save request only when asked: --archive, or the case's archive setting. Never in
// source-protection mode, where asking for one is an error rather than a silent skip.
export function wantArchive(env, f) {
  if (f.archive && f["no-archive"]) throw new Error("--archive and --no-archive contradict each other; choose one");
  if (f.archive && env.protection) throw new ProtectionBlocked("a Wayback save request");
  if (f.archive) return true;
  if (f["no-archive"]) return false;
  return env.settings.archive && !env.protection;
}

async function add(env, { _: [target], f }) {
  if (!target) throw new Error("case add needs a URL or a file");
  if (/\.jsonl$/i.test(target)) {
    const have = new Set(env.data().sources.map((s) => s.url)), out = [];
    for (const u of inboxUrls(target)) if (!have.has(u)) out.push(await add(env, { _: [u], f: { ...f, json: false } }));
    return out.join("") || "Every address in the list is already in the case.\n";
  }
  const r = await addSource(env.dir, target, { fetchFn: env.fetchFn, sleep: env.sleep, now: env.now, archive: wantArchive(env, f), protection: env.protection, origin: f.origin, tier: f.tier, date: f.date, what: f.what });
  const s = r.source, extra = [...r.derived.edges.map((e) => `edge ${e.id}`), ...r.derived.absent.map((a) => `absence ${a.id}`)];
  env.commit(`case add ${s.id}`);
  return f.json ? asJson(r) : `${s.id} captured: ${s.capture.bytes} bytes, sha256 ${s.capture.sha256}. ${s.archive.url ? `Archived at ${s.archive.url}.` : s.archive.error ? `No archive copy: ${s.archive.error}.` : s.archive.note + "."}${extra.length ? ` Also recorded: ${extra.join(", ")}.` : ""}\n`;
}

function claim(env, { _: [text], f }) {
  const c = addClaim(env.dir, env.data(), { text, source: f.source, rung: f.rung, retells: f.retells, corroborates: f.corroborates, selfSourced: !!f["self-sourced"], date: f.date, key: f.key, note: f.note, now: env.now() });
  env.commit(`case claim ${c.id}`);
  return f.json ? asJson(c) : `${c.id} recorded (${c.rung}).\n`;
}

function claims(env, { f }) {
  const rows = env.data().claims.filter((c) => c.status !== "rejected");
  if (f.json) return asJson(f.blind ? rows.map(({ rung, ...r }) => r) : rows);
  return rows.map((c) => `${c.id}${f.blind ? "" : ` [${c.rung}${c.status === "proposed" ? ", proposed" : ""}]`} ${c.text} (${c.source})`).join("\n") + "\n";
}

function label(env, { _: [id], f }) {
  const l = addLabel(env.dir, env.data(), { claim: id, labeller: f.labeller, rung: f.rung, now: env.now() });
  env.commit(`case label ${l.claim} by ${l.labeller}`);
  return `${l.id} recorded.\n`;
}

function labels(env, { f }) {
  const a = labelAgreement(env.data());
  if (f.json) return asJson(a);
  if (a.agreement == null) return `Agreement: ${a.note}.\n`;
  return `${a.labellers.join(" and ")} labelled ${a.n} claims. Agreement ${a.agreement}, Cohen's kappa ${a.kappa}.\n${a.disagreements.map((d) => `  ${d.claim}: ${a.labellers.map((w) => `${w} ${d[w]}`).join(", ")}; inventory ${d.inventory}`).join("\n")}\n`;
}

const views = {
  trace: (env, { _: [id], f }) => { const t = traceClaim(env.data(), id); return f.json ? asJson(t) : traceLines(t); },
  timeline: (env, { f }) => { const t = buildTimeline(env.data(), { gapDays: f.gap ? Number(f.gap) : 3 }); return f.json ? asJson(t) : timelineLines(t); },
  network: (env, { f }) => {
    const data = env.data(), n = buildNetwork(data);
    if (typeof f.html === "string") { writeFileSync(f.html, networkHtml(n, `${data.meta.name}: network`)); }
    return f.json ? asJson(n) : networkLines(n) + (typeof f.html === "string" ? `Graph written to ${f.html}.\n` : "");
  },
  leads: (env, { f }) => { const l = rankLeads(env.data()); return f.json ? asJson(l) : leadLines(l); },
};

function event(env, { _: [text], f }) {
  const data = env.data();
  if (!text || !f.date) throw new Error('case event needs "<text>" and --date');
  if (f.source && !byId(data.sources).has(f.source)) throw new Error(`no source ${f.source} in this case`);
  const e = addRow(env.dir, "events", { date: f.date, text, source: f.source || null, key: f.key || null });
  env.commit(`case event ${e.id}`);
  return `${e.id} recorded.\n`;
}

function edge(env, { f }) {
  const e = { from: f.from, to: f.to, type: f.type, source: f.source };
  const p = checkEdge(e, byId(env.data().sources));
  if (p) throw new Error(p);
  const row = addRow(env.dir, "edges", e);
  env.commit(`case edge ${row.id}`);
  return `${row.id} recorded.\n`;
}

function lead(env, { _: [question], f }) {
  const l = { question, record: f.record, holder: f.holder || null, decisive: Number(f.decisive), access: f.access || "unknown", claims: list(f.claims), path: f.path || null, status: "open" };
  const p = checkLead(l, byId(env.data().claims));
  if (p) throw new Error(p);
  const row = addRow(env.dir, "leads", l);
  env.commit(`case lead ${row.id}`);
  return `${row.id} recorded.\n`;
}

function absent(env, { _: [what], f }) {
  const data = env.data();
  if (!what) return f.json ? asJson(data.absent) : absentLines(data.absent);
  const a = { what, status: f.status, custodian: f.custodian || null, source: f.source || null, noted: env.now(), note: f.note || null };
  const p = checkAbsence(a, byId(data.sources));
  if (p) throw new Error(p);
  const row = addRow(env.dir, "absent", a);
  env.commit(`case absent ${row.id}`);
  return `${row.id} recorded.\n`;
}

function actor(env, { _: [handle], f }) {
  if (!handle) throw new Error("case actor needs a handle");
  const data = env.data(), h = handle.startsWith("@") ? handle : "@" + handle;
  const have = data.actors.find((a) => String(a.handle).toLowerCase() === h.toLowerCase());
  const row = have ? updateRow(env.dir, "actors", have.id, (r) => ({ ...r, public_figure: !!f["public-figure"], keep_name: !!f["keep-name"], name: f.name || r.name })) : addRow(env.dir, "actors", { handle: h, name: f.name || null, public_figure: !!f["public-figure"], keep_name: !!f["keep-name"], note: f.note || null });
  env.commit(`case actor ${row.handle}`);
  return `${row.handle}: ${row.public_figure ? "public figure, handle kept in exports" : "private, shown as a pseudonym in exports"}.\n`;
}

const COMMANDS = { settings, add, claim, claims, label, labels, event, edge, lead, absent, actor, ...views, ...RUN_COMMANDS };
const READ_ONLY = new Set(["claims", "labels", "trace", "timeline", "network", "leads", "verify-export"]);

export async function runCaseCommand(argv, base = {}) {
  const args = parseCaseArgs(argv), cmd = args._.shift();
  if (cmd === "help" && CASE_HELP[args._[0]]) return { code: 0, out: helpText(CASE_HELP[args._[0]], `cmmns case ${args._[0]}`) };
  if (cmd && args.f.help && CASE_HELP[cmd]) return { code: 0, out: helpText(CASE_HELP[cmd], `cmmns case ${cmd}`) };
  if (!cmd || cmd === "help" || args.f.help) return { code: cmd ? 0 : 2, out: CASE_USAGE };
  const net = network(base.env || process.env);
  const env = { now: clock(base.env || process.env), ...net, ...base };
  if (cmd === "init") return { code: 0, out: init(env, args) };
  if (cmd === "watch" && args.f.schedule) return { code: 0, out: SCHEDULE_HELP };
  const fn = COMMANDS[cmd];
  if (!fn) return { code: 2, out: `Unknown case command "${cmd}". The commands are:
${CASE_USAGE}` };
  env.dir = resolve(typeof args.f.case === "string" ? args.f.case : base.cwd || process.cwd());
  if (cmd === "run" && !isCase(env.dir)) { initCase(env.dir, typeof args.f.name === "string" ? args.f.name : "Case from seeds", env.now()); if (!args.f["no-git"]) gitInit(env.dir); }
  env.data = () => loadCase(env.dir);
  if (cmd !== "verify-export") Object.assign(env, protectEnv(env, env.data().meta, base.env || process.env));   // an export checks on its own, outside any case
  env.commit = args.f["no-commit"] || READ_ONLY.has(cmd) ? () => false : (msg) => gitCommit(env.dir, msg, { anon: env.protection });
  return { code: 0, out: await fn(env, args) };
}

