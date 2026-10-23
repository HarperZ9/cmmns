// The research profile: the case as a dataset. JSON Lines tables, W3C PROV-O provenance for every
// capture (prov.jsonld), and MLCommons Croissant metadata (croissant.json) describing the files
// with their hashes. Text from captures is left out; hashes and addresses stay.
import { sha256 } from "./capture.js";

const TABLE_FIELDS = {
  sources: ["id", "kind", "url", "title", "author", "source_date", "accessed", "read_mode", "origin", "capture.sha256", "archive.url"],
  claims: ["id", "text", "source", "rung", "status", "proposed_by", "accepted_by", "retells", "corroborates", "self_sourced", "date"],
  events: ["id", "date", "text", "source", "key"],
  edges: ["id", "from", "to", "type", "source"],
  leads: ["id", "question", "record", "holder", "access", "decisive", "status"],
  absent: ["id", "what", "status", "custodian", "source"],
};

const pick = (row, path) => path.split(".").reduce((v, k) => (v && typeof v === "object" ? v[k] : undefined), row) ?? null;
export const tableRows = (data, name) => data[name].filter((r) => r.status !== "rejected").map((r) => Object.fromEntries(TABLE_FIELDS[name].map((f) => [f.replace(".", "_"), pick(r, f)])));

export function datasetFiles(data, ctx, redactor) {
  const files = {};
  for (const name of Object.keys(TABLE_FIELDS)) files[`${name}.jsonl`] = tableRows(data, name).map((r) => JSON.stringify(redactor.deep(r))).join("\n") + "\n";
  files["prov.jsonld"] = JSON.stringify(provDoc(data, ctx, redactor), null, 2) + "\n";
  files["croissant.json"] = JSON.stringify(croissant(data, ctx, files), null, 2) + "\n";
  return files;
}

function provDoc(data, ctx, redactor) {
  const graph = [{ "@id": "urn:daylight:tool", "@type": "prov:SoftwareAgent", "rdfs:label": ctx.tool }];
  for (const s of data.sources) {
    graph.push({ "@id": `urn:daylight:case:source:${s.id}`, "@type": "prov:Entity", "prov:atLocation": redactor.text(s.url || s.file || ""), "prov:wasGeneratedBy": `urn:daylight:case:capture:${s.id}`, "daylight:sha256": s.capture ? s.capture.sha256 : null, ...(s.archive && s.archive.url ? { "prov:alternateOf": s.archive.url } : {}) });
    graph.push({ "@id": `urn:daylight:case:capture:${s.id}`, "@type": "prov:Activity", "prov:startedAtTime": s.accessed, "prov:wasAssociatedWith": "urn:daylight:tool", "rdfs:comment": s.read_mode });
  }
  for (const c of data.claims.filter((x) => x.status !== "rejected")) graph.push({ "@id": `urn:daylight:case:claim:${c.id}`, "@type": "prov:Entity", "prov:wasDerivedFrom": c.source.split(",").map((x) => `urn:daylight:case:source:${x}`), ...(c.retells ? { "prov:wasRevisionOf": `urn:daylight:case:claim:${c.retells}` } : {}) });
  return { "@context": { prov: "http://www.w3.org/ns/prov#", rdfs: "http://www.w3.org/2000/01/rdf-schema#", daylight: "urn:daylight:" }, "@graph": graph };
}

function croissant(data, ctx, files) {
  const dist = Object.keys(files).filter((f) => f.endsWith(".jsonl")).sort().map((f) => ({ "@type": "cr:FileObject", "@id": f, name: f, contentUrl: f, encodingFormat: "application/jsonlines", sha256: sha256(Buffer.from(files[f], "utf8")) }));
  const recordSet = Object.entries(TABLE_FIELDS).map(([name, fields]) => ({ "@type": "cr:RecordSet", "@id": name, name, field: fields.map((f) => ({ "@type": "cr:Field", "@id": `${name}/${f.replace(".", "_")}`, name: f.replace(".", "_"), dataType: "sc:Text", source: { fileObject: { "@id": `${name}.jsonl` }, extract: { column: f.replace(".", "_") } } })) }));
  return {
    "@context": { "@vocab": "https://schema.org/", sc: "https://schema.org/", cr: "http://mlcommons.org/croissant/", dct: "http://purl.org/dc/terms/" },
    "@type": "sc:Dataset", conformsTo: "http://mlcommons.org/croissant/1.0", name: data.meta.name, description: `Case records exported by ${ctx.tool} on ${ctx.at}. Sources, claims with rungs, events, amplification edges, leads and absences. Capture text is not included; each source carries its sha256.`,
    license: "https://creativecommons.org/licenses/by/4.0/", datePublished: ctx.at.slice(0, 10), distribution: dist, recordSet,
  };
}
