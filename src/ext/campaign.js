// The launch campaign lens in the page (project-docs/CAMPAIGN-LENS.md). X only. It gathers the
// accounts and quotes the page itself loaded for one launch post: the repost list when the viewer
// opens it (X's own Retweeters response, passed by src/ext/sniff.js), the quote list, and the
// replies. Daylight Commons never pages through a list on its own and makes no request for this.
// Cross-launch overlap is kept in chrome.storage.local only, as salted hashes (src/core/campaign-overlap.js).
(() => {
  "use strict";
  const LIST_PATH = /^\/[A-Za-z0-9_]{1,15}\/status\/(\d+)(?:\/(retweets|reposts|quotes|likes))?/;
  const reposters = new Map();   // launch id -> Map(handle -> account)
  const paidIds = new Set();     // post ids X shows with a Paid partnership label
  let store = null, loading = null, ledger = null, ledgerDirty = false;
  chrome.storage.local.get(PB.LEDGER_KEY).then((r) => { ledger = PB.pruneLedger((r && r[PB.LEDGER_KEY]) || {}); }).catch((e) => { console.error("[daylight-commons] could not read the count ledger", e); ledger = {}; });
  setInterval(() => { if (ledger && ledgerDirty) { ledgerDirty = false; chrome.storage.local.set({ [PB.LEDGER_KEY]: ledger }).catch((e) => console.error("[daylight-commons] could not save the count ledger", e)); } }, 30000);
  const saved = new Map();       // launch id -> sample size last saved, so a refresh does not rewrite storage

  const launchId = () => { const m = location.pathname.match(LIST_PATH); return m ? m[1] : null; };
  const listKind = () => { const m = location.pathname.match(LIST_PATH); return m ? m[2] || null : null; };

  // Accounts in X's own responses while the viewer is on a repost list are that list's accounts.
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "radar-sniff") return;
    const id = launchId(), kind = listKind();
    if (!id || (kind !== "retweets" && kind !== "reposts")) return;
    const m = reposters.get(id) || new Map();
    for (const u of PB.usersIn(e.data.json)) m.set(u.handle.toLowerCase(), { handle: u.handle, bio: u.bio, joinDate: u.joinDate, defaultAvatar: u.defaultAvatar });
    reposters.set(id, m);
  });

  function loadStore() {
    if (store || loading) return loading;
    loading = chrome.storage.local.get(PB.OVERLAP_KEY).then((r) => {
      const s = r && r[PB.OVERLAP_KEY];
      store = s && s.salt ? PB.pruneLaunches(s) : PB.emptyStore(Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join(""));
    }).catch((e) => { console.error("[daylight-commons] could not read the launch store", e); store = PB.emptyStore("unsaved-" + Math.random()); });
    return loading;
  }
  loadStore();

  const saveStore = () => chrome.storage.local.set({ [PB.OVERLAP_KEY]: store }).catch((e) => console.error("[daylight-commons] could not save the launch store", e));
  function forget() {
    store = null; loading = null; saved.clear();
    return chrome.storage.local.remove(PB.OVERLAP_KEY).then(loadStore).catch((e) => console.error("[daylight-commons] could not clear the launch store", e));
  }

  const counts = (t) => ({ reposts: t.reposts, likes: t.likes, replies: t.replies, quotes: t.quotes, bookmarks: t.bookmarks, views: t.views });

  // site: the X adapter; items: posts read on the page; tweets: Map id -> X post data; cache: readings.
  function lens(site, items, tweets, cache) {
    if (!site || site.id !== "x") return null;
    const id = launchId();
    if (!id) return null;
    for (const r of items) if (r.paidPartnership) paidIds.add(r.id);
    const T = tweets.get(id);
    const author = T && T.author ? T.author.toLowerCase() : null;
    const reading = author ? cache[author] || null : null;
    const reading_ = (h) => cache[String(h).toLowerCase()] || {};
    const accounts = new Map(reposters.get(id) || []);
    const quotes = [];
    for (const t of tweets.values()) {
      if (!t.author || t.author.toLowerCase() === author) continue;
      // The page's own label and the response's mark are both X's claim; either one counts as X saying so.
      if (t.quotedId === id) quotes.push({ id: t.id, author: t.author, text: (items.find((r) => r.id === t.id) || {}).text || t.text || "", posted: t.posted, paidPartnership: paidIds.has(t.id) || t.paidPartnership === true });
      if (t.quotedId === id || t.replyTo === id) { const rd = reading_(t.author); accounts.set(t.author.toLowerCase(), { handle: t.author, bio: rd.bio, joinDate: rd.joinDate, defaultAvatar: rd.defaultAvatar }); }
    }
    const ownPosts = author ? [...tweets.values()].filter((t) => t.id !== id && t.author && t.author.toLowerCase() === author && !t.repostOf).map(counts) : [];
    const handles = [...accounts.values()].map((a) => a.handle);
    let overlap = null;
    if (store) {
      overlap = PB.overlapOf(store, id, handles);
      if (handles.length >= PB.SAMPLE_MIN && saved.get(id) !== handles.length) { store = PB.recordLaunch(store, id, handles); saved.set(id, handles.length); saveStore(); }
    }
    const post = T ? { ...counts(T), followers: reading && reading.followersCount, text: (items.find((r) => r.id === id) || {}).text || "" } : null;
    return { ...PB.campaignLens({ platform: "x", timePrecision: "second", post, ownPosts, accounts: [...accounts.values()], quotes, overlap, actor: PB.actorOf(reading) }), platform: "x", actor: PB.actorOf(reading), launchId: id, onForget: forget, evidence: evidenceOf(id, T, post, items, reading) };
  }

  // The evidence block's inputs (src/ext/evidence-view.js): the local count ledger for this post, and
  // what a lookup would ask about. Only the post's own links and domains; never an account.
  function evidenceOf(id, T, post, items, reading) {
    if (!T) return null;
    if (ledger) { const before = JSON.stringify(ledger[id] || null); ledger = PB.recordCounts(ledger, id, counts(T)); ledgerDirty = ledgerDirty || JSON.stringify(ledger[id] || null) !== before; }
    const own = items.find((r) => r.id === id) || {};
    return { launchId: id, postUrl: T.author ? `https://x.com/${T.author}/status/${id}` : null, ledger: ledger ? PB.ledgerGrowth(ledger[id]) : null,
      request: { links: T.links || [], domains: [...(own.domains || []), ...(T.links || []).map((u) => { try { return new URL(u).hostname; } catch { return null; } }).filter(Boolean)], text: post && post.text, name: (reading && reading.display) || T.author || null, postedAt: T.posted || null } };
  }

  globalThis.PBCampaign = Object.freeze({ lens, forget, onList: () => !!listKind() });
})();
