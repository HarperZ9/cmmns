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
    const echo = PB.echoes(PBLogs.net(), PB.threadKey(site.id, location.pathname, location.search), r.text);
    if (reading && site.hasLocation) return { mismatch, activity, flags: PB.flagsFor({ handle: r.author, display: reading.display || r.display, postsCount: reading.postsCount, followersCount: reading.followersCount, followingCount: reading.followingCount, joinDate: reading.joinDate, nameChanges: reading.nameChanges, basedIn: reading.basedIn, connectedVia: reading.connectedVia, proxyNote: reading.proxyNote, profileLocation: reading.profileLocation, pattern: reading.pattern, brandCheck: !!site.hasLocation, verifiedType: reading.verifiedType, affiliate: reading.affiliate || reading.affiliateOf, xLabel: reading.xLabel || r.pageLabel }, { mismatch, cluster, activity, echo }) };
    // Other sites: what each one discloses (src/ext/platforms.js reading()): Reddit's account age,
    // karma and sign-up name; Instagram's and Facebook's join date, label and renames; Bluesky's
    // join date and moderation labels.
    const rd = reading || {};
    const flags = PB.flagsFor({ handle: site.hasLocation ? r.author : "", display: r.display, joinDate: rd.joinDate, karma: rd.karma, redditDefaultName: rd.defaultName, nameChanges: rd.nameChanges, basedIn: rd.basedIn, platformLabels: rd.platformLabels, labelSource: rd.labelSource }, { mismatch, cluster, echo });
    return { mismatch, flags, activity };
  }

  const { ensureOwners, recordNet, recordTrail, saveSnapshot, exportReport } = PBLogs;
  const clearNet = () => PBLogs.clearAll().then(refresh).catch((e) => console.error("[daylight-commons] could not clear history", e));

  function removePanel() { PBPanel.remove(); }

  // Text analysis is the costly part of a refresh; each post's text is read once.
  const memo = new Map();
  function analyse(r) {
    const key = (r.writtenIn ? "t:" : "o:") + r.text;
    let a = memo.get(key);
    if (!a) {
      const sc = PB.score(r.text);
      a = { markers: sc.markers, extreme: sc.extreme, persuasion: PB.persuasion(r.text), machine: machineOf(r) };
      if (memo.size > 3000) memo.clear();
      memo.set(key, a);
    }
    return a;
  }
  // Only posts on or near the screen are wired; the rest are wired as they scroll in.
  const near = (n) => { const b = n.getBoundingClientRect(); return b.bottom > -600 && b.top < window.innerHeight + 900; };

  // User settings (popup and options page, src/ext/settings.js): sites, feeds, automatic lookups.
  let settings = PBSettings.get();
  PBSettings.onChange((s) => { settings = s; schedule(); });
  PBSettings.ready.then(() => schedule());
  const enabled = () => { const site = PBSites.current(); return !!site && PB.siteOn(settings, site.id); };
  const feedMode = (site) => !!site && !site.onThread() && settings.feeds && !!(site.onFeed && site.onFeed());
  // The toolbar icon follows this tab: paused, reading accounts, or idle. Sent only on change.
  let iconSent = "";
  function icon(state) {
    if (state === iconSent) return;
    iconSent = state;
    chrome.runtime.sendMessage({ type: "pb-icon", state }).catch(() => {});
  }
  let lastSummary = null, lastExport = null;
  // The last computed models, so scrolling only wires posts coming into view (badge() is cheap
  // and skips unchanged posts) instead of rebuilding the whole thread.
  let drawn = [];
  function drawVisible() { for (const [node, model, anchor] of drawn) if (node.isConnected && near(node)) PBUI.badge(node, model, lookup, anchor); }

  // X's translation is X's wording, not the author's, so machine-writing signs are not read from
  // it (its dashes and stock phrasing would count against the author). Leaks and spam still are.
  function machineOf(r) {
    const m = PB.machineSigns(r.text);
    return r.writtenIn && !m.leak ? { ...m, signs: [], machineLike: false, translated: true } : m;
  }

  // The technique signs (project-docs/TECHNIQUES.md): one link, upload or reviewed claim across
  // languages, the account rates the flooding sign reads, and each post's laundering chain.
  function techniques(site, replies, root, cache) {
    const row = (r) => { const T = tweets.get(r.id) || {}; return { id: r.id, author: r.author, lang: T.lang || null, text: r.text, links: T.links || [], media: T.media || [], claims: PBLogs.claimsOf(r.id) || [] }; };
    const groups = PB.crossLanguage(replies.map(row), { root: root && row(root) });
    const rateOf = (h) => { const rd = cache[h] || (site.reading ? site.reading(h) : null); return rd ? PB.ratePerDay(rd) : null; };
    const perPost = (m) => {
      const T = m.tweet, mine = groups.filter((g) => g.ids.includes(m.postId));
      return { crossLang: T ? [...mine, ...PB.acrossViewed(T, PBLogs.trail()).filter((x) => !mine.some((g) => g.key === x.key))] : mine,
        chain: T ? PB.launderingChain(T, tweets, PBLogs.trail()) : null };
    };
    return { groups, rateOf, perPost };
  }

  async function refresh() {
    const site = PBSites.current();
    // Feed mode (timelines, profiles, likes, search): badges on every post, no thread report and
    // nothing added to the connections log, because a feed is not a conversation.
    const feed = feedMode(site);
    if (site && !PB.siteOn(settings, site.id)) { removePanel(); PBUI.closePop(); icon("paused"); PBHealth.observe(null); return; }
    if (!site || (!site.onThread() && !feed)) { removePanel(); PBHealth.observe(null); return; }
    // Adapter health (src/ext/health.js): a reader that finds nothing where it should says so.
    const nodes = site.items(), items = nodes.map((n) => site.read(n)).filter(Boolean);
    PBHealth.observe(site, feed, nodes.length, items, () => schedule(0));
    if (!items.length) { videoOnly(site, feed); return; }
    const [root, replies] = !feed && (site.hasLocation || site.rootFirst) ? [items[0], items.slice(1)] : [null, items];
    await Promise.all([ensureOwners(items), PBLogs.ensureClaims(items)]);
    const threadKey = PB.threadKey(site.id, location.pathname, location.search);
    if (!feed && replies.length) recordNet(threadKey, replies, root);
    const cache = site.hasLocation ? await PBStore.all() : {};
    if (site.want && settings.auto) site.want([...new Set(items.map((r) => r.author))], schedule);
    const clusters = feed ? [] : PB.duplicateClusters(replies, { root });
    const clusterOf = new Map();
    for (const c of clusters) for (const id of c.ids) clusterOf.set(id, c);
    const rows = [], models = [], readings = [];
    for (const r of replies) {
      const reading = cache[r.author.toLowerCase()] || (site.reading ? site.reading(r.author) : null);
      const { mismatch, flags, activity } = evidence(site, r, reading, clusterOf.get(r.id));
      const an = analyse(r);
      models.push([r.node, { site, node: r.node, tweets, postId: r.id, threadKey, text: r.text, handle: r.author, display: r.display, posted: r.posted, profile: site.profileOf ? site.profileOf(r.author) : r.profile, activity, tweet: tweets.get(r.id), trail: PB.trailFor(tweets.get(r.id), tweets, PBLogs.trail()), yt: ytAuthors.get(r.author.toLowerCase()), markers: an.markers, persuasion: an.persuasion, machine: an.machine, paid: r.paid, domains: r.domains, writtenIn: r.writtenIn, pageLabel: r.pageLabel, xSpam: r.xSpam, claims: PBLogs.claimsOf(r.id), reading, flags, mismatch, lookingUp: lookingUp.has(r.author), failed: failed.has(r.author) }, r.anchor]);
      // Without account readings a reply's flags are complete for what the site offers.
      if (reading) readings.push(reading);
      rows.push({ id: r.id, author: r.author, text: r.text, extreme: an.extreme, techniques: an.persuasion.map((h) => h.technique), machine: an.machine.machineLike, about: !!(reading && (reading.aboutRead || reading.basedIn)), basedIn: reading && reading.basedIn, joinDate: reading && reading.joinDate, flags: reading || !site.hasLocation ? flags : null });
    }
    if (root) models.push([root.node, { site, node: root.node, tweets, postId: root.id, threadKey, text: root.text, handle: root.author, tweet: tweets.get(root.id), trail: PB.trailFor(tweets.get(root.id), tweets, PBLogs.trail()), claims: PBLogs.claimsOf(root.id), reading: cache[root.author.toLowerCase()] || (site.reading ? site.reading(root.author) : null), flags: [], lookingUp: lookingUp.has(root.author) }, root.anchor]);
    PBLogs.ensureProfiles(readings).catch((e) => console.error("[daylight-commons] profile lookup failed", e));
    // Thread context for the window's comparison: median account age, labels and flags among the
    // accounts read here.
    const read = rows.filter((r) => r.about || r.joinDate);
    const ages = read.map((r) => r.joinDate && PB.ageDays(r.joinDate)).filter((x) => x != null).sort((a, b) => a - b);
    const places = {};
    for (const r of read) if (r.basedIn) places[r.basedIn] = (places[r.basedIn] || 0) + 1;
    const viewed = Object.keys((PBLogs.net() || {}).threads || {}).length;
    const thread = { feed: !!feed, replies: replies.length, viewed, n: read.length, medianAgeDays: ages.length ? ages[Math.floor(ages.length / 2)] : null, places, flagged: read.filter((r) => r.flags && PB.isFlagged(r.flags)).length };
    for (const [, model] of models) model.thread = thread;
    const tech = techniques(site, replies, root, cache);
    for (const [, model] of models) Object.assign(model, tech.perPost(model));
    drawn = models;
    drawVisible();
    const pending = site.hasLocation ? [...new Set(rows.filter((r) => !r.about).map((r) => r.author))].filter((h) => !lookingUp.has(h) && !failed.has(h)) : [];
    // Automatic: every author without About data is asked about in the page, at a steady pace.
    if (site.hasLocation && pending.length && globalThis.PBAuto && settings.auto) PBAuto.want(pending, schedule);
    lastPending = pending;
    icon(PB.iconState({ reading: scanLeft || (globalThis.PBAuto ? PBAuto.left() : 0) }));
    lastSummary = { site: site.name, feed, posts: items.length, lookedUp: rows.filter((r) => r.about).length, flagged: rows.filter((r) => r.flags && PB.isFlagged(r.flags)).length, pending: pending.length, scanning: scanLeft || (globalThis.PBAuto ? PBAuto.left() : 0), origins: PB.threadReport(rows).origins || [] };
    if (feed) { removePanel(); recordFeed(site, items); return; }
    const auto = globalThis.PBAuto ? PBAuto.left() : 0;
    const report = PB.threadReport(rows);
    // Reply times come from the page's datetime attributes, which give seconds (src/core/precision.js).
    report.bursts = PB.timingBursts(replies, { precision: "second" });
    report.flood = PB.floodSign(replies, tech.rateOf, { bursts: report.bursts });
    report.crossLang = tech.groups;
    report.swarm = root ? PB.swarmSign(replies, swarmMarks(rows), { precision: "second" }) : null;
    report.state = PB.stateSummary(replies);
    report.upstream = PB.upstream(items, tweets, PBLogs.trail());
    const pushed = PB.pushedLinks(PBLogs.net(), items.flatMap((r) => r.domains || []));
    const video = currentVideo(site);
    if (video && video.channelId) PBLogs.ensureChannel(video.channelId);
    report.groups = PB.returningGroups(PBLogs.net(), threadKey, replies.map((r) => r.author));
    report.context = PB.threadContext(items, { noteOf, claimsOf: PBLogs.claimsOf });
    report.campaign = globalThis.PBCampaign ? PBCampaign.lens(site, items, tweets, cache) : null;
    if (root && report.campaign) for (const [, model] of models) if (model.postId === report.campaign.launchId) model.campaign = report.campaign;
    saveSnapshot(threadKey, site.name, report);
    lastSummary = { ...lastSummary, sentence: report.sentence, signs: (report.bursts || []).length + clusters.length + (report.state || []).length, state: report.state };
    PBUI.panel(report, clusters, { pending: auto ? 0 : pending.length, scanning: scanLeft || auto, paused: globalThis.PBAuto && PBAuto.paused(), site, video, pushed, viewed, onClearHistory: clearNet, onExport: (lastExport = () => exportReport(site, report, clusters, rows, video, pushed)), onCard: () => PBLogs.saveCard({ site, report, items, replies, rows, root, clusters, media: globalThis.PBMedia ? items.flatMap((r) => PBMedia.resultsFor(r.node, tweets.get(r.id))) : null }) }, () => lookup(...pending.slice(0, SCAN_MAX)));
  }

  // The swarming sign's marks (src/core/swarming.js): an account is new when it joined under
  // NEW_ACCOUNT_DAYS before its reply, flagged when Daylight Commons flagged it. Unread accounts are unknown.
  function swarmMarks(rows) {
    const by = new Map(rows.filter((r) => r.joinDate || r.flags).map((r) => [String(r.author).toLowerCase(), r]));
    return (h, at) => {
      const r = by.get(h);
      if (!r) return null;
      const age = r.joinDate ? PB.ageDays(r.joinDate, at) : null;
      return { new: age != null && age < PB.NEW_ACCOUNT_DAYS, flagged: !!(r.flags && PB.isFlagged(r.flags)) };
    };
  }

  // Feed dashboard (src/core/feed.js): each feed post once per day, with what it linked and the
  // signs Daylight Commons read in it. Post ids and counts only; no text is kept.
  const noteOf = (id) => (tweets.get(id) || {}).note || null;
  function recordFeed(site, items) {
    PBLogs.recordFeed(site.name, items.map((r) => {
      const an = analyse(r), c = PBLogs.claimsOf(r.id);
      return { id: r.id, domains: r.domains || [], strong: an.extreme, note: !!noteOf(r.id), claims: c ? c.length : 0, techniques: an.persuasion.map((h) => h.technique), frame: PB.feedFrame(r.text) };
    }));
  }

  function currentVideo(site) {
    if (site.id !== "youtube") return null;
    return ytVideos.get(new URLSearchParams(location.search).get("v") || location.pathname.split("/shorts/")[1]) || null;
  }

  // A video with no comments (or comments turned off) still has its own context: the channel,
  // YouTube's funding and paid-promotion labels. Live check 2026-10-21: a state-funded
  // broadcaster's videos with comments off showed no Daylight Commons panel at all.
  function videoOnly(site, feed) {
    // A repost list shows accounts, not posts: the launch campaign lens still reads it.
    if (!feed && globalThis.PBCampaign && PBCampaign.onList()) {
      PBStore.all().then((cache) => { const r = PB.threadReport([]); r.campaign = PBCampaign.lens(site, [], tweets, cache); PBUI.panel(r, [], { pending: 0, scanning: 0, paused: false, site, pushed: [] }, () => {}); }).catch((e) => console.error("[daylight-commons] campaign lens failed", e));
      return;
    }
    const video = feed ? null : currentVideo(site);
    if (!video) { removePanel(); return; }
    PBUI.panel(PB.threadReport([]), [], { pending: 0, scanning: 0, paused: false, site, video, pushed: [] }, () => {});
  }

  function lookup(...handles) {
    const fresh = handles.filter((h) => !lookingUp.has(h) && !failed.has(h));
    if (!fresh.length) return;
    fresh.forEach((h) => lookingUp.add(h));
    chrome.runtime.sendMessage({ type: "pb-lookup", handles: fresh }).catch((e) => console.error("[daylight-commons] lookup request failed", e));
    schedule();
  }

  // Posting patterns (src/core/pattern.js): posts X loaded, collected per author across responses;
  // once an author has enough, the pattern is saved with that account's reading.
  const authorPosts = new Map();
  function recordPatterns(batch) {
    for (const [k, posts] of PB.byAuthor(batch)) {
      const all = new Map((authorPosts.get(k) || []).map((p) => [p.id, p]));
      for (const p of posts) all.set(p.id, p);
      const list = [...all.values()].slice(-200);
      authorPosts.set(k, list);
      // X's created_at gives seconds; a scheduler posting on the hour must not read as rounded times.
      const pattern = PB.postingPattern(list, { precision: "second" });
      if (pattern) PBStore.put({ handle: posts[0].author, pattern }).catch((e) => console.error("[daylight-commons] could not save a posting pattern", e));
    }
  }

  // Post metadata from X's responses, and YouTube's page data (src/ext/ytsniff.js), in memory only.
  const tweets = new Map(), ytAuthors = new Map();
  const ytVideos = new Map();   // videoId -> info; the page's first data goes stale after in-page navigation
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data) return;
    if (!enabled()) return;
    if (e.data.source === "radar-sniff") {
      const batch = PB.tweetsIn(e.data.json);
      for (const t of batch) tweets.set(t.id, { ...(tweets.get(t.id) || {}), ...t });
      if (batch.length) { recordTrail(batch); recordPatterns(batch); }
    }
    if (e.data.source !== "radar-yt") return;
    const v = PB.ytVideoInfo(e.data.json);
    if (v && v.videoId) ytVideos.set(v.videoId, { ...(ytVideos.get(v.videoId) || {}), ...v });
    for (const [h, a] of PB.ytCommentAuthors(e.data.json)) ytAuthors.set(h, { ...(ytAuthors.get(h) || {}), ...a });
    schedule();
  });
  if (/(^|\.)youtube\.com$/.test(location.hostname)) window.postMessage({ source: "radar-yt-ask" }, location.origin);
  if (globalThis.PBMeta) PBMeta.onChange(() => schedule());

  // Live data: accounts in the responses X's own app already downloaded (src/ext/sniff.js). Each
  // reading is merged into the local cache, so badges fill in as the page loads, with no request.
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "radar-sniff" || !enabled()) return;
    const users = PB.usersIn(e.data.json);
    // An About response for a handle we asked about: record it even if X showed no location, so
    // the account is not asked again.
    if (e.data.about) users.push({ handle: e.data.about, aboutRead: true, ...(PB.aboutIn(e.data.json) || {}) });
    if (!users.length) return;
    Promise.all(users.map((u) => PBStore.put(u))).then(schedule).catch((err) => console.error("[daylight-commons] live data cache failed", err));
  });

  chrome.runtime.onMessage.addListener((msg) => {
    // One click: the toolbar button scans every account on screen and opens the report.
    if (msg && msg.type === "pb-scan") {
      const p = document.getElementById("pb-panel");
      if (p) p.dataset.collapsed = "0";
      refresh().then(() => lookup(...lastPending.slice(0, SCAN_MAX))).catch((e) => console.error("[daylight-commons] scan failed", e));
    }
    if (msg && msg.type === "pb-progress") { scanLeft = msg.left; schedule(); }
    if (msg && msg.type === "pb-panel") { PBPanel.setOpen(true); schedule(0); }
    if (msg && msg.type === "pb-export" && lastExport) lastExport();
    if (msg && msg.type === "pb-about-result") {
      lookingUp.delete(msg.handle);
      if (!msg.reading) { failed.add(msg.handle); console.warn("[daylight-commons] lookup gave no reading for", msg.handle, msg.error || ""); }
      schedule();
    }
  });

  // The toolbar popup asks for a summary of the current page.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "pb-summary") { sendResponse(lastSummary); return false; }
    if (msg && msg.type === "pb-selftest") { const site = PBSites.current(); sendResponse(site ? PBHealth.selfTest(site, feedMode(site)) : null); return false; }
    return false;
  });

  function schedule(ms = 250) { clearTimeout(timer); timer = setTimeout(() => refresh().catch((e) => console.error("[daylight-commons] refresh failed", e)), ms); }
  let scrollFrame = 0;
  window.addEventListener("scroll", () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; drawVisible(); }); }, { passive: true });

  new MutationObserver((muts) => {
    if (location.pathname !== lastPath) { lastPath = location.pathname; PBUI.closePop(); PBAbout.check(); }
    if (muts.some((m) => [...m.addedNodes].some((n) => n.nodeType === 1 && !(n.closest && n.closest(".pb-bar, .pb-panel, .pb-pop"))))) schedule();
  }).observe(document.body, { childList: true, subtree: true });
  schedule();
})();
