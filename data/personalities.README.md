# personalities.json: documented backing of public media personalities

Built 2026-10-21 for Radar by `scripts/personalities-build.mjs` from the hand-kept records in
`data/personalities-sources/`. The build writes `src/ext/personalities.json`, which ships inside the
signed data pack. It reads no network, and the extension fetches nothing live for it.

## What it does for the user

On the account of a public media personality (X, YouTube, TikTok and the other sites Radar reads),
the post's window carries a sign such as "Backing on record: 3 sources". Opening it shows each record:
who employs the person, who owns their outlet, investors, licensing deals, filings, court records,
sanctions and government labels. Each record gives its sources' own words, the date each page was
read, a status (documented, reported, alleged), a confidence and a "this does not prove" line. On a
YouTube video, the panel names the channel's records in one line. Every window ends with a link to
send a sourced correction.

The sign is the same level (info) for every kind of record and every person. An indictment does not
raise it. It says who is behind a voice; it never says the voice is wrong.

## What a record is

One person (`people-*.json`) has a public name, a public role, the accounts the research confirmed,
and `backing` rows. A row has a kind, the backer as the source names it, an attributed summary, a
period, a status, its sources and a does-not-prove line. A source has publisher, title, URL,
publication date, the date read, who wrote it (`self`, `company`, `court`, `government`, `filing`,
`platform`, `press`, `researcher`) and a quote of the supporting sentence (30 words at most).

Outlet owners are recorded once, on the outlet (`outlets.json`), and the build gives those rows to
every person whose current employer is that outlet. So every Fox News host gets the same Fox
Corporation row, and every MS NOW host the same Versant row. A person's own company is the one
exception. Wikidata's employer statements (P108, fetched 2026-10-21, `wikidata.json`) are shown as a
separate "Wikidata lists" line and are not counted as sources.

## The rule, the same for every person

`src/core/personalities-schema.js` holds it; `tests/personalities.symmetry.test.js` checks that its
code names no person, outlet or side, that relabelling a person changes nothing but the name shown,
and that everyone at one outlet gets the same outlet rows.

- Every row needs a source with a quote. `scripts/personalities-quotecheck.mjs` fetched every source
  page and looked for every quote (results in `project-docs/evidence/personalities-quotecheck.json`).
  Only sources whose quote was found ship. A row ships only when one of its quotes was found and every
  kind of record it rests on (a court record, a filing, a government or platform document) was
  confirmed. Of 280 quotes, 253 were found word for word, 15 with only punctuation or spacing
  different, and 12 pages refused automated reading. Two rows are held back for that reason: the FEC
  disbursements to Crooked Media (the FEC's public API answered "too many requests") and Vladimir
  Solovyov's Russia-1 role (EUR-Lex served a bot wall; the research pass read it in a browser).
- Status: a court record is always `alleged`. `documented` needs a primary source; press-only rows
  are `reported`. The build lowers a status its shipped sources do not allow.
- Confidence comes from the sources only: high when a primary source's quote was found, moderate
  when quotes were found on two sites, low otherwise.
- Investigative reporting needs two independent outlets. A claim that met no bar is a lead, marked
  UNVERIFIED in the records, and never ships.
- No private data: no address, phone, email, salary, contract amount, net worth or family field,
  anywhere (`tests/personalities.data.test.js` checks every key). Amounts appear in Radar's own words
  only where a filing or court record is the backing itself.
- No inference from association: a summary that says "appeared on", "met with", "attended" or
  "follows" fails the build. No label: Radar's own words never say propagandist, propaganda, shill,
  bot, troll or puppet about anyone, and a quote that carries one of those words is not shipped.
- Every claim names its source ("the indictment alleges", "Fortune and TheWrap report").

What the quote check does not prove: a found quote shows the sentence is on the cited page. It does
not show that the sentence supports the summary as strongly as the summary reads. That judgement was
made by the research passes and spot-checked by hand; a reader can open every source.

## How people were chosen

By audience and topic, never by side. The candidate pool is every person on Wikidata
with an occupation of journalist, pundit, political pundit, news presenter, podcaster, television
presenter, YouTuber, columnist, blogger or radio personality and an X follower figure (P8687) of
400,000 or more: 1,637 people (`data/personalities-sources/pool.rq`, run 2026-10-21; most follower
figures date from February 2023, when X closed its API). From the pool, taken in follower order:

- 42 people in the United States, 5 in the United Kingdom, 5 in India, 3 in Pakistan, 3 in
  Turkey, 3 Arabic-language, 5 in Latin America and 4 Russian- or Ukrainian-language whose public role
  is politics and current affairs, leaving out sitting officials and the dead;
- 7 lifestyle personalities who carry political content (Joe Rogan, Jordan Peterson, Patrick
  Bet-David, Lex Fridman, Theo Von, Andrew Tate, Gary Lineker).

Fourteen more were chosen because a primary record names them: the six Tenet Media commentators,
four state-media presenters (EU and US sanctions, platform labels), Steve Bannon and Alex Jones
(records about who funds their media companies), and four creators named in Vippi Media's FARA
filings. The topic filter is a judgement; the follower ranking is reproducible.

Ten research passes on 2026-10-21 read public web pages only, with no account and no paid service.
Each pass had a mixed batch, so no pass covered one side. A shared limit of 200 web searches ran
out partway through: about a third of people, mostly late in each batch, got fewer searches for
FARA, sanctions, campaign finance and platform labels. Their leads say so. That is a gap in the
search, recorded per person, not a finding of absence.

## Totals

90 people researched; 78 have at least one shipped record; 162 rows ship, citing 179 distinct
documents. By status: 94 documented, 61 reported, 7 alleged. By confidence: 98 high, 42 moderate,
22 low. 228 leads stay in the records as UNVERIFIED and never ship.

### Balance

Side is never an input. To report balance, the maintainer gave each person a coarse label
(`balance.json`, build-time only, never shipped, never read by the build): right, left, centre, state
media, or not classified (politics outside the US and UK left-right frame, or none).

| | right | left | centre | state media | not classified |
|---|---|---|---|---|---|
| People researched | 31 | 18 | 9 | 5 | 27 |
| People with a shipped record | 28 | 14 | 9 | 4 | 23 |
| Shipped rows | 65 | 25 | 21 | 11 | 40 |
| Findings (rows beyond employer, outlet owner and network) | 18 | 0 | 4 | 5 | 14 |
| People with a finding | 15 | 0 | 3 | 3 | 11 |

Accounts on each platform among people with a shipped record (a person counts once per platform):

| | right | left | centre | state media | not classified |
|---|---|---|---|---|---|
| X | 25 | 14 | 9 | 4 | 19 |
| YouTube | 21 | 6 | 1 | 0 | 8 |
| TikTok | 9 | 3 | 1 | 2 | 6 |
| Instagram | 5 | 4 | 1 | 0 | 2 |
| Facebook | 0 | 0 | 0 | 0 | 1 |

**The dataset leans right, and the findings lean further right. Both need reading with care.**

- The audience pool leaned right among US politics accounts (26 right, 18 left in the audience
  selection), and five of the fourteen record-selected people are the Tenet Media commentators.
- The 18 right-side findings come from about seven cases: the Daily Wire's founding investor (shown
  on four hosts because the outlet rule gives every host the same rows), the Tenet Media indictment
  (six people), Rumble's exclusive deals and Tether's stake in Rumble, 1789 Capital's seed round for
  Tucker Carlson's network, Spotify's licence for Joe Rogan, and the Infowars store revenue in court
  records. Counted by case, the gap is smaller than counted by row.
