// Options page: per-site switches, the window's areas, retention, clear-all, accessibility and the
// measured accuracy of every badge family. Every change is saved to chrome.storage.local at once
// through PBSettings; the content scripts and the background worker pick it up from there.
(async () => {
  "use strict";
  const { el, aperture, switchRow, sites } = PBPages;
  const $ = (id) => document.getElementById(id);
  await PBSettings.ready;
  const s = () => PBSettings.get();
  const save = (patch) => PBSettings.save(patch).catch((e) => console.error("[cmmns] could not save settings", e));
  $("art").append(aperture(false));

  function siteSwitches() {
    $("sites").append(switchRow("Pause CMMNS everywhere", "Stops reading and hides the window on every site until you switch it back.", s().paused, (on) => save({ paused: on })));
    for (const [id, name] of sites()) $("sites").append(switchRow(name, null, PB.siteOn({ ...s(), paused: false }, id), (on) => save({ sites: { ...s().sites, [id]: on } })));
  }

  // Mastodon servers the user turned CMMNS on for (src/ext/instances.js).
  async function servers() {
    const list = (await chrome.runtime.sendMessage({ type: "pb-instance-list" }).catch(() => null)) || [];
    const ul = $("servers");
    ul.replaceChildren();
    if (!list.length) { ul.append(el("li", { class: "hint" }, "None yet.")); return; }
    for (const host of list) {
      const li = el("li", {}, host + " ");
      const b = el("button", { type: "button", class: "btn" }, "Remove");
      b.addEventListener("click", () => chrome.runtime.sendMessage({ type: "pb-instance-remove", host }).then(servers).catch((e) => console.error("[cmmns] could not remove", host, e)));
      li.append(b);
      ul.append(li);
    }
  }

  const AREA_HINTS = {
    place: "Where the platform places the account, and replies that speak as a local of somewhere else.",
    account: "Age, renames, sign-up handles and follow patterns.",
    posting: "Posting hours, posting apps, reply speed and volume.",
    coordination: "The same text or upload from several accounts.",
    language: "Slurs, calls for violence, dehumanising language, spam and machine-writing signs.",
    sources: "Outlet owners, state links from cited reports, ads and Community Notes.",
    media: "Media uploaded long before the post that shows it.",
  };
  // Evidence lookups send link domains and repository names. Firefox 140 and later ask the user for
  // that themselves ("websiteContent", optional in the manifest), from this click; elsewhere that
  // key throws and only the host is asked for. The host is web.archive.org, whose CDX answers
  // without a CORS header. Turning the switch off gives both back.
  function evidenceSwitch(on, input) {
    const origins = ["https://web.archive.org/*"], both = { origins, data_collection: ["websiteContent"] };
    const ask = (verb) => { try { return chrome.permissions[verb](both); } catch { return chrome.permissions[verb]({ origins }); } };
    if (!on) { Promise.resolve(ask("remove")).catch(() => {}); save({ evidence: false }); return; }
    let asked;
    try { asked = ask("request"); } catch { asked = Promise.resolve(false); }
    Promise.resolve(asked).catch(() => true).then((ok) => {
      if (ok === false) { input.checked = false; return; }
      save({ evidence: true });
    });
  }

  function windowSwitches() {
    for (const id of PB.AREA_IDS) {
      const name = id[0].toUpperCase() + id.slice(1);
      $("areas").append(switchRow(name, AREA_HINTS[id], PB.areaOn(s(), id), (on) => save({ areas: { ...s().areas, [id]: on } })));
    }
    $("reading").append(
      switchRow("CMMNS on feeds and profiles", "Adds CMMNS to feeds and profile pages, beside the replies under a post you open.", s().feeds, (on) => save({ feeds: on })),
      switchRow("Read account details automatically", "Reads account details as replies load. With this off, ask for them in the window.", s().auto, (on) => save({ auto: on })),
      switchRow("Evidence lookups", "Adds \"Look up evidence\" to the launch campaign section. On your click, the repository names and domains a post links to go to GitHub, rdap.org and the Internet Archive; nothing else, and never an account. Each result is sealed in this browser. Turning this on asks your browser for access to web.archive.org, whose answers need it.", s().evidence, (on, input) => evidenceSwitch(on, input)),
      switchRow("Every reading technique", `Marks each reading-lens technique on posts. Off, only techniques with held-out precision of 80% or more show: ${[...PB.readingOn()].map((id) => PB.TECHNIQUE_BY_ID.get(id).name.toLowerCase()).join(", ") || "none yet"}.`, s().lensAll, (on) => save({ lensAll: on })),
      switchRow("Pressure lens", "Marks pressure moves in messages, whoever wrote them: urgency, shrinking the ask, manufactured consensus, false even-handedness, burden shifting and deflection by label. On held-out messages it was right on 8 of 9 marks and found 8 of 47 moves, so a message without a mark can still carry pressure.", s().pressureLens, (on) => save({ pressureLens: on })),
      switchRow("Read text in images", "Adds \"Read text in this image\" to the window's Media area. CMMNS reads the words on this device, only when you click, in Latin-script languages; the image and its text never leave your browser.", s().imageText, (on) => save({ imageText: on })),
      switchRow("Discourse checks", "Adds five checks to the window, all on this device: where a quoted line comes from, in a bundled index of public-domain texts and a sourced list of misattributions; accounts named after a well-known person who has died; counts such as 45/50 with their 95% interval; the post's words against the document pages it shows as images (with \"Read text in images\" on, on your click); and replies that bring a source or name an error. Not yet measured on real threads.", s().discourse, (on) => save({ discourse: on })),
      switchRow("Argument lens", "With Discourse checks on, splits a post into premises, assumptions, conclusions and turns at the connectives that join them, in English, Portuguese, Spanish, French and Latin, and marks claims about what someone else knows or intends, conclusions that bring in words their premises lack, and posts that rearrange their sources' facts. Roles that have not passed their held-out test show as plain segments.", s().argumentLens, (on) => save({ argumentLens: on })),
      switchRow("Every argument role", "Shows every role the argument lens assigns, including roles not yet measured against people's own markings.", s().argumentAll, (on) => save({ argumentAll: on })),
    );
  }

  // The user's own GitHub token for star timestamps (src/ext/evidence-bg.js). Kept in this browser,
  // sent only to api.github.com, removed by "Clear all CMMNS data". A read-only token with no scopes is enough.
  async function tokenField() {
    const KEY = "pb.evidence.github";
    const input = el("input", { type: "password", id: "githubToken", autocomplete: "off", spellcheck: "false" });
    input.value = ((await chrome.storage.local.get(KEY))[KEY]) || "";
    input.addEventListener("change", () => (input.value.trim() ? chrome.storage.local.set({ [KEY]: input.value.trim() }) : chrome.storage.local.remove(KEY)).catch((e) => console.error("[cmmns] could not save the token", e)));
    $("reading").append(el("label", { for: "githubToken" }, "Your GitHub token, for star timestamps (optional). GitHub lists stargazers only to signed-in callers; a token with no scopes is enough. Kept in this browser and sent only to api.github.com. "), input);
  }

  function retention() {
    for (const key of ["historyDays", "aboutDays"]) {
      const input = $(key), r = PB.RETENTION[key];
      input.min = r.min; input.max = r.max; input.value = s()[key];
      input.addEventListener("change", async () => { const next = await save({ [key]: input.value }); if (next) input.value = next[key]; setTimeout(usage, 300); });
    }
    $("historyHint").textContent = " (connections and source trails stop at 30)";
  }

  async function usage() {
    try {
      const all = await chrome.storage.local.get(null);
      const keys = PB.dataKeys(Object.keys(all));
      const bytes = keys.reduce((a, k) => a + JSON.stringify(all[k]).length, 0);
      $("usage").textContent = keys.length ? `About ${Math.max(1, Math.round(bytes / 1024))} KB kept in ${keys.length} store${keys.length === 1 ? "" : "s"}.` : "CMMNS keeps nothing yet.";
    } catch (e) { console.error("[cmmns] could not measure storage", e); }
  }

  // Two steps, so one stray click cannot delete everything.
  function clearAll() {
    const b = $("clear");
    let armed = false;
    const disarm = () => { armed = false; b.textContent = "Clear all CMMNS data"; b.classList.remove("hot"); };
    b.addEventListener("click", async () => {
      if (!armed) { armed = true; b.textContent = "Click again to delete everything"; b.classList.add("hot"); return; }
      try {
        const all = await chrome.storage.local.get(null);
        await chrome.storage.local.remove(PB.dataKeys(Object.keys(all)));
        if (globalThis.PBTrackStore) await PBTrackStore.clearAll();   // the engagement series and seen log (IndexedDB)
        $("clearStatus").textContent = "Cleared. Your settings are kept.";
      } catch (e) { console.error("[cmmns] clear failed", e); $("clearStatus").textContent = "Could not clear: " + e.message; }
      disarm();
      usage();
    });
    b.addEventListener("blur", () => { if (armed) disarm(); });
  }

  function access() {
    $("access").append(
      switchRow("Reduce motion", "The window appears and disappears instantly.", s().calm, (on) => save({ calm: on })),
      switchRow("Larger text", "Larger text in CMMNS' window and pages.", s().large, (on) => save({ large: on })),
    );
  }

  function families() {
    const detectors = PB.FAMILIES.filter((f) => f.kind === "detector");
    const n = detectors.filter((f) => PB.measuredLine(f.id).measured).length;
    $("measuredNote").textContent = `Precision is the share of shown signs that a person checking by hand agreed with, on threads held back from tuning. ${n} of ${detectors.length} detectors are measured so far.`;
    const order = (f) => PB.AREA_IDS.indexOf(f.area);
    for (const f of [...PB.FAMILIES].sort((a, b) => order(a) - order(b))) {
      const line = PB.measuredLine(f.id);
      const tr = el("tr");
      tr.append(el("td", {}, f.name), el("td", {}, f.area[0].toUpperCase() + f.area.slice(1)), el("td", { class: line.measured ? "figure" : "muted" }, line.text));
      $("families").append(tr);
    }
  }

  siteSwitches(); servers(); windowSwitches();
  tokenField().catch((e) => console.error("[cmmns] token field failed", e)); retention(); clearAll(); access(); families(); usage();
  $("foot").textContent = `CMMNS ${chrome.runtime.getManifest().version}. CMMNS reads the site you are on. Other coverage and evidence lookups reach further once you turn them on.`;
})().catch((e) => console.error("[cmmns] options page failed", e));
