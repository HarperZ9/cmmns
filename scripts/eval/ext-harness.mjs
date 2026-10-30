// Shared by the R&D timing harnesses (save-timing.mjs, likes-timing.mjs): a Chromium with the unpacked
// extension loaded and X's hosts mapped to a local HTTPS server, a flat DevTools session on one tab, and
// evaluation in the extension's content-script world. Nothing here ships.
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, statSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Opens a browser on url with the extension at ext; downloads go to <work>/dl-<stamp>.
// serverPort: where the local HTTPS server listens; X's hosts on 443 are mapped to it.
export async function openTab({ chromium, ext, work, stamp, url, port, serverPort = 443 }) {
  const to = serverPort === 443 ? "127.0.0.1" : `127.0.0.1:${serverPort}`;
  const profile = join(work, `profile-${stamp}`), dl = join(work, `dl-${stamp}`);
  rmSync(dl, { recursive: true, force: true });
  mkdirSync(join(profile, "Default"), { recursive: true }); mkdirSync(dl, { recursive: true });
  writeFileSync(join(profile, "Default", "Preferences"), JSON.stringify({ download: { default_directory: dl, prompt_for_download: false, directory_upgrade: true } }));
  const proc = spawn(chromium, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--ignore-certificate-errors",
    `--host-resolver-rules=MAP x.com:443 ${to}, MAP pbs.twimg.com:443 ${to}, MAP video.twimg.com:443 ${to}`, `--disable-extensions-except=${ext}`, `--load-extension=${ext}`, "about:blank"], { stdio: "ignore" });
  const dt = await devtools(port);
  const { targetId } = await dt.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await dt.send("Target.attachToTarget", { targetId, flatten: true });
  await dt.send("Target.activateTarget", { targetId });   // a background tab gets no scroll events
  await dt.send("Runtime.enable", {}, sessionId); await dt.send("Page.enable", {}, sessionId);
  await dt.send("Page.navigate", { url }, sessionId);
  await inExtension(dt, sessionId, `new Promise((ok) => { const go = () => (globalThis.PBQuickSave && document.readyState === "complete" ? setTimeout(() => ok(true), 1500) : setTimeout(go, 50)); go(); })`);
  const js = (expr) => inExtension(dt, sessionId, expr);
  const close = async () => { dt.close(); proc.kill(); await sleep(1500); try { rmSync(profile, { recursive: true, force: true }); } catch (e) { console.error("profile left behind:", e.code); } };
  return { dt, sessionId, dl, js, close };
}

// A flat-session DevTools client over the browser's own socket.
export async function devtools(port) {
  let info = null;
  for (let i = 0; i < 300 && !info; i++) { await sleep(100); try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { info = null; } }
  if (!info) throw new Error("Chromium did not open its debugging port");
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0;
  const waiting = new Map(), events = [];
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && waiting.has(msg.id)) { const w = waiting.get(msg.id); waiting.delete(msg.id); msg.error ? w.no(new Error(msg.error.message)) : w.ok(msg.result); } else if (msg.method) events.push(msg); };
  const send = (method, params = {}, sessionId) => new Promise((ok, no) => { waiting.set(++id, { ok, no }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
  return { send, events, close: () => ws.close() };
}

// Evaluates in the extension's content-script world of the page.
export async function inExtension(dt, session, expr) {
  for (let i = 0; i < 100; i++) {
    const ctx = dt.events.filter((e) => e.sessionId === session && e.method === "Runtime.executionContextCreated").map((e) => e.params.context)
      .filter((c) => c.auxData && c.auxData.type === "isolated" && c.origin.startsWith("chrome-extension://")).pop();
    if (ctx) {
      const r = await dt.send("Runtime.evaluate", { expression: expr, contextId: ctx.id, awaitPromise: true, returnByValue: true }, session);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
      return r.result.value;
    }
    await sleep(100);
  }
  if (process.env.DEBUG) console.error(JSON.stringify(dt.events.filter((e) => e.method === "Runtime.executionContextCreated").map((e) => e.params.context)));
  throw new Error("the extension's page world did not appear");
}

// Files complete on disk under dir (no .crdownload), and their total size.
export function onDisk(dir) {
  const out = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n), s = statSync(p); if (s.isDirectory()) walk(p); else out.push({ name: n, size: s.size }); } };
  try { walk(dir); } catch { /* not made yet */ }
  return { done: out.filter((f) => !/\.crdownload$|\.tmp$/.test(f.name)), partial: out.filter((f) => /\.crdownload$/.test(f.name)).length };
}
export async function untilFiles(dir, n, ms = 180000) {
  const t0 = Date.now();
  for (; Date.now() - t0 < ms; await sleep(20)) { const d = onDisk(dir); if (d.done.length >= n && !d.partial) return d.done; }
  throw new Error(`only ${onDisk(dir).done.length} of ${n} files arrived`);
}

