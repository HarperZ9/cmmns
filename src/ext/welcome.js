// First-run page: opens once on install. The user picks the sites and starts Daylight Commons with one click.
(async () => {
  "use strict";
  const { el, aperture, switchRow, sites } = PBPages;
  const $ = (id) => document.getElementById(id);
  await PBSettings.ready;
  $("art").append(aperture(true));
  const chosen = { ...PBSettings.get().sites };
  for (const [id, name] of sites()) {
    $("sites").append(switchRow(name, null, chosen[id] !== false, (on) => { chosen[id] = on; }));
  }

  // Honest count: how many detectors have a measured precision today.
  const detectors = PB.FAMILIES.filter((f) => f.kind === "detector");
  const measured = detectors.filter((f) => PB.measuredLine(f.id).measured).length;
  $("measured").textContent = measured
    ? `Each sign shows its measured precision. Today ${measured} of ${detectors.length} detectors have one; the rest say "not measured yet".`
    : `Each sign shows its measured precision once it has one. Today every detector is still waiting for its first measurement.`;

  $("start").addEventListener("click", async () => {
    const on = sites().filter(([id]) => chosen[id] !== false);
    try {
      // Firefox asks the user for site access here; Chrome granted it at install and says yes.
      if (chrome.permissions && on.length) await chrome.permissions.request({ origins: on.flatMap(([, , o]) => o) });
    } catch (e) { console.error("[daylight-commons] site access request failed", e); }
    await PBSettings.save({ sites: chosen, paused: false, onboarded: true });
    $("start").textContent = "Daylight Commons is on";
    $("start").disabled = true;
    $("done").replaceChildren(el("p", { class: "done" }, on.length
      ? `Daylight Commons is on for ${on.map(([, n]) => n).join(", ")}. Open any post with replies and rest the pointer on a reply.`
      : "Every site is switched off. Turn one on in Daylight Commons' options when you want it."));
  });
})().catch((e) => console.error("[daylight-commons] first-run page failed", e));
