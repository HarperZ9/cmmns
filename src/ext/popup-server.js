// Toolbar popup, on a page Daylight Commons does not run on: if the page is a Mastodon server, offer to turn
// Daylight Commons on for that server. The check runs only when the user opens the popup (the browser's
// activeTab grant) and reads two things: whether the Mastodon web app's root element is there, and
// the version and domain from its initial state. Nothing else on the page is read, no token is
// touched, and nothing is sent anywhere. Turning Daylight Commons on asks the browser for access to that one
// server; the browser shows its own prompt.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);

  // Runs in the page. Returns only the root flag, version and domain.
  function probe() {
    const root = !!document.getElementById("mastodon");
    let version = null, domain = null;
    try {
      const s = document.getElementById("initial-state");
      const m = s ? JSON.parse(s.textContent).meta || {} : {};
      version = typeof m.version === "string" ? m.version : null;
      domain = typeof m.domain === "string" ? m.domain : null;
    } catch (_) { /* not Mastodon */ }
    return { root, version, domain };
  }

  async function offer(tab) {
    const origin = tab && tab.url ? PB.instanceOrigin(tab.url) : null;
    if (!origin || !chrome.scripting) return;
    let found = null;
    try {
      const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: probe });
      found = PB.mastodonProbe(res && res.result);
    } catch (_) { return; }   // a page the browser does not let extensions read
    if (!found) return;
    const host = new URL(tab.url).hostname.toLowerCase();
    $("server").hidden = false;
    $("server-text").textContent = `This looks like a Mastodon server (${host}, Mastodon ${found.version.split("+")[0]}). ` +
      "Daylight Commons can read the posts this server shows you here. Your browser asks you to allow it for this one server.";
    const already = await chrome.permissions.contains({ origins: [origin] });
    $("server-on").addEventListener("click", async () => {
      if (already) {
        const r = await chrome.runtime.sendMessage({ type: "pb-instance-add", host, tabId: tab.id });
        $("server-text").textContent = r && r.ok ? "Daylight Commons is on for this server. Reload the page to see it." : "Daylight Commons could not turn on here.";
        return;
      }
      // The request must come straight from the click, with no wait before it. The pending note is
      // written alongside: the browser's prompt can close this popup before the answer comes back,
      // and the background worker finishes the job from the note (src/ext/instances.js).
      chrome.storage.local.set({ "pb.instances.pending": { host, tabId: tab.id, at: Date.now() } }).catch(() => {});
      const ok = await chrome.permissions.request({ origins: [origin] }).catch(() => false);
      $("server-text").textContent = ok ? "Daylight Commons is on for this server. Reload the page to see it." : "Not turned on. Nothing was changed.";
      $("server-on").disabled = true;
    });
  }

  globalThis.PBServer = Object.freeze({ offer });
})();
