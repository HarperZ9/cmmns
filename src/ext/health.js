// Adapter health in the page: after each read, content.js tells this file how many boxes the site
// reader picked out and how many it could read. When a platform has changed its markup so that
// Daylight Commons reads nothing where it should, a small notice says so plainly instead of Daylight Commons showing
// nothing (verdicts from src/core/health.js). The toolbar popup can run the same check on demand
// as a self-test. Counts only; no post text is kept or sent.
(() => {
  "use strict";
  let since = performance.now(), path = location.pathname, last = null, hidden = "", retry = 0;

  const structure = () => ({ times: document.querySelectorAll("time, [datetime]").length, articles: document.querySelectorAll('article, [role="article"]').length });
  const pageOf = (site, feed) => (site.onThread() ? "thread" : feed ? "feed" : "other");

  function found(site, feed, candidates, items) {
    if (location.pathname !== path) { path = location.pathname; since = performance.now(); }
    return { page: pageOf(site, feed), candidates, read: items.length, withText: items.filter((r) => r.text).length, sinceMs: performance.now() - since, structure: structure() };
  }

  function notice(site, v) {
    let n = document.getElementById("pb-health");
    if (!v.say || hidden === location.pathname) { if (n) n.remove(); return; }
    if (!n) {
      n = document.createElement("div");
      n.id = "pb-health"; n.className = "pb-health"; n.setAttribute("role", "status");
      document.body.append(n);
    }
    const p = document.createElement("p"); p.textContent = v.say;
    const help = document.createElement("p"); help.className = "pb-health-sub";
    help.textContent = "The site's own page still works. Daylight Commons' toolbar button has a self-test with the counts.";
    const close = document.createElement("button"); close.type = "button"; close.className = "pb-btn"; close.textContent = "Hide";
    close.addEventListener("click", () => { hidden = location.pathname; n.remove(); });
    n.replaceChildren(p, help, close);
  }

  // Called by content.js after each read. again() asks for another read once the page has settled.
  function observe(site, feed, candidates, items, again) {
    if (!site) { last = null; notice(null, { say: null }); return; }
    const f = found(site, feed, candidates, items);
    last = { site: site.name, ...f, verdict: PB.adapterHealth(site, f) };
    if (last.verdict.state === "waiting" && again) { clearTimeout(retry); retry = setTimeout(again, PB.HEALTH_SETTLE_MS - f.sinceMs + 200); }
    notice(site, last.verdict);
  }

  // The self-test: read the page now with the site's reader and count what came back.
  function selfTest(site, feed) {
    if (!site) return null;
    const nodes = site.items();
    const items = nodes.map((n) => { try { return site.read(n); } catch (e) { PBGuard.report("self-test read failed", e); return null; } }).filter(Boolean);
    const f = found(site, feed, nodes.length, items);
    return { site: site.name, ...f, withAuthor: items.filter((r) => r.author).length, withId: items.filter((r) => r.id).length, verdict: PB.adapterHealth(site, { ...f, sinceMs: Math.max(f.sinceMs, PB.HEALTH_SETTLE_MS) }), at: new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC" };
  }

  globalThis.PBHealth = Object.freeze({ observe, selfTest, last: () => last });
})();
