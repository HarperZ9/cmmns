// A minimal Chrome DevTools Protocol client for the OCR evaluation: launch headless Chrome with a
// throwaway profile, open one page, send commands. Node's built-in WebSocket; no dependencies.
// R&D only: nothing here ships.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

// opts.chrome: the browser to run; opts.args: extra command line flags (tests/browser.js passes
// --no-sandbox on Linux CI runners, where Chrome's sandbox cannot start).
export async function launch(port = 9333, { chrome = CHROME, args = [] } = {}) {
  const profile = mkdtempSync(join(tmpdir(), "radar-ocr-chrome-"));
  const proc = spawn(chrome, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-extensions", "--hide-scrollbars", "--force-color-profile=srgb", ...args, "about:blank"], { stdio: "ignore" });
  let info = null;
  for (let i = 0; i < 100 && !info; i++) {
    await new Promise((ok) => setTimeout(ok, 100));
    try { info = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { info = null; }
  }
  if (!info) { proc.kill(); throw new Error(`Chrome did not open its debugging port (${chrome})`); }
  const page = info.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0;
  const waiting = new Map(), events = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) { const { ok, no } = waiting.get(msg.id); waiting.delete(msg.id); msg.error ? no(new Error(msg.error.message)) : ok(msg.result); }
    else if (msg.method) events.push(msg);
  };
  const send = (method, params = {}) => new Promise((ok, no) => { waiting.set(++id, { ok, no }); ws.send(JSON.stringify({ id, method, params })); });
  const close = () => { try { ws.close(); proc.kill(); } catch { /* already gone */ } setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch (e) { console.warn("could not remove the Chrome profile", e.code); } }, 1500); };
  await send("Page.enable");
  await send("Runtime.enable");
  return { send, close, events };
}

export async function goto(cdp, url) {
  cdp.events.length = 0;
  await cdp.send("Page.navigate", { url });
  for (let i = 0; i < 200; i++) {
    if (cdp.events.some((e) => e.method === "Page.loadEventFired")) break;
    await new Promise((ok) => setTimeout(ok, 25));
  }
  await cdp.send("Runtime.evaluate", { expression: "document.fonts ? document.fonts.ready.then(() => 1) : 1", awaitPromise: true });
}

export async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
  return r.result.value;
}
