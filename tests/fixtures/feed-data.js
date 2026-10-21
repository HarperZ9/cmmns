// Invented sample logs for the history and "Your feed" fixtures: every account, site and number
// here is made up. Sets window.FIXTURE_STORE in the shape chrome.storage.local holds.
(() => {
  const now = Date.now(), day = 86400000;
  const reports = {};
  const up = [["origin_one", "relay_a"], ["origin_one"], ["origin_one", "origin_two"], ["origin_two"], ["origin_three", "origin_one"]];
  const links = [[["example-news.test", 6], ["rt.com", 3], ["clips.example", 2]], [["example-news.test", 4], ["daily.example", 3]], [["rt.com", 2], ["video.example", 5], ["example-news.test", 1]]];
  for (let i = 0; i < 24; i++) {
    reports["x:t" + i] = { key: "x:t" + i, site: i % 4 ? "X" : "YouTube", at: now - (23 - i) * day * 1.2, replies: 40 + i * 3, lookedUp: 20 + i, flaggedK: 3 + (i % 5),
      extreme: { n: 6, k: 3 }, others: { n: 14 + i, k: i % 4 }, machine: i % 3, bursts: i % 4 === 0 ? 1 : 0,
      origins: [{ place: "France", n: 8 }, { place: "United States", n: 5 }, { place: "Nigeria", n: i % 3 }, { place: "Russia", n: 1 }],
      state: i % 3 === 0 ? [{ state: "Russia", basis: "named-in-report", actor: "government", replies: 2 }] : [],
      strong: 2 + (i % 6), techniques: {},
      context: { posts: 41 + i * 3, notes: i % 5 === 0 ? 1 : 0, claims: i % 4 === 0 ? 2 : 0, links: links[i % 3].map(([domain, n]) => ({ domain, n })) },
      upstream: { accounts: up[i % up.length].map((h) => ({ handle: h, n: 2 })), domains: [{ domain: "example-news.test", n: 2 }, { domain: "clips.example", n: 2 }], uploads: 4, recycled: 2 } };
  }
  const feed = {};
  for (let i = 0; i < 9; i++) {
    const at = now - i * day * 0.9, d = new Date(at).toISOString().slice(0, 10);
    feed["X|" + d] = { site: "X", day: d, at, ids: [], posts: 60 + i * 7, strong: 3 + (i % 4), notes: i % 3, claims: i % 2, links: { "example-news.test": 9 + i, "rt.com": 2, "shop.example": 4 }, techniques: {} };
  }
  // Accounts replying together: a ring that keeps meeting, a looser pair, and passers-by.
  const threads = {};
  const ring = ["ring_alpha", "ring_bravo", "ring_charlie", "ring_delta"];
  for (let i = 0; i < 14; i++) {
    const authors = {};
    for (const h of ring) if ((i + h.length) % 5 !== 0) authors[h] = 30 + i;
    if (i % 2 === 0) { authors.fan_one = 400; authors.fan_two = 520; }
    if (i % 3 === 0) authors.ring_bravo_fan = 900;
    authors["passer_" + i] = 1000;
    threads["x:" + (1000 + i)] = { at: now - i * day * 1.5, authors };
  }
  const trail = { media: { m1: { posts: [{ id: "1", handle: "origin_one", at: "2019-05-02T01:00:00Z" }, { id: "2", handle: "relay_a", at: "2026-10-18T10:00:00Z" }, { id: "3", handle: "relay_b", at: "2026-10-18T10:01:00Z" }, { id: "4", handle: "relay_c", at: "2026-10-18T10:02:00Z" }] } } };
  window.FIXTURE_STORE = { "pb.history.v1": reports, "pb.feed.v1": feed, "pb.net.v2": { threads }, "pb.trail.v1": trail, "pb.settings": { historyDays: 60 } };
})();
