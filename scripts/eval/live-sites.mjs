// Live check of site cards in a real Chromium with the extension loaded. R&D only: needs
// playwright-core and a Chromium build, neither of which ships. The search engines' and the
// article's addresses are answered with the synthetic pages in tests/fixtures, so no real search
// is made. Measures long tasks and main-thread time on an idle page with and without the card.
//
//   node scripts/eval/live-sites.mjs --pw <path to playwright-core> --chromium <chrome.exe> [--real <news URL>]
import { cpSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = await import(pathToFileURL(join(arg("--pw"), "index.mjs")).href);
const fixture = (f) => readFileSync(join(root, "tests/fixtures", f), "utf8");

// A test copy of the extension with the optional hosts granted up front, since a script cannot
// click the browser's permission prompt.
const ext = mkdtempSync(join(tmpdir(), "radar-ext-"));
cpSync(join(root, "src/ext"), ext, { recursive: true });
const m = JSON.parse(readFileSync(join(ext, "manifest.json"), "utf8"));
m.host_permissions = [...m.host_permissions, ...m.optional_host_permissions, "https://www.theguardian.com/*"];
writeFileSync(join(ext, "manifest.json"), JSON.stringify(m));
const profile = mkdtempSync(join(tmpdir(), "radar-prof-"));
const ctx = await chromium.launchPersistentContext(profile, { executablePath: arg("--chromium"), headless: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
const out = {};
try {
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent("serviceworker");
  // The worker can answer before its extension APIs are bound; wait until storage is there.
  for (let i = 0; i < 20 && !(await sw.evaluate(() => !!(globalThis.chrome && chrome.storage))); i++) await new Promise((r) => setTimeout(r, 250));
  await sw.evaluate(() => chrome.storage.local.set({ "pb.settings": { search: { google: true, bing: true, duckduckgo: true } } }));
  await new Promise((r) => setTimeout(r, 1500));
  for (const [host, file] of [["https://www.google.com/search?q=floods", "search-google.html"], ["https://www.bing.com/search?q=floods", "search-bing.html"], ["https://duckduckgo.com/?q=floods", "search-duckduckgo.html"]]) {
    await ctx.route(host.split("?")[0] + "**", (r) => r.fulfill({ contentType: "text/html", body: fixture(file) }));
    const page = await ctx.newPage();
    await page.goto(host);
    await page.waitForTimeout(2500);
    out[file] = await page.$$eval(".pb-site-line", (n) => n.map((x) => x.textContent));
    const a = page.locator("a").first();
    await a.hover(); await page.waitForTimeout(900);
    out[file + " hover"] = await page.$$eval(".pb-pop .pb-g-who, .pb-pop .pb-g-fact", (n) => n.map((x) => x.textContent));
    await page.close();
  }
  // The article card, injected the way the toolbar button does it.
  const url = arg("--real", "https://www.theguardian.com/world/2026/oct/20/radar-fixture");
  if (!arg("--real")) await ctx.route(url, (r) => r.fulfill({ contentType: "text/html", body: fixture("article.html") }));
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load" });
  const idle = async (ms) => page.evaluate((ms) => new Promise((res) => {
    const lt = []; const ob = new PerformanceObserver((l) => lt.push(...l.getEntries().map((e) => e.duration))); ob.observe({ type: "longtask", buffered: false });
    setTimeout(() => { ob.disconnect(); res({ longTasks: lt.length, longestMs: Math.round(Math.max(0, ...lt)) }); }, ms);
  }), ms);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Performance.enable");
  const busy = async () => (await cdp.send("Performance.getMetrics")).metrics.find((x) => x.name === "TaskDuration").value;
  let t = await busy(); out.idleBefore = await idle(10000); out.idleBefore.mainThreadMsPer10s = Math.round((await busy() - t) * 1000);
  const tab = await sw.evaluate(async (u) => (await chrome.tabs.query({})).find((x) => x.url && x.url.startsWith(u.split("#")[0])).id, url);
  const t0 = Date.now();
  await sw.evaluate(async (tabId) => {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["badges.css"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["core.bundle.js", "settings.js", "pop.js", "linkcard.js", "sitepage.js"] });
  }, tab);
  await page.waitForSelector(".pb-pop", { timeout: 5000 });
  out.cardMs = Date.now() - t0;
  out.card = await page.$$eval(".pb-pop .pb-row", (n) => n.map((x) => x.textContent).slice(0, 14));
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(arg("--shots", tmpdir()), "radar-sitecard.png") });
  // Other coverage: turn it on with two outlets as the options page would (the browser grants each
  // feed host there), then read and accept the consent step.
  await sw.evaluate(() => chrome.storage.local.set({ "pb.settings": { coverage: true, outlets: { bbc: true, npr: true } } }));
  await page.waitForTimeout(400);
  await sw.evaluate(async (tabId) => chrome.scripting.executeScript({ target: { tabId }, func: () => globalThis.PBSitePage.show() }), tab);
  await page.waitForTimeout(600);
  out.consent = await page.$$eval(".pb-pop .pb-row", (n) => n.map((x) => x.textContent).filter((x) => /Would ask|sends nothing/i.test(x)));
  const c0 = Date.now();
  await page.getByRole("button", { name: "Ask these outlets" }).click();
  await page.waitForFunction(() => [...document.querySelectorAll(".pb-pop .pb-row")].some((r) => /^Asked/.test(r.textContent)), null, { timeout: 30000 });
  out.coverageMs = Date.now() - c0;
  out.coverage = await page.$$eval(".pb-pop .pb-row", (n) => n.map((x) => x.textContent).filter((x) => !/^Review|^Site|^Owned|^Founded|^Country|^Fact-check|^Source|^Does not/.test(x)).slice(0, 16));
  await page.waitForTimeout(600);
  await page.$eval(".pb-pop", (p) => { const s = [...p.querySelectorAll(".pb-sec-h")].find((h) => h.textContent === "Other coverage"); if (s) s.scrollIntoView(); });
  await page.screenshot({ path: join(arg("--shots", tmpdir()), "radar-coverage.png") });
  t = await busy(); out.idleAfter = await idle(10000); out.idleAfter.mainThreadMsPer10s = Math.round((await busy() - t) * 1000);
} finally {
  await ctx.close();
  rmSync(ext, { recursive: true, force: true }); rmSync(profile, { recursive: true, force: true });
}
console.log(JSON.stringify(out, null, 1));
