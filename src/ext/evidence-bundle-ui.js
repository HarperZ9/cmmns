// The signed evidence bundle on the thread card page: radar-core analyses the posts the thread
// panel handed over, with Daylight Commons' full tables, and the bundle is signed with this browser's key.
// The posts stay in this browser; full text goes into the bundle only when the user ticks the box.
// Carrier-safe: a one-time key, the day only, and no page address unless the user types one.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const id = location.hash.slice(1);
  const built = id ? await chrome.runtime.sendMessage({ type: "pb-card-get", id }) : null;
  if (!built || !built.ok || !built.bundleInput) return;
  $("bundle").hidden = false;
  const page = () => { $("bundle-page-row").hidden = !$("bundle-carrier").checked; };
  $("bundle-carrier").addEventListener("change", page);
  page();
  $("bundle-save").addEventListener("click", async () => {
    const say = (t) => { $("bundle-status").textContent = t; };
    try {
      say("Analysing the thread on this device…");
      await PBSign.loadTables();
      const input = built.bundleInput, result = PB.analyzeThread(input);
      const texts = Object.fromEntries([input.root, ...input.replies].filter(Boolean).map((p) => [p.id, p.text]));
      const carrier = $("bundle-carrier").checked;
      const made = PB.makeBundle(result, { tool: PBSign.tool(), dataLock: await PBSign.dataLock(), page: built.card.thread.page, includeText: $("bundle-text").checked, texts, ...(carrier ? { profile: PB.CARRIER_SAFE, typedPage: $("bundle-page").value.trim() || null } : {}) });
      if (!made.ok) { say(made.reason); return; }
      const signed = carrier ? await PBSign.signCarrierSafe(made.bundle) : await PBSign.sign(made.bundle);
      const name = `radar-bundle-${String(built.card.thread.site).toLowerCase()}-${signed.signature.value.slice(0, 10)}.json`;
      PBSign.download(name, JSON.stringify(signed, null, 2) + "\n");
      say(carrier ? `Saved ${name}: ${signed.evidence.length} evidence items, carrier-safe, signed with a one-time key that was not kept.` : `Saved ${name}: ${signed.evidence.length} evidence items, signed with key ${signed.signer.keyId}.`);
    } catch (e) {
      console.error("[daylight-commons] bundle failed", e);
      say("Could not make the bundle: " + e.message);
    }
  });
})().catch((e) => console.error("[daylight-commons] bundle section failed", e));
