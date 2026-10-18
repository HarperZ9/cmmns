// Builds a sourced ownership table from Wikidata: news outlets and broadcasters (P31 = news
// media, newspaper, TV channel, website) with an official website (P856) and an owner (P127),
// each row linking back to its Wikidata item. Run it by hand, review the diff, and replace the
// `seed` rows in src/core/owners.js. Radar itself never calls Wikidata from the browser.
//   node scripts/owners-build.mjs > project-docs/evidence/owners-wikidata.json
// This is a network download: run only with the author's approval.
const QUERY = `
SELECT ?item ?itemLabel ?site ?owner ?ownerLabel WHERE {
  VALUES ?type { wd:Q11032 wd:Q1110794 wd:Q1616075 wd:Q17232649 wd:Q1153191 }
  ?item wdt:P31 ?type; wdt:P856 ?site; wdt:P127 ?owner.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,de,es". }
} LIMIT 5000`;

const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(QUERY);
const res = await fetch(url, { headers: { "User-Agent": "Radar ownership table builder (local, manual run)" } });
if (!res.ok) { console.error("Wikidata query failed:", res.status, await res.text()); process.exit(1); }
const rows = (await res.json()).results.bindings.map((b) => ({
  name: b.itemLabel.value,
  domain: new URL(b.site.value).hostname.replace(/^www\./, ""),
  owner: b.ownerLabel.value,
  source: b.item.value,
  ownerSource: b.owner.value,
}));
console.log(JSON.stringify({ built: new Date().toISOString(), rows }, null, 1));
