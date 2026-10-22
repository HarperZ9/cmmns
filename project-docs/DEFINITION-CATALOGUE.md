<!-- writing-profile: research -->
# Definition catalogue: published definitions, element by element

Status: data and library built, unit-tested on synthetic fixtures. Not wired into the extension
window yet. Not reviewed by a lawyer.

**Legal review note.** This is not legal advice. A media lawyer should review the catalogue's
wording, the element splits and the summary phrasing before any public release. UK and EU
defamation law is stricter than US law, and a sentence such as "this conduct matches elements A and
B" about a named company is one a court could read as a statement of fact.

## The problem

The author, verbatim, 2026-10-22: "highlight every action by it's definition in the jurisdiction of
where it occurs. The catalog remains always neutral, and always readily visible and challengeable."
And: "If an action is visible, and it matches the definition there is no reason to skirt that."

The campaign lens shows signs. A reader then asks what the conduct amounts to. Calling it "fraud" is
a verdict Daylight Commons cannot give. Saying nothing hides a fair comparison. The catalogue gives
the comparison: the published definition, quoted from its official source, split into elements, and for
each element whether the visible evidence matches it, does not, or cannot be seen from a page.

## What is in the repository

| Path | What it holds |
|---|---|
| `catalogue/definitions/*.json` | One entry per definition. |
| `catalogue/schema/definition.v1.json` | The entry format, for readers. `src/core/definitions-schema.js` enforces it. |
| `catalogue/signals.json` | Every signal an element may cite, with its family and source module. |
| `catalogue/CHANGELOG.md` | Every entry at every version, with the date and reason. |
| `src/core/definitions.js` | The element-table library. |
| `scripts/catalogue-refetch.mjs` | Re-reads every source live and reports drift. |
| `.github/ISSUE_TEMPLATE/challenge.yml` | The challenge form for entries and badges. |

## An entry

Each entry carries:
- `id`, `version`, `title`, `jurisdiction`, `instrument`, `section`, `kind` and `role`;
- `binding_note`: what kind of text this is and who it binds;
- `in_force`: status, the date where the source states it, and a note;
- `sources`: the official URL, the URL actually retrieved, the retrieval date, the SHA-256 of what
  was retrieved, how the hash was taken, and the tool used;
- `quotes`: the definition text, word for word, with a locator;
- `elements`: the definition split into rows. Each row has `observable_from` (`page`,
  `public-record` or `not-observable`), a `strength` (`direct`, or `indicative` when the signals
  are consistent with the element without showing it), and the Daylight Commons signals that can
  evidence it.
  An indicative row can require two or more independent signal families (`min_families`);
- `does_not_prove`.

Roles:
- **match**: a definition aimed at the conduct, such as 16 CFR 465.8.
- **comparison**: a broader definition shown beside it, such as fraud. Its intent and knowledge
  elements are not observable, and the table says so instead of leaving it out.
- **context**: a duty that falls on someone else, such as a platform's duty under the DSA.

## How a table reads

`elementTables(entries, finding, registry, { jurisdictions })` returns one table per applicable,
verified entry. For the positive campaign fixture against 16 CFR 465.8:

> This conduct matches elements A, B and F of 16 CFR 465.8(b) (...). Element B is matched on
> indicative evidence only: the signals are consistent with it and do not show it. Elements D and E
> are not observable from here. Element C has no evidence in what this page loaded. This compares
> visible conduct with a published definition, element by element. It is not a finding by a court, a
> regulator or the platform.

Rules the tests hold:
- The library never writes "committed", "guilty", "is fraud", "violated", "illegal", "unlawful",
  "liable", "crime" or "breach" (`VERDICT_WORDS`). The law's own words appear only inside quotes.
- A not-observable element is never matched, whatever signals arrive.
- An unverified or withdrawn entry is never matched.
- A summary never says a definition is met.
- Context-only signals (random handle suffixes, default avatars, quote bunching, overlap below the
  threshold) never evidence any element.

## Jurisdiction

`applicableJurisdictions({ platform, actor, audience })` lists every jurisdiction that applies: the
platform's own rules, the actor's disclosed location and the audience's. When the actor's location
is not public it says so. Tables come back in a fixed order (jurisdiction, role, id), so the harshest
reading is never promoted.

## The entries

All verified on 2026-10-22, from official sources only.

