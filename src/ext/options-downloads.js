// The options page's downloads section: the save folder, the hover Download control and where it
// shows, the Download button on X and Reddit posts, whether the browser asks where to save each file,
// and the post's words saved with it. quick-hover*.js, quick-inline.js and quick-save*.js read these.
(async () => {
  "use strict";
  const { switchRow, el } = PBPages;
  await PBSettings.ready;
  const save = (patch) => PBSettings.save(patch).catch((e) => console.error("[cmmns] could not save settings", e));
  const s = PBSettings.get(), EVERYWHERE = { origins: ["https://*/*"] };
  // The save folder, inside Downloads; each site gets its own folder in it.
  const label = el("label", { class: "switch" }), text = el("span", {}, "Folder inside Downloads");
  text.append(el("span", { class: "hint" }, "Files go here, one folder per site (CMMNS/x, CMMNS/reddit). Left empty, it goes back to CMMNS. Installs from before 3.9.0 keep their Daylight folder."));
  const input = el("input", { type: "text", spellcheck: "false" });
  input.value = s.mediaFolder;
  input.addEventListener("change", () => save({ mediaFolder: input.value }).then((n) => { if (n) input.value = n.mediaFolder; }));
  label.append(text, input);
  // "Every site" needs the browser's permission for all https sites; asked here, on this click.
  const granted = await chrome.permissions.contains(EVERYWHERE).catch(() => false);
  const everywhere = switchRow("Show it on every site", "Needs your browser's permission to read pictures on any https site, asked when you turn this on. Without it, the control shows on the sites CMMNS already reads, and Alt+Shift+D works everywhere.",
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
  // How many comments a save opens up to; 0 keeps only those the page shows.
  const capLabel = el("label", { class: "switch" }), capText = el("span", {}, "Comments to open up to");
  capText.append(el("span", { class: "hint" }, "200 by default, at most 5000. 0 saves only the comments the page already shows."));
  const cap = el("input", { type: "number", min: String(PB.RETENTION.threadCap.min), max: String(PB.RETENTION.threadCap.max) });
  cap.value = s.threadCap;
  cap.addEventListener("change", () => save({ threadCap: cap.value }).then((n) => { if (n) cap.value = n.threadCap; }));
  capLabel.append(capText, cap);
  document.getElementById("downloads").append(label,
    switchRow("Save straight into Downloads", "Off by default. On, files go into Downloads itself, with no folder for CMMNS or for each site.", s.mediaToRoot, (on) => save({ mediaToRoot: on })),
    switchRow("Download control on pictures and videos", "On by default. Rest the pointer on a picture, GIF or video for a moment and a Download button shows in its corner, even where the site blocks right-click.", s.hoverDownload, (on) => save({ hoverDownload: on })),
    everywhere, el("p", { class: "hint" }, "Sites where the control never shows:"), offList,
    switchRow("Download button on X and Reddit posts", "On by default. One click saves every picture and video in the post.", s.mediaButtons, (on) => save({ mediaButtons: on })),
    switchRow("Always ask where to save", "Off by default: files go straight to the folder above.", s.mediaAskWhere, (on) => save({ mediaAskWhere: on })),
    switchRow("Save the post's words beside each file", "On by default: a .md file with the same name holds the post's text, author, time, alt text and links.", s.mediaSidecar, (on) => save({ mediaSidecar: on })),
    switchRow("Write the description into the file", "On by default, for JPEG, PNG, WebP, GIF and MP4. The picture and sound are not changed.", s.mediaEmbed, (on) => save({ mediaEmbed: on })),
    switchRow("Also save a .json file for tools", "Off by default.", s.mediaSidecarJson, (on) => save({ mediaSidecarJson: on })),
    switchRow("Save the post's comments with it", "On by default: every comment the page shows, as a .thread.json file beside the note, with how many the site counted and how many were saved.", s.threadCapture, (on) => save({ threadCapture: on })),
    switchRow("Open more comments while saving", "On by default, on the post's own page: one \"more replies\" at a time, a second or two apart, with Stop on the notice. Source protection holds it off.", s.threadExpand, (on) => save({ threadExpand: on })),
    capLabel);
})().catch((e) => console.error("[cmmns] download options failed", e));
