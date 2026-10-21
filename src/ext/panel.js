// The thread panel: a small floating "Radar" button that opens into a summary of the thread. It
// starts collapsed and remembers the user's choice for the session. Sections read top-down: what
// it means, where accounts are based, signs of coordination, links and video, then actions.
(() => {
  "use strict";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pct = (x) => `${Math.round(x * 100)}%`;
  const ci = (c) => `${pct(c[0])} to ${pct(c[1])}`;
  const num = (x) => (x == null ? null : Number(x).toLocaleString());
  let open = false;
  try { open = sessionStorage.getItem("pb.panel.open") === "1"; } catch (_) { /* storage blocked */ }

  function section(p, title, lines) {
    const items = lines.filter(Boolean);
    if (!items.length) return;
    const s = el("section", "pb-psec");
    s.append(el("h3", "pb-sec-h", title));
    for (const t of items) s.append(el("p", "pb-num", t));
    p.append(s);
  }

  function button(label, title, fn) { const b = el("button", "pb-btn", label); b.type = "button"; b.title = title; b.addEventListener("click", fn); return b; }

  function coordination(report, clusters) {
    return [
      report.joinBurst && report.joinBurst.n >= 3 ? `${report.joinBurst.n} of ${report.joinBurst.of} looked-up accounts joined within the same two weeks (${report.joinBurst.from} to ${report.joinBurst.to}).` : null,
      ...(report.bursts || []).slice(0, 3).map((b) => `${b.authors.length} accounts replied within ${Math.max(1, Math.round((Date.parse(b.to) - Date.parse(b.from)) / 1000))} s at ${b.from.slice(11, 16)} UTC (${b.authors.slice(0, 4).map((a) => "@" + a).join(", ")}). Chance at this thread's pace: p ≈ ${b.p < 1e-6 ? "<0.000001" : b.p.toPrecision(2)}.`),
      clusters.length ? `${clusters.length} group${clusters.length === 1 ? "" : "s"} of near-identical replies from different accounts (largest ${clusters[0].ids.length}).` : null,
      report.groups && report.groups.length ? "Seen together in other threads you viewed: " + report.groups.slice(0, 3).map((g) => `@${g.a} and @${g.b} (${g.n})`).join("; ") + "." : null,
      report.machine && report.machine.n ? `${report.machine.n} of ${report.replies} replies show machine-writing signs or leaked AI text.` : null,
    ];
  }

  function sources(report, video, pushed) {
    return [
      ...(report.state || []).map((st) => `${st.replies} repl${st.replies === 1 ? "y" : "ies"}: ${PB.stateLabel(st).says} (${st.names.slice(0, 2).join(", ")})`),
      ...(pushed || []).slice(0, 3).map((x) => `${x.domain} pushed by ${x.authors} accounts across ${x.threads} threads you viewed.`),
      video ? [video.channel, video.subscribers, video.channelBadges].filter(Boolean).join(" · ") : null,
      video && video.funding ? `Funding: ${video.funding}` : null,
      video && video.paidPromotion ? video.paidPromotion : null,
      video && video.synthetic ? `Uploader says: ${video.synthetic}` : null,
      video && video.published ? [video.published, video.category, video.views != null ? `${num(video.views)} views` : null].filter(Boolean).join(" · ") : null,
    ];
  }

  // stats: { site, pending, scanning, paused, video, pushed, onExport, onClearHistory }
  function render(report, clusters, stats, onLookupAll) {
    let p = document.getElementById("pb-panel");
    if (!p) { p = el("aside", "pb-panel"); p.id = "pb-panel"; document.body.append(p); }
    p.dataset.open = open ? "1" : "0";
    p.replaceChildren();
    const signs = (report.bursts || []).length + clusters.length + (report.state || []).length;
    // A platform funding label is source context worth seeing without opening the panel.
    const funded = stats.video && stats.video.funding ? " · funding label" : "";
    const head = el("button", "pb-panel-head", open ? "Radar" : `Radar · ${report.replies}${signs ? ` · ${signs} sign${signs === 1 ? "" : "s"}` : ""}${funded}`);
    head.type = "button";
    head.setAttribute("aria-expanded", String(open));
    head.addEventListener("click", () => { open = !open; try { sessionStorage.setItem("pb.panel.open", open ? "1" : "0"); } catch (_) { /* ignore */ } render(report, clusters, stats, onLookupAll); });
    p.append(head);
    if (!open) return;
    p.append(el("p", "pb-sentence", report.replies ? report.sentence : "No comments loaded on this page, so there is no reply report. The source details below still apply."));
    section(p, "Flagged accounts", report.verdict === "too-few" ? [] : [`Among the most extreme replies: ${pct(report.extreme.share)} (95% interval ${ci(report.extreme.ci)}).`, `Among the rest: ${pct(report.others.share)} (${ci(report.others.ci)}).`]);
    section(p, "Where accounts are based", [
      report.origins && report.origins.length ? report.origins.slice(0, 6).map((o) => `${o.place} ${o.n}`).join(" · ") : null,
      stats.site && !stats.site.hasLocation ? ({
        instagram: `${report.lookedUp} of ${report.replies} accounts have an "About this account" you opened. Instagram shows where an account is based only there.`,
        facebook: `${report.lookedUp} of ${report.replies} accounts have Page transparency you opened. Facebook shows it for Pages, not people.`,
        bluesky: `${report.lookedUp} of ${report.replies} accounts have Bluesky data (join date, moderation labels). Bluesky shows no account location.`,
      }[stats.site.id] || `${stats.site.name} shows no account location; this view uses coordination signs only.`) : `${report.lookedUp} of ${report.replies} accounts read so far.`,
      stats.paused ? "X is limiting requests; Radar paused for a few minutes." : stats.scanning ? `Reading ${stats.scanning} more…` : null,
    ]);
    section(p, "Coordination", coordination(report, clusters));
    const U = report.upstream;
    section(p, "Upstream", U ? [
      U.accounts.length ? "Replies quote or lift media from: " + U.accounts.map((a) => `@${a.handle} (${a.n})`).join(", ") + "." : null,
      U.domains.length ? "Most-linked sites: " + U.domains.map((d) => `${d.domain} (${d.n})`).join(", ") + "." : null,
      U.recycled ? `${U.recycled} of ${U.uploads} uploads here were first posted by another account.` : null,
    ] : []);
    section(p, "Sources and media", sources(report, stats.video, stats.pushed));
    const acts = el("div", "pb-actions");
    if (!stats.scanning && !stats.paused && stats.pending) acts.append(button(`Read ${Math.min(stats.pending, 200)} accounts`, "Reads each account's profile and About page in one minimised window.", onLookupAll));
    if (stats.onExport) acts.append(button("Save report", "Saves the report and each account's flags to a JSON file on this computer. Nothing is uploaded.", stats.onExport));
    if (stats.onClearHistory) acts.append(button("Clear history", "Forgets which accounts Radar has seen in which threads (this browser only).", stats.onClearHistory));
    p.append(acts);
    p.append(el("p", "pb-foot", PB.REPORT_DOES_NOT_PROVE));
  }

  function remove() { const p = document.getElementById("pb-panel"); if (p) p.remove(); }
  function setOpen(v) { open = !!v; }

  globalThis.PBPanel = Object.freeze({ render, remove, setOpen });
})();
