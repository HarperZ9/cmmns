// The options page's downloads section: the save folder, the hover Download control and where it
// shows, the Download button on X and Reddit posts, whether the browser asks where to save each file,
// and the post's words saved with it. quick-hover*.js, quick-inline.js and quick-save*.js read these.
(async () => {
  "use strict";
  const { switchRow, el } = PBPages;
  await PBSettings.ready;
  const save = (patch) => PBSettings.save(patch).catch((e) => console.error("[daylight-commons] could not save settings", e));
  const s = PBSettings.get(), EVERYWHERE = { origins: ["https://*/*"] };
  // The save folder, inside Downloads; each site gets its own folder in it.
  const label = el("label", { class: "switch" }), text = el("span", {}, "Folder inside Downloads");
  text.append(el("span", { class: "hint" }, "Files go here, one folder per site (Daylight/x, Daylight/reddit). Left empty, it goes back to Daylight."));
  const input = el("input", { type: "text", spellcheck: "false" });
  input.value = s.mediaFolder;
  input.addEventListener("change", () => save({ mediaFolder: input.value }).then((n) => { if (n) input.value = n.mediaFolder; }));
  label.append(text, input);
  // "Every site" needs the browser's permission for all https sites; asked here, on this click.
  const granted = await chrome.permissions.contains(EVERYWHERE).catch(() => false);
  const everywhere = switchRow("Show it on every site", "Needs your browser's permission to read pictures on any https site, asked when you turn this on. Without it, the control shows on the sites Daylight Commons already reads, and Alt+Shift+D works everywhere.",
    s.hoverEverywhere && granted, (on, box) => {
      if (!on) { save({ hoverEverywhere: false }); return; }
      chrome.permissions.request(EVERYWHERE).then((ok) => { box.checked = ok; save({ hoverEverywhere: ok }); }, () => { box.checked = false; });
    });
  const offList = el("ul", { class: "plain" });
  function sites() {
    const hosts = PBSettings.get().hoverOffSites;
    offList.replaceChildren(...(hosts.length ? hosts.map((h) => {
      const li = el("li", {}, h + " "), b = el("button", { type: "button", class: "btn" }, "Show it again");
      b.addEventListener("click", () => save({ hoverOffSites: PBSettings.get().hoverOffSites.filter((x) => x !== h) }));
      li.append(b);
      return li;
    }) : [el("li", { class: "hint" }, "No site is left out.")]));
  }
  PBSettings.onChange(sites);
  sites();
  document.getElementById("downloads").append(label,
    switchRow("Save straight into Downloads", "Off by default. On, files go into Downloads itself, with no folder for Daylight or for each site.", s.mediaToRoot, (on) => save({ mediaToRoot: on })),
    switchRow("Download control on pictures and videos", "On by default. Rest the pointer on a picture, GIF or video for a moment and a Download button shows in its corner, even where the site blocks right-click.", s.hoverDownload, (on) => save({ hoverDownload: on })),
    everywhere, el("p", { class: "hint" }, "Sites where the control never shows:"), offList,
    switchRow("Download button on X and Reddit posts", "On by default. One click saves every picture and video in the post.", s.mediaButtons, (on) => save({ mediaButtons: on })),
    switchRow("Always ask where to save", "Off by default: files go straight to the folder above.", s.mediaAskWhere, (on) => save({ mediaAskWhere: on })),
    switchRow("Save the post's words beside each file", "On by default: a .md file with the same name holds the post's text, author, time, alt text and links.", s.mediaSidecar, (on) => save({ mediaSidecar: on })),
    switchRow("Write the description into the file", "On by default, for JPEG, PNG, WebP, GIF and MP4. The picture and sound are not changed.", s.mediaEmbed, (on) => save({ mediaEmbed: on })),
    switchRow("Also save a .json file for tools", "Off by default.", s.mediaSidecarJson, (on) => save({ mediaSidecarJson: on })));
})().catch((e) => console.error("[daylight-commons] download options failed", e));
