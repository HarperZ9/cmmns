# ops.json: documented influence operations

Built 2026-10-21 for Radar by `scripts/ops-build.mjs` from the hand-kept records in
`data/ops-sources/*.json`. The build writes `data/ops.json` and the copy the extension loads,
`src/ext/ops.json`. It reads no network.

## What a record is

One influence operation that a primary source documented between 2017 and 2026, with:

- `state`: the country the source attributes the operation's origin to.
- `operator` and `operatorType`: who the sources say ran it. The type is one of `government`,
  `state media`, `contractor` (a firm or group a source says worked for, or was funded or directed
  by, a government), `linked to a state` (a source says linked to or associated with a government
  but not that it ran the operation), `commercial firm` (no state principal named) and `origin only`.
- `attributions`: one per source that attributes, with the source's own words (25 words at most)
  and the page or section. Sources that disagree are all kept. The record's `operatorType` must be
  one a source states; the build refuses a stronger or weaker type of our own.
- `active`, `platforms`, `languages` (ISO 639 codes), `targets`, `narratives` (a paraphrase of the
  source's own summary), `techniques` (a fixed list), each cited in `cite` to source ids.
- `indicators`: domains and X handles the source says the operation created or controlled.
- `sources`: publisher, title, URL, date, kind (`court`, `government`, `platform`, `researcher`,
  `press`), redistribution terms, and how the document was read (`checked`).

## The evidence rule, the same for every country

`src/core/ops-schema.js` holds the rule; `tests/ops.symmetry.test.js` checks that its code names no
country and that relabelling an operation's country never changes the result. Every record needs:
at least one source that was read, at least one attribution from a read source, an operator type a
source states, a cited source for every filled field, and indicators that cite a source. A record
that fails stops the build.

Balance sits in the method. No finding was softened, and none was strengthened, to even out counts.

## How the records were gathered

Six research passes on 2026-10-21, one per region, each opening the primary documents (platform
threat reports and their GitHub indicator files, research-lab reports, US court filings and Treasury
and State Department releases, EU Official Journal texts, VIGINUM reports in French, a FakeReporter
report in Hebrew, and investigative reporting that names its sources). Where a site refused
automated reading, the record says so and names the Internet Archive capture used. The working
files and the downloaded documents stayed outside the repository.

Reading followed Rauch's two rules (The Constitution of Knowledge, 2021): no final say, so a later
source that revises an attribution is recorded beside the earlier one; and no personal authority,
so an attribution counts by what a document shows, not by who published it. A platform's "linked
to" stays "linked to". A newspaper's report that a ministry commissioned a campaign is recorded as
the newspaper's claim, with what it cites and the ministry's denial in the notes.

## Totals

98 operations, 27 attributed countries, 176 documents, 1,237 indicators (1,174 distinct domains,
43 X handles). 613 indicators come from the records; the other 624 are domain rows of
`data/state-reports.json` whose operation `joins.json` maps to a record.

| Country | Operations | Documents | Operator types (count) |
|---|---|---|---|
| Russia | 25 | 49 | linked to a state 11, origin only 7, contractor 2, government 2, commercial firm 2, state media 1 |
| China | 17 | 27 | origin only 10, commercial firm 4, linked to a state 2, government 1 |
| Iran | 14 | 24 | origin only 8, government 2, contractor 2, state media 1, linked to a state 1 |
| United Arab Emirates | 5 | 5 | commercial firm 3, contractor 1, origin only 1 |
| Israel | 4 | 16 | commercial firm 3, contractor 1 |
| Saudi Arabia | 4 | 6 | linked to a state 2, contractor 1, commercial firm 1 |
| India | 3 | 3 | commercial firm 2, linked to a state 1 |
| United States | 3 | 6 | government 2, linked to a state 1 |
| Azerbaijan, Myanmar, Pakistan, Venezuela | 2 each | 2 to 4 | see the records |
| Bangladesh, Belarus, Cuba, Egypt, Ethiopia, Georgia, Ghana, Honduras, Nicaragua, Philippines, Serbia, Thailand, Togo, Türkiye, Uganda | 1 each | 1 to 4 | see the records |

By year of first report: 2018: 4, 2019: 22, 2020: 14, 2021: 5, 2022: 4, 2023: 8, 2024: 24,
2025: 8, 2026: 9. These count what investigators found and published. They are not a measure of
activity: platforms look harder at some countries and languages, Twitter's state-backed archive
(2018 to 2021) inflates those years, and a country whose government publishes takedowns (France's
VIGINUM) surfaces operations aimed at it.

Documents by kind: 88 platform, 43 researcher, 26 government, 14 press, 5 court. Most US
Treasury and State releases are `government`; indictments and affidavits are `court`, though a few
DOJ press releases about them are filed as `government`.

## Indicators shipped and what was held back

- Shipped: cloned news domains (Doppelganger's spoofed outlets, Endless Mayfly's 72 typosquats),
  operation websites (Pravda network, CopyCop, PAPERWALL, HaiEnergy, GLASSBRIDGE, Storm-2035, the
  Togo and Bangladesh networks and others), and brand accounts on X (for example @TEN_GOP,
  @peacedata_, @dcleaks_, @Inside_Syria, @bakuinitiative).
- Held back, 52 X handles of fake personas (Spamouflage, Operation Overload, Meta's 2026 Iran
  networks): a suspended handle that reads as a person's name can be registered again by a real
  person. Also held back: @YamoahFestus (looks like a real person), @manon_bergers (persona), and
  news360.com (a generic name that Wikidata records as a real news service).
- Never included: real outlets that were impersonated or carried paid placements, victims and
  targets, real influencers (none of the US commentators in the Tenet Media case), private
  individuals, compromised third-party sites, redirect domains, and platform hosts.
- `dcleaks.com` is on Wikidata as a website; it stays because the July 2018 indictment names it as
  a GRU front (`joins.json`, `realOutletFronts`).

## Left out, and why

- Operations whose only source could not be read, or that name no operator and no country.
- Further Meta and Twitter state-linked takedowns named in notes but not recorded for lack of
  time: Thai ISOC (Meta, February 2021), Cuba UJC/FEU (Twitter, October 2020), Twitter's 2021
  Uganda and Venezuela sets, Meta's Bolivia network (Q4 2022). Indonesia and Rwanda were not
  researched. Google TAG bulletins publish counts per country, not indicators.
- Not searched: Act.IL and Israel's Ministry of Strategic Affairs, Haaretz's Hebrew edition (a local
  fetch filter blocked Hebrew search), OpenAI 2025 and 2026 Iran cases.
- The `data/state-reports.json` rows for LT Media (Vietnam), the four Turkish agencies, Operation K
  and Xi'an Tianwendian (China), Al Mayadeen (Lebanon) and Digited (Benin) have no record here yet;
  they still show as the older state-link chip.

## Licence and terms

- US government documents (DOJ, Treasury, State, CISA/FBI advisories): public domain, 17 USC 105.
- EU Official Journal texts: EU reuse policy (Decision 2011/833/EU), reuse with attribution.
- Meta's GitHub indicator files: MIT (repository licence). Meta's reports: copyright; facts and
  short quotes only. The same holds for OpenAI, Microsoft, Google/Mandiant, Graphika, DFRLab,
  Recorded Future, Citizen Lab, EU DisinfoLab, FakeReporter and the press.
- Stanford Internet Observatory: CC BY-NC-ND 4.0 per the Stanford Digital Repository record, though
  one PDF carries a plain copyright notice. CheckFirst's Operation Overload report: CC BY-SA.
- VIGINUM (French government): no reuse licence stated in the documents read. Doubtful; only
  domain names, dates and short quotes are used.

What Radar redistributes is facts (names, domains, dates), paraphrased summaries, and quotes of 25
words or fewer with their source. Em dashes in source text are shown as a spaced hyphen.

## Judgement calls to review

1. Zero Zeno (STOIC): one operation, five attributions. Meta says "found links to" STOIC; OpenAI
   says STOIC operated it; the NYT says Israel's Ministry of Diaspora Affairs commissioned it,
   citing four officials and documents; Haaretz's subheadline says the ministry orchestrated it. The
   record's type is `contractor` from the NYT and Haaretz attributions; the ministry denied it.
2. Doppelganger is `contractor` (SDA and Structura, which the DOJ affidavit says worked under the
   Russian Presidential Administration). Earlier Meta reports name no principal; both are kept.
3. Ghostwriter is Belarus, after Mandiant's 2021 attribution; the EU's 2021 declaration associated
   it with the Russian state. Both are kept.
4. DigitSol: `state` is Ghana, where Meta says the network originated; the firm is in the UAE.
   `data/state-reports.json` files the same domains under the UAE (the firm's country).
5. Rokh Solis / Blackcore (Israel, 2026): VIGINUM says an Israeli private entity was probably
   behind it. Merging it with Meta's H2 2026 Israel-based network rests on six shared domains; Meta
   does not name Blackcore.

## Correction, 2026-10-21

`data/state-reports.README.md` says, as of 2026-10-18, that no Meta second-half 2026 report exists.
It does: `transparency.meta.com/sr/H2-2026-adversarial-threat-report/` served the PDF (17 MB,
titled "Meta H2 2026 Adversarial Threat Report") on 2026-10-21, and Meta's threat-research
repository carries its indicator files.
