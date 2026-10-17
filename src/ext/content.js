// Reads the replies X has rendered on a post's page, works out each reply's evidence from the
// cached account readings, and draws the badges and the thread report. It reads only what is
// on screen; account readings come from About pages the user visited or asked to look up.
(() => {
  "use strict";
  const SEL = {
    tweet: 'article[data-testid="tweet"]',
    name: '[data-testid="User-Name"]',
    text: '[data-testid="tweetText"]',
  };
  const LOOKUP_BATCH = 60;
  const lookingUp = new Set();
  const failed = new Set();   // looked up this session, nothing readable came back
  let timer = 0, lastPath = location.pathname;

  // The fixture harness (tests/fixtures/thread.html) marks itself as a post page.
  const onStatusPage = () => /^\/[A-Za-z0-9_]{1,15}\/status\/\d+/.test(location.pathname) || document.documentElement.dataset.pbFixture === "status";

  // One rendered tweet -> { id, author, text, node } or null when it is not a readable post.
  function readTweet(node) {
    const nameBox = node.querySelector(SEL.name);
    const link = nameBox && [...nameBox.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute("href")).find((h) => /^\/[A-Za-z0-9_]{1,15}$/.test(h));
    const time = node.querySelector('a[href*="/status/"] time');
    const idm = time && time.parentElement.getAttribute("href").match(/\/status\/(\d+)/);
    if (!link || !idm) return null;
    const t = node.querySelector(SEL.text);
    return { id: idm[1], author: link.slice(1), text: t ? t.innerText : "", node };
  }

  async function refresh() {
    if (!onStatusPage()) { const p = document.getElementById("pb-panel"); if (p) p.remove(); return; }
    const tweets = [...document.querySelectorAll(SEL.tweet)].map(readTweet).filter(Boolean);
    if (!tweets.length) return;
    const [root, ...replies] = tweets;
    const cache = await PBStore.all();
    const clusters = PB.duplicateClusters(replies);
    const clusterOf = new Map();
    for (const c of clusters) for (const id of c.ids) clusterOf.set(id, c);
    const rows = [];
    for (const r of replies) {
      const reading = cache[r.author.toLowerCase()] || null;
      const mismatch = PB.compare(r.text, reading && reading.basedIn);
      const c = clusterOf.get(r.id);
      const flags = reading
        ? PB.flagsFor({ handle: r.author, joinDate: reading.joinDate, nameChanges: reading.nameChanges, basedIn: reading.basedIn }, { mismatch, cluster: c ? { size: c.ids.length, authors: c.authors } : null })
        : (c ? PB.flagsFor({ handle: r.author }, { cluster: { size: c.ids.length, authors: c.authors } }) : []);
      PBUI.badge(r.node, { handle: r.author, reading, flags, mismatch, lookingUp: lookingUp.has(r.author), failed: failed.has(r.author) }, lookup);
      rows.push({ id: r.id, author: r.author, text: r.text, flags: reading ? flags : null });
    }
    if (root) PBUI.badge(root.node, { handle: root.author, reading: cache[root.author.toLowerCase()] || null, flags: [], lookingUp: lookingUp.has(root.author) }, lookup);
    const pending = [...new Set(rows.filter((r) => !r.flags).map((r) => r.author))].filter((h) => !lookingUp.has(h) && !failed.has(h));
    PBUI.panel(PB.threadReport(rows), clusters, { pending: pending.length }, () => lookup(...pending.slice(0, LOOKUP_BATCH)));
  }

  function lookup(...handles) {
    const fresh = handles.filter((h) => !lookingUp.has(h) && !failed.has(h));
    if (!fresh.length) return;
    fresh.forEach((h) => lookingUp.add(h));
    chrome.runtime.sendMessage({ type: "pb-lookup", handles: fresh }).catch((e) => console.error("[provenance-badges] lookup request failed", e));
    schedule();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "pb-about-result") {
      lookingUp.delete(msg.handle);
      if (!msg.reading) { failed.add(msg.handle); console.warn("[provenance-badges] lookup gave no reading for", msg.handle, msg.error || ""); }
      schedule();
    }
  });

  function schedule() { clearTimeout(timer); timer = setTimeout(() => refresh().catch((e) => console.error("[provenance-badges] refresh failed", e)), 400); }

  new MutationObserver((muts) => {
    if (location.pathname !== lastPath) { lastPath = location.pathname; PBUI.closePop(); PBAbout.check(); }
    if (muts.some((m) => [...m.addedNodes].some((n) => n.nodeType === 1 && !(n.closest && n.closest(".pb-bar, .pb-panel, .pb-pop"))))) schedule();
  }).observe(document.body, { childList: true, subtree: true });
  schedule();
})();
