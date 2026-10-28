// Cloned-outlet framing (project-docs/TECHNIQUES.md, technique 3; DISARM T0098 Establish Inauthentic
// News Sites, T0097.202 News Outlet Persona). A post that names a real outlet ("The Washington Post
// reports...") while its link goes to a look-alike address borrows the outlet's trust twice: in
// the words and in the address. Doppelganger posts did this with copied outlets on addresses such as
// washingtonpost.pm. CMMNS joins two checks it already has: the look-alike address (lookalike.js)
// and the published reports that named the address (ops.js). Wording that names the outlet is the
// only new part, and it is matched on the outlet's own name, never on a topic or side.

import { lookalikeOf } from "./lookalike.js";
import { opsOfDomain } from "./ops.js";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fold = (s) => String(s || "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

// True when the text names the outlet: its name with or without a leading "The", or its own address.
export function namesOutlet(text, outlet, official) {
  const t = fold(text), name = fold(outlet).replace(/^the /, "");
  if (name.length >= 3 && new RegExp(`(?<![\\p{L}\\p{N}])(?:the )?${esc(name)}(?![\\p{L}\\p{N}])`, "u").test(t)) return true;
  return !!official && new RegExp(`(?<![\\w.-])${esc(fold(official))}(?![\\w-])`).test(t);
}

// One entry per look-alike link: { domain, outlet, official, how, named, reports }, where named says
// the post's own words name the copied outlet and reports lists the operations that named the
// address. An empty list when no link is a look-alike.
export function clonedCitations(text, domains) {
  const out = [], seen = new Set();
  for (const d of domains || []) {
    const host = String(d || "").toLowerCase().replace(/^www\./, "");
    if (seen.has(host)) continue;
    seen.add(host);
    const h = lookalikeOf(host);
    if (!h) continue;
    const reports = [...new Map(opsOfDomain(host).filter((x) => x.op).map((x) => [x.op.id, x.op.name])).values()];
    out.push({ domain: host, outlet: h.outlet, official: h.official, how: h.how, named: namesOutlet(text, h.outlet, h.official), reports });
  }
  return out;
}

export const CLONED_DOES_NOT_PROVE = "The post names an outlet and links a copy on another address. People also share copies by mistake or to warn others.";
