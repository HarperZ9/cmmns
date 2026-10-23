// Links from what Daylight Commons shows to the open catalogue (catalogue/, catalogue/DECISIONS.md).
// A badge in the launch campaign lens is named by its signal id; it links to every active catalogue
// entry that cites the signal, at the version shown, and to the dispute templates with the entry or
// the signal filled in. Pure: no DOM, no network. A link opens only when the user clicks it.
export const REPO_URL = "https://github.com/HarperZ9/daylight-commons";
export const DECISIONS_URL = `${REPO_URL}/blob/main/catalogue/DECISIONS.md`;
export const SIGNALS_URL = `${REPO_URL}/blob/main/catalogue/signals.json`;
export const TEMPLATES = Object.freeze({
  challenge: `${REPO_URL}/issues/new?template=challenge.yml`,
  finding: `${REPO_URL}/issues/new?template=dispute-finding.yml`,
});
export const DECISIONS_NOTE = "Every challenge gets a public decision with its reasons in the catalogue's decisions log.";

export const entryUrl = (id) => `${REPO_URL}/blob/main/catalogue/definitions/${encodeURIComponent(id)}.json`;
export const entryRef = (e) => `${e.id}@${e.version}`;

// GitHub issue forms fill a field from a query parameter named after the field's id.
export const challengeUrl = (ref) => `${TEMPLATES.challenge}&entry=${encodeURIComponent(ref)}`;
export const findingUrl = (signal) => `${TEMPLATES.finding}&signal=${encodeURIComponent(signal)}`;

// Active entries that cite the signal in any element, sorted by id.
export function entriesCiting(signalId, entries) {
  return (entries || [])
    .filter((e) => e && e.status === "active" && (e.elements || []).some((el) => (el.signals || []).includes(signalId)))
    .map((e) => ({ id: e.id, version: e.version, ref: entryRef(e), url: entryUrl(e.id), title: e.title }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// What one badge links to. A signal no entry cites links to the signal registry at its version.
// Every badge, cited or not, links to the finding dispute template.
export function badgeLinks(signalId, entries, registry) {
  const reg = ((registry && registry.signals) || []).find((s) => s.id === signalId) || null;
  const cited = entriesCiting(signalId, entries);
  const links = cited.map((e) => [e.ref, e.url]);
  if (!cited.length && reg) links.push([`signals.json@${registry.version}: ${signalId}`, SIGNALS_URL]);
  links.push(["Dispute this badge", findingUrl(signalId)]);
  return { signal: signalId, registered: !!reg, registry: registry ? `signals.json@${registry.version}` : null, entries: cited, links };
}

// One line for a badge's catalogue row, naming the entries and versions it cites.
export function badgeLine(b) {
  if (b.entries.length) return `Cited by ${b.entries.length} catalogue ${b.entries.length === 1 ? "entry" : "entries"}: ${b.entries.map((e) => e.ref).join(", ")}.`;
  return b.registered ? `No catalogue entry cites this sign; it is listed in ${b.registry}.` : "This line is context, outside the catalogue.";
}
