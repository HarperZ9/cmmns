// The options page's downloads section: the Download button on X and Reddit posts, and whether the
// browser asks where to save each file. quick-inline.js and quick-save-bg.js read both.
(async () => {
  "use strict";
  const { switchRow } = PBPages;
  await PBSettings.ready;
  const save = (patch) => PBSettings.save(patch).catch((e) => console.error("[daylight-commons] could not save settings", e));
  const s = PBSettings.get();
  document.getElementById("downloads").append(
    switchRow("Download button on X and Reddit posts", "On by default. One click saves every picture and video in the post.", s.mediaButtons, (on) => save({ mediaButtons: on })),
    switchRow("Always ask where to save", "Off by default: files go straight to your Downloads folder.", s.mediaAskWhere, (on) => save({ mediaAskWhere: on })));
})().catch((e) => console.error("[daylight-commons] download options failed", e));
