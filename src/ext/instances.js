// Mastodon servers the user turned CMMNS on for, in the background. CMMNS has no access to any
// server until the user clicks "Turn on CMMNS here" in the toolbar popup on that server's page and
// the browser asks them to allow it (an optional host permission, one server at a time). Then this
// worker registers CMMNS' content scripts for that server alone. Removing the server in the
// options page, or revoking the permission in the browser, unregisters them.
(() => {
  "use strict";
  const KEY = "pb.instances.v1", PENDING = "pb.instances.pending";
  const idOf = (host) => "pb-masto-" + host.replace(/[^a-z0-9.-]/gi, "_");
  const hostOf = (origin) => { const m = /^https:\/\/([^/*]+)\/\*$/.exec(origin || ""); return m ? m[1].toLowerCase() : null; };
  const files = () => {
    const cs = chrome.runtime.getManifest().content_scripts.find((c) => (c.js || []).includes("content.js"));
    return { js: cs.js, css: cs.css || [] };
  };
  const list = () => chrome.storage.local.get(KEY).then((g) => g[KEY] || []);
  const save = (hosts) => chrome.storage.local.set({ [KEY]: [...new Set(hosts)].sort() });

  async function unregister(host) {
    const ids = [idOf(host), idOf(host) + "-sniff"];
    const have = await chrome.scripting.getRegisteredContentScripts({ ids });
    if (have.length) await chrome.scripting.unregisterContentScripts({ ids: have.map((s) => s.id) });
  }

  async function register(host) {
    const matches = [`https://${host}/*`], { js, css } = files();
    await unregister(host);
    await chrome.scripting.registerContentScripts([{ id: idOf(host), matches, js, css, runAt: "document_idle", persistAcrossSessions: true }]);
    // The page-context copier for the server's own responses. A browser without main-world
    // registration still gets badges, without join dates.
    try {
      await chrome.scripting.registerContentScripts([{ id: idOf(host) + "-sniff", matches, js: ["fedisniff.js"], runAt: "document_start",
        world: "MAIN", persistAcrossSessions: true }]);
    } catch (e) { console.warn("[cmmns] main-world script not available for", host, e); }
  }

  async function enable(host, tabId) {
    if (!(await chrome.permissions.contains({ origins: [`https://${host}/*`] }))) return { ok: false, error: "not allowed" };
    await register(host);
    await save([...(await list()), host]);
    if (tabId != null) {
      const { js, css } = files();
      await chrome.scripting.insertCSS({ target: { tabId }, files: css }).catch(() => {});
      await chrome.scripting.executeScript({ target: { tabId }, files: js }).catch((e) => console.warn("[cmmns] could not start on this tab", e));
    }
    return { ok: true };
  }

  async function disable(host) {
    await unregister(host);
    await save((await list()).filter((h) => h !== host));
    await chrome.permissions.remove({ origins: [`https://${host}/*`] }).catch(() => {});
    return { ok: true };
  }

  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!msg || !/^pb-instance-/.test(msg.type || "")) return false;
    const host = typeof msg.host === "string" ? msg.host.toLowerCase() : null;
    const job = msg.type === "pb-instance-add" && host ? enable(host, msg.tabId)
      : msg.type === "pb-instance-remove" && host ? disable(host)
      : msg.type === "pb-instance-list" ? list() : Promise.resolve(null);
    job.then(reply).catch((e) => { console.error("[cmmns] server setting failed", e); reply({ ok: false, error: String(e) }); });
    return true;
  });

  // The popup records the server it asked about before the browser's prompt opens, since the
  // prompt can close the popup; the grant then finishes here.
  chrome.permissions.onAdded.addListener(async (p) => {
    const { [PENDING]: pending } = await chrome.storage.local.get(PENDING);
    for (const host of (p.origins || []).map(hostOf).filter(Boolean)) {
      if (pending && pending.host === host && Date.now() - pending.at < 120000) {
        await chrome.storage.local.remove(PENDING);
        await enable(host, pending.tabId).catch((e) => console.error("[cmmns] could not turn on", host, e));
      }
    }
  });
  chrome.permissions.onRemoved.addListener(async (p) => {
    for (const host of (p.origins || []).map(hostOf).filter(Boolean)) {
      await unregister(host).catch(() => {});
      await save((await list()).filter((h) => h !== host));
    }
  });
  // Registrations can be lost across browser updates (Firefox does not keep them): restore them
  // for every server whose permission is still granted.
  const restore = async () => {
    for (const host of await list()) {
      if (await chrome.permissions.contains({ origins: [`https://${host}/*`] })) await register(host).catch((e) => console.error("[cmmns] restore failed", host, e));
    }
  };
  chrome.runtime.onStartup.addListener(restore);
  chrome.runtime.onInstalled.addListener(restore);
})();
