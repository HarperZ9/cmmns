// Shared by CMMNS' first-run and options pages: the aperture drawing, switch rows, and the sites
// this build runs on (read from the manifest, so a site added later shows up by itself).
(() => {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, text) => {
    const e = tag.startsWith("svg:") ? document.createElementNS(NS, tag.slice(4)) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  };

  // The aperture: a luminous orb inside fine concentric line-work on the void, in the bone and void
  // of the author's site. Ring spacing and weight follow a fixed sequence, so the drawing is the same
  // every time. `mark` adds the one lit point on the outer ring.
  function aperture(mark) {
    const s = el("svg:svg", { viewBox: "0 0 128 128", "aria-hidden": "true" });
    const defs = el("svg:defs"), g = el("svg:radialGradient", { id: "pb-orb", cx: "0.5", cy: "0.46", r: "0.5" });
    for (const [o, c, a] of [["0", "#fff6e6", 1], ["0.45", "#ece5d6", 1], ["0.8", "#b8b0a0", 0.5], ["1", "#b8b0a0", 0]]) g.append(el("svg:stop", { offset: o, "stop-color": c, "stop-opacity": a }));
    defs.append(g); s.append(defs);
    s.append(el("svg:circle", { cx: 64, cy: 64, r: 62, fill: "#060608", stroke: "#6f6a61", "stroke-opacity": 0.9, "stroke-width": 1 }));
    for (let i = 0; i < 22; i++) {
      const r = 20 + i * 1.95 + (i % 3) * 0.4;
      s.append(el("svg:circle", { cx: 64, cy: 64, r: r.toFixed(2), fill: "none", stroke: "#ece5d6", "stroke-width": i % 5 === 0 ? 0.9 : 0.35, "stroke-opacity": (0.18 + 0.5 * Math.sin((i / 21) * Math.PI)).toFixed(2) }));
    }
    s.append(el("svg:circle", { cx: 64, cy: 64, r: 30, fill: "url(#pb-orb)" }), el("svg:circle", { cx: 64, cy: 64, r: 11, fill: "#fff6e6" }));
    if (mark) s.append(el("svg:circle", { cx: 99.4, cy: 28.6, r: 5, fill: "#fff6e6", stroke: "#060608", "stroke-width": 2.5 }));
    return s;
  }

  // A labelled switch: <label class="switch"><span>name<span class="hint">hint</span></span><input role="switch"></label>
  function switchRow(name, hint, checked, onChange) {
    const label = el("label", { class: "switch" });
    const text = el("span", {}, name);
    if (hint) text.append(el("span", { class: "hint" }, hint));
    const input = el("input", { type: "checkbox", role: "switch" });
    input.checked = !!checked;
    input.addEventListener("change", () => onChange(input.checked, input));
    label.append(text, input);
    return label;
  }

  const ORIGINS = { x: ["https://x.com/*", "https://twitter.com/*"], youtube: ["https://www.youtube.com/*"], reddit: ["https://www.reddit.com/*"], facebook: ["https://www.facebook.com/*"], instagram: ["https://www.instagram.com/*"], bluesky: ["https://bsky.app/*"],
    threads: ["https://www.threads.com/*", "https://www.threads.net/*"], tiktok: ["https://www.tiktok.com/*"] };
  // [[id, name, origins]] for the sites this build has host access for.
  function sites() {
    const hosts = (chrome.runtime.getManifest().host_permissions || []);
    // Mastodon has no fixed host: it is listed when the build can ask for servers one by one.
    const servers = (chrome.runtime.getManifest().optional_host_permissions || []).length > 0;
    return PB.SITES.map(([id, name]) => [id, name, ORIGINS[id] || []]).filter(([id, , o]) => o.some((x) => hosts.includes(x)) || (id === "mastodon" && servers));
  }

  globalThis.PBPages = Object.freeze({ el, aperture, switchRow, sites });
})();
