// The discourse checks' data, in the background worker (project-docs/DISCOURSE.md). The quote index
// and the name list ship inside the extension (src/ext/discourse/) under the project key's signature;
// both are checked against it on first use and refused if they differ. A content script asks with
// the post's text or an account's names; nothing leaves the browser. The data is dropped after five
// minutes without use.
(() => {
  "use strict";
  const IDLE_MS = 5 * 60000, FILES = ["quotes.json", "persons.json"], MAX_TEXT = 4000, MAX_ITEMS = 40;
  let data = null, loading = null, idle = 0;
  const url = (f) => chrome.runtime.getURL("discourse/" + f);
  const bytes = (f) => fetch(url(f)).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b));

  async function open() {
    const pack = JSON.parse(new TextDecoder().decode(await bytes("discourse-data.pack.json")));
    const got = Object.fromEntries(await Promise.all(FILES.map(async (f) => [f, await bytes(f)])));
    const v = await PB.verifyPack(pack, [PB.PROJECT_KEY]);
    const problems = [...v.problems, ...(await PB.verifyFiles(pack, async (n) => got[n]))];
    if (!v.trusted || problems.length) throw new Error(`the discourse data does not match its signed copy: ${problems.join("; ") || "unknown key"}`);
    const read = (f) => JSON.parse(new TextDecoder().decode(got[f]));
    const persons = read("persons.json");
    const names = [...new Set(persons.people.flatMap((p) => p[4]).filter((n) => n.split(" ").length >= 2 || n.length >= 5))];
    return { quotes: PBD.buildIndex(read("quotes.json")), persons: PBD.buildPersons(persons), names, surnames: lastNames(persons) };
  }

  // Names a post may credit by surname alone ("Nietzsche: It's power."): the last word of each name
  // of seven letters or more, when no other listed person shares it.
  function lastNames(persons) {
    const count = new Map(), of = new Map();
    for (const p of persons.people) for (const n of new Set(p[4].map((x) => x.split(" ").pop()).filter((w) => w.length >= 7))) { count.set(n, (count.get(n) || 0) + 1); of.set(n, p[1]); }
    return [...count.entries()].filter(([, c]) => c === 1).map(([n]) => n);
  }

  function load() {
    clearTimeout(idle);
    idle = setTimeout(() => { data = null; loading = null; }, IDLE_MS);
    if (data) return Promise.resolve(data);
    if (!loading) loading = open().then((d) => (data = d)).catch((e) => { loading = null; throw e; });
    return loading;
  }

  // posts: [{ id, text }] -> { [id]: { results, list } }; accounts: [{ key, display, handle, verified }] -> { [key]: persona }
  async function answer(msg) {
    const s = PB.normalizeSettings((await chrome.storage.local.get(PB.SETTINGS_KEY))[PB.SETTINGS_KEY]);
    if (!s.discourse) return { error: "the discourse checks are off in CMMNS' options" };
    const d = await load(), out = { quotes: {}, personas: {} };
    for (const p of (msg.posts || []).slice(0, MAX_ITEMS)) {
      const text = String(p.text || "").slice(0, MAX_TEXT), names = d.names.concat(d.surnames).filter((n) => text.includes(n));
      const { quotes, list } = PBD.extractQuotes(text, names);
      out.quotes[p.id] = { results: quotes.map((q) => PBD.lookupQuote(d.quotes, q.text, q.by)), list };
    }
    for (const a of (msg.accounts || []).slice(0, MAX_ITEMS)) out.personas[a.key] = PBD.personaOf(d.persons, a);
    return out;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== "pb-discourse" || !sender.tab) return undefined;
    answer(msg).then(sendResponse, (e) => {
      console.error("[cmmns] the discourse checks failed", e);
      sendResponse({ error: String((e && e.message) || e) });
    });
    return true;
  });
})();
