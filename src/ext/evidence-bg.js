// Evidence lookups in the background worker (project-docs/EVIDENCE-LAYER.md). A page asks with
// "pb-evidence" after the user clicked "Look up evidence" for the post they are viewing. Nothing
// runs unless the user turned evidence lookups on (settings.evidence). Receipts are appended to the
// sealed local log (pb.seal.v1), and "pb-evidence-export" returns the log as an evidence chain.
// The user's GitHub token, if they added one in Options, is read here and sent only to api.github.com.
(() => {
  "use strict";
  const SEAL_KEY = "pb.seal.v1", TOKEN_KEY = "pb.evidence.github", MAX_SEAL = 2000;
  let queue = Promise.resolve();   // one lookup at a time, so the seal is appended in order
  const settings = async () => PB.normalizeSettings((await chrome.storage.local.get(PB.SETTINGS_KEY))[PB.SETTINGS_KEY]);

  async function seal(receipts) {
    const cur = (await chrome.storage.local.get(SEAL_KEY))[SEAL_KEY] || PB.emptySeal();
    let next = cur;
    for (const r of receipts) next = await PB.appendSeal(next, r);
    // The log is append-only; when it is full, the user is told to export and clear it, nothing is dropped.
    if (next.entries.length > MAX_SEAL) return { full: true };
    await chrome.storage.local.set({ [SEAL_KEY]: next });
    return { size: next.entries.length };
  }

  async function lookup(msg) {
    const s = await settings();
    if (!s.evidence) return { error: "off" };
    const token = ((await chrome.storage.local.get(TOKEN_KEY))[TOKEN_KEY] || "").trim() || null;
    const repos = PB.reposIn(msg.links || []).concat(PB.reposIn(msg.text || ""));
    const domains = [...new Set((msg.domains || []).map(PB.registrable).filter(Boolean))].filter((d) => d !== "github.com");
    const out = await PB.lookupEvidence((u, o) => fetch(u, o), { repos, domains, postedAt: msg.postedAt || null, token });
    const sealed = out.receipts.length ? await seal(out.receipts) : { size: null };
    if (sealed.full) out.notes.push("The evidence log is full. Save the evidence chain and clear Radar data to start a new one.");
    return { ...out, sealed: sealed.size, ads: PB.adLibraryLinks({ name: msg.name, domain: domains[0] }) };
  }

  async function exportChain() {
    const cur = (await chrome.storage.local.get(SEAL_KEY))[SEAL_KEY] || PB.emptySeal();
    const check = await PB.verifySeal(cur);
    return { chain: await PB.exportSeal(cur, { title: "Radar evidence chain" }), check };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "pb-evidence") {
      queue = queue.then(() => lookup(msg)).then(sendResponse, (e) => { console.error("[radar] evidence lookup failed", e); sendResponse({ error: "failed" }); });
      return true;
    }
    // Witness: the user opened the Internet Archive's save page for a public post. The receipt keeps
    // where the archived copy can be looked up; Radar does not fetch it or check the save worked.
    if (msg && msg.type === "pb-evidence-witness" && /^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/status\/\d+$/.test(msg.postUrl || "")) {
      queue = queue.then(async () => {
        if (!(await settings()).evidence) return { error: "off" };
        const r = await PB.makeReceipt({ kind: "witness-request", subject: msg.postUrl, observed: { requested: true }, source: "Internet Archive Save Page Now, opened by you", url: `https://web.archive.org/save/${msg.postUrl}`, method: "user-opened", witness: { lookup: `https://web.archive.org/web/*/${msg.postUrl}` }, dnp: "This records that you asked the Internet Archive to save the page. The archive may refuse or save a login wall instead of the post; open the lookup address to see what it kept." });
        return seal([r]);
      }).then(sendResponse, (e) => { console.error("[radar] witness receipt failed", e); sendResponse({ error: "failed" }); });
      return true;
    }
    if (msg && msg.type === "pb-evidence-export") {
      exportChain().then(sendResponse, (e) => { console.error("[radar] evidence export failed", e); sendResponse({ error: "failed" }); });
      return true;
    }
    return false;
  });
})();
