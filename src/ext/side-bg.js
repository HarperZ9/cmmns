// The worker's side of the side panel: it knows whether a side panel is open (the panel keeps a port
// open) and tells the pages, so their post windows go to the panel and come back when it closes.
// Opening the panel is the popup's button (a click the browser requires).
globalThis.PBSideBg = (() => {
  "use strict";
  let ports = 0;

  async function tell() {
    const tabs = await chrome.tabs.query({}).catch(() => []);
    for (const t of tabs) chrome.tabs.sendMessage(t.id, { type: "pb-side", open: ports > 0 }).catch(() => {});
  }

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "pb-sidepanel") return;
    ports++; tell();
    port.onDisconnect.addListener(() => { ports = Math.max(0, ports - 1); tell(); });
  });
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== "pb-side-state") return false;
    sendResponse({ open: ports > 0 });
    return false;
  });
  // Chrome: the toolbar button keeps its menu; the panel opens from the menu's button.
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

  return Object.freeze({ isOpen: () => ports > 0 });
})();
