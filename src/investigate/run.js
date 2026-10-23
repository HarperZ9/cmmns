// `case run <seed>`: the whole pipeline, end to end, with no one at the keyboard. Twelve stages,
// each idempotent: an item that finished is checkpointed and skipped next time; an item that was
// interrupted is purged (every row it wrote is tagged) and run again; each item runs under a
// watchdog; a lock with a heartbeat keeps two runs off one case. Run it again after a crash, or
// after adding seeds, and it carries on.
import { loadCase } from "./store.js";
import { purgeTag } from "./store.js";
import { loadState, saveState, isDone, markDone, takeLock, withTimeout, crashHook } from "./runstate.js";
import { parseSeeds } from "./ingest.js";
import { ingest, capture, archive, claims, primary } from "./stages-gather.js";
import { trace, timeline, network, leads, absences, reading, exportStage } from "./stages-build.js";

export const STAGES = [ingest, capture, archive, claims, primary, trace, timeline, network, leads, absences, reading, exportStage];
export const STAGE_NAMES = STAGES.map((s) => s.name);
const MAX_PASSES = 50, MAX_ROUNDS = 4;

// One stage: run every item not yet done, then look again, since capture finds more to capture.
async function runStage(ctx, stage, log) {
  let ran = 0;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const todo = (await stage.items(ctx)).filter((it) => !isDone(ctx.state, stage.name, it.key));
    if (!todo.length) break;
    for (const it of todo) {
      const tag = `${stage.name}:${it.key}`;
      purgeTag(ctx.dir, tag);
      let note;
      try { note = await withTimeout(Promise.resolve(stage.run(ctx, it, tag)), ctx.opts.itemTimeoutMs || 120000, tag); } catch (e) { purgeTag(ctx.dir, tag); note = `error: ${e.message}`; log(`  ${tag}: ${note}`); }
      ctx.crash(stage.name);
      markDone(ctx.state, stage.name, it.key, note);
      saveState(ctx.dir, ctx.state);
      ctx.beat();
      ran++;
    }
  }
  return ran;
}

// ctx: { dir, now, fetchFn, sleep, model, ocr, analyze, sign, tool, history, opts, log }
export async function runCase(seedArgs, ctx) {
  const lock = takeLock(ctx.dir);
  const log = ctx.log || (() => {});
  if (lock.note) log(lock.note);
  try {
    const state = loadState(ctx.dir);
    for (const a of seedArgs) for (const s of parseSeeds(a)) if (!state.seeds.some((x) => x.key === s.key)) state.seeds.push(s);
    if (!state.seeds.length) throw new Error("no seeds: give a URL, a folder, a file of URLs, or a claim");
    state.runs = (state.runs || 0) + 1;
    saveState(ctx.dir, state);
    const run = { ...ctx, state, data: () => loadCase(ctx.dir), crash: crashHook(ctx.env), beat: lock.beat, opts: ctx.opts || {} };
    const summary = {}, wanted = STAGES.filter((s) => !run.opts.stop || STAGE_NAMES.indexOf(s.name) <= STAGE_NAMES.indexOf(run.opts.stop));
    const body = wanted.filter((s) => s !== exportStage), last = wanted.filter((s) => s === exportStage);
    // Later stages can add sources (primary records), so the body repeats until nothing new runs.
    for (let round = 0; round < MAX_ROUNDS; round++) {
      let ran = 0;
      for (const stage of body) { const n = await runStage(run, stage, log); summary[stage.name] = (summary[stage.name] || 0) + n; ran += n; }
      if (!ran) break;
    }
    for (const stage of last) summary[stage.name] = await runStage(run, stage, log);
    for (const s of wanted) log(`${s.name}: ${summary[s.name] || 0} item${summary[s.name] === 1 ? "" : "s"}`);
    return { summary, state };
  } finally {
    lock.release();
  }
}
