// The discourse checks in the window (project-docs/DISCOURSE.md): quote sources, persona names,
// counts with their sample size, the post's words against the document images it shows, and the
// replies that bring a source or name an error. Off until the user turns on "Discourse checks" in
// the options. Quotes and names are answered by the background worker from data inside the
// extension (src/ext/discourse-bg.js); counts and replies are read here. Nothing leaves the browser.
(() => {
  "use strict";
  const quotes = new Map(), personas = new Map(), docs = new Map(), asked = new Set();
  const corrections = new Map();   // root post id -> ranked replies
  let timer = 0, queue = { posts: new Map(), accounts: new Map() };
  const DOC_CUE = /\b(letter|document|filing|memo|report|court|lawsuit|complaint|statement|transcript|email|contract|page|pages|attorneys?|lawyers?|study|paper|says|claims?)\b/i;

  const keyOf = (m) => String(m.handle || "").toLowerCase();
  const displayOf = (m) => m.display || (m.reading && m.reading.display) || null;
  const verifiedOf = (m) => !!(m.reading && m.reading.verifiedType) || !!(m.tweet && m.tweet.verified);

  // Queue the posts and accounts in view that have not been asked about, and ask once per 400 ms.
  function want(models, settings) {
    if (!settings || !settings.discourse) return;
    for (const m of models) {
      if (m.postId && !asked.has("p:" + m.postId) && /["“«:]/.test(m.text || "")) { asked.add("p:" + m.postId); queue.posts.set(m.postId, { id: m.postId, text: m.text }); }
      const k = keyOf(m), d = displayOf(m);
      if (k && d && !asked.has("a:" + k)) { asked.add("a:" + k); queue.accounts.set(k, { key: k, display: d, handle: m.handle, verified: verifiedOf(m) }); }
    }
    if ((queue.posts.size || queue.accounts.size) && !timer) timer = setTimeout(send, 400);
  }

  async function send() {
    timer = 0;
    const msg = { type: "pb-discourse", posts: [...queue.posts.values()], accounts: [...queue.accounts.values()] };
    queue = { posts: new Map(), accounts: new Map() };
    try {
      const r = await chrome.runtime.sendMessage(msg);
      if (!r || r.error) { if (r && r.error) console.warn("[daylight-commons] discourse checks:", r.error); return; }
      for (const [id, v] of Object.entries(r.quotes || {})) quotes.set(id, v);
      for (const [k, v] of Object.entries(r.personas || {})) personas.set(k, v);
      if (globalThis.PBPop) PBPop.refresh();
    } catch (e) { console.warn("[daylight-commons] the discourse checks could not reach the background worker", e); }
  }

  // The replies under a root post that bring a source or name an error. Links come from the post data
  // when the site loaded it, else from the domains the reply names.
  function readReplies(root, replies, tweets) {
    if (!root || !replies || !replies.length) return;
    const links = (r) => { const T = tweets && tweets.get ? tweets.get(r.id) : null; return (T && T.links && T.links.length ? T.links : (r.domains || []).map((d) => `https://${d}/`)); };
    const ranked = PBD.rankCorrections({ text: root.text, author: root.author }, replies.map((r) => ({ id: r.id, author: r.author, text: r.text, links: links(r) })));
    // reach as the site showed it, for the sheets view only: it never enters the ranking above
    const views = (id) => { const T = tweets && tweets.get ? tweets.get(id) : null; return T && T.views != null ? T.views : null; };
    corrections.set(root.id, ranked.map((x) => ({ ...x, reach: views(x.id), links: links(replies.find((r) => r.id === x.id)) })));
  }

  const images = (m) => (globalThis.PBMedia && m.node ? PBMedia.inPost(m.node, m.tweet).filter((x) => x.type === "image" && x.src) : []);

  // Read every image in the post with the text recogniser, then compare once all are read.
  function checkDocument(m) {
    const imgs = images(m);
    docs.set(m.postId, { state: "reading", srcs: imgs.map((x) => x.src) });
    for (const x of imgs) PBMedia.readText(x.src);
  }

  function docSigns(m, settings) {
    const imgs = images(m);
    if (!imgs.length || !DOC_CUE.test(m.text || "") || PBD.keyTerms(m.text).length < 2) return [];
    const st = docs.get(m.postId);
    if (!st) {
      const off = !settings.imageText;
      return [{ label: "check the post's words against its images", fam: "doc-claim", level: "info", cat: "sources", rows: [
        ["Document check", off ? "Turn on \"Read text in images\" in the options to read the pages this post shows." : { action: [`Read the ${imgs.length} ${imgs.length === 1 ? "image" : "images"} and compare`, () => checkDocument(m), "Reading…"] }],
        ["How", "Daylight Commons reads each image on this device with its own text recogniser, then looks for the post's key terms in the text."]] }];
    }
    const pages = st.srcs.map((s) => { const t = PBMedia.textOf(s); return t && t.state === "done" ? (t.result && t.result.text ? t.result : { text: "" }) : null; });
    if (pages.some((p) => p === null)) return [{ label: "reading the post's images", fam: "doc-claim", level: "info", cat: "sources", rows: [["Document check", `${pages.filter(Boolean).length} of ${pages.length} images read`]] }];
    return PBD.docSign(docResult(m));
  }

  // The finished document check for a post, or null.
  function docResult(m) {
    const st = docs.get(m.postId);
    if (!st) return null;
    const pages = st.srcs.map((s) => { const t = PBMedia.textOf(s); return t && t.state === "done" ? (t.result && t.result.text ? t.result : { text: "" }) : null; });
    return pages.some((p) => p === null) ? null : PBD.checkDocument(m.text, pages);
  }

  // Every finished result for a post, for the parts tree and the sheets.
  function results(m) {
    const ranked = corrections.get(m.postId) || null;
    return { quotes: quotes.get(m.postId) || null, doc: docResult(m), counts: PBD.findCounts(m.text), corrections: ranked,
      independence: ranked ? PBD.independence(PBD.buildSheets({ claim: {}, corrections: ranked.map((x) => ({ reach: x.reach, origin: x.origin })) })) : null, persona: personas.get(keyOf(m)) || null };
  }

  // The post over the replies that bring a source over the primary documents they link, for sheets.html.
  async function openSheets(m) {
    const ranked = corrections.get(m.postId) || [];
    const docs = [...new Set(ranked.flatMap((x) => x.links || []).filter((u) => PBD.sourceKind(u) === "primary"))].slice(0, 6).map((u) => ({ title: u.replace(/^https?:\/\//, "").slice(0, 80), url: u }));
    const thread = { claim: { text: m.text, reach: m.tweet && m.tweet.views != null ? m.tweet.views : null }, corrections: ranked.map((x) => ({ text: x.text, reach: x.reach, origin: x.origin })), documents: docs };
    await chrome.storage.local.set({ "pb.sheets.view": { thread, at: new Date().toISOString() } });
    await chrome.runtime.sendMessage({ type: "pb-open-page", path: "sheets.html" });
  }

  function countSigns(m) {
    const out = PBD.countSigns(PBD.findCounts(m.text));
    if (globalThis.PBMedia && PBMedia.textsFor) for (const r of PBMedia.textsFor(m.node, m.tweet)) out.push(...PBD.countSigns(PBD.findCounts(r.text), true));
    return out;
  }

  // Save the post as a study item with every finished analysis attached (daylight.sidecar/1, study:
  // true, "## Analysis" sections), through the same study save as the Study button (src/ext/quick-text.js).
  async function saveStudy(m, settings) {
    const { notes, analysis } = PBD.studyNotes(collect(m, settings));
    const raw = (globalThis.PBQuickSites && m.node && PBQuickSites.postMetaOf(m.node)) || { site: location.hostname.replace(/^www\./, ""), text: m.text, handle: m.handle, pageUrl: location.href };
    if (!globalThis.PBQuickText) throw new Error("the study save is not loaded on this page");
    const res = await PBQuickText.run("study", { raw: { ...raw, kind: "text", notes, analysis } });
    // the same results as a parts tree beside the note (refdb.parts/1), for the reference library
    if (res && res.ok && res.name && globalThis.PBQuickSave) {
      const parts = PBD.discourseParts({ site: res.meta && res.meta.site, postUrl: res.meta && res.meta.postUrl, handle: m.handle }, results(m));
      await PBQuickSave.saveText(new TextEncoder().encode(JSON.stringify(parts, null, 1)), "application/json", res.name.replace(/\.md$/, ".parts.json"), res.meta && res.meta.site, true);
    }
    return res;
  }

  // The signs for one post, with a "save as study" row on each finished analysis.
  function signs(m, settings) {
    if (!settings || !settings.discourse || !globalThis.PBD) return [];
    const out = collect(m, settings);
    const save = ["Study", { action: ["Save the post with this analysis for study", () => saveStudy(m, settings).catch((e) => console.warn("[daylight-commons] study save failed", e)), "Saving…"] }];
    const sheets = ["Sheets", { action: ["Open the post and what lies under it as sheets", () => openSheets(m).catch((e) => console.warn("[daylight-commons] sheets failed", e)), "Opening…"] }];
    return out.map((s) => (s.rows.some(([, v]) => v && typeof v === "object" && v.action) ? s : { ...s, rows: [...s.rows, ...(s.fam === "correction-replies" ? [sheets] : []), save] }));
  }

  function collect(m, settings) {
    const q = quotes.get(m.postId);
    return [
      ...PBD.personaSign(personas.get(keyOf(m)) || null),
      ...(q ? PBD.quoteSigns(q.results, q.list) : []),
      ...countSigns(m),
      ...docSigns(m, settings),
      ...PBD.correctionSign(corrections.get(m.postId) || null),
    ];
  }

  globalThis.PBDiscourse = Object.freeze({ want, readReplies, signs });
})();
