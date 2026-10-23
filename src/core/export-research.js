// The research and ML export profile: one JSON line per receipt with its lineage, a fixed split
// chosen by hash (so the same receipt always lands in the same split and a model can show it never
// trained on its test rows), Croissant metadata (https://mlcommons.org/croissant/, 1.0) and a
// datasheet stating who made the data, how, and its known biases.

import { sha256Hex } from "./receipt.js";

export const SPLITS = [["train", 80], ["dev", 10], ["test", 10]];

// The split for one receipt hash under a seed: the first 8 hex digits of SHA-256(seed|hash), mod 100.
export async function splitFor(seed, hash) {
  const n = parseInt((await sha256Hex(`${seed}|${hash}`)).slice(0, 8), 16) % 100;
  let edge = 0;
  for (const [name, share] of SPLITS) { edge += share; if (n < edge) return name; }
  return SPLITS[SPLITS.length - 1][0];
}

async function rowsWithSplits(ctx) {
  const out = [];
  for (const row of ctx.rows) {
    const r = row.receipt;
    out.push({ id: r.hash, split: await splitFor(ctx.seed, r.hash), kind: r.kind, subject: r.subject, subjectKind: r.subjectKind,
      observed: r.observed, source: r.source, url: r.url, at: r.at, labeller: r.labeller || null, stratum: r.stratum || null,
      catalogue: r.catalogue || null, doesNotProve: r.dnp,
      lineage: { seq: row.seq, link: row.link, root: ctx.chain.root, proof: row.proof, rawHash: (r.capture || {}).rawHash || null, method: (r.capture || {}).method || null, adapter: (r.capture || {}).adapter || null } });
  }
  return out;
}

const FIELDS = [["id", "sc:Text", "SHA-256 of the receipt"], ["split", "sc:Text", "train, dev or test, fixed by hash"], ["kind", "sc:Text", "what kind of fact"],
  ["subject", "sc:Text", "what the fact is about; private accounts only as salted pseudonyms"], ["subjectKind", "sc:Text", "artefact, organisation or private-pseudonym"],
  ["source", "sc:Text", "where the fact was read"], ["at", "sc:Date", "when it was read"], ["labeller", "sc:Text", "who labelled it, when hand-labelled"],
  ["stratum", "sc:Text", "fairness stratum, when hand-labelled"], ["doesNotProve", "sc:Text", "what the fact does not show"]];

export function croissant(ctx, dataHash, counts) {
  return {
    "@context": { "@vocab": "https://schema.org/", sc: "https://schema.org/", cr: "http://mlcommons.org/croissant/", dct: "http://purl.org/dc/terms/" },
    "@type": "sc:Dataset", conformsTo: "http://mlcommons.org/croissant/1.0",
    name: "daylight-commons-evidence", description: `Receipts from one Daylight Commons evidence chain (root ${ctx.chain.root}), as features and identifiers only. Split counts: ${counts}.`,
    license: "https://creativecommons.org/licenses/by/4.0/", creator: { "@type": "sc:Organization", name: ctx.tool }, datePublished: ctx.at,
    url: "https://github.com/HarperZ9/daylight-commons",
    distribution: [{ "@type": "cr:FileObject", "@id": "rows.jsonl", name: "rows.jsonl", contentUrl: "rows.jsonl", encodingFormat: "application/jsonlines", sha256: dataHash }],
    recordSet: [{ "@type": "cr:RecordSet", "@id": "rows", name: "rows",
      field: FIELDS.map(([name, type, description]) => ({ "@type": "cr:Field", "@id": `rows/${name}`, name, description, dataType: type,
        source: { fileObject: { "@id": "rows.jsonl" }, extract: { column: name } } })) }],
  };
}

function datasheet(ctx, rows, counts) {
  const labelled = rows.filter((r) => r.labeller).length, strata = [...new Set(rows.map((r) => r.stratum).filter(Boolean))];
  return [
    "# Datasheet", "",
    `Made ${ctx.at} by ${ctx.tool} from an evidence chain of ${rows.length} receipts (root \`${ctx.chain.root}\`).`, "",
    "## How it was made",
    "Each row is one receipt this browser recorded: a fact read from a public source or the page the user loaded, with the hash of the fragment it was read from. Rows hold identifiers, hashes and extracted features, never post text.", "",
    "## Splits", `Fixed by hash under seed \`${ctx.seed}\`: ${counts}. The same receipt lands in the same split in every export with this seed.`, "",
    "## Labels and fairness",
    labelled ? `${labelled} rows carry a labeller; strata present: ${strata.join(", ") || "none"}.` : "No row is hand-labelled. No fairness audit applies to these rows, and none is claimed.", "",
    "## Known biases",
    "Rows come from what one user chose to open and look up, so they describe that user's browsing, not any platform as a whole. Platforms round, delay and recount what they show.", "",
    "## Privacy and licence",
    "Private accounts appear only as pseudonyms salted per export, so two exports cannot be joined. The compilation is CC BY 4.0; facts read from third parties keep their sources' terms.", "",
    `## Does not prove`, ctx.dnp, "",
  ].join("\n");
}

export async function researchFiles(ctx) {
  const rows = await rowsWithSplits(ctx);
  const jsonl = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const counts = SPLITS.map(([s]) => `${s} ${rows.filter((r) => r.split === s).length}`).join(", ");
  const splits = {};
  for (const [s] of SPLITS) {
    const ids = rows.filter((r) => r.split === s).map((r) => r.id).sort();
    splits[s] = { rows: ids.length, sha256: await sha256Hex(ids.join("\n")) };
  }
  return {
    "rows.jsonl": jsonl,
    "croissant.json": JSON.stringify(croissant(ctx, await sha256Hex(jsonl), counts), null, 2) + "\n",
    "splits.json": JSON.stringify({ seed: ctx.seed, shares: Object.fromEntries(SPLITS), splits }, null, 2) + "\n",
    "DATASHEET.md": datasheet(ctx, rows, counts),
  };
}