| Entry | Source | Retrieved through |
|---|---|---|
| `us-ftc-endorsement-material-connection` | 16 CFR 255.5(a), 255.0(b) | eCFR API, point-in-time 2026-10-19 |
| `us-ftc-fake-social-media-indicators` | 16 CFR 465.8, 465.1(h), (j) | eCFR API, point-in-time 2026-10-19 |
| `us-ftc-act-s5-deception` | 15 U.S.C. 45(a)(1); FTC Policy Statement on Deception | govinfo; ftc.gov PDF in a browser |
| `us-wire-fraud-18usc1343` | 18 U.S.C. 1343; DOJ CRM 941 (archived) | govinfo; justice.gov in a browser |
| `eu-ucpd-annex1-11-advertorial` | Directive 2005/29/EC, Annex I point 11 | Publications Office (Cellar), consolidated 27.09.2026 |
| `eu-ucpd-annex1-22-posing-as-consumer` | Annex I point 22 | as above |
| `eu-ucpd-annex1-23c-false-reviews-endorsements` | Annex I point 23c; Directive 2019/2161 recital 49 | as above, and the Official Journal text |
| `eu-dsa-art26-advertising` | Regulation 2022/2065, Article 26 | Official Journal text via Cellar |
| `eu-dsa-art39-ad-repository` | Regulation 2022/2065, Article 39 | as above |
| `uk-dmcc-sch20-12-advertorial` | DMCC Act 2024, Sch. 20 para 12 | legislation.gov.uk |
| `uk-dmcc-sch20-13-fake-reviews` | DMCC Act 2024, Sch. 20 para 13 | legislation.gov.uk; SI 2025/272 |
| `uk-dmcc-sch20-25-posing-as-consumer` | DMCC Act 2024, Sch. 20 para 25 | legislation.gov.uk |
| `uk-fraud-act-2006-s2` | Fraud Act 2006, s. 2 | legislation.gov.uk |
| `x-paid-partnerships` | X Help Center, Paid Partnerships Policy | browser |
| `x-authenticity-engagement-spam` | X Help Center, Authenticity | browser |

Findings from verification:
- 16 CFR 465.8 is headed "Misuse of fake indicators of social media influence"; 465.3 is reserved.
- The UCPD has a newer consolidated version than 28.05.2022: 27.09.2026, which adds the amendments
  of Directive (EU) 2024/825. Points 11, 22 and 23c read the same in both.
- Points 23b and 23c were inserted by Directive 2019/2161, which Member States apply from 28 May
  2022 (its Article 7).
- DMCC Act Schedule 20 paragraph 13 is the fake-review banned practice. Chapter 1 of Part 4, which
  holds section 225 and Schedule 20, came into force on 6 April 2025 under SI 2025/272, regulation
  2(3).
- Fraud Act 2006 section 2 extends to England and Wales and Northern Ireland, not Scotland, per the
  legislation.gov.uk XML.
- X's platform manipulation page now redirects to "Authenticity", dated April 2025 on the page.

## How sources were read, and the hashes

- eCFR, govinfo, legislation.gov.uk and the EU Publications Office answered scripted requests. Their
  hashes are of the raw response bytes. EUR-Lex itself returned an empty bot challenge, so the EU
  texts were read from the Publications Office repository, which serves the same documents by CELEX
  number.
- ftc.gov, help.x.com and justice.gov refuse scripted requests. These were read in a browser, and
  the hash was taken there. For justice.gov the raw response was a changing challenge page, so the
  hash covers the rendered text of the page's main element; the entry says so (`hash_method`).
- legislation.gov.uk serves its XML with attributes in a different order on each request, so the raw
  hash differs between fetches while the text does not. Each source also records `text_sha256`, a
  hash of its normalised visible text, and the refetch script compares both.

## Keeping it current

`node scripts/catalogue-refetch.mjs --quotes` re-reads every source, reports `same`,
`same text, bytes differ`, `changed` or `blocked`, and checks each quote against the fetched text.
A changed source means: read it, update the entry, bump its version, and add a changelog line. A
blocked source is rechecked in a browser. Platform policies change most often; their retrieval date
is part of every table.

## Challenges

Anyone can challenge an entry or a badge with the form in `.github/ISSUE_TEMPLATE/challenge.yml`,
including an organisation named by a badge. Each decision is published with its reasons. Changes
land as a new entry version with a dated changelog line, so earlier badges stay readable against the
version they used.

## Gaps

- Not wired into the extension window yet; the library and data are ready for it.
- No common-law fraud entry, which would carry the reliance and harm elements. No official source
  was retrieved for it, so it is not in the catalogue rather than written from memory.
- The effective date of 16 CFR Part 465 is not stated in the retrieved eCFR text and is left open.
- The DSA Article 39 start date for X depends on its designation under Article 33, not checked.
- Evidence-layer receipts (domain age, star history) are not yet cited by any element; the ad
  repository link is registered and pending PR #47.
- Member State transpositions of the UCPD are not catalogued; the Directive's text is.
- Other platforms' policies (Instagram, TikTok, YouTube, LinkedIn) are not catalogued.
- Legal review of the wording, as above.

## What it does not prove

A table compares visible conduct with a published definition. It does not show that anyone broke a
law or a rule, and it says nothing about the elements Daylight Commons cannot see. Only a court, a
regulator or the platform decides that.
