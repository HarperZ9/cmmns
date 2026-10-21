// Radar's local logs and lookups, shared by the content script: the owner and state tables for
// what is on screen, the connections log, source trails, per-thread history snapshots, and the
// report export. Everything stays in chrome.storage.local on this machine.
(() => {
  "use strict";
  // Ask the background worker for the owners of the domains and accounts on screen, once each.
  const askedOwners = new Set(), ownerRows = [], stateRows = [];
  async function ensureOwners(items) {
    const domains = [...new Set(items.flatMap((r) => r.domains || []))].filter((d) => !askedOwners.has(d));
    const handles = items.map((r) => r.author).filter((h) => !askedOwners.has("@" + h));
    if (!domains.length && !handles.length) return;
    domains.forEach((d) => askedOwners.add(d)); handles.forEach((h) => askedOwners.add("@" + h));
    // Site cards for the same domains, so the window's Sources area can show the whole card.
    if (globalThis.PBLinkCard) await Promise.all(domains.map((d) => PBLinkCard.info(d))).catch((e) => console.error("[radar] site lookup failed", e));
    try {
      const [rows, srows] = await Promise.all([chrome.runtime.sendMessage({ type: "pb-owners", domains, handles }), chrome.runtime.sendMessage({ type: "pb-state", domains, handles })]);
      if (Array.isArray(rows) && rows.length) { ownerRows.push(...rows); PB.setOwnerRows(ownerRows); }
      if (Array.isArray(srows) && srows.length) { stateRows.push(...srows); PB.setStateRows(stateRows); }
    } catch (e) { console.error("[radar] owner lookup failed", e); }
  }

  // Fact-checked claims similar to each post on screen, asked once per post (src/core/claims.js).
  const askedClaims = new Set(), claimHits = new Map();
  async function ensureClaims(items) {
    const posts = items.filter((r) => r.id && r.text && !askedClaims.has(r.id)).map((r) => ({ id: r.id, text: r.text }));
    if (!posts.length) return;
    posts.forEach((p) => askedClaims.add(p.id));
    try {
      const got = await chrome.runtime.sendMessage({ type: "pb-claims", posts });
      for (const [id, hits] of Object.entries(got || {})) claimHits.set(id, hits);
    } catch (e) { console.error("[radar] claim lookup failed", e); }
  }
  const claimsOf = (id) => claimHits.get(id) || null;

  // Local connections log (src/core/network.js): which accounts replied where, and how fast.
  // v2: threads keyed by post id (src/core/threadkey.js); v1 keyed by path and could count one
  // thread twice, so its entries are left behind rather than mixed in.
  const NET_KEY = "pb.net.v2";
  let netLog = {}, lastRecorded = "";
  chrome.storage.local.get(NET_KEY).then((g) => { netLog = g[NET_KEY] || {}; }).catch(() => {});
  function recordNet(threadKey, replies, root) {
    const sig = threadKey + ":" + replies.length;
    if (sig === lastRecorded) return;
    lastRecorded = sig;
    netLog = PB.recordThread(netLog, threadKey, replies.map((r) => ({ author: r.author, posted: r.posted, text: r.text, domains: r.domains })), root && root.posted);
    chrome.storage.local.set({ [NET_KEY]: netLog }).catch((e) => console.error("[radar] could not save the connections log", e));
  }

  // Source trails (src/core/trail.js): which posts carried each upload and link, kept 30 days.
  const TRAIL_KEY = "pb.trail.v1";
  let trailLog = {}, trailSave = 0;
  chrome.storage.local.get(TRAIL_KEY).then((g) => { trailLog = g[TRAIL_KEY] || {}; }).catch(() => {});
  function recordTrail(batch) {
    trailLog = PB.recordSpread(trailLog, batch);
    clearTimeout(trailSave);
    trailSave = setTimeout(() => chrome.storage.local.set({ [TRAIL_KEY]: trailLog }).catch((e) => console.error("[radar] could not save trails", e)), 2000);
  }

  // One snapshot per thread for the history page (src/core/history.js), saved a moment after the
  // thread settles so a scrolling thread is written once, not on every refresh.
  const HISTORY_KEY = "pb.history.v1";
  let historySave = 0;
  function saveSnapshot(key, siteName, report) {
    clearTimeout(historySave);
    historySave = setTimeout(async () => {
      try {
        const log = (await chrome.storage.local.get(HISTORY_KEY))[HISTORY_KEY] || {};
        await chrome.storage.local.set({ [HISTORY_KEY]: PB.addSnapshot(log, PB.snapshot(key, siteName, report)) });
      } catch (e) { console.error("[radar] could not save the thread snapshot", e); }
    }, 3000);
  }

  // Feed posts for the "Your feed" page (src/core/feed.js), merged into what is stored so several
  // tabs add to one tally. Saved a moment after the feed settles.
  const FEED_KEY = "pb.feed.v1";
  let feedSave = 0, feedPending = [];
  function recordFeed(siteName, posts) {
    feedPending.push(...posts);
    clearTimeout(feedSave);
    feedSave = setTimeout(async () => {
      const batch = feedPending; feedPending = [];
      try {
        const log = (await chrome.storage.local.get(FEED_KEY))[FEED_KEY] || {};
        await chrome.storage.local.set({ [FEED_KEY]: PB.addFeedPosts(log, siteName, batch) });
      } catch (e) { console.error("[radar] could not save the feed tally", e); }
    }, 3000);
  }

  // Another tab, the options page or the background prune can change or clear these logs; keep
  // the in-memory copies current so an old copy is never written back.
  if (chrome.storage.onChanged) chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local") return;
    if (ch[NET_KEY]) { netLog = ch[NET_KEY].newValue || {}; if (!ch[NET_KEY].newValue) lastRecorded = ""; }
    if (ch[TRAIL_KEY]) trailLog = ch[TRAIL_KEY].newValue || {};
  });

  function clearAll() {
    trailLog = {}; netLog = {}; lastRecorded = "";
    if (globalThis.PBMeta) PBMeta.clear().catch((e) => console.error("[radar] could not clear account readings", e));
    feedPending = [];
    return chrome.storage.local.remove([HISTORY_KEY, TRAIL_KEY, NET_KEY, FEED_KEY]);
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

  // A thread card (src/core/evidence.js): built here from what is on screen, then shown on the card
  // page (card.html) to read before saving or sharing. Refused for threads with too few accounts.
  function saveCard({ site, report, items, replies, clusters, media }) {
    const claims = items.flatMap((r) => claimsOf(r.id) || []);
    const sites = (report.context ? report.context.links : []).map((l) => ({
      domain: l.domain, n: l.n, owner: PB.ownerOfDomain(l.domain) ? PB.ownerOfDomain(l.domain).owner : null,
      state: [...new Set(PB.stateLinksOfDomain(l.domain).map((h) => PB.stateLabel(h).chip))],
    }));
    const built = PB.evidenceCard({ tool: "Radar " + chrome.runtime.getManifest().version, savedAt: new Date().toISOString(), site: site.name, page: location.href, thread: true,
      authors: replies.map((r) => r.author), report, sameText: clusters.length, claims, sites, media });
    chrome.runtime.sendMessage({ type: "pb-card-open", built }).catch((e) => console.error("[radar] could not open the card page", e));
  }

  globalThis.PBLogs = Object.freeze({ ensureOwners, ensureClaims, claimsOf, recordNet, recordTrail, recordFeed, saveCard, saveSnapshot, exportReport, clearAll, net: () => netLog, trail: () => trailLog });
})();
