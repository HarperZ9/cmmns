// The options page's downloads section: the save folder, the Download button on X and Reddit posts,
// whether the browser asks where to save each file, and the post's words saved with it.
// quick-inline.js, quick-save.js and quick-save-bg.js read these.
(async () => {
  "use strict";
  const { switchRow, el } = PBPages;
  await PBSettings.ready;
  const save = (patch) => PBSettings.save(patch).catch((e) => console.error("[daylight-commons] could not save settings", e));
  const s = PBSettings.get();
  // The save folder, inside Downloads; each site gets its own folder in it.
  const label = el("label", { class: "switch" }), text = el("span", {}, "Folder inside Downloads");
  text.append(el("span", { class: "hint" }, "Files go here, one folder per site (Daylight/x.com, Daylight/reddit). Empty saves straight into Downloads."));
  const input = el("input", { type: "text", spellcheck: "false" });
  input.value = s.mediaFolder;
  input.addEventListener("change", () => save({ mediaFolder: input.value }).then((n) => { if (n) input.value = n.mediaFolder; }));
  label.append(text, input);
  document.getElementById("downloads").append(label,
    switchRow("Download button on X and Reddit posts", "On by default. One click saves every picture and video in the post.", s.mediaButtons, (on) => save({ mediaButtons: on })),
    switchRow("Always ask where to save", "Off by default: files go straight to the folder above.", s.mediaAskWhere, (on) => save({ mediaAskWhere: on })),
    switchRow("Save the post's words beside each file", "On by default: a .md file with the same name holds the post's text, author, time, alt text and links.", s.mediaSidecar, (on) => save({ mediaSidecar: on })),
    switchRow("Write the description into the file", "On by default, for JPEG, PNG, WebP, GIF and MP4. The picture and sound are not changed.", s.mediaEmbed, (on) => save({ mediaEmbed: on })),
    switchRow("Also save a .json file for tools", "Off by default.", s.mediaSidecarJson, (on) => save({ mediaSidecarJson: on })));
})().catch((e) => console.error("[daylight-commons] download options failed", e));
