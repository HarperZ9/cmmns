// "What Daylight shows about you" (selfaudit.html), on src/core/self-audit.js. Two ways in, both
// proving the account is the user's own: the open tab's own markers (selfaudit-page.js, checked by
// PB.ownedProfile), or the platform's data export read from files the user picks. There is no
// field to type an account into. The reading of the profile comes from this browser's own store
// (what X already loaded for the page); nothing is fetched and nothing leaves the device.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const { el } = PBPages;
  const say = (t) => { $("status").textContent = t; };
  const tabId = Number(new URLSearchParams(location.search).get("tab")) || null;
  $("from-page").disabled = !tabId;

  const item = (s) => { const li = el("li"); li.append(el("strong", {}, s.title), el("br"), `Shows: ${s.shows}`, el("br"), `Reveals: ${s.reveals}`, el("br"), `To reduce it: ${s.reduce}`); return li; };

  function render(a) {
    $("signals").replaceChildren(...(a.signals.length ? a.signals.map(item) : [el("li", {}, "Daylight Commons found none of its signals for this account yet.")]));
    $("flags").replaceChildren(...(a.flags.length ? a.flags.map((f) => el("li", {}, `${f.evidence}. ${f.doesNotProve || ""}`)) : [el("li", {}, "None.")]));
    $("not-checked").replaceChildren(...a.notChecked.map((x) => el("li", {}, x)));
    $("signals-box").hidden = false;
  }

  $("from-page").addEventListener("click", async () => {
    $("signals-box").hidden = true;
    let markers = null;
    try { [{ result: markers }] = await chrome.scripting.executeScript({ target: { tabId }, files: ["selfaudit-page.js"] }); } catch (e) { say(`This tab cannot be read: ${e.message}. ${PB.SELF_AUDIT_REFUSED}`); return; }
    const handle = PB.ownedProfile(markers || {});
    if (!handle) { say(`Not your own profile, or not signed in, so nothing was read. ${PB.SELF_AUDIT_REFUSED}`); return; }
    const store = (await chrome.storage.local.get("pb.about.v1"))["pb.about.v1"] || {}, reading = store[handle];
    if (!reading) { say(`Daylight Commons has no reading of @${handle} yet. Scroll your profile so X loads your posts, open your About page, then try again.`); return; }
    render(PB.selfAudit({ site: "X", source: "page", account: reading, pattern: reading.pattern || null }));
    say(`Your own profile, @${handle}, from what X loaded in this browser. Nothing was sent.`);
  });

  $("files").addEventListener("change", async () => {
    $("signals-box").hidden = true;
    const files = await Promise.all([...$("files").files].map(async (f) => ({ name: f.name, text: await f.text() })));
    const got = PB.exportAuditInput(files);
    if (!got.ok) { say(got.reason); return; }
    render(PB.selfAudit(got.input));
    say(`From your ${got.input.site || "platform"} data export: ${got.input.posts.length} posts. Read on this device; nothing was sent.`);
  });
})().catch((e) => console.error("[daylight-commons] self-audit failed", e));
