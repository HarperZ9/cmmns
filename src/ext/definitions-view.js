// Element tables in the launch campaign window (project-docs/DEFINITION-CATALOGUE.md). For each
// jurisdiction that applies, every published definition the catalogue holds is shown element by
// element: matched, not matched or not observable, with the signals behind each match. All
// applicable jurisdictions are shown in a fixed order, never the most damning one alone. Each table
// links to its catalogue entry at the version used and to the challenge template. Local only: the
// catalogue ships inside the extension (src/core/catalogue-data.js) and nothing is fetched.
(() => {
  "use strict";
  const STATUS_WORD = { "matched": "matched", "not-matched": "not matched", "not-observable": "not observable" };
  const ALL_NOTE = "Every jurisdiction the catalogue covers is shown, in a fixed order, since your own is unknown here.";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const link = (label, href) => { const a = el("a", "pb-link", label); a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; return a; };

  // c: the campaign lens with its actor (actorOf) and launch flag. opts.actor and opts.audience are
  // jurisdiction codes when public or set by the user; without them every jurisdiction is shown.
  function model(c, { actor = null, audience = null } = {}) {
    if (!c || !PB.elementTables || !PB.CATALOGUE_ENTRIES) return null;
    const finding = PB.signalsFromCampaign(c, { launch: c.launch !== false, actor: c.actor || null });
    const J = PB.applicableJurisdictions({ platform: c.platform || "x", actor, audience });
    const narrowed = !!(actor || audience);
    const tables = PB.elementTables(PB.CATALOGUE_ENTRIES, finding, PB.SIGNAL_REGISTRY, { jurisdictions: narrowed ? J.jurisdictions : null });
    const why = new Map(J.jurisdictions.map((j) => [j.code, j.why]));
    const groups = [];
    for (const t of tables) {
      let g = groups.find((x) => x.code === t.jurisdiction.code);
      if (!g) { g = { code: t.jurisdiction.code, name: t.jurisdiction.name, why: why.get(t.jurisdiction.code) || null, tables: [] }; groups.push(g); }
      g.tables.push({ ...t, url: PB.entryUrl(t.entry), challengeUrl: PB.challengeUrl(t.catalogue) });
    }
    return { groups, notes: [...J.notes, ...(narrowed ? [] : [ALL_NOTE])], frame: PB.DEFINITION_FRAME, legal: PB.LEGAL_NOTE };
  }

  const evidenceOf = (r) => (r.evidence.length ? r.evidence.map((e) => e.signal).join(", ") : r.status === "not-observable" ? "cannot be seen from the page" : "none in what the page loaded");

  // Rows for the account card (src/ext/card.js, src/ext/pop.js row format).
  function rows(m) {
    if (!m || !m.groups.length) return [];
    const out = m.notes.map((n) => ["", n]);
    for (const g of m.groups) {
      out.push([g.name, g.why || "Shown because the catalogue covers it."]);
      for (const t of g.tables) {
        out.push([t.role === "match" ? "Definition" : t.role === "comparison" ? "For comparison" : "Context", t.title], ["", { links: [[t.catalogue, t.url], ["Challenge", t.challengeUrl]] }]);
        for (const r of t.rows) out.push([`Element ${r.id}`, `${STATUS_WORD[r.status]}: ${r.label}`]);
        out.push(["Reading", t.summary], ["Read it as", t.dnp]);
      }
    }
    out.push(["", m.legal]);
    return out;
  }

  function table(t) {
    const box = el("div", "pb-def");
    const head = el("p", "pb-def-h");
    head.append(el("span", "pb-def-role", t.role === "match" ? "Definition" : t.role === "comparison" ? "For comparison" : "Context"), " ", el("span", null, t.title));
    const tb = el("table", "pb-def-t");
    const hr = el("tr");
    for (const h of ["Element", "Status", "Evidence"]) hr.append(el("th", null, h));
    tb.append(hr);
    for (const r of t.rows) {
      const tr = el("tr", `pb-def-${r.status}`);
      const lab = el("td"); lab.append(el("b", null, r.id), ` ${r.label}`);
      tr.append(lab, el("td", "pb-def-s", STATUS_WORD[r.status]), el("td", "pb-def-e", evidenceOf(r)));
      tb.append(tr);
    }
    const refs = el("p", "pb-foot");
    refs.append(link(t.catalogue, t.url), link("Challenge this entry", t.challengeUrl), link("Source", t.source.url));
    box.append(head, tb, el("p", "pb-foot", t.summary), el("p", "pb-foot", `Read it as: ${t.dnp}`), refs);
    return box;
  }

  // The window's section: one block per jurisdiction, each table under it.
  function section(parent, m) {
    if (!m || !m.groups.length) return;
    const s = el("div", "pb-defs");
    s.append(el("h4", "pb-sec-h", "Published definitions, element by element"));
    for (const n of m.notes) s.append(el("p", "pb-foot", n));
    for (const g of m.groups) {
      const d = el("details", "pb-def-j");
      const sum = el("summary", null, `${g.name}: ${g.tables.length} ${g.tables.length === 1 ? "definition" : "definitions"}`);
      d.append(sum);
      if (g.why) d.append(el("p", "pb-foot", g.why));
      for (const t of g.tables) d.append(table(t));
      s.append(d);
    }
    s.append(el("p", "pb-foot", m.legal));
    parent.append(s);
  }

  globalThis.PBDefinitionsView = Object.freeze({ model, rows, section, STATUS_WORD, ALL_NOTE });
})();
