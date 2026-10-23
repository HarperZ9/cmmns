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
  const KEYS = { reports: "pb.history.v1", feed: "pb.feed.v1", net: "pb.net.v2", media: PB.MEDIA_KEY };
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
  } catch (e) { console.error("[daylight-commons] label lookup failed", e); }
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

  // Documented operations: the whole table's counts, and which of the logged sites a report named.
  let opsAll = null;
  try { opsAll = await chrome.runtime.sendMessage({ type: "pb-ops", all: true }); } catch (e) { console.error("[daylight-commons] ops table failed", e); }
  function operations() {
    if (!opsAll || !opsAll.ops || !opsAll.ops.length) { $("ops-say").textContent = "The operations table did not load."; return; }
    const T = PB.opsTrend(opsAll), named = PB.opsLookup(opsAll, { domains: [...domains] });
    const sites = new Set(named.indicators.map((i) => i.d));
    $("ops-say").textContent = `Daylight Commons carries ${plural(T.total, "operation", "operations")} from ${plural(T.byState.length, "attributed country", "attributed countries")}, each cited to the reports that found it. ` +
      (sites.size ? `${plural(sites.size, "site", "sites")} in your logs ${sites.size === 1 ? "was" : "were"} named in one of those reports: ${[...sites].slice(0, 5).join(", ")}.` : "Sites in your logs that those reports name are listed here.");
    $("ops-caveat").textContent = PB.OPS_TREND_CAVEAT;
    bars($("ops-years"), T.byYear.map((y) => ({ ...y, label: String(y.year) })), (r) => r.label);
    bars($("ops-states"), T.byState, (r) => r.state, (r) => `${plural(r.docs, "document", "documents")}`);
  }

  function rhetoric(d) {
    $("strong-say").textContent = d.strong
      ? `${plural(d.strong.k, "post or reply", "posts and replies")} of ${d.strong.n.toLocaleString()} showed strong rhetoric signs: dehumanising words, calls for violence, slurs, or two weaker signs together.`
      : "Open a thread with Daylight Commons on, and its posts and replies are counted here.";
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
      ? "Techniques start counting here once they pass their measurement. The options page lists each technique with its measured figure."
      : T.counts.length ? `Counted for the techniques that passed their measurement: ${T.shown.map((t) => PB.TECHNIQUES[t].name.toLowerCase()).join(", ")}.` : "Measured techniques are counted here when a post you open uses one.";
  }

  // Reading-lens frames (src/core/reading.js): feed posts that used each technique the window shows.
  function lens(d) {
    const rows = d.lens || [];
    bars($("lens"), rows, (r) => PB.TECHNIQUE_BY_ID.get(r.id).name, (r) => `${r.n} of ${d.feedPosts.toLocaleString()} feed posts`);
    $("lens-say").textContent = rows.length ? "Feed posts you scrolled past, counted once per technique." : "Frames show here when a feed post uses a technique the window shows.";
  }

  // The episodic and thematic balance (src/core/feed.js framingBalance): held with its reason and no
  // counts until the person-story reading clears its measurement.
  function framing(d) {
    const F = d.framing || { shown: false, status: "held back: not measured" };
    $("framing-say").textContent = !F.shown
      ? `Daylight Commons can read whether a feed post tells an issue through one person's story or explains it through trends, numbers and policy. That reading is ${F.status.replace(/^held back: /, "")}, and it starts here once it passes the same bar as every other sign.`
      : F.read ? `Of ${plural(F.read, "feed post", "feed posts")} long enough to read, the first bar shows those told purely through one person's story and the second those explained purely through structure. The rest mixed the two or took another form. ${PB.FRAMING_DOES_NOT_PROVE}` : "Feed posts long enough to read are counted here.";
    shareBar($("framing-person"), F.shown ? F.personStory : null, "posts told only as a person's story");
    shareBar($("framing-structure"), F.shown ? F.structural : null, "posts explained only through structure");
  }

  function checks(d) {
    $("flag-say").textContent = d.flagged
      ? `${plural(d.flagged.k, "account", "accounts")} of ${d.flagged.n.toLocaleString()} read were flagged: one strong sign, such as a very new account or a reply that speaks as a local from somewhere else, or two different weaker signs.`
      : "Accounts Daylight Commons reads in this window are counted here.";
    shareBar($("flag"), d.flagged, "accounts read with a flag");
    $("checks-say").textContent = d.notes
      ? `${plural(d.notes.k, "post", "posts")} of ${d.notes.n.toLocaleString()} carried a Community Note, and ${plural(d.claims.k, "post", "posts")} closely matched a claim a fact-checker had already reviewed.`
      : "Posts you open in this window are counted here.";
    const tb = $("together").querySelector("tbody");
    tb.replaceChildren();
    for (const e of d.together) { const tr = el("tr"); tr.append(el("td", null, `@${e.a} and @${e.b}`), el("td", "n", String(e.n)), evidence(e.threads)); tb.append(tr); }
    if (!d.together.length) { const tr = el("tr"); const td = el("td", "empty", "A pair appears here once two accounts reply in three or more of the same threads."); td.colSpan = 3; tr.append(td); tb.append(tr); }
    $("together-say").textContent = ["Pairs of accounts that replied in at least three of the same threads you opened. Friends and fans of the same creator do this too.", PB.pairsLine(d.threads)].filter(Boolean).join(" ");
  }

  // Content Credentials survival (src/core/survival.js): the files the user checked, per site.
  function media(days) {
    const rows = PB.survival(store[KEYS.media], { days }), tb = $("media").querySelector("tbody");
    tb.replaceChildren();
    for (const r of rows) {
      const tr = el("tr");
      tr.append(el("td", null, r.site), ...[r.n, r.intact, r.partial, r.changed, r.none + r.remote].map((x) => el("td", "n", x.toLocaleString())));
      tb.append(tr);
    }
    $("media").hidden = !rows.length;
    const n = rows.reduce((a, r) => a + r.n, 0), k = rows.reduce((a, r) => a + r.intact, 0);
    $("media-say").textContent = n
      ? `Of ${plural(n, "file", "files")} you asked Daylight Commons to check, ${k.toLocaleString()} carried Content Credentials that were intact. Platforms often strip credentials on upload, so read "none found" as missing data about the file. The count covers the files you checked.`
      : "In a post's window, \"Check this file\" reads a file's Content Credentials and adds it here.";
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
    $("scope").textContent = `${plural(d.threads, "thread", "threads")} and ${plural(d.feedPosts, "feed post", "feed posts")}, ${d.from} to ${d.to}.` + (held < days ? ` Daylight Commons keeps ${keep} days (Options), so this covers ${keep}.` : "");
    sites(d); operations(); rhetoric(d); techniques(d); lens(d); framing(d); checks(d); media(days);
    for (const b of document.querySelectorAll(".window button")) b.setAttribute("aria-pressed", String(+b.dataset.days === days));
  }

  for (const b of document.querySelectorAll(".window button")) b.addEventListener("click", () => render(+b.dataset.days));
  $("not-show").textContent = PB.FEED_DOES_NOT_SHOW;
  $("foot").textContent = `Daylight Commons ${chrome.runtime.getManifest().version}. Kept ${keep} days in this browser; accounts seen together, 30 days at most.`;
  render(7);
})().catch((e) => { console.error("[daylight-commons] feed page failed", e); document.getElementById("scope").textContent = "Could not read the logs: " + e.message; });
