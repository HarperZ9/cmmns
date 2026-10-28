// The worker's side of the hover Download control and the keyboard shortcut (Alt+Shift+D).
// - On the sites CMMNS already reads, the control is a manifest content script. On every
//   other site it runs only after the user allows "every site" in the options (the optional
//   https://*/* access), and then as a registered content script; turning it off unregisters it.
// - A press on the control sends the point it was over; this file reads that tab once and runs the
//   same download, copy or Save to CMMNS as the right-click menu (quick-save-bg.js).
// - The shortcut reads the current tab (activeTab) and saves the media under the pointer, or the
//   focused media, in the frame the pointer was last in.
globalThis.PBHoverBg = (() => {
  "use strict";
  const ID = "pb-hover", EVERYWHERE = ["https://*/*"], FILES = ["quick-hover-ui.js", "quick-hover.js"];
  // The named sites that already load the control from the manifest (not a wildcard grant).
  const own = () => (chrome.runtime.getManifest().host_permissions || []).filter((h) => /^https:\/\/[a-z0-9.-]+\//i.test(h));

  async function sync() {
    if (!chrome.scripting || !chrome.scripting.registerContentScripts) return;
    try {
      const s = await PBQuickBg.settings();
      const granted = await chrome.permissions.contains({ origins: EVERYWHERE }).catch(() => false);
      const want = s.hoverDownload && s.hoverEverywhere && granted;
      const have = await chrome.scripting.getRegisteredContentScripts({ ids: [ID] }).catch(() => []);
      if (want && !have.length) {
        const script = { id: ID, matches: EVERYWHERE, excludeMatches: own(), js: FILES, allFrames: true, runAt: "document_idle" };
        await chrome.scripting.registerContentScripts([{ ...script, persistAcrossSessions: true }]).catch(() => chrome.scripting.registerContentScripts([script]));
      }
      if (!want && have.length) await chrome.scripting.unregisterContentScripts({ ids: [ID] });
    } catch (e) { console.warn("[cmmns] could not update the hover control's sites", e); }
  }

  async function patch(change) {
    const k = PB.SETTINGS_KEY, cur = (await chrome.storage.local.get(k))[k];
    const next = PB.normalizeSettings({ ...PB.normalizeSettings(cur), ...change(PB.normalizeSettings(cur)) });
    await chrome.storage.local.set({ [k]: next });
  }

  async function run(tabId, frameId, args) {
    const target = await PBQuickBg.inject(tabId, frameId);
    const [r] = await chrome.scripting.executeScript({ target, args: [args], func: (a) => {
      const at = a.at || undefined;
      if (a.action === "ytlink") return PBYouTube.copyLink();
      if (/^text-/.test(a.action)) return PBQuickText.run(a.action.slice(5), { selection: a.selection });
      if (a.action === "ytcli") return globalThis.PBYtHandoff ? PBYtHandoff.run() : null;
      if (a.action === "copy" || a.action === "link" || a.action === "caption") return PBQuickCopy.copy(PBQuickResolve.resolve({ at }), { link: a.action === "link", caption: a.action === "caption" });
      return PBQuickSave.fromMenu({ at, asGif: a.action === "gif", study: a.action === "study" });
    } });
    return r && r.result;
  }

  async function onAction(msg, sender) {
    const tab = sender.tab, frameId = sender.frameId || 0, host = (() => { try { return new URL(sender.url).hostname.replace(/^www\./, ""); } catch { return null; } })();
    if (msg.action === "never" && host) return patch((s) => ({ hoverOffSites: [...s.hoverOffSites, host] }));
    if (msg.action === "off") return patch(() => ({ hoverDownload: false }));
    if (msg.action === "daylight") return globalThis.PBSaveToDaylight ? PBSaveToDaylight(tab, msg.src, null, frameId) : null;
    return run(tab.id, frameId, { action: msg.action, at: msg.at, selection: msg.selection || null });
  }

  // The shortcut: the frame whose hover control saw the pointer last, else the top frame.
  async function onCommand(cmd, tab) {
    if (cmd !== "save-media") return;
    const t = tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (!t) return;
    const seen = await chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, func: () => { const p = globalThis.PBHover && PBHover.lastPoint(); return p ? p.at : 0; } }).catch(() => []);
    const best = seen.filter((r) => r && r.result).sort((a, b) => b.result - a.result)[0];
    try { await run(t.id, best ? best.frameId : 0, { action: "download" }); }
    catch (e) { console.warn("[cmmns] the shortcut could not read this page", e); }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== "pb-hover-action" || !sender.tab) return false;
    onAction(msg, sender).then(() => sendResponse({ ok: true }), (e) => sendResponse({ error: e.message }));
    return true;
  });
  if (chrome.commands) chrome.commands.onCommand.addListener((cmd, tab) => { onCommand(cmd, tab); });
  chrome.runtime.onInstalled.addListener(sync);
  if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(sync);
  if (chrome.permissions && chrome.permissions.onAdded) chrome.permissions.onAdded.addListener(sync);
  if (chrome.permissions && chrome.permissions.onRemoved) chrome.permissions.onRemoved.addListener(sync);
  chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[PB.SETTINGS_KEY]) sync(); });

  return Object.freeze({ sync, run, onCommand });
})();
