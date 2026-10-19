// The history page: aggregates across the threads the user has viewed (src/core/history.js), from
// this browser's local logs. Nothing is fetched from the web; outlet owners and state links come
// from the extension's own tables through the background worker.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pct = (x) => `${Math.round(x * 100)}%`;
  const KEYS = { reports: "pb.history.v1", net: "pb.net.v1", trail: "pb.trail.v1" };
  const store = await chrome.storage.local.get(Object.values(KEYS));
  const s = PB.summarize(store[KEYS.reports], store[KEYS.net], store[KEYS.trail]);

  const sites = Object.entries(s.sites).map(([k, n]) => `${n} on ${k}`).join(", ");
  $("scope").textContent = s.threads ? `${s.threads} thread${s.threads === 1 ? "" : "s"} since ${s.since} (${sites}). Kept 60 days in this browser only.` : "No threads yet. Open posts on X, YouTube or Reddit with Radar on, and they will show up here.";
  $("caveat").textContent = PB.HISTORY_DOES_NOT_PROVE;

  const tile = (value, label, hot) => { const t = el("div", "tile" + (hot ? " hot" : "")); t.append(el("b", null, value), el("span", null, label)); return t; };
  $("tiles").append(
    tile(s.replies.toLocaleString(), "replies seen"),
    tile(s.looked.toLocaleString(), "accounts read"),
    tile(s.flaggedShare ? pct(s.flaggedShare.share) : "–", s.flaggedShare ? `flagged (95% CI ${pct(s.flaggedShare.ci[0])} to ${pct(s.flaggedShare.ci[1])})` : "flagged", !!(s.flaggedShare && s.flaggedShare.share > 0)),
    tile(s.extreme ? pct(s.extreme.share) : "–", s.extreme ? `of ${s.extreme.n} most extreme replies from flagged accounts` : "extreme replies from flagged accounts"),
    tile(String(s.bursts), "timing bursts"),
    tile(String(s.machine), "replies with machine-writing signs"),
  );

  // The funnel.
  const F = s.funnel;
  $("funnel-sentence").textContent = F.concentration
    ? F.concentration.sources <= 5
      ? `Across your threads, replies quoted or lifted media from ${F.concentration.sources} upstream account${F.concentration.sources === 1 ? "" : "s"} (${F.concentration.mentions} links). Concentration needs more sources to mean anything.`
      : `Across your threads, replies quoted or lifted media from ${F.concentration.sources} upstream accounts. The top five account for ${pct(F.concentration.top5)} of ${F.concentration.mentions} upstream links.`
    : "No upstream links recorded yet. They appear once Radar has seen quotes, reposts or lifted media in the threads you open.";
  const fill = (tableId, rows, cells) => {
    const tb = $(tableId).querySelector("tbody");
    tb.replaceChildren();
    if (!rows.length) { const tr = el("tr"); const td = el("td", "empty", "None yet."); td.colSpan = 3; tr.append(td); tb.append(tr); return; }
    for (const r of rows) { const tr = el("tr"); for (const c of cells(r)) tr.append(c); tb.append(tr); }
  };
  const acct = (h) => { const td = el("td"); const a = el("a", null, "@" + h); a.href = `https://x.com/${encodeURIComponent(h)}`; a.target = "_blank"; a.rel = "noopener noreferrer"; td.append(a); return td; };
  const num = (n) => el("td", "n", String(n));

  // Owner and state labels for the listed sites, from the extension's own tables.
  const domains = F.domains.map((d) => d.domain);
  let owners = [], states = [];
  try { [owners, states] = await Promise.all([chrome.runtime.sendMessage({ type: "pb-owners", domains, handles: [] }), chrome.runtime.sendMessage({ type: "pb-state", domains, handles: [] })]); } catch (e) { console.error("[radar] label lookup failed", e); }
  PB.setOwnerRows(owners || []); PB.setStateRows(states || []);
  const known = (d) => [...new Set(PB.stateLinksOfDomain(d).map((h) => PB.stateLabel(h).chip))].concat(PB.ownerOfDomain(d) ? [`owned by ${PB.ownerOfDomain(d).owner}`] : []).join("; ") || "–";

  fill("up-accounts", F.accounts, (r) => [acct(r.handle), num(r.threads)]);
  fill("up-domains", F.domains, (r) => [el("td", null, r.domain), el("td", "muted", known(r.domain)), num(r.threads)]);
  fill("recurring", s.recurring, (r) => [acct(r.handle), num(r.threads)]);
  fill("uploads", s.uploads, (r) => [acct(r.first.handle), num(r.accounts), num(r.posts)]);
  fill("state", s.stateLinks, (r) => [el("td", null, PB.stateLabel(r).says), num(r.replies)]);

  // Trend: one bar per day, height = flagged share.
  const trend = $("trend");
  trend.setAttribute("aria-label", "Flagged share by day; the table below has the numbers.");
  for (const d of s.days) {
    const share = d.looked ? d.flagged / d.looked : 0;
    const bar = el("i");
    bar.style.height = `${Math.max(2, Math.round(share * 100))}%`;
    bar.title = `${d.day}: ${d.flagged} of ${d.looked} accounts flagged (${pct(share)}), ${d.threads} thread${d.threads === 1 ? "" : "s"}`;
    trend.append(bar);
  }
  fill("trend-table", [...s.days].reverse().slice(0, 14), (d) => [el("td", null, d.day), num(d.threads), num(d.looked), num(d.looked ? pct(d.flagged / d.looked) : "–")]);

  // Origins as horizontal bars (single series, so no legend).
  const max = Math.max(1, ...s.origins.map((o) => o.n));
  if (!s.origins.length) $("origins").append(el("p", "muted", "None read yet."));
  for (const o of s.origins) {
    const row = el("div", "bar"); row.title = `${o.place}: ${o.n} account readings`;
    const fillBar = el("i"); fillBar.style.width = `${Math.round((o.n / max) * 100)}%`;
    const track = el("div"); track.append(fillBar);
    row.append(el("span", null, o.place), track, el("em", null, String(o.n)));
    $("origins").append(row);
  }

  $("export").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ tool: "Radar " + chrome.runtime.getManifest().version, savedAt: new Date().toISOString(), summary: s, doesNotProve: PB.HISTORY_DOES_NOT_PROVE }, null, 2)], { type: "application/json" }));
    a.download = `radar-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  $("clear").addEventListener("click", async () => {
    if (!confirm("Clear Radar's thread history, connections log and source trails from this browser?")) return;
    await chrome.storage.local.remove(Object.values(KEYS));
    location.reload();
  });
})().catch((e) => { console.error("[radar] history page failed", e); document.getElementById("scope").textContent = "Could not read the history: " + e.message; });
