// Options: check a signed head (src/core/head.js) the user picked, from a release or the offline
// kit. The head must be signed by CMMNS' project key, carry a version no lower than one
// accepted here, and name the catalogue this install carries. Expired heads are accepted and
// marked Expired. The accepted state stays in this browser (pb.head.v1). Nothing is downloaded.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const say = (t) => { $("headStatus").textContent = t; };
  const show = async () => { const v = await chrome.runtime.sendMessage({ type: "pb-freshness" }); if (v) say(`${v.label}. ${v.line}`); };

  async function check(files) {
    const by = new Map([...files].map((f) => [f.name, f]));
    const head = by.get("HEAD.json"), sig = by.get("HEAD.sig");
    if (!head || !sig) { say("Pick HEAD.json and HEAD.sig together. Add SHA256SUMS to check it as well."); return; }
    if (head.size > PB.HEAD_MAX_BYTES) { say(PB.refusalSentence("size")); return; }
    const g = await chrome.storage.local.get(PBHeadKey);
    const r = await PB.checkHead({
      head: await head.text(), sig: sig.size > PB.HEAD_SIG_MAX_BYTES ? "" : await sig.text(), trusted: [PB.PROJECT_KEY.jwk], state: g[PBHeadKey] || null,
      now: Date.now(), sums: by.has("SHA256SUMS") ? await by.get("SHA256SUMS").text() : null, catalogue: (await PBSign.dataLock()).value,
    });
    if (!r.ok) { say(r.sentence); return; }
    await chrome.storage.local.set({ [PBHeadKey]: r.state });
    await show();
  }
  const PBHeadKey = "pb.head.v1";
  $("headPick").addEventListener("click", () => $("headFile").click());
  $("headFile").addEventListener("change", (e) => check(e.target.files).catch((err) => { console.error("[cmmns] head check failed", err); say("Could not check the head: " + err.message); }));
  $("headCaveat").textContent = PB.HEAD_DOES_NOT_PROVE;
  await show();
})().catch((e) => console.error("[cmmns] signed head section failed", e));