- Part of the gap reflects the evidence: many large right-of-centre voices run independent companies
  that announce investors and platform deals, while most large left-of-centre voices are employees of
  listed networks whose owner rows count as routine. Part reflects the search: the one left-leaning
  paid-creator program checked in depth (the Chorus program reported by WIRED in 2025) has one
  original report, which names no creator as paid, so it stays a lead; the FEC disbursements to Crooked
  Media are held back until the FEC's page can be read; and the search limit ran out before Sam Seder,
  Kyle Kulinski, Jimmy Dore and others were fully checked. On the right, Laura Loomer's reported funding
  rests on one outlet and stays a lead too.
- No left-side finding is documented in this build. That is a statement about this dataset and its
  search, not a statement that none exists.

## Public-sentiment campaigns

Rows where a person's public content was part of a documented campaign carry `campaign`: the
campaign's name, the content type and the dates, never copies of the content. Two campaigns qualify:

- Tenet Media (US v. Kalashnikov and Afanasyeva, SDNY, September 2024): commentator videos on YouTube,
  X, TikTok and Instagram, 2023 to 2024. The indictment says the defendants "worked together to
  deceive two U.S. online commentators" and names no commentator; press and the commentators' own
  statements identify them, and each says they did not know. Technique: DISARM T0100 Co-Opt Trusted
  Sources, supported by the Justice Department's own wording.
- Vippi Media's FARA filings (registrant 7057) for the Chinese consulate in New York: sponsored
  Instagram and TikTok posts promoting the Beijing 2022 Winter Olympics, January to March 2022. The
  filing says Viral Nation "sourced the social media influencers and created the content". The
  technique mapping (T0100) is the research pass's reading; the filing itself names none.

`project-docs/TECHNIQUES.md` section 10 maps these to Radar's technique taxonomy.

## Leads, including names the author suspects

Leads (`leads` in each record) list what was suggested, what was searched and why it stays
unverified. The author said some personalities are suspected; their names did not reach this build's
brief, so none was checked as a named lead. They can be added as leads and checked against the same
rule.

## Corrections

`data/owner-corrections.json` has a `personalities` list, applied by the build. An entry names the
person and row, retracts or amends it, and cites a primary source or two independent outlets with the
date checked and the reason. The window's last link points there. The same rule applies to everyone.

## Not done

- No US state-media presenter (VOA, RFE/RL) is in the dataset; the audience pool held none, and none
  was added by record.
- Podcast-only and TikTok-only personalities without a Wikidata follower figure are under-covered.
- Four record-selected people have no confirmed account handle, so their sign cannot appear yet.
- No live browser check of the sign or the panel line; the lead runs those (project-docs/LIVE-CHECKS.md).

## Licence

Records: CC BY 4.0. Wikidata statements: CC0 1.0. US government documents: public domain. EU
sanctions data: EU reuse policy, with attribution. Everything else: facts and short quotes only, with
their source.
