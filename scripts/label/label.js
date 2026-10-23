// The blind labelling page (label.html). A classic script so it runs from a file:// address with
// no server. It writes dc-label/1 rows (scripts/label/format.mjs) to this browser's storage and
// exports them as a file. It never reads the lens's verdict and never sends anything.
// The sets below must match format.mjs; tests/label.page.test.js checks that they do.
(function () {
  "use strict";
  var FORMAT = "dc-label/1";
  var CAMPAIGN = ["paid-disclosed", "paid-undisclosed", "organic", "unsure"];
  var EVIDENCE = ["agency-case-study", "platform-notice", "court-or-regulator", "company-statement"];
  var FAMILIES = ["shape", "bios", "joins", "topic", "quotes", "overlap"];
  var FAMILY_TEXT = {
    shape: "Engagement shape unusual for an account this size",
    bios: "Repeated bio templates or stock personas",
    joins: "Many amplifiers joined in the same window",
    topic: "Amplifiers whose usual topics do not match the post",
    quotes: "Unlabelled quotes sharing a template with labelled ones",
    overlap: "The same amplifiers on other launches",
  };
  var SEEN = ["yes", "no", "cannot-tell"];
  var STRATA = {
    platform: ["x", "reddit", "youtube", "instagram", "tiktok", "bluesky", "threads", "facebook", "linkedin"],
    audience: ["under-10k", "10k-100k", "100k-1m", "1m-plus"],
    topic: ["tech", "crypto", "entertainment", "politics", "sport", "other"],
    language: null,
    region: null,
  };
  var CASE_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
  var state = { labeller: "", cases: [], at: 0, rows: {} };
  var $ = function (id) { return document.getElementById(id); };

  function seeded(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return function () { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return h / 4294967296; };
  }

  function shuffle(list, seed) {
    var next = seeded(seed), out = list.slice();
    for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(next() * (i + 1)); var t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  }

  function store() {
    try { localStorage.setItem("dc-label:" + state.labeller, JSON.stringify(state.rows)); } catch (e) { status("Could not save in this browser: " + e.message); }
  }

  function restore() {
    try { state.rows = JSON.parse(localStorage.getItem("dc-label:" + state.labeller) || "{}"); } catch (e) { state.rows = {}; }
  }

  function status(text) { $("status").textContent = text; }

  function radios(name, values, into) {
    into.textContent = "";
    values.forEach(function (v) {
      var l = document.createElement("label"), i = document.createElement("input");
      i.type = "radio"; i.name = name; i.value = v; i.required = true;
      l.appendChild(i); l.appendChild(document.createTextNode(" " + v)); into.appendChild(l);
    });
  }

  function build() {
    radios("campaign", CAMPAIGN, $("campaign"));
    EVIDENCE.forEach(function (v) { var o = document.createElement("option"); o.value = o.textContent = v; $("evidence").appendChild(o); });
    FAMILIES.forEach(function (f) {
      var t = document.createElement("span"), d = document.createElement("div");
      t.textContent = FAMILY_TEXT[f]; radios("fam-" + f, SEEN, d);
      $("families").appendChild(t); $("families").appendChild(d);
    });
    Object.keys(STRATA).forEach(function (k) {
      var t = document.createElement("span"), el;
      t.textContent = k;
      if (STRATA[k]) { el = document.createElement("select"); STRATA[k].forEach(function (v) { var o = document.createElement("option"); o.value = o.textContent = v; el.appendChild(o); }); }
      else { el = document.createElement("input"); el.type = "text"; el.size = 8; el.placeholder = k === "language" ? "en" : "US or unstated"; }
      el.required = true; el.id = "s-" + k; $("strata").appendChild(t); $("strata").appendChild(el);
    });
    $("campaign").addEventListener("change", function () { $("evidenceRow").hidden = picked("campaign") !== "paid-undisclosed"; });
  }

  function picked(name) { var el = document.querySelector("input[name='" + name + "']:checked"); return el ? el.value : null; }

  function setPicked(name, value) {
    var els = document.querySelectorAll("input[name='" + name + "']");
    for (var i = 0; i < els.length; i++) els[i].checked = els[i].value === value;
  }

  function show() {
    var c = state.cases[state.at];
    if (!c) { $("form").hidden = true; status("All " + state.cases.length + " cases saved. Export the labels file and send it to the coordinator."); return; }
    $("form").hidden = false;
    $("title").textContent = "Case " + (state.at + 1) + " of " + state.cases.length + " (" + c.case + ")";
    $("open").href = c.open;
    var r = state.rows[c.case] || { families: {}, strata: {} };
    setPicked("campaign", r.campaign || null);
    $("evidenceRow").hidden = r.campaign !== "paid-undisclosed";
    if (r.evidence) $("evidence").value = r.evidence;
    FAMILIES.forEach(function (f) { setPicked("fam-" + f, r.families[f] || null); });
    Object.keys(STRATA).forEach(function (k) { if (r.strata[k]) $("s-" + k).value = r.strata[k]; });
    status(Object.keys(state.rows).length + " of " + state.cases.length + " saved");
  }

  function read(caseId) {
    var row = { format: FORMAT, kind: "label", case: caseId, labeller: state.labeller, campaign: picked("campaign"), families: {}, strata: {} };
    if (row.campaign === "paid-undisclosed") row.evidence = $("evidence").value;
    FAMILIES.forEach(function (f) { row.families[f] = picked("fam-" + f); });
    Object.keys(STRATA).forEach(function (k) { row.strata[k] = $("s-" + k).value.trim(); });
    row.strata.language = row.strata.language.toLowerCase();
    row.strata.region = row.strata.region === "unstated" ? "unstated" : row.strata.region.toUpperCase();
    return row;
  }

  function load(text) {
    var list = JSON.parse(text);
    if (!Array.isArray(list)) throw new Error("the case list must be a JSON array");
    list.forEach(function (c) {
      if (!CASE_ID.test(c.case || "")) throw new Error("bad case id " + c.case);
      if (!/^https:\/\//.test(c.open || "")) throw new Error("case " + c.case + " needs an https link");
    });
    state.cases = shuffle(list, state.labeller);
    restore();
    state.at = 0;
    while (state.cases[state.at] && state.rows[state.cases[state.at].case]) state.at++;
    $("export").hidden = false;
    show();
  }

  function exportFile() {
    var lines = state.cases.map(function (c) { return state.rows[c.case]; }).filter(Boolean).map(function (r) { return JSON.stringify(r); });
    var blob = new Blob([lines.join("\n") + "\n"], { type: "application/x-ndjson" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "labels-" + state.labeller + ".jsonl";
    document.body.appendChild(a); a.click(); a.remove();
  }

  build();
  $("cases").addEventListener("change", function (e) {
    state.labeller = $("labeller").value.trim();
    if (!/^L[0-9]{1,2}$/.test(state.labeller)) { status("Enter your labeller id first, such as L1."); e.target.value = ""; return; }
    var f = e.target.files[0];
    if (!f) return;
    f.text().then(load).catch(function (err) { status("Case list not loaded: " + err.message); });
  });
  $("form").addEventListener("submit", function (e) {
    e.preventDefault();
    var c = state.cases[state.at];
    state.rows[c.case] = read(c.case);
    store(); state.at++; show();
  });
  $("back").addEventListener("click", function () { if (state.at > 0) { state.at--; show(); } });
  $("export").addEventListener("click", exportFile);
})();
