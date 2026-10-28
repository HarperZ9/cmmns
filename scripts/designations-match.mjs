// Matches outlet names in data/state-designations.json to official websites through Wikidata, and
// writes data/state-designations.domains.json. A match needs the Wikidata label or an alias to
// equal the designated name (ignoring case and punctuation), or one of its slash-separated forms
// ("Rossiya 24 / Russia 24"), and the item's country (P17) to be the designating document's
// country. Each match cites its Wikidata item, so a row carries two sources: the designation for
// the state link, and Wikidata for the domain.
//   node scripts/designations-match.mjs     (network download: run only with the author's approval)
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = { "User-Agent": "CMMNS designations matcher (local, manual run)" };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[’'".,()-]/g, " ").replace(/\s+/g, " ").trim();
const SAME_COUNTRY = { China: ["People's Republic of China", "China"], Russia: ["Russia"], Iran: ["Iran"], Belarus: ["Belarus"] };

async function get(url) {
  for (let a = 1; a <= 6; a++) {
    const res = await fetch(url, { headers: UA });
    if (res.ok) return res.json();
    await pause((Number(res.headers.get("retry-after")) || 5) * 1000 * a);
  }
  throw new Error("Wikidata request failed: " + url);
}

const rows = JSON.parse(readFileSync(join(root, "data/state-designations.json"), "utf8"));
const out = {};
for (const r of rows) {
  const names = r.outlet.split("/").map((s) => s.trim()).filter(Boolean);
  const found = [];
  for (const name of names) {
    const s = await get(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=7&search=${encodeURIComponent(name)}`);
    const exact = (s.search || []).filter((x) => norm(x.match && x.match.text) === norm(name));
    if (!exact.length) continue;
    const ents = (await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|labels&languages=en&ids=${exact.map((x) => x.id).join("|")}`)).entities;
    const countryIds = [...new Set(Object.values(ents).flatMap((e) => ((e.claims || {}).P17 || []).map((c) => c.mainsnak.datavalue && c.mainsnak.datavalue.value.id)).filter(Boolean))];
    const countries = countryIds.length ? (await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=en&ids=${countryIds.join("|")}`)).entities : {};
    for (const e of Object.values(ents)) {
      const c = ((e.claims || {}).P17 || []).map((x) => x.mainsnak.datavalue && countries[x.mainsnak.datavalue.value.id]).filter(Boolean).map((x) => x.labels.en && x.labels.en.value);
      if (!c.some((x) => (SAME_COUNTRY[r.state] || [r.state]).includes(x))) continue;
      for (const site of ((e.claims || {}).P856 || [])) {
        try {
          const domain = new URL(site.mainsnak.datavalue.value).hostname.replace(/^www\./, "").toLowerCase();
          found.push({ domain, item: `https://www.wikidata.org/entity/${e.id}`, label: e.labels.en ? e.labels.en.value : name });
        } catch { /* skip */ }
      }
    }
    await pause(400);
  }
  out[r.outlet] = [...new Map(found.map((f) => [f.domain, f])).values()];
  console.log(`${r.state} | ${r.outlet} -> ${out[r.outlet].map((f) => f.domain).join(", ") || "no exact match"}`);
}
writeFileSync(join(root, "data/state-designations.domains.json"), JSON.stringify(out, null, 1) + "\n");
