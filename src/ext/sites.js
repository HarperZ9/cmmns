// The review list for one site, opened from a site card. Everything comes from Radar's bundled
// tables through the background worker. Ratings are quoted as each fact-checker wrote them.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
  const domain = decodeURIComponent(location.hash.slice(1));
  const info = await chrome.runtime.sendMessage({ type: "pb-site-list", domain });
  const rec = info && info.record, f = (info && info.facts) || {};
  $("title").textContent = `${f.name || (info && info.owner && info.owner.name) || domain} (${domain})`;
  document.title = `Radar: ${domain}`;
  $("line").textContent = PB.recordLine(rec) || "No review in Radar's table lists this site as where a claim appeared.";
  for (const [h, v] of PB.siteInfoRows(info || { domain, state: [] }).filter(([h, v]) => h && typeof v === "string" && !["Fact-check record", "Review", "Does not prove", "Source"].includes(h))) $("facts").append(el("dt", h), el("dd", v));
  $("dnp").textContent = PB.SITE_RECORD_DOES_NOT_PROVE;
  for (const r of (rec && rec.reviews) || []) {
    const tr = el("tr"), a = el("a", new URL(r.url).hostname.replace(/^www\./, ""));
    a.href = r.url; a.target = "_blank"; a.rel = "noopener noreferrer";
    const link = el("td"); link.append(a);
    tr.append(el("td", r.date || "not given", "mono"), el("td", r.checker), el("td", `"${r.rating}"`), el("td", r.claim), link);
    $("reviews").append(tr);
  }
  if (rec && rec.n > rec.reviews.length) $("more").textContent = `The newest ${rec.reviews.length} of ${rec.n.toLocaleString("en")} are listed; the count covers all of them.`;
  $("credit").textContent = PB.SITE_SOURCES + " Reviews link to each fact-checker's own page.";
})().catch((e) => { console.error("[radar] site record page failed", e); document.getElementById("line").textContent = "Could not read Radar's tables: " + e.message; });
