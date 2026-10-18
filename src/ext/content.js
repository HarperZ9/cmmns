// Reads the replies a site has rendered on a post's page, works out each reply's evidence, and
// draws the badges and the thread report. It reads only what is on screen. On X, account
// readings come from About pages the user visited or asked to look up; other sites show no
// account location, so their badges carry coordination signs only (src/ext/platforms.js).
(() => {
  "use strict";
  const LOOKUP_BATCH = 60;
  const lookingUp = new Set();
  const failed = new Set();   // looked up this session, nothing readable came back
  let timer = 0, lastPath = location.pathname;

  // Flags for one reply from what the site offers: the account reading (X only) and clusters.
  function evidence(site, r, reading, c) {
    const cluster = c ? { size: c.ids.length, authors: c.authors } : null;
    const mismatch = PB.compare(r.text, reading && reading.basedIn);
    if (reading) return { mismatch, flags: PB.flagsFor({ handle: r.author, joinDate: reading.joinDate, nameChanges: reading.nameChanges, basedIn: reading.basedIn }, { mismatch, cluster }) };
    const flags = cluster ? PB.flagsFor({ handle: site.hasLocation ? r.author : "" }, { cluster }) : [];
    return { mismatch, flags };
  }

  async function refresh() {
    const site = PBSites.current();
    if (!site || !site.onThread()) { const p = document.getElementById("pb-panel"); if (p) p.remove(); return; }
    const items = site.items().map((n) => site.read(n)).filter(Boolean);
    if (!items.length) return;
    const [root, replies] = site.hasLocation ? [items[0], items.slice(1)] : [null, items];
    const cache = site.hasLocation ? await PBStore.all() : {};
    const clusters = PB.duplicateClusters(replies);
    const clusterOf = new Map();
    for (const c of clusters) for (const id of c.ids) clusterOf.set(id, c);
    const rows = [];
    for (const r of replies) {
      const reading = cache[r.author.toLowerCase()] || null;
      const { mismatch, flags } = evidence(site, r, reading, clusterOf.get(r.id));
      PBUI.badge(r.node, { site, handle: r.author, display: r.display, posted: r.posted, profile: site.profileOf ? site.profileOf(r.author) : r.profile, reading, flags, mismatch, lookingUp: lookingUp.has(r.author), failed: failed.has(r.author) }, lookup, r.anchor);
      // Without account readings a reply's flags are complete for what the site offers.
      rows.push({ id: r.id, author: r.author, text: r.text, flags: reading || !site.hasLocation ? flags : null });
    }
    if (root) PBUI.badge(root.node, { site, handle: root.author, reading: cache[root.author.toLowerCase()] || null, flags: [], lookingUp: lookingUp.has(root.author) }, lookup, root.anchor);
    const pending = site.hasLocation ? [...new Set(rows.filter((r) => !r.flags).map((r) => r.author))].filter((h) => !lookingUp.has(h) && !failed.has(h)) : [];
    PBUI.panel(PB.threadReport(rows), clusters, { pending: pending.length, site }, () => lookup(...pending.slice(0, LOOKUP_BATCH)));
  }

  function lookup(...handles) {
    const fresh = handles.filter((h) => !lookingUp.has(h) && !failed.has(h));
    if (!fresh.length) return;
    fresh.forEach((h) => lookingUp.add(h));
    chrome.runtime.sendMessage({ type: "pb-lookup", handles: fresh }).catch((e) => console.error("[radar] lookup request failed", e));
    schedule();
  }

  chrome.runtime.onMessage.addListener((msg) => {
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
