// Ad and tracker blocking with the browser's own declarativeNetRequest engine: the EasyList and
// EasyPrivacy rulesets compiled by scripts/adblock-build.mjs (src/ext/rules/), switched on and off
// with the "adblock" setting, which is off until the user turns it on. Sites in "adblockAllow" get
// one dynamic allowAllRequests rule above every list rule, so nothing on those pages is blocked.
// The browser matches requests itself; Daylight Commons never sees which requests were blocked.
(() => {
  "use strict";
  const KEY = PB.SETTINGS_KEY, RULESETS = ["easylist", "easyprivacy"], ALLOW_ID = 1, ALLOW_PRIORITY = 100;
  const dnr = chrome.declarativeNetRequest;
  if (!dnr) return;

  async function settings() { return PB.normalizeSettings((await chrome.storage.local.get(KEY))[KEY]); }

  // The dynamic rule for the allowed sites, or none when the list is empty.
  const allowRule = (hosts) => ({ id: ALLOW_ID, priority: ALLOW_PRIORITY, action: { type: "allowAllRequests" },
    condition: { requestDomains: hosts, resourceTypes: ["main_frame", "sub_frame"] } });

  async function apply(s) {
    const on = !s.paused && s.adblock;
    const enabled = new Set(await dnr.getEnabledRulesets());
    const enable = on ? RULESETS.filter((r) => !enabled.has(r)) : [], disable = on ? [] : RULESETS.filter((r) => enabled.has(r));
    if (enable.length || disable.length) await dnr.updateEnabledRulesets({ enableRulesetIds: enable, disableRulesetIds: disable });
    const hosts = s.adblockAllow || [];
    await dnr.updateDynamicRules({ removeRuleIds: [ALLOW_ID], addRules: hosts.length ? [allowRule(hosts)] : [] });
  }
  const sync = () => settings().then(apply).catch((e) => console.error("[daylight-commons] ad blocking could not update", e));

  chrome.runtime.onInstalled.addListener(sync);
  if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(sync);
  chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[KEY]) sync(); });

  // The popup asks for the state on its tab's site: { on, allowed, site, rules }.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== "pb-adblock-state") return false;
    (async () => {
      const s = await settings(), site = PB.adblockSite(msg.url);
      const enabled = await dnr.getEnabledRulesets();
      sendResponse({ on: !s.paused && s.adblock, enabled, site, allowed: !!site && PB.adblockAllowed(s.adblockAllow, site) });
    })().catch((e) => sendResponse({ error: String(e) }));
    return true;
  });
})();
