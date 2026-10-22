// Options for data packs (src/core/packs.js, src/ext/packs-bg.js): import a pack file the user
// picks, see which key signed it and what it adds, trust the key, turn packs on and off, remove
// them, and check Daylight Commons' own bundled data against the project key. Nothing is downloaded.
(async () => {
  "use strict";
  const { el } = PBPages;
  const $ = (id) => document.getElementById(id);
  const PACKS = "pb.packs.v1", KEYS = "pb.packkeys.v1", MAX_BYTES = 20 * 1024 * 1024;
  const store = async () => { const g = await chrome.storage.local.get([PACKS, KEYS]); return { packs: g[PACKS] || [], keys: g[KEYS] || [] }; };
  const put = (patch) => chrome.storage.local.set(patch);
  const fail = (what) => (e) => { console.error(`[daylight-commons] ${what}`, e); $("packPreview").replaceChildren(el("p", { class: "status" }, `Could not ${what}: ${e.message}`)); };
  const button = (text, onClick, cls) => { const b = el("button", { type: "button", ...(cls ? { class: cls } : {}) }, text); b.addEventListener("click", onClick); return b; };
  const signer = (m, keyId) => `key ${PB.keyFingerprint(keyId)}${m.author && m.author.name ? `, which calls itself "${m.author.name}"` : ""}`;

  async function renderLists() {
    const { packs, keys } = await store();
    const ul = $("packList"), kl = $("keyList");
    ul.replaceChildren(); kl.replaceChildren();
    if (!packs.length) ul.append(el("li", { class: "muted" }, "None yet."));
    packs.forEach((e, i) => {
      const m = e.pack.manifest, li = el("li", {}, `${m.name} ${m.version}: ${PB.packSummary(e.pack.content)}. Signed by ${signer(m, m.author.keyId)}. ${e.enabled ? "On." : "Off."} `);
      li.append(button(e.enabled ? "Turn off" : "Turn on", () => setPack(i, { enabled: !e.enabled }), "quiet"), " ", button("Remove", () => removePack(i), "quiet"));
      ul.append(li);
    });
    if (!keys.length) kl.append(el("li", { class: "muted" }, "None. Daylight Commons' own data is checked against its project key, which is built in."));
    keys.forEach((k) => {
      const li = el("li", {}, `${k.label}: ${PB.keyFingerprint(k.keyId)}, trusted since ${k.added}. `);
      li.append(button("Stop trusting", () => distrust(k.keyId), "quiet"));
      kl.append(li);
    });
  }

  async function setPack(i, patch) {
    const { packs } = await store();
    packs[i] = { ...packs[i], ...patch };
    await put({ [PACKS]: packs }); renderLists();
  }
  async function removePack(i) {
    const { packs } = await store();
    packs.splice(i, 1);
    await put({ [PACKS]: packs }); renderLists();
  }
  // Stop trusting a key: its packs are turned off and stay listed, so the user can remove them.
  async function distrust(keyId) {
    const { packs, keys } = await store();
    await put({ [KEYS]: keys.filter((k) => k.keyId !== keyId), [PACKS]: packs.map((e) => (e.pack.manifest.author.keyId === keyId ? { ...e, enabled: false } : e)) });
    renderLists();
  }

  // Adds (or replaces, same name and key) a verified pack; trusts its key first when asked to.
  async function addPack(pack, keyId, trustKey) {
    const { packs, keys } = await store(), today = new Date().toISOString().slice(0, 10);
    const label = (pack.manifest.author && pack.manifest.author.name) || "Key " + keyId.slice(0, 8);
    const nextKeys = trustKey && !keys.some((k) => k.keyId === keyId) ? [...keys, { keyId, jwk: PB.publicJwk(pack.publicKey), label, added: today }] : keys;
    const rest = packs.filter((e) => !(e.pack.manifest.name === pack.manifest.name && e.pack.manifest.author.keyId === keyId));
    await put({ [KEYS]: nextKeys, [PACKS]: [...rest, { pack, enabled: true, imported: today }] });
    $("packPreview").replaceChildren(el("p", { class: "status" }, `Added ${pack.manifest.name}. It is on; Daylight Commons uses it from the next page you open.`));
    renderLists();
  }

  // The import screen: what the file is, who signed it, what it adds, and what is wrong with it.
  async function preview(file) {
    if (file.size > MAX_BYTES) throw new Error("the file is over 20 MB");
    let pack;
    try { pack = JSON.parse(await file.text()); } catch { throw new Error("the file is not JSON"); }
    const { keys } = await store();
    const v = await PB.verifyPack(pack, keys);
    const problems = [...v.problems, ...(pack && pack.content ? PB.validatePackContent(pack.content) : ["the pack has no content Daylight Commons can add"])];
    const m = (pack && pack.manifest) || {}, box = $("packPreview");
    box.replaceChildren(el("h3", { class: "sub" }, `${m.name || "Unnamed pack"} ${m.version || ""}`));
    if (m.description) box.append(el("p", {}, m.description));
    box.append(el("p", {}, `Signed by ${signer(m, v.keyId)}. ${v.trusted ? "You trust this key." : "You do not trust this key yet. Only the key id is checked; the name is what the signer wrote."}`));
    box.append(el("p", {}, `Adds ${PB.packSummary(pack && pack.content)}. Created ${m.created || "on a date not given"}.`));
    if (problems.length) {
      box.append(el("p", { class: "status" }, "Daylight Commons will not use this pack:"));
      const ul = el("ul", { class: "plain" });
      for (const p of problems.slice(0, 12)) ul.append(el("li", {}, p));
      box.append(ul);
      return;
    }
    const row = el("div", { class: "row" });
    row.append(v.trusted ? button("Add the pack", () => addPack(pack, v.keyId, false).catch(fail("add the pack"))) : button("Trust this key and add the pack", () => addPack(pack, v.keyId, true).catch(fail("add the pack"))));
    row.append(button("Cancel", () => box.replaceChildren(), "quiet"));
    box.append(row);
  }

  // Daylight Commons' own tables against the signed list of their hashes (src/ext/radar-data.pack.json).
  async function checkBundled() {
    const say = (t) => { $("bundled").textContent = t; };
    say("Checking...");
    const get = (n) => fetch(chrome.runtime.getURL(n));
    const pack = await (await get("radar-data.pack.json")).json();
    const v = await PB.verifyPack(pack, [PB.PROJECT_KEY]);
    const files = await PB.verifyFiles(pack, async (n) => (await get(n)).arrayBuffer());
    const n = Object.keys(pack.manifest.files || {}).length;
    say(v.trusted && !files.length ? `Daylight Commons' own data: signed by the Daylight Commons project key ${PB.keyFingerprint(v.keyId)}; all ${n} tables match the signed copy (${pack.manifest.created}). This checks the files against each other; it cannot rule out a tampered install, which could carry a different key. Compare the key with the one published in Daylight Commons' repository.`
      : `Daylight Commons' own data does not match its signature: ${[...v.problems, ...files].join("; ") || "the key is not the project key"}. Reinstall Daylight Commons from a source you trust.`);
  }

  $("packCaveat").textContent = PB.PACK_DOES_NOT_PROVE;
  $("packPick").addEventListener("click", () => $("packFile").click());
  $("packFile").addEventListener("change", () => { const f = $("packFile").files[0]; $("packFile").value = ""; if (f) preview(f).catch(fail("read the pack")); });
  $("bundledCheck").addEventListener("click", () => checkBundled().catch((e) => { console.error("[daylight-commons] bundled data check failed", e); $("bundled").textContent = "Could not check Daylight Commons' own data: " + e.message; }));
  renderLists().catch(fail("list the packs"));
})().catch((e) => console.error("[daylight-commons] data pack options failed", e));
