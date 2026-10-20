// Reads the replies a site has rendered on a post's page, works out each reply's evidence, and
// draws the badges and the thread report. It reads only what is on screen. On X, account
// readings come from About pages the user visited or asked to look up; other sites show no
// account location, so their badges carry coordination signs only (src/ext/platforms.js).
(() => {
  "use strict";
  const SCAN_MAX = 200;   // accounts per scan; one scan reads two pages per account
  let scanLeft = 0;
  const lookingUp = new Set();
  const failed = new Set();   // looked up this session, nothing readable came back
  let timer = 0, lastPath = location.pathname, lastPending = [];

  // Flags for one reply from what the site offers: the account reading (X only) and clusters.
  function evidence(site, r, reading, c) {
    const cluster = c ? { size: c.ids.length, authors: c.authors } : null;
    const mismatch = PB.compare(r.text, reading && reading.basedIn);
    const activity = PB.activity(PBLogs.net(), r.author);
    const echo = PB.echoes(PBLogs.net(), site.id + ":" + location.pathname, r.text);
    if (reading && site.hasLocation) return { mismatch, activity, flags: PB.flagsFor({ handle: r.author, display: reading.display || r.display, postsCount: reading.postsCount, followersCount: reading.followersCount, followingCount: reading.followingCount, joinDate: reading.joinDate, nameChanges: reading.nameChanges, basedIn: reading.basedIn, connectedVia: reading.connectedVia, proxyNote: reading.proxyNote, profileLocation: reading.profileLocation }, { mismatch, cluster, activity, echo }) };
    // Reddit: account age, karma and sign-up name from Reddit's own account data (src/ext/reddit.js).
    const rd = site.id === "reddit" && globalThis.PBReddit ? PBReddit.get(r.author) : null;
    const flags = PB.flagsFor({ handle: site.hasLocation ? r.author : "", display: r.display, joinDate: rd && rd.joinDate, karma: rd && rd.karma, redditDefaultName: rd && rd.defaultName }, { cluster, echo });
    return { mismatch, flags, activity };
  }

  const { ensureOwners, recordNet, recordTrail, saveSnapshot, exportReport } = PBLogs;
  const clearNet = () => PBLogs.clearAll().then(refresh).catch((e) => console.error("[radar] could not clear history", e));

  function removePanel() { PBPanel.remove(); }

  // Text analysis is the costly part of a refresh; each post's text is read once.
  const memo = new Map();
  function analyse(r) {
    const key = (r.writtenIn ? "t:" : "o:") + r.text;
    let a = memo.get(key);
    if (!a) {
      a = { markers: PB.score(r.text).markers, machine: machineOf(r) };
      if (memo.size > 3000) memo.clear();
      memo.set(key, a);
    }
    return a;
  }
  // Only posts on or near the screen get their pills drawn; the rest are drawn as they scroll in.
  const near = (n) => { const b = n.getBoundingClientRect(); return b.bottom > -600 && b.top < window.innerHeight + 900; };

  // User settings (toolbar popup): badges on feeds, automatic About lookups.
  const SETTINGS_KEY = "pb.settings";
  let settings = { feeds: true, auto: true };
  chrome.storage.local.get(SETTINGS_KEY).then((g) => { settings = { ...settings, ...(g[SETTINGS_KEY] || {}) }; schedule(); }).catch(() => {});
  chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[SETTINGS_KEY]) { settings = { ...settings, ...(ch[SETTINGS_KEY].newValue || {}) }; schedule(); } });
  let lastSummary = null, lastExport = null;
  // The last computed pill models, so scrolling only draws rows coming into view (badge() skips
  // rows whose evidence has not changed) instead of rebuilding the whole thread.
  let drawn = [];
  function drawVisible() { for (const [node, model, anchor] of drawn) if (node.isConnected && near(node)) PBUI.badge(node, model, lookup, anchor); }

  // X's translation is X's wording, not the author's, so machine-writing signs are not read from
  // it (its dashes and stock phrasing would count against the author). Leaks and spam still are.
  function machineOf(r) {
    const m = PB.machineSigns(r.text);
    return r.writtenIn && !m.leak ? { ...m, signs: [], machineLike: false, translated: true } : m;
  }

  async function refresh() {
    const site = PBSites.current();
    // Feed mode (timelines, profiles, likes, search): badges on every post, no thread report and
    // nothing added to the connections log, because a feed is not a conversation.
    const feed = !!site && !site.onThread() && settings.feeds && !!(site.onFeed && site.onFeed());
    if (!site || (!site.onThread() && !feed)) { removePanel(); return; }
    const items = site.items().map((n) => site.read(n)).filter(Boolean);
    if (!items.length) return;
    const [root, replies] = !feed && site.hasLocation ? [items[0], items.slice(1)] : [null, items];
    await ensureOwners(items);
    const threadKey = site.id + ":" + location.pathname;
    if (!feed && replies.length) recordNet(threadKey, replies, root);
    const cache = site.hasLocation ? await PBStore.all() : {};
    if (site.id === "reddit" && globalThis.PBReddit && settings.auto) PBReddit.want([...new Set(items.map((r) => r.author))], schedule);
    const clusters = feed ? [] : PB.duplicateClusters(replies);
    const clusterOf = new Map();
    for (const c of clusters) for (const id of c.ids) clusterOf.set(id, c);
    const rows = [], models = [];
    for (const r of replies) {
      const reading = cache[r.author.toLowerCase()] || (site.id === "reddit" && globalThis.PBReddit ? PBReddit.get(r.author) : null);
      const { mismatch, flags, activity } = evidence(site, r, reading, clusterOf.get(r.id));
      const an = analyse(r);
      models.push([r.node, { site, handle: r.author, display: r.display, posted: r.posted, profile: site.profileOf ? site.profileOf(r.author) : r.profile, activity, tweet: tweets.get(r.id), trail: PB.trailFor(tweets.get(r.id), tweets, PBLogs.trail()), yt: ytAuthors.get(r.author.toLowerCase()), markers: an.markers, machine: an.machine, paid: r.paid, domains: r.domains, writtenIn: r.writtenIn, pageLabel: r.pageLabel, xSpam: r.xSpam, reading, flags, mismatch, lookingUp: lookingUp.has(r.author), failed: failed.has(r.author) }, r.anchor]);
      // Without account readings a reply's flags are complete for what the site offers.
      rows.push({ id: r.id, author: r.author, text: r.text, machine: an.machine.machineLike, about: !!(reading && (reading.aboutRead || reading.basedIn)), basedIn: reading && reading.basedIn, joinDate: reading && reading.joinDate, flags: reading || !site.hasLocation ? flags : null });
    }
    if (root) models.push([root.node, { site, handle: root.author, tweet: tweets.get(root.id), trail: PB.trailFor(tweets.get(root.id), tweets, PBLogs.trail()), reading: cache[root.author.toLowerCase()] || null, flags: [], lookingUp: lookingUp.has(root.author) }, root.anchor]);
    drawn = models;
    drawVisible();
    const pending = site.hasLocation ? [...new Set(rows.filter((r) => !r.about).map((r) => r.author))].filter((h) => !lookingUp.has(h) && !failed.has(h)) : [];
    // Automatic: every author without About data is asked about in the page, at a steady pace.
    if (site.hasLocation && pending.length && globalThis.PBAuto && settings.auto) PBAuto.want(pending, schedule);
    lastPending = pending;
    lastSummary = { site: site.name, feed, posts: items.length, lookedUp: rows.filter((r) => r.about).length, flagged: rows.filter((r) => r.flags && PB.isFlagged(r.flags)).length, pending: pending.length, scanning: scanLeft || (globalThis.PBAuto ? PBAuto.left() : 0), origins: PB.threadReport(rows).origins || [] };
    if (feed) { removePanel(); return; }
    const auto = globalThis.PBAuto ? PBAuto.left() : 0;
    const report = PB.threadReport(rows);
    report.bursts = PB.timingBursts(replies);
    report.state = PB.stateSummary(replies);
    report.upstream = PB.upstream(items, tweets, PBLogs.trail());
    const pushed = PB.pushedLinks(PBLogs.net(), items.flatMap((r) => r.domains || []));
    const video = site.id === "youtube" ? ytVideos.get(new URLSearchParams(location.search).get("v") || location.pathname.split("/shorts/")[1]) || null : null;
    report.groups = PB.returningGroups(PBLogs.net(), threadKey, replies.map((r) => r.author));
    saveSnapshot(threadKey, site.name, report);
    lastSummary = { ...lastSummary, sentence: report.sentence, signs: (report.bursts || []).length + clusters.length + (report.state || []).length, state: report.state };
    PBUI.panel(report, clusters, { pending: auto ? 0 : pending.length, scanning: scanLeft || auto, paused: globalThis.PBAuto && PBAuto.paused(), site, video, pushed, onClearHistory: clearNet, onExport: (lastExport = () => exportReport(site, report, clusters, rows, video, pushed)) }, () => lookup(...pending.slice(0, SCAN_MAX)));
  }

  function lookup(...handles) {
    const fresh = handles.filter((h) => !lookingUp.has(h) && !failed.has(h));
    if (!fresh.length) return;
    fresh.forEach((h) => lookingUp.add(h));
    chrome.runtime.sendMessage({ type: "pb-lookup", handles: fresh }).catch((e) => console.error("[radar] lookup request failed", e));
    schedule();
  }

  // Post metadata from X's responses, and YouTube's page data (src/ext/ytsniff.js), in memory only.
  const tweets = new Map(), ytAuthors = new Map();
  const ytVideos = new Map();   // videoId -> info; the page's first data goes stale after in-page navigation
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.source === "radar-sniff") {
      const batch = PB.tweetsIn(e.data.json);
      for (const t of batch) tweets.set(t.id, { ...(tweets.get(t.id) || {}), ...t });
      if (batch.length) recordTrail(batch);
    }
    if (e.data.source !== "radar-yt") return;
    const v = PB.ytVideoInfo(e.data.json);
    if (v && v.videoId) ytVideos.set(v.videoId, { ...(ytVideos.get(v.videoId) || {}), ...v });
    for (const [h, a] of PB.ytCommentAuthors(e.data.json)) ytAuthors.set(h, { ...(ytAuthors.get(h) || {}), ...a });
    schedule();
  });
  if (/(^|\.)youtube\.com$/.test(location.hostname)) window.postMessage({ source: "radar-yt-ask" }, location.origin);

  // Live data: accounts in the responses X's own app already downloaded (src/ext/sniff.js). Each
  // reading is merged into the local cache, so badges fill in as the page loads, with no request.
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "radar-sniff") return;
    const users = PB.usersIn(e.data.json);
    // An About response for a handle we asked about: record it even if X showed no location, so
    // the account is not asked again.
    if (e.data.about) users.push({ handle: e.data.about, aboutRead: true, ...(PB.aboutIn(e.data.json) || {}) });
    if (!users.length) return;
    Promise.all(users.map((u) => PBStore.put(u))).then(schedule).catch((err) => console.error("[radar] live data cache failed", err));
  });

  chrome.runtime.onMessage.addListener((msg) => {
    // One click: the toolbar button scans every account on screen and opens the report.
    if (msg && msg.type === "pb-scan") {
      const p = document.getElementById("pb-panel");
      if (p) p.dataset.collapsed = "0";
      refresh().then(() => lookup(...lastPending.slice(0, SCAN_MAX))).catch((e) => console.error("[radar] scan failed", e));
    }
    if (msg && msg.type === "pb-progress") { scanLeft = msg.left; schedule(); }
    if (msg && msg.type === "pb-panel") { PBPanel.setOpen(true); schedule(0); }
    if (msg && msg.type === "pb-export" && lastExport) lastExport();
    if (msg && msg.type === "pb-about-result") {
      lookingUp.delete(msg.handle);
      if (!msg.reading) { failed.add(msg.handle); console.warn("[radar] lookup gave no reading for", msg.handle, msg.error || ""); }
      schedule();
    }
  });

  // The toolbar popup asks for a summary of the current page.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "pb-summary") { sendResponse(lastSummary); return false; }
    return false;
  });

  function schedule(ms = 250) { clearTimeout(timer); timer = setTimeout(() => refresh().catch((e) => console.error("[radar] refresh failed", e)), ms); }
  let scrollFrame = 0;
  window.addEventListener("scroll", () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; drawVisible(); }); }, { passive: true });

  new MutationObserver((muts) => {
    if (location.pathname !== lastPath) { lastPath = location.pathname; PBUI.closePop(); PBAbout.check(); }
    if (muts.some((m) => [...m.addedNodes].some((n) => n.nodeType === 1 && !(n.closest && n.closest(".pb-bar, .pb-panel, .pb-pop"))))) schedule();
  }).observe(document.body, { childList: true, subtree: true });
  schedule();
})();
