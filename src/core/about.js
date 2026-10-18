// Parse the text of X's "About this account" page into the fields the badges use. The page is
// read from what X itself renders for the viewer (innerText), never from a private API. Labels
// are matched loosely because X words and orders them differently across versions; every
// pattern below must be re-checked against a live page (project-docs/LIVE-CHECKS.md).

const LABELS = {
  basedIn: [/account based in/i, /based in/i, /^location$/i],
  joined: [/date joined/i, /joined/i],
  connectedVia: [/connected via/i, /downloaded (?:the app )?(?:from|via)/i],
  nameChanges: [/username changes?/i, /changed (?:their )?username/i],
  verified: [/^verified$/i],
  affiliate: [/^an affiliate of/i],
};

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// "March 2019", "Joined March 2019", "2019-03" -> ISO date string of the first of that month.
export function parseJoined(s) {
  const m = String(s || "").match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})/i);
  if (m) return new Date(Date.UTC(+m[2], MONTHS[m[1].toLowerCase()], 1)).toISOString().slice(0, 10);
  const n = String(s || "").match(/\b(\d{4})-(\d{2})\b/);
  return n ? `${n[1]}-${n[2]}-01` : null;
}

// "3 username changes", "Changed username 2 times", "No username changes" -> number or null.
export function parseNameChanges(s) {
  const t = String(s || "");
  if (/\bno\b|\bnever\b/i.test(t) && !/\d/.test(t)) return 0;
  const m = t.match(/(\d+)/);
  return m ? +m[1] : null;
}

// text: the page's innerText. handle: the account the page is about.
// Returns { handle, basedIn, joinDate, connectedVia, nameChanges, raw } with null for anything
// not found. A field is taken from the line after its label, or from the rest of the label line.
export function parseAbout(text, handle) {
  const lines = String(text || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const pick = (patterns) => {
    for (let i = 0; i < lines.length; i++) {
      for (const re of patterns) {
        if (!re.test(lines[i])) continue;
        const rest = lines[i].replace(re, "").replace(/^[\s:·-]+/, "").trim();
        if (rest) return rest;
        if (i + 1 < lines.length) return lines[i + 1];
      }
    }
    return null;
  };
  const basedIn = pick(LABELS.basedIn);
  const joinedRaw = pick(LABELS.joined);
  const via = pick(LABELS.connectedVia);
  const changes = pick(LABELS.nameChanges);
  const verified = pick(LABELS.verified);
  const affiliate = pick(LABELS.affiliate);
  return {
    handle: handle || null,
    basedIn: basedIn || null,
    joinDate: parseJoined(joinedRaw),
    connectedVia: via || null,
    nameChanges: changes == null ? null : parseNameChanges(changes),
    verifiedSince: verified ? verified.replace(/^since\s+/i, "") : null,
    // X adds a note when it suspects a VPN or proxy ("may not be accurate"); wording unconfirmed.
    proxyNote: /\b(?:vpn|proxy)\b|may not be accurate/i.test(String(text || "")),
    affiliateOf: affiliate || null,
    raw: { basedIn, joinedRaw, via, changes },
  };
}
