// Firefox check over WebDriver BiDi (scripts/demo/README.md). Development tool only. Installs the release
// xpi as a temporary add-on in a fresh headless profile, then shoots the first-run, Options, Analyse a
// file and privacy pages, checks a saved evidence chain, and opens a reply's window on the demo stage.
//   node scripts/demo/firefox.mjs <cmmns-firefox-<v>.xpi> <stage dir> <out dir> <evidence-chain.json>
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [xpi, stageDir, out, chain] = process.argv.slice(2);
const prof = mkdtempSync(join(tmpdir(), "dc-ff-"));
const port = 9341;
const ff = spawn("C:/Program Files/Mozilla Firefox/firefox.exe", ["--headless", "--no-remote", "--profile", prof, `--remote-debugging-port=${port}`, "--width=1280", "--height=800"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(), events = [];
for (let i = 0; i < 60; i++) { try { ws = new WebSocket(`ws://127.0.0.1:${port}/session`); await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; }); break; } catch { await sleep(500); } }
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else events.push(d); };
const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
const must = async (method, params) => { const r = await send(method, params); if (r.type === "error") throw new Error(`${method}: ${r.error} ${r.message}`); return r.result; };
const stages = JSON.parse(readFileSync(join(stageDir, "stages.json"), "utf8"));
try {
  await must("session.new", { capabilities: { alwaysMatch: { acceptInsecureCerts: true, "moz:firefoxOptions": {} } } });
  const ext = await must("webExtension.install", { extensionData: { type: "archivePath", path: xpi } });
  console.log("installed", ext.extension);
  await sleep(3000);
  const tree = await must("browsingContext.getTree", {});
  const urls = tree.contexts.map((c) => c.url);
  console.log("contexts", urls);
  const welcome = tree.contexts.find((c) => /welcome\.html/.test(c.url));
  const base = welcome ? welcome.url.replace(/welcome\.html.*$/, "") : null;
  const shot = async (ctx, name) => { const r = await must("browsingContext.captureScreenshot", { context: ctx }); writeFileSync(join(out, name), Buffer.from(r.data, "base64")); console.log("shot", name); };
  const evalIn = async (ctx, expr) => (await must("script.evaluate", { expression: expr, target: { context: ctx }, awaitPromise: true })).result;
  if (!base) throw new Error("no first-run page opened");
  await must("browsingContext.setViewport", { context: welcome.context, viewport: { width: 1280, height: 800 } });
  await shot(welcome.context, "ff-welcome.png");
  for (const page of ["options.html", "analyze.html", "privacy.html"]) {
    await evalIn(welcome.context, `location.href = ${JSON.stringify(base + page)}`).catch(() => {});
    await sleep(1500);
    await shot(welcome.context, `ff-${page.replace(".html", "")}.png`);
  }
  // Check the saved chain on the Analyse a file page.
  await evalIn(welcome.context, `location.href = ${JSON.stringify(base + "analyze.html")}`).catch(() => {});
  await sleep(1500);
  const input = await must("browsingContext.locateNodes", { context: welcome.context, locator: { type: "css", value: "#check" } });
  await must("input.setFiles", { context: welcome.context, element: input.nodes[0], files: [chain] });
  await sleep(1500);
  console.log("chain check:", JSON.stringify(await evalIn(welcome.context, "document.getElementById('checks').innerText")));
  await evalIn(welcome.context, "document.getElementById('checks').scrollIntoView({block:'center'})");
  await shot(welcome.context, "ff-analyze-chain.png");
  // A synthetic X page, answered by interception.
  await must("network.addIntercept", { phases: ["beforeRequestSent"], urlPatterns: [{ type: "string", pattern: "https://x.com/" }, { type: "pattern", protocol: "https", hostname: "x.com" }] });
  await must("session.subscribe", { events: ["network.beforeRequestSent"] });
  let stage = "thread";
  const answered = [];
  setInterval(async () => {
    while (events.length) {
      const e = events.shift();
      if (e.method !== "network.beforeRequestSent" || !e.params.isBlocked) continue;
      const u = e.params.request.url;
      let body = null, type = "text/html";
      if (u.includes("/i/api/graphql/demo/")) { const op = u.split("/demo/")[1].split("?")[0]; try { body = readFileSync(join(stageDir, `${stage}.${op}.json`), "utf8"); type = "application/json"; } catch { body = "{}"; } }
      else for (const [n, s] of Object.entries(stages)) if ([s.url, s.quotesUrl, s.retweetsUrl].includes(u.split("?")[0])) { stage = n; body = readFileSync(join(stageDir, `${n}.html`), "utf8"); }
      answered.push(u);
      if (body == null) { await send("network.failRequest", { request: e.params.request.request }); continue; }
      await send("network.provideResponse", { request: e.params.request.request, statusCode: 200, reasonPhrase: "OK", headers: [{ name: "content-type", value: { type: "string", value: type } }], body: { type: "string", value: body } });
    }
  }, 50);
  await send("browsingContext.navigate", { context: welcome.context, url: stages.thread.url, wait: "complete" });
  await sleep(5000);
  console.log("answered", answered.length);
  const loc = await must("browsingContext.locateNodes", { context: welcome.context, locator: { type: "css", value: "article[data-testid=tweet] [data-testid=tweetText]" } });
  console.log("articles", loc.nodes.length);
  const n = loc.nodes[2];
  await must("input.performActions", { context: welcome.context, actions: [{ type: "pointer", id: "m", actions: [{ type: "pointerMove", x: 0, y: 0, origin: { type: "element", element: n } }, { type: "pause", duration: 1500 }] }] });
  await sleep(2000);
  console.log("window:", JSON.stringify(await evalIn(welcome.context, "(document.querySelector('.pb-pop')||{}).innerText||'none'")).slice(0, 400));
  await shot(welcome.context, "ff-thread-window.png");
  console.log("pill:", JSON.stringify(await evalIn(welcome.context, "(document.querySelector('.pb-panel-head')||{}).innerText||'none'")));
} catch (e) { console.error("FAILED", e.message); process.exitCode = 1; }
finally { try { await send("session.end", {}); } catch {} ff.kill(); process.exit(); }
