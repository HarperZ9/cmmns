// `daylight media convert <file> --to <format>` and `daylight media compress <file>`: the extension's
// convert page on the command line, through a system ffmpeg when one is installed (FFMPEG names
// another binary). Writes the new file beside the original, never over it, and a lineage file with
// both SHA-256 hashes, the step, its parameters and the ffmpeg version. Runs locally; sends nothing.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { ffmpegPlan } from "./media-args.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const unit = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} bytes`);
export const sizeLine = (a, b) => { const d = Math.round((100 * (a - b)) / a); return `${unit(a)} to ${unit(b)}, ${d >= 0 ? `${d}% smaller` : `${-d}% larger`}`; };

// The ffmpeg to run and its version line, or null when there is none.
export function findFfmpeg(env = process.env) {
  const bin = env.FFMPEG || "ffmpeg";
  const r = spawnSync(bin, ["-hide_banner", "-version"], { encoding: "utf8" });
  if (r.error || r.status !== 0) return null;
  return { bin, version: (r.stdout.split(/\r?\n/)[0] || "ffmpeg").trim() };
}

function outPath(file, plan, flags) {
  if (typeof flags.out === "string") return flags.out;
  const stem = basename(file, extname(file)), tag = plan.op === "compress" ? ".small" : "";
  let out = join(dirname(file), `${stem}${tag}.${plan.to}`), i = 2;
  while (existsSync(out)) out = join(dirname(file), `${stem}${tag}-${i++}.${plan.to}`);
  return out;
}

// Runs one conversion. Returns { out, lineage, line }. Throws with what to do next.
export function runMedia(op, file, flags = {}, env = process.env) {
  if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`No such file or folder: ${file}. Check the path.`);
  const plan = ffmpegPlan(op, extname(file).slice(1), flags);
  const ff = findFfmpeg(env);
  if (!ff) throw new Error("ffmpeg was not found. Install it (ffmpeg.org) or set FFMPEG to its path, or use the extension's Convert page, which needs nothing installed.");
  const out = outPath(file, plan, flags);
  if (out === file) throw new Error("The new file would replace the original. Give another name with --out.");
  if (existsSync(out) && !flags.force) throw new Error(`${out} exists. Add --force to replace it, or give another name with --out.`);
  const before = readFileSync(file);
  const r = spawnSync(ff.bin, ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", file, ...plan.args, out], { encoding: "utf8" });
  if (r.status !== 0 || !existsSync(out)) throw new Error(`ffmpeg could not ${op} this file: ${(r.stderr || "").trim().split(/\r?\n/).slice(-2).join(" ") || "no output"}`);
  const after = readFileSync(out);
  const lineage = { format: "daylight-lineage/1", original: sha(before), file: { name: basename(out), sha256: sha(after), bytes: after.length },
    steps: [{ op, from: sha(before), to: sha(after), params: plan.params, tool: ff.version, at: new Date().toISOString(), bytesBefore: before.length, bytesAfter: after.length }] };
  writeFileSync(out + ".lineage.json", JSON.stringify(lineage, null, 2) + "\n");
  return { out, lineage, line: `${basename(file)} to ${basename(out)}: ${sizeLine(before.length, after.length)}.\nSHA-256 before ${lineage.original}\nSHA-256 after  ${lineage.file.sha256}\nLineage written to ${basename(out)}.lineage.json\n` };
}
