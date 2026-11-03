// YouTube "Download video", only in the unpacked and self-distributed builds: the store packages
// leave this file out (scripts/zip.mjs, tests/store-build.test.js), because store policy forbids
// extensions that download YouTube video. The extension itself never fetches the video. It copies
// the command for CMMNS' command line, `cmmns media fetch`, which runs a yt-dlp the
// user installed and writes the same daylight.sidecar/1 note beside the file.
globalThis.PBYtHandoff = globalThis.PBYtHandoff || (() => {
  "use strict";
  const quote = (s) => `"${String(s).replace(/["\\$`]/g, "")}"`;

  // stem: the name of a "Save video in full" bundle (yt-full.js), so the file lands beside it.
  async function copyCommand(stem = null) {
    const url = globalThis.PBYouTube ? PBYouTube.linkAtTime().replace(/&t=\d+s$/, "") : location.href;
    const cmd = `cmmns media fetch ${quote(url)}${typeof stem === "string" && stem ? ` --name ${quote(stem)}` : ""}`;
    try {
      await navigator.clipboard.writeText(cmd);
      PBQuickToast.show(`Copied: ${cmd}. Paste it in a terminal; it needs yt-dlp installed.`, { tone: "ok", stay: 9000 });
      return { ok: true, text: cmd };
    } catch (e) { PBQuickToast.show(`Not copied: ${e.message}`, { tone: "no" }); return { ok: false }; }
  }

  // The hover control's menu item for this (quick-hover.js shows it only when this file is here).
  const MENU = ["ytcli", "Download video with the command line"];

  return Object.freeze({ run: () => copyCommand(), runFor: (stem) => copyCommand(stem), MENU });
})();
