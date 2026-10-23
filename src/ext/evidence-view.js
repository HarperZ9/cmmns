// The evidence block under the launch campaign section of the thread panel
// (project-docs/EVIDENCE-LAYER.md): the local count ledger, one-click lookups with their receipts,
// ad library links, an optional Internet Archive save of the post, and the evidence chain download.
// The first lookup asks for consent in place, saying exactly what is sent and to whom.
(() => {
  "use strict";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (label, title, fn) => { const b = el("button", "pb-btn", label); b.type = "button"; b.title = title; b.addEventListener("click", fn); return b; };
  const link = (label, href) => { const a = el("a", null, label); a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; return a; };
  const results = new Map();   // launch id -> last lookup result, kept for this page only
  const CONSENT = "Look up evidence sends the repository names and web domains this post links to GitHub, rdap.org with the registry it forwards to, and the Internet Archive. Your account, the post's text and every handle stay on this device. One click, one lookup. Your GitHub token, if you added one in Options, goes to GitHub alone.";

  function summary(r) {
    const o = r.observed || {};
    if (r.kind === "github-repo") return `${r.subject}: created ${String(o.created).slice(0, 10)}${o.daysBeforePost != null ? `, ${o.daysBeforePost} days before this post` : ""}; ${o.stars} stars.`;
    if (r.kind === "github-stars") return `${r.subject}: busiest 24 hours ${o.busiest.n} stars against a median day of ${o.medianPerDay} (${o.pagesRead} pages read${o.pagesSkipped ? `, ${o.pagesSkipped} not read` : ""}).`;
    if (r.kind === "domain-registration") return `${r.subject}: registered ${String(o.registered).slice(0, 10)}${o.daysBeforePost != null ? `, ${o.daysBeforePost} days before this post` : ""}${o.registrar ? ` (registrar ${o.registrar})` : ""}.`;
    if (r.kind === "wayback-first") return `${r.subject}: first Internet Archive capture ${o.first.slice(0, 10)}.`;
    return r.kind;
  }

  function receipts(box, res) {
    for (const r of res.receipts || []) box.append(el("p", "pb-num", summary(r)), el("p", "pb-foot", `Source: ${r.source}. Receipt ${r.hash.slice(0, 12)}, ${r.at.slice(0, 16)} UTC. What it shows: ${r.dnp}`));
    for (const n of res.notes || []) box.append(el("p", "pb-foot", n));
    if ((res.ads || []).length) {
      const p = el("p", "pb-num", "Ad libraries (each opens in a tab for you to search): ");
      res.ads.forEach((a, i) => { if (i) p.append(" · "); p.append(link(a.name, a.url)); });
      box.append(p, el("p", "pb-foot", PB.ADS_DOES_NOT_PROVE));
    }
  }

  async function run(box, ev, rerender) {
    const res = await chrome.runtime.sendMessage({ type: "pb-evidence", ...ev.request }).catch((e) => { PBGuard.report("evidence request failed", e); return { error: "failed" }; });
    results.set(ev.launchId, res || { error: "failed" });
    rerender();
  }

  function consent(box, ev, rerender) {
    box.append(el("p", "pb-foot", CONSENT), btn("Allow and look up", "Turns on evidence lookups (you can turn them off in Options) and runs this one.", async () => {
      await PBSettings.save({ evidence: true }).catch((e) => PBGuard.report("could not save settings", e));
      run(box, ev, rerender);
    }));
  }

  async function saveChain() {
    const res = await chrome.runtime.sendMessage({ type: "pb-evidence-export" }).catch(() => null);
    if (!res || !res.chain) return;
    const blob = new Blob([JSON.stringify(res.chain, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `radar-evidence-chain-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ev: { launchId, postUrl, ledger, request: { links, domains, text, name, postedAt } }
  function section(parent, ev, rerender) {
    if (!ev) return;
    const box = el("div", "pb-evidence");
    box.append(el("h3", "pb-sec-h", "Evidence"));
    const g = ev.ledger;
    if (g) for (const [k, c] of Object.entries(g.counts)) if (c.largestStep.by > 0) box.append(el("p", "pb-num", `${k}: ${c.first} to ${c.last} across your ${g.visits} visits; largest step +${c.largestStep.by} in ${c.largestStep.hours} h.`));
    if (g) box.append(el("p", "pb-foot", PB.LEDGER_DOES_NOT_PROVE));
    const res = results.get(ev.launchId);
    if (res && res.error === "off") consent(box, ev, rerender);
    else if (res && res.error === "browser-consent") box.append(el("p", "pb-foot", "Firefox asks you to allow this itself. Turn on Evidence lookups in Options, allow it when Firefox asks, then look up again."), btn("Open Options", "Opens Daylight Commons' options.", () => chrome.runtime.sendMessage({ type: "pb-open-options" }).catch((e) => PBGuard.report("could not open options", e))));
    else if (res && res.error) box.append(el("p", "pb-foot", "The lookup stopped partway. Try again later."));
    else if (res) receipts(box, res);
    else if (globalThis.PBSettings && PBSettings.get().evidence) box.append(btn("Look up evidence", "Asks GitHub, RDAP and the Internet Archive about what this post links to.", () => run(box, ev, rerender)));
    else consent(box, ev, rerender);
    const actions = el("p", "pb-num");
    if (ev.postUrl) {
      const save = link("Save this post to the Internet Archive", `https://web.archive.org/save/${ev.postUrl}`);
      save.addEventListener("click", () => chrome.runtime.sendMessage({ type: "pb-evidence-witness", postUrl: ev.postUrl }).catch((e) => PBGuard.report("witness receipt failed", e)));
      actions.append(save, " · ");
    }
    actions.append(btn("Save evidence chain", "Downloads every receipt Daylight Commons sealed in this browser, with the chain and Merkle proofs, to check offline.", saveChain));
    box.append(actions);
    parent.append(box);
  }

  globalThis.PBEvidenceView = Object.freeze({ section });
})();
