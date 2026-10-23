// The thread panel: a small floating "Daylight Commons" button that opens into a summary of the thread. It
// starts collapsed and remembers the user's choice for the session. Sections read top-down: what
// it means, where accounts are based, signs of coordination, links and video, then actions.
(() => {
  "use strict";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pct = (x) => `${Math.round(x * 100)}%`;
  const ci = (c) => `${pct(c[0])} to ${pct(c[1])}`;
  const num = (x) => (x == null ? null : Number(x).toLocaleString());
  let open = false;
  // The tour's thread-report tip (src/ext/tour.js), taken once per page and kept until dismissed.
  let tip = null, tipDone = false;
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

  // Each coordination sign is followed by how often it shows up in ordinary threads
  // (src/core/baselines.js), so the count reads against normal.
  function coordination(report, clusters, viewed) {
    const base = (sign, on) => (on ? PB.baselineLine(sign, { replies: report.replies, viewed }) : null);
    const bursts = report.bursts || [], groups = report.groups || [];
    return [
      report.joinBurst && report.joinBurst.n >= 3 ? `${report.joinBurst.n} of ${report.joinBurst.of} looked-up accounts joined within the same two weeks (${report.joinBurst.from} to ${report.joinBurst.to}).` : null,
      ...bursts.slice(0, 3).map((b) => `${b.authors.length} accounts replied within ${Math.max(1, Math.round((Date.parse(b.to) - Date.parse(b.from)) / 1000))} s at ${b.from.slice(11, 16)} UTC (${b.authors.slice(0, 4).map((a) => "@" + a).join(", ")}). Chance at this thread's pace: p ≈ ${b.p < 1e-6 ? "<0.000001" : b.p.toPrecision(2)}.`),
      base("burst", bursts.length),
      clusters.length ? `${clusters.length} group${clusters.length === 1 ? "" : "s"} of near-identical replies from different accounts (largest ${clusters[0].ids.length}).` : null,
      base("same-text", clusters.length),
      groups.length ? "Seen together in other threads you viewed: " + groups.slice(0, 3).map((g) => `@${g.a} and @${g.b} (${g.n})`).join("; ") + "." : null,
      base("together", groups.length),
      ...flooding(report.flood, base),
      ...swarming(report.swarm, base),
      ...(report.crossLang || []).slice(0, 2).map((g) => `One ${g.kind === "claim" ? "fact-checked claim" : g.kind === "media" ? "upload" : "link"} carried by ${g.accounts} accounts in ${g.langs.length} languages (${g.langs.map((l) => l.replace("script:", "")).join(", ")}).`),
      base("cross-language", (report.crossLang || []).length),
      report.machine && report.machine.n ? `${report.machine.n} of ${report.replies} replies show machine-writing signs or leaked AI text.` : null,
    ];
  }

  // The flooding sign (src/core/flooding.js): volume, speed, then repeat posters as context.
  function flooding(f, base) {
    if (!f) return [];
    return [
      f.volume ? `${f.volume.accounts.length} accounts posting ${f.threshold} or more times a day wrote ${Math.round(f.volume.share * 100)}% of the ${f.volume.known} replies whose account rate Daylight Commons knows.` : null,
      f.speed ? `${f.speed.highRate} of the ${f.speed.accounts} accounts in a burst at ${f.speed.from.slice(11, 16)} UTC post ${f.threshold} or more times a day.` : null,
      f.repeaters.length ? `Context: ${f.repeaters.map((x) => `@${x.handle} replied ${x.n} times`).join(", ")}. Conversations do this too.` : null,
      base("flood", true),
      PB.FLOOD_DOES_NOT_PROVE,
    ];
  }

  // The swarming sign (src/core/swarming.js): counts only, never the accounts, so the thread report
  // cannot become a list to pile on in turn.
  function swarming(w, base) {
    if (!w) return [];
    const parts = [w.newAccounts ? `${w.newAccounts} new` : null, w.flagged ? `${w.flagged} flagged` : null].filter(Boolean).join(", ");
    return [
      `${w.marked} of ${w.known} accounts Daylight Commons read in a ${Math.round(w.windowSec / 60)}-minute window from ${w.from.slice(11, 16)} UTC were new or flagged (${parts}), all replying to this post.`,
      base("swarm", true),
      PB.SWARM_DOES_NOT_PROVE,
    ];
  }

  // The channel's documented backing (src/core/backing.js), in brief: the window on any of the
  // channel's own comments shows every record with its sources.
  function channelBacking(video) {
    const p = video && video.channelId && PB.backingOfChannel ? PB.backingOfChannel(video.channelId) : null;
    if (!p) return null;
    return `${PB.backingLabel(p)} for this channel (${p.name}): ${p.rows.slice(0, 3).map((r) => `${r.kind}, ${r.who} (${r.status})`).join("; ")}. ${PB.BACKING_DOES_NOT_PROVE}`;
  }

  function sources(report, video, pushed) {
    return [
      ...(report.state || []).map((st) => `${st.replies} repl${st.replies === 1 ? "y" : "ies"}: ${PB.stateLabel(st).says} (${st.names.slice(0, 2).join(", ")})`),
      ...(pushed || []).slice(0, 3).map((x) => `${x.domain} pushed by ${x.authors} accounts across ${x.threads} threads you viewed.`),
      video ? [video.channel, video.subscribers, video.channelBadges].filter(Boolean).join(" · ") : null,
      video && video.funding ? `Funding: ${video.funding}` : null,
      channelBacking(video),
      video && video.paidPromotion ? video.paidPromotion : null,
      video && video.synthetic ? `Uploader says: ${video.synthetic}` : null,
      video && video.published ? [video.published, video.category, video.views != null ? `${num(video.views)} views` : null].filter(Boolean).join(" · ") : null,
    ];
  }

  const links = (p, pairs) => { for (const [label, href] of pairs) { const a = el("a", "pb-link", label); a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; p.append(a); } return p; };
  // Each campaign sign names the catalogue entries that cite it, at their versions, and links to them
  // and to the dispute template (src/core/catalogue-links.js). A link opens only when clicked.
  function catalogue(s, id) {
    if (!id || !PB.badgeLinks) return;
    const b = PB.badgeLinks(id, PB.CATALOGUE_ENTRIES, PB.SIGNAL_REGISTRY);
    s.append(links(el("p", "pb-foot pb-cat", `${PB.badgeLine(b)} `), b.links));
  }

  // The launch campaign lens (src/core/campaign.js, src/ext/campaign.js): the lead, the ladder's
  // claims, each sign with what it does not prove, then context, the dispute route and the wipe.
  function campaign(p, c, rerender) {
    if (!c || c.status === "undefined" || (c.status === "thin" && !c.indicators.length)) return;
    const s = el("section", "pb-psec");
    s.append(el("h3", "pb-sec-h", "Launch campaign"), el("p", "pb-num", c.lead));
    for (const x of c.claims || []) s.append(el("p", "pb-num", x.text));
    for (const x of c.indicators) { s.append(el("p", "pb-num", x.text), el("p", "pb-foot", `Read it as: ${x.dnp}`)); catalogue(s, x.id); }
    for (const x of c.context) { s.append(el("p", "pb-num", x.text)); catalogue(s, x.id); }
    s.append(el("p", "pb-foot", c.dnp), el("p", "pb-foot", c.dispute));
    if (PB.DECISIONS_URL) s.append(links(el("p", "pb-foot", `${PB.DECISIONS_NOTE} `), [["Decisions log", PB.DECISIONS_URL]]));
    if (globalThis.PBDefinitionsView) PBDefinitionsView.section(s, PBDefinitionsView.model(c));
    if (c.onForget) s.append(button("Forget launches I viewed", "Deletes the launch overlap Daylight Commons keeps in this browser (hashed accounts only).", () => c.onForget()));
    if (globalThis.PBEvidenceView) PBEvidenceView.section(s, c.evidence, rerender);
    p.append(s);
  }

  // stats: { site, pending, scanning, paused, video, pushed, viewed, onExport, onCard, onClearHistory }
  function render(report, clusters, stats, onLookupAll) {
    let p = document.getElementById("pb-panel");
    if (!p) { p = el("aside", "pb-panel"); p.id = "pb-panel"; document.body.append(p); }
    p.dataset.open = open ? "1" : "0";
    p.replaceChildren();
    const signs = (report.bursts || []).length + clusters.length + (report.state || []).length;
    // A platform funding label is source context worth seeing without opening the panel.
    const funded = stats.video && stats.video.funding ? " · funding label" : "";
    const head = el("button", "pb-panel-head", open ? "Daylight Commons" : `Daylight Commons · ${report.replies}${signs ? ` · ${signs} sign${signs === 1 ? "" : "s"}` : ""}${funded}`);
    head.type = "button";
    head.setAttribute("aria-expanded", String(open));
    head.addEventListener("click", () => { open = !open; try { sessionStorage.setItem("pb.panel.open", open ? "1" : "0"); } catch (_) { /* ignore */ } render(report, clusters, stats, onLookupAll); });
    p.append(head);
    if (!tip && !tipDone && globalThis.PBTour) tip = PBTour.take("panel");
    if (tip && !tipDone) {
      const box = PBPop.tipBox({ ...tip, open: ["Lesson: the thread report", "learn.html#thread-report"] });
      box.addEventListener("click", (e) => { if (e.target.tagName === "BUTTON") tipDone = true; });
      p.append(box);
    }
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
      stats.paused ? "X is limiting requests; Daylight Commons paused for a few minutes." : stats.scanning ? `Reading ${stats.scanning} more…` : null,
    ]);
    const coord = coordination(report, clusters, stats.viewed);
    campaign(p, report.campaign, () => render(report, clusters, stats, onLookupAll));
    section(p, "Coordination", coord);
    if (coord.some((t) => t && t.includes(" showed up in "))) p.lastChild.append(el("p", "pb-foot", PB.BASELINE_SOURCE));
    // Persuasion techniques get their own line; they never count toward "flagged".
    section(p, "Persuasion", report.persuasion ? [report.persuasion.sentence] : []);
    // Reading-lens frames (src/core/reading.js): how many posts and authors here use each one.
    section(p, "Frames in this thread", (report.lens || []).map((x) => `${x.name}: ${x.posts} of ${x.of} posts, ${x.authors} author${x.authors === 1 ? "" : "s"}${x.pattern ? ", a pattern" : ""}`));
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
    if (stats.onCard) acts.append(button("Save card", "Makes a card about this thread (never about one account) to read, then save or share as an image and a JSON file.", stats.onCard));
    if (stats.onClearHistory) acts.append(button("Clear history", "Forgets which accounts Daylight Commons has seen in which threads (this browser only).", stats.onClearHistory));
    p.append(acts);
    p.append(el("p", "pb-foot", PB.REPORT_DOES_NOT_PROVE));
  }

  function remove() { const p = document.getElementById("pb-panel"); if (p) p.remove(); }
  function setOpen(v) { open = !!v; }

  globalThis.PBPanel = Object.freeze({ render, remove, setOpen });
})();
