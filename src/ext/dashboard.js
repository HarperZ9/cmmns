// "Your feed": what the user's feeds and threads carried over 7 or 30 days (src/core/feed.js), from
// this browser's local logs. Outlet owners and state links come from the extension's own tables
// through the background worker. Nothing is fetched from the web and nothing is sent anywhere.
// A mirror, not a hook: no streaks, no goals, no notifications.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pct = (x) => `${Math.round(x * 100)}%`;
  const plural = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
  const KEYS = { reports: "pb.history.v1", feed: "pb.feed.v1", net: "pb.net.v2" };
  await PBSettings.ready;
  const keep = PBSettings.get().historyDays;
  const store = await chrome.storage.local.get(Object.values(KEYS));

  // Owners and state links for every site in the logs, asked once.
  const domains = new Set();
  for (const s of Object.values(store[KEYS.reports] || {})) for (const l of (s.context && s.context.links) || []) domains.add(l.domain);
  for (const f of Object.values(store[KEYS.feed] || {})) for (const d of Object.keys(f.links || {})) domains.add(d);
  try {
    const ask = { domains: [...domains], handles: [] };
    const [owners, states] = await Promise.all([chrome.runtime.sendMessage({ type: "pb-owners", ...ask }), chrome.runtime.sendMessage({ type: "pb-state", ...ask })]);
    PB.setOwnerRows(owners || []); PB.setStateRows(states || []);
  } catch (e) { console.error("[radar] label lookup failed", e); }
  const isState = (d) => PB.stateLinksOfDomain(d).length > 0;
  const known = (d) => [PB.ownerOfDomain(d) ? `owned by ${PB.ownerOfDomain(d).owner}` : null, ...new Set(PB.stateLinksOfDomain(d).map((h) => PB.stateLabel(h).chip))].filter(Boolean).join("; ");

  // A proportion as a bar with its 95% interval, and the same numbers written out beside it.
  function shareBar(box, s, what) {
    box.replaceChildren();
    if (!s) return;
    const track = el("div", "track"), fill = el("span", "fill"), ci = el("span", "ci");
    fill.style.width = pct(s.share);
    ci.style.left = pct(s.ci[0]); ci.style.width = `${Math.max(0.5, (s.ci[1] - s.ci[0]) * 100)}%`;
    track.append(fill, ci);
    const text = `${s.k.toLocaleString()} of ${s.n.toLocaleString()} ${what} (${pct(s.share)}, 95% interval ${pct(s.ci[0])} to ${pct(s.ci[1])})`;
    track.title = text; track.setAttribute("role", "img"); track.setAttribute("aria-label", text);
    box.append(track, el("span", "n", `${pct(s.share)} of ${s.n.toLocaleString()}`));
  }

  function bars(box, rows, label, sub) {
    box.replaceChildren();
    const max = Math.max(1, ...rows.map((r) => r.n));
    for (const r of rows) {
      const row = el("div", "bar"), name = el("span", "name", label(r)), extra = sub ? sub(r) : "";
      if (extra) name.append(el("small", null, extra));
      const track = el("span", "track"), fill = el("span", "fill");
      fill.style.width = `${(r.n / max) * 100}%`; track.append(fill);
      row.title = `${label(r)}: ${r.n.toLocaleString()}${extra ? ` (${extra})` : ""}`;
      row.append(name, track, el("span", "n", r.n.toLocaleString()));
      box.append(row);
    }
  }

  function sites(d) {
    bars($("sites"), d.sites, (r) => r.domain, (r) => known(r.domain));
    $("sites-say").textContent = d.siteMentions
      ? `${plural(d.siteMentions, "link", "links")} to ${plural(d.siteCount, "site", "sites")}. The most linked, ${d.sites[0].domain}, had ${d.sites[0].n.toLocaleString()} of them. Each post counts once per site.`
      : "No links counted yet in this window.";
    $("state-say").textContent = d.state
      ? `${plural(d.state.k, "link", "links")} of ${d.state.n.toLocaleString()} went to sites a cited source ties to a state: state-owned outlets, designated outlets, or domains named in takedown reports.`
      : "No links counted yet in this window.";
    shareBar($("state"), d.state, "links to state-linked sites");
  }

  function rhetoric(d) {
    $("strong-say").textContent = d.strong
      ? `${plural(d.strong.k, "post or reply", "posts and replies")} of ${d.strong.n.toLocaleString()} showed strong rhetoric signs: dehumanising words, calls for violence, slurs, or two weaker signs together.`
      : "No posts or replies counted yet in this window.";
    shareBar($("strong"), d.strong, "posts and replies with strong signs");
    const box = $("days"), tb = $("days-table").querySelector("tbody");
    box.replaceChildren(); tb.replaceChildren();
    // Heights are relative to the highest day, which the label states, so low shares stay visible.
    const top = Math.max(0, ...d.daily.filter((x) => x.strongN).map((x) => x.strong / x.strongN));
    box.setAttribute("aria-label", `Share with strong signs by day; the tallest bar is ${pct(top)}. The table under Numbers by day has the counts.`);
    $("days-scale").textContent = top ? `By day. The tallest bar is ${pct(top)}; rest the pointer on a bar for its numbers.` : "";
    for (const day of d.daily) {
      const bar = el("i", day.strongN ? null : "none");
      bar.style.height = day.strongN && top ? `${Math.max(2, (day.strong / day.strongN / top) * 100)}%` : "1px";
      bar.title = day.strongN ? `${day.day}: ${day.strong} of ${day.strongN} (${pct(day.strong / day.strongN)})` : `${day.day}: nothing counted`;
      box.append(bar);
      const tr = el("tr"); tr.append(el("td", null, day.day), el("td", "n", String(day.strongN)), el("td", "n", String(day.strong))); tb.append(tr);
    }
  }

  function techniques(d) {
    const T = d.techniques;
    bars($("tech"), T.counts, (r) => PB.TECHNIQUES[r.id].name);
    $("tech-say").textContent = !T.shown.length
      ? "No technique has passed its measurement yet, so none is counted here. The options page lists each technique with its measured figure; one that clears the bar starts counting here."
      : T.counts.length ? `Counted only for techniques that passed their measurement: ${T.shown.map((t) => PB.TECHNIQUES[t].name.toLowerCase()).join(", ")}.` : "None of the measured techniques was seen in this window.";
  }

  function checks(d) {
    $("flag-say").textContent = d.flagged
      ? `${plural(d.flagged.k, "account", "accounts")} of ${d.flagged.n.toLocaleString()} read were flagged: one strong sign, such as a very new account or a reply that speaks as a local from somewhere else, or two different weaker signs.`
      : "No accounts read yet in this window.";
    shareBar($("flag"), d.flagged, "accounts read with a flag");
    $("checks-say").textContent = d.notes
      ? `${plural(d.notes.k, "post", "posts")} of ${d.notes.n.toLocaleString()} carried a Community Note, and ${plural(d.claims.k, "post", "posts")} closely matched a claim a fact-checker had already reviewed.`
      : "No posts counted yet in this window.";
    const tb = $("together").querySelector("tbody");
    tb.replaceChildren();
    for (const e of d.together) { const tr = el("tr"); tr.append(el("td", null, `@${e.a} and @${e.b}`), el("td", "n", String(e.n)), evidence(e.threads)); tb.append(tr); }
    if (!d.together.length) { const tr = el("tr"); const td = el("td", "empty", "No pair has appeared together in three or more threads in this window."); td.colSpan = 3; tr.append(td); tb.append(tr); }
    $("together-say").textContent = "Pairs of accounts that replied in at least three of the same threads you opened. Friends and fans of the same creator do this too.";
  }

  // The threads behind a pair, linked where the thread key allows it.
  function evidence(keys) {
    const td = el("td");
    keys.forEach((k, i) => {
      if (i) td.append(", ");
      const url = PB.threadUrl(k);
      if (!url) { td.append(el("span", "mono", k)); return; }
      const a = el("a", null, k.replace(/^[a-z]+:/, "")); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; td.append(a);
    });
    return td;
  }

  function render(days) {
    const d = PB.feedDashboard(store[KEYS.reports], store[KEYS.feed], store[KEYS.net], { days, isState });
    const held = Math.min(days, keep);
    $("scope").textContent = `${plural(d.threads, "thread", "threads")} and ${plural(d.feedPosts, "feed post", "feed posts")}, ${d.from} to ${d.to}.` + (held < days ? ` Radar keeps ${keep} days (Options), so this covers ${keep}.` : "");
    sites(d); rhetoric(d); techniques(d); checks(d);
    for (const b of document.querySelectorAll(".window button")) b.setAttribute("aria-pressed", String(+b.dataset.days === days));
  }

  for (const b of document.querySelectorAll(".window button")) b.addEventListener("click", () => render(+b.dataset.days));
  $("not-show").textContent = PB.FEED_DOES_NOT_SHOW;
  $("foot").textContent = `Radar ${chrome.runtime.getManifest().version}. Kept ${keep} days in this browser; accounts seen together, 30 days at most. Evidence, not verdicts.`;
  render(7);
})().catch((e) => { console.error("[radar] feed page failed", e); document.getElementById("scope").textContent = "Could not read the logs: " + e.message; });
