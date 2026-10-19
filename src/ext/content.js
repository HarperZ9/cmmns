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
    const activity = PB.activity(netLog, r.author);
    const echo = PB.echoes(netLog, site.id + ":" + location.pathname, r.text);
    if (reading) return { mismatch, activity, flags: PB.flagsFor({ handle: r.author, display: reading.display || r.display, postsCount: reading.postsCount, followersCount: reading.followersCount, followingCount: reading.followingCount, joinDate: reading.joinDate, nameChanges: reading.nameChanges, basedIn: reading.basedIn, connectedVia: reading.connectedVia, proxyNote: reading.proxyNote, profileLocation: reading.profileLocation }, { mismatch, cluster, activity, echo }) };
    const flags = PB.flagsFor({ handle: site.hasLocation ? r.author : "", display: r.display }, { cluster, echo });
    return { mismatch, flags, activity };
  }

  // Ask the background worker for the owners of the domains and accounts on screen, once each.
  const askedOwners = new Set(), ownerRows = [];
  async function ensureOwners(items) {
    const domains = [...new Set(items.flatMap((r) => r.domains || []))].filter((d) => !askedOwners.has(d));
    const handles = items.map((r) => r.author).filter((h) => !askedOwners.has("@" + h));
    if (!domains.length && !handles.length) return;
    domains.forEach((d) => askedOwners.add(d)); handles.forEach((h) => askedOwners.add("@" + h));
    try {
      const rows = await chrome.runtime.sendMessage({ type: "pb-owners", domains, handles });
      if (Array.isArray(rows) && rows.length) { ownerRows.push(...rows); PB.setOwnerRows(ownerRows); }
    } catch (e) { console.error("[radar] owner lookup failed", e); }
  }

  // Local connections log (src/core/network.js): which accounts replied where, and how fast.
  const NET_KEY = "pb.net.v1";
  let netLog = {}, lastRecorded = "";
  chrome.storage.local.get(NET_KEY).then((g) => { netLog = g[NET_KEY] || {}; }).catch(() => {});
  function recordNet(threadKey, replies, root) {
    const sig = threadKey + ":" + replies.length;
    if (sig === lastRecorded) return;
    lastRecorded = sig;
    netLog = PB.recordThread(netLog, threadKey, replies.map((r) => ({ author: r.author, posted: r.posted, text: r.text, domains: r.domains })), root && root.posted);
    chrome.storage.local.set({ [NET_KEY]: netLog }).catch((e) => console.error("[radar] could not save the connections log", e));
  }

  function clearNet() {
    netLog = {}; lastRecorded = "";
    chrome.storage.local.remove(NET_KEY).then(refresh).catch((e) => console.error("[radar] could not clear the connections log", e));
  }

  // A local file the user can keep or share: the report, per-account labels and flags with what
  // each does not prove, and where the data came from. Reply text is left out.
  function exportReport(site, report, clusters, rows, video, pushed) {
    const out = {
      tool: "Radar " + chrome.runtime.getManifest().version, savedAt: new Date().toISOString(), page: location.href, site: site.name,
      report, video, pushedLinks: pushed,
      sameTextGroups: clusters.map((c) => ({ size: c.ids.length, authors: c.authors })),
      accounts: rows.map((r) => ({ handle: r.author, basedIn: r.basedIn || null, joinDate: r.joinDate || null, machineSigns: r.machine, flags: (r.flags || []).map((f) => ({ id: f.id, evidence: f.evidence, doesNotProve: f.doesNotProve })) })),
      doesNotProve: PB.REPORT_DOES_NOT_PROVE,
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
    a.download = `radar-${site.id}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function removePanel() { const p = document.getElementById("pb-panel"); if (p) p.remove(); }

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
    const feed = !!site && !site.onThread() && !!(site.onFeed && site.onFeed());
    if (!site || (!site.onThread() && !feed)) { removePanel(); return; }
    const items = site.items().map((n) => site.read(n)).filter(Boolean);
    if (!items.length) return;
    const [root, replies] = !feed && site.hasLocation ? [items[0], items.slice(1)] : [null, items];
    await ensureOwners(items);
    const threadKey = site.id + ":" + location.pathname;
    if (!feed && replies.length) recordNet(threadKey, replies, root);
    const cache = site.hasLocation ? await PBStore.all() : {};
    const clusters = feed ? [] : PB.duplicateClusters(replies);
    const clusterOf = new Map();
    for (const c of clusters) for (const id of c.ids) clusterOf.set(id, c);
    const rows = [];
    for (const r of replies) {
      const reading = cache[r.author.toLowerCase()] || null;
      const { mismatch, flags, activity } = evidence(site, r, reading, clusterOf.get(r.id));
      PBUI.badge(r.node, { site, handle: r.author, display: r.display, posted: r.posted, profile: site.profileOf ? site.profileOf(r.author) : r.profile, activity, tweet: tweets.get(r.id), yt: ytAuthors.get(r.author.toLowerCase()), markers: PB.score(r.text).markers, machine: machineOf(r), paid: r.paid, domains: r.domains, writtenIn: r.writtenIn, pageLabel: r.pageLabel, xSpam: r.xSpam, reading, flags, mismatch, lookingUp: lookingUp.has(r.author), failed: failed.has(r.author) }, lookup, r.anchor);
      // Without account readings a reply's flags are complete for what the site offers.
      rows.push({ id: r.id, author: r.author, text: r.text, machine: machineOf(r).machineLike, about: !!(reading && (reading.aboutRead || reading.basedIn)), basedIn: reading && reading.basedIn, joinDate: reading && reading.joinDate, flags: reading || !site.hasLocation ? flags : null });
    }
    if (root) PBUI.badge(root.node, { site, handle: root.author, tweet: tweets.get(root.id), reading: cache[root.author.toLowerCase()] || null, flags: [], lookingUp: lookingUp.has(root.author) }, lookup, root.anchor);
    const pending = site.hasLocation ? [...new Set(rows.filter((r) => !r.about).map((r) => r.author))].filter((h) => !lookingUp.has(h) && !failed.has(h)) : [];
    // Automatic: every author without About data is asked about in the page, at a steady pace.
    if (site.hasLocation && pending.length && globalThis.PBAuto) PBAuto.want(pending, schedule);
    lastPending = pending;
    if (feed) { removePanel(); return; }
    const auto = globalThis.PBAuto ? PBAuto.left() : 0;
    const report = PB.threadReport(rows);
    report.bursts = PB.timingBursts(replies);
    const pushed = PB.pushedLinks(netLog, items.flatMap((r) => r.domains || []));
    const video = site.id === "youtube" ? ytVideos.get(new URLSearchParams(location.search).get("v") || location.pathname.split("/shorts/")[1]) || null : null;
    report.groups = PB.returningGroups(netLog, threadKey, replies.map((r) => r.author));
    PBUI.panel(report, clusters, { pending: auto ? 0 : pending.length, scanning: scanLeft || auto, paused: globalThis.PBAuto && PBAuto.paused(), site, video, pushed, onClearHistory: clearNet, onExport: () => exportReport(site, report, clusters, rows, video, pushed) }, () => lookup(...pending.slice(0, SCAN_MAX)));
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
    if (e.data.source === "radar-sniff") for (const t of PB.tweetsIn(e.data.json)) tweets.set(t.id, { ...(tweets.get(t.id) || {}), ...t });
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
    if (msg && msg.type === "pb-about-result") {
      lookingUp.delete(msg.handle);
      if (!msg.reading) { failed.add(msg.handle); console.warn("[radar] lookup gave no reading for", msg.handle, msg.error || ""); }
      schedule();
    }
  });

  function schedule() { clearTimeout(timer); timer = setTimeout(() => refresh().catch((e) => console.error("[radar] refresh failed", e)), 400); }

  new MutationObserver((muts) => {
    if (location.pathname !== lastPath) { lastPath = location.pathname; PBUI.closePop(); PBAbout.check(); }
    if (muts.some((m) => [...m.addedNodes].some((n) => n.nodeType === 1 && !(n.closest && n.closest(".pb-bar, .pb-panel, .pb-pop"))))) schedule();
  }).observe(document.body, { childList: true, subtree: true });
  schedule();
})();
