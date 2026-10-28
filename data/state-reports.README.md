# state-reports.json and state-designations.json: sources, counts and gaps

Built 2026-10-18 for CMMNS. Two files, two kinds of evidence.

- `state-reports.json`: domains and X handles that a published report ties to a state or to an influence operation. Each domain or handle appears verbatim in the cited document (defanged `[.]` restored).
- `state-designations.json`: outlets that a government or EU document classifies as state-owned, state-controlled or sanctioned state media. The outlet name appears verbatim in the cited document. A domain is recorded only where the document itself gives one. Matching outlet names to official domains is a separate step with its own citation.

The counts below are computed from the two data files.

## state-reports.json

### Row format

`domain` or `x` (handle without @, lower case), `state`, `actor`, `name`, optional `operation`, `source {title, url, date}`.

- `state`: the single country the report says the operation came from. Where a report names a firm in one country that ran a network aimed elsewhere, the firm's country is used.
- `actor`, from the report's own wording: `government` (report ties the operation to a government, military, intelligence service, law enforcement or state media), `commercial firm` (report names a PR, marketing, political-consultancy or IT firm, or says the operation was run by a marketing company; the firm is in `operation` when named), `individuals or group` (anything else, including operations with no stated principal). A firm is never upgraded to `government` unless the cited document says so.
- `date`: `YYYY-MM-DD` where the publisher's own page or file gives the day. Where only the month is confirmed the value is `YYYY-MM`: Meta Q3 2023 (2023-11), Q4 2023 (2024-02), Q3 2024 (2024-12), Q4 2024 (2025-02), Q1 2025 (2025-05), Q2/Q3 2025 (2025-12), H1 2026 (2026-03); OpenAI October 2024 (2024-10), October 2025 (2025-10) and the February 2026 Fish Food case (2026-02). Meta Q2 2023 (2023-08-29), Q1 2024 (2024-05-29) and Q2 2024 (2024-08-15) take the day from news coverage and, for Q2 2024, the PDF creation stamp; Meta's own listing shows the month only.
- Several X handles are fake personas that the reports list by name (for example Spamouflage accounts). Most are suspended. No IP addresses are included.

### Totals

- Rows: 1120 (950 domains, 170 X handles). Distinct domain-or-handle and state pairs: 963 (a domain named by two documents has two rows, one per document).

| State | Rows | government | commercial firm | individuals or group |
|---|---|---|---|---|
| Russia | 841 | 36 | 239 | 566 |
| China | 131 | 36 | 3 | 92 |
| Iran | 44 | 11 | 0 | 33 |
| Togo | 29 | 0 | 29 | 0 |
| Bangladesh | 18 | 0 | 0 | 18 |
| United States | 11 | 0 | 0 | 11 |
| Vietnam | 10 | 0 | 10 | 0 |
| Israel | 8 | 0 | 8 | 0 |
| Venezuela | 7 | 0 | 7 | 0 |
| Turkiye | 7 | 0 | 7 | 0 |
| Myanmar | 4 | 4 | 0 | 0 |
| Lebanon | 4 | 0 | 0 | 4 |
| United Arab Emirates | 3 | 0 | 3 | 0 |
| Benin | 2 | 0 | 2 | 0 |
| Pakistan | 1 | 1 | 0 | 0 |
| **All** | **1120** | **88** | **308** | **724** |

### Documents used (every document that supplied at least one row)

| # | Title | Date | URL | Rows | States |
|---|---|---|---|---|---|
| 1 | Taking down coordinated inauthentic behavior from Russia and China (Meta detailed report, September 2022; Russia domain list last updated November 22, 2022) | 2022-09-27 | https://about.fb.com/wp-content/uploads/2022/10/CIB-Report_-China-Russia_Sept-2022-1-1.pdf | 516 | Russia 516 |
| 2 | Meta's Adversarial Threat Report, First Quarter 2023 | 2023-05-03 | https://about.fb.com/wp-content/uploads/2023/06/Meta-Quarterly-Adversarial-Threat-Report-Q1-2023.pdf | 46 | Togo 29, Venezuela 7, Iran 6, China 4 |
| 3 | Meta's Adversarial Threat Report, Third Quarter 2023 | 2023-11 | https://transparency.meta.com/sr/Q3-2023-Adversarial-threat-report/ | 135 | China 85, Russia 44, Iran 6 |
| 4 | Meta's Adversarial Threat Report, Fourth Quarter 2023 | 2024-02 | https://transparency.meta.com/sr/Q4-2023-Adversarial-threat-report/ | 4 | Myanmar 4 |
| 5 | Meta's Adversarial Threat Report, First Quarter 2024 | 2024-05-29 | https://transparency.meta.com/sr/Q1-2024-Adversarial-threat-report/ | 40 | Bangladesh 18, Iran 7, Russia 6, China 5, Israel 4 |
| 6 | Meta's Adversarial Threat Report, Second Quarter 2024 | 2024-08-15 | https://transparency.meta.com/sr/Q2-2024-Adversarial-threat-report/ | 65 | Russia 44, United States 11, Vietnam 10 |
| 7 | Meta's Adversarial Threat Report, Third Quarter 2024 | 2024-12 | https://transparency.meta.com/sr/Q3-2024-Adversarial-threat-report/ | 54 | Russia 42, Iran 8, Lebanon 4 |
| 8 | Meta's Adversarial Threat Report, Fourth Quarter 2024 | 2025-02 | https://transparency.meta.com/sr/Q4-2024-Adversarial-threat-report/ | 5 | Benin 2, United Arab Emirates 2, China 1 |
| 9 | Meta's Adversarial Threat Report, First Quarter 2025 | 2025-05 | https://transparency.meta.com/sr/Q1-2025-Adversarial-threat-report/ | 3 | Iran 3 |
| 10 | AI and Covert Influence Operations: Latest Trends (OpenAI threat report, May 2024) | 2024-05-30 | https://cdn.openai.com/threat-intelligence-reports/threat-intel-report-may-2024.pdf | 10 | Israel 4, Russia 3, Iran 2, China 1 |
| 11 | Disrupting a covert Iranian influence operation | 2024-08-16 | https://openai.com/index/disrupting-a-covert-iranian-influence-operation/ | 5 | Iran 5 |
| 12 | Disrupting malicious uses of our models: an update (OpenAI threat report, February 2025) | 2025-02-21 | https://cdn.openai.com/threat-intelligence-reports/disrupting-malicious-uses-of-our-models-february-2025-update.pdf | 5 | Iran 4, United Arab Emirates 1 |
| 13 | Affidavit in Support of Seizure Warrant, United States v. Certain Domains, No. 24-mj-1395 (E.D. Pa.), filed 2024-09-04 | 2024-09-04 | https://www.justice.gov/d9/2024-09/doppelganger_affidavit_9.4.24.pdf | 32 | Russia 32 |
| 14 | Alerting the World to RT's Global Covert Activities (U.S. Department of State fact sheet) | 2024-09-13 | https://2021-2025.state.gov/alerting-the-world-to-rts-global-covert-activities/ | 2 | Russia 2 |
| 15 | Meta's Semiannual Adversarial Threat Report, Second and Third Quarter 2025 | 2025-12 | https://transparency.meta.com/sr/Q2-Q3-2025-Adversarial-threat-report/ | 3 | Iran 3 |
| 16 | Meta's Semiannual Adversarial Threat Report, First Half 2026 | 2026-03 | https://transparency.meta.com/sr/first-half-2026-Adversarial-threat-report/ | 1 | Pakistan 1 |
| 17 | Meta's Adversarial Threat Report, Second Quarter 2023 (Doppelganger domain list last updated November 30, 2023) | 2023-08-29 | https://transparency.meta.com/sr/Q2-2023-Adversarial-threat-report/ | 190 | Russia 148, China 35, Turkiye 7 |
| 18 | Influence and cyber operations: an update (OpenAI threat report, October 2024) | 2024-10 | https://cdn.openai.com/threat-intelligence-reports/influence-and-cyber-operations-an-update_October-2024.pdf | 2 | Russia 2 |
| 19 | Disrupting malicious uses of AI: October 2025 (OpenAI threat report) | 2025-10 | https://cdn.openai.com/threat-intelligence-reports/7d662b68-952f-4dfd-a2f2-fe55b041cc4a/disrupting-malicious-uses-of-ai-october-2025.pdf | 1 | Russia 1 |
| 20 | Operation "Fish Food": Russia-origin content farm activity (OpenAI, case study from the February 2026 report Disrupting malicious uses of AI) | 2026-02 | https://openai.com/index/disrupting-malicious-uses-of-ai-fish-food/ | 1 | Russia 1 |

The Meta `transparency.meta.com/sr/...` links redirect to the report PDF. The Sept 2022 and Q1 2023 reports are hosted at about.fb.com. Documents 18 onward were added in the second round: Meta Q3 2023, Q1 2024, Q2 2024 and Q3 2024 Russian networks and Doppelganger lists, and four OpenAI documents (143 Russian rows in all).

### Documents opened that supplied no rows

These were read and gave no usable domain or handle (see the next section for reasons):

- Meta Adversarial Threat Report Q1 2022 and Q2 2022 (about.fb.com PDFs, 2022-04-07 and 2022-08-04): indicators are malware and command-and-control infrastructure of cyber-espionage groups.
- Meta Adversarial Threat Report Q3 2022, filed as `Quarterly-Adversarial-Threat-Report-Q2-2022-1.pdf` (2022-11-22): the US network 'linked to individuals associated with the US military' has no domain or handle list.
- Meta Adversarial Threat Report Q4 2022 (2023-02-23): no indicator appendix beyond the Doppelganger domains already covered by the Sept 2022 report.
- Meta Adversarial Threat Report December 2021.
- OpenAI October 2024, June 2025, October 2025 and February 2026 reports: no usable domains or handles for the non-Russian cases. The Russian cases are covered by the rows from OpenAI October 2024, October 2025 and Fish Food (February 2026).
- US Treasury press releases jy2195 (2024-03-20), jy2559 (2024-09-04) and jy2766 (2024-09-27): no domains found by pattern search.
- Council Regulations (EU) 2022/350, 2022/879, 2022/2474, 2023/427, 2023/1214: now in `state-designations.json` (outlet names only, no domains).
- Meta Adversarial Threat Report Q4 2023 (2024-02), Russia: the Doppelganger section is a heading and a pointer to GitHub; the PDF has no domain list.
- Meta Q4 2024, Q1 2025 and H1 2026: Russian cases are described with no Russian domains or handles (the Q4 2024 Doppelganger section has no list; H1 2026 has no indicator appendix).
- Meta Q2/Q3 2025: the Russian cases (sub-Saharan Africa freelancers, the RT-linked Allo Afrique and Derniere Minute brands, a Moldova operation) give no domains or handles.
- OpenAI February 2025 (no Russian case) and June 2025 (Helgoland Bite: a Telegram channel and an unnamed X account, no domain or handle).
- Meta second half 2026: no such report exists as of 2026-10-18. The transparency.meta.com address returns an error page. Corrected 2026-10-21: the report exists at transparency.meta.com/sr/H2-2026-adversarial-threat-report/ (see data/ops.README.md). Its rows are not in this file yet.
- Google Threat Analysis Group bulletins: see the next section.

### Searched, nothing usable

- **United States, Meta Q3 2022**: the network is attributed to individuals associated with the US military, but the report publishes no domains or handles. Zero rows. (Rows for the United States come only from Meta Q2 2024, the Patriots Run Project network.)
- **Georgia (Meta Q1 2023)**: network linked to the Strategic Communications Department of the Government Administration of Georgia. No indicators published.
- **Croatia (Meta Q1 2024)**: network linked to HDZ youth wing individuals. No indicators published.
- **Ukraine (Meta Q4 2023)**: no indicators published.
- **India (Meta Q3 2024, Q2/Q3 2025), Azerbaijan, Egypt, Saudi Arabia, North Korea**: no network in the Meta or OpenAI reports I opened gave a domain or handle with a state attribution. India's two Q3 2024 networks have no indicator tables. The H1 2026 Meta network aimed at Azerbaijan is attributed to 'Azerbaijani individuals located in Iran and Germany' and lists no domains. Not searched in primary documents beyond these reports: Google TAG bulletins (see Unverified).
- **Romania (Meta Q1 2025)**: six X handles listed, but the report attributes the network to no state, firm or group ('originated in and targeted Romania'). Excluded.
- **Türkiye (Meta Q2 2023)**: networks 1 (Türkiye and Iran) and 2 (individuals around a news outlet, pay-per-click sites) name no state or firm, so their domains and handles are excluded. Network 3 (four social media agencies) is included.
- **Moldova (Meta Q3 2024)**: the only domain, point.md, is a legitimate news site whose articles the network summarized, so it is not the operation's property. Excluded.
- **China (Meta Q1 2025, Q4 2024)**: the Q1 2025 network lists no handles or domains. Q4 2024 gives one X handle (included) and blogspot pages (platform subdomains, excluded).
- **Doppelganger redirect domains (Meta Q2 2023)**: several hundred 'redirect domains', many of them apparently unrelated or compromised sites. Excluded on accuracy grounds; only the report's lists of spoofed domains and operation websites are included.
- **Social platform pages**: Telegram, TikTok, YouTube, Medium, Reddit and Blogspot addresses are not included (CMMNS matches domains and X handles only).
- **Malware, hacking-forum and registrar domains** named in the same appendices (for example leakzone.net, cracked.io, fastdomains.com) are excluded.
- **Ghana network, X handle `YamoahFestus` (Meta Q4 2024)**: the report lists it with the network's assets, but the name looks like a real person. Excluded as a possible private individual's account.
- **Victim accounts**: OpenAI February 2026 names @whyyoutouzhele, @huikezhen and @xu96175836 as targets of harassment by a Chinese operation. They are victims, not operation accounts. Excluded.
- **Legitimate outlets named as venues**: wapa.pe (OpenAI February 2025, sponsored content) and perfil.com (OpenAI February 2026). Excluded.
- **OpenAI June 2025, October 2025, February 2026**: operation websites and accounts for the non-Russian cases are not named, apart from revealscum.com (already in the data from May 2024).
- **US Treasury (OFAC)**: the 2024-03-20 (SDA, Structura), 2024-09-04 (RT, ANO Dialog) and 2024-09-27 releases name entities and brands but no domains.
- **Google TAG bulletins (Q3 2022, Q1 2024, Q1 2025, Q2 2025)**: each lists terminated YouTube channels and Ads accounts, and domains blocked from Google News surfaces and Discover, as counts per country (Russia, China, Iran, Turkey, Israel, Kuwait and others). None of the four names a domain or channel handle. The other quarters from 2022 to 2026 were not opened, so the result for them is unknown; the format was the same in all four that were opened.
- **Meta Q2 2024 Russia networks #3 and #4**: Telegram channels only, no domain or X handle.
- **OpenAI May 2024, Doppelganger**: `solarpanelfor.sale` is a random redirect link in X comments, not an operation website. Excluded like the other redirect domains.
- **OpenAI October 2024, Corrupt Comment**: anti-Navalny-foundation comments on X, no state or principal named, no handles given.
- **Treasury press release jy2559 (2024-09-04)**: the earlier note that it names no domains was wrong. It names `rrn.world` (already in the data from Meta) and `rrussianews.com` in the paragraph about ANO Dialog. Not added in this round. Candidate for the next one.

### Named, no domain given

Outlets that a designation document names are now in `state-designations.json`. Report-only cases with no domain: Social Design Agency, Structura, ANO Dialog and Dialog Regions (US Treasury 2024-03-20 and 2024-09-04), 'Reliable Recent News' and 'War on Fakes', and REST Media (OpenAI, linked to Rybar).

### Judgment calls to review

1. Ghana network (Meta Q4 2024, OpenAI Feb 2025): `state` is United Arab Emirates because the reports name a UAE marketing firm (DigitSol) behind a network that originated in Ghana.
2. Q1 2023 Venezuela row: `state` is Venezuela, the first country named; the network is stated as originating in Venezuela and the United States and tied to a Florida-registered firm.
3. Spamouflage rows are `government` because the Meta Q2 2023 and OpenAI May 2024 reports tie the network to people associated with Chinese law enforcement or to a Ministry of Public Security unit.
4. Meta Q3 2024 Iran rows are `government` because the report links the network to a threat actor Microsoft tied to the IRGC and to Emennet Pasargad per a US and Israeli advisory.
5. Doppelganger `actor` follows each document's own wording. Meta Sept 2022 and Q3 2023 name no principal (`individuals or group`). Meta Q2 2023, Q1 2024, Q2 2024 and Q3 2024 attribute it to two Russian companies sanctioned by the EU and the US Treasury (`commercial firm`; Q3 2024 names Structura National Technology and Social Design Agency). The DOJ affidavit says the Russian government directed it (`government`). The OpenAI May 2024 rows say only "on behalf of Doppelganger" (`individuals or group`). A domain can therefore appear with different `actor` values in different rows.
6. Meta Q3 2023 People Say and Military Wave handles are `government` because the report links the network to employees of RT, a Russian state-controlled media entity.
7. Meta Q2 2024 network #1 domains are `commercial firm` (IMA Digital, a Moscow-registered marketing firm). Network #2 (euronewstop.co.uk, newstop.africa and two X handles) names no principal in the Meta report, so it is `individuals or group`. The same brand in OpenAI October 2024 and October 2025 (Stop News) is `commercial firm` because OpenAI writes that it appeared consistent with an operation run by a marketing company, though it names no firm.
8. `britishtalks.com` (OpenAI October 2024) is a Stop News site that OpenAI calls non-political. It is listed because OpenAI names it as part of the operation.
9. `andaluciamorisca.org` (OpenAI Fish Food, February 2026) is the weakest Russian row. The case study shows Rybar-branded content on this Spanish-language site and does not say who runs it. It is recorded as a site that carried the content. Drop it if a chip should require stated ownership.
10. Fish Food date: the case-study page shows "February 1, 2026" while the parent report is dated February 25, 2026. The row carries `2026-02`.
11. Meta Q3 2024 Doppelganger domains sit under "Domains spoofing news sites" in the report although the preceding text calls them new brand iterations. Row names say "spoofed or brand".

## state-designations.json

### Row format

`outlet` (name as the document gives it), `state`, `designation`, optional `domain` (only where the document gives one), `source {title, url, date}`. Hyphens and spacing in outlet names are kept as the source prints them. One change: the Federal Register prints "TV-Novosti" with a special hyphen, and the row uses a plain hyphen.

### Totals

- Rows: 52. By state: Russia 32, China 15, Iran 4, Belarus 1.
- Rows with a document-given domain: 2 (irib.ir for Islamic Republic of Iran Broadcasting, tvr.by for Belteleradio Company). The IRIB release also gives `iransat.irib.ir` as an alternate website; it has no row of its own.

### Documents used

| # | Title | Date | URL | Rows | State and outlets |
|---|---|---|---|---|---|
| 1 | Senior State Department Officials On the Office of Foreign Missions Designation of Chinese Media Entities as Foreign Missions (special briefing) | 2020-02-18 | https://www.state.gov/senior-state-department-officials-on-the-office-of-foreign-missions-designation-of-chinese-media-entities-as-foreign-missions/ | 5 | China: Xinhua News Agency; China Global Television Network; China Radio International; China Daily Distribution Corporation; Hai Tian Development USA |
| 2 | Designation of Additional Chinese Media Entities as Foreign Missions (press statement) | 2020-06-22 | https://www.state.gov/designation-of-additional-chinese-media-entities-as-foreign-missions/ | 4 | China: China Central Television; China News Service; People’s Daily; Global Times |
| 3 | Designation of Additional PRC Propaganda Outlets as Foreign Missions (press statement) | 2020-10-21 | https://www.state.gov/designation-of-additional-prc-propaganda-outlets-as-foreign-missions/ | 6 | China: Yicai Global; Jiefang Daily; Xinmin Evening News; Social Sciences in China Press; Beijing Review; Economic Daily |
| 4 | Determination Pursuant to the Foreign Missions Act (Rossiya Segodnya), Federal Register Vol. 89, No. 176, FR Doc. 2024-20515 | 2024-09-11 | https://www.govinfo.gov/content/pkg/FR-2024-09-11/pdf/2024-20515.pdf | 1 | Russia: Rossiya Segodnya |
| 5 | Determination Pursuant to the Foreign Missions Act (RIA Novosti), Federal Register Vol. 89, No. 176, FR Doc. 2024-20517 | 2024-09-11 | https://www.govinfo.gov/content/pkg/FR-2024-09-11/pdf/2024-20517.pdf | 1 | Russia: RIA Novosti |
| 6 | Determination Pursuant to the Foreign Missions Act (RT), Federal Register Vol. 89, No. 176, FR Doc. 2024-20516 | 2024-09-11 | https://www.govinfo.gov/content/pkg/FR-2024-09-11/pdf/2024-20516.pdf | 1 | Russia: RT |
| 7 | Determination Pursuant to the Foreign Missions Act (TV-Novosti), Federal Register Vol. 89, No. 176, FR Doc. 2024-20518 | 2024-09-11 | https://www.govinfo.gov/content/pkg/FR-2024-09-11/pdf/2024-20518.pdf | 1 | Russia: TV-Novosti |
| 8 | Determination Pursuant to the Foreign Missions Act (Ruptly), Federal Register Vol. 89, No. 176, FR Doc. 2024-20513 | 2024-09-11 | https://www.govinfo.gov/content/pkg/FR-2024-09-11/pdf/2024-20513.pdf | 1 | Russia: Ruptly |
| 9 | Determination Pursuant to the Foreign Missions Act (Sputnik), Federal Register Vol. 89, No. 176, FR Doc. 2024-20520 | 2024-09-11 | https://www.govinfo.gov/content/pkg/FR-2024-09-11/pdf/2024-20520.pdf | 1 | Russia: Sputnik |
| 10 | Council Regulation (EU) 2022/350 of 1 March 2022 (adds Annex XV to Regulation (EU) No 833/2014) | 2022-03-01 | https://eur-lex.europa.eu/eli/reg/2022/350/oj | 6 | Russia: RT- Russia Today English; RT- Russia Today UK; RT - Russia Today Germany; RT - Russia Today France; RT- Russia Today Spanish; Sputnik |
| 11 | Council Regulation (EU) 2022/879 of 3 June 2022 (Annex VI amends Annex XV) | 2022-06-03 | https://eur-lex.europa.eu/eli/reg/2022/879/oj | 3 | Russia: Rossiya RTR / RTR Planeta; Rossiya 24 / Russia 24; TV Centre International |
| 12 | Council Regulation (EU) 2022/2474 of 16 December 2022 (Annex V amends Annex XV) | 2022-12-16 | https://eur-lex.europa.eu/eli/reg/2022/2474/oj | 4 | Russia: NTV/NTV Mir; Rossiya 1; REN TV; Pervyi Kanal |
| 13 | Council Regulation (EU) 2023/427 of 25 February 2023 (Annex V amends Annex XV) | 2023-02-25 | https://eur-lex.europa.eu/eli/reg/2023/427/oj | 2 | Russia: RT Arabic; Sputnik Arabic |
| 14 | Council Regulation (EU) 2023/1214 of 23 June 2023 (Annex IV amends Annex XV) | 2023-06-23 | https://eur-lex.europa.eu/eli/reg/2023/1214/oj | 5 | Russia: RT Balkan; Oriental Review; Tsargrad; New Eastern Outlook; Katehon |
| 15 | Council Regulation (EU) 2024/1428 of 17 May 2024 (Annex amends Annex XV) | 2024-05-17 | https://eur-lex.europa.eu/eli/reg/2024/1428/oj | 4 | Russia: Voice of Europe; RIA Novosti; Izvestija; Rossiiskaja Gazeta |
| 16 | Treasury Announces Sanctions Against Iran (U.S. Department of the Treasury press release tg1847) | 2013-02-06 | https://home.treasury.gov/news/press-releases/tg1847 | 1 | Iran: Islamic Republic of Iran Broadcasting |
| 17 | Treasury Sanctions Senior Officials and “Interrogator Journalists” of Iran’s State-Run Media (U.S. Department of the Treasury press release jy1109) | 2022-11-16 | https://home.treasury.gov/news/press-releases/jy1109 | 1 | Iran: Islamic Republic of Iran Broadcasting |
| 18 | Treasury Sanctions Iranian Entities for Attempted Election Interference (U.S. Department of the Treasury press release sm1158) | 2020-10-22 | https://home.treasury.gov/news/press-releases/sm1158 | 2 | Iran: Iranian Islamic Radio and Television Union; International Union of Virtual Media |
| 19 | Foreign Secretary announces sanctions on Putin’s propaganda (GOV.UK press release) | 2022-03-31 | https://www.gov.uk/government/news/foreign-secretary-announces-sanctions-on-putins-propaganda--2 | 2 | Russia: TV-Novosti; Rossiya Segodnya |
| 20 | Council Implementing Regulation (EU) 2022/876 of 3 June 2022 implementing Article 8a(1) of Regulation (EC) No 765/2006 (entry 35) | 2022-06-03 | https://eur-lex.europa.eu/eli/reg_impl/2022/876/oj | 1 | Belarus: Belteleradio Company |

How the documents were read:
- The three 2020 State Department statements were read from Internet Archive copies of the state.gov pages. state.gov returned "Technical Difficulties" to curl from this machine on 2026-10-18, on the 2017-2021 and 2021-2025 hosts alike. The rows cite the state.gov URL, which is the document's own address. Snapshots used: web.archive.org/web/20200316151030 (February 18 briefing), /web/2020 (June 22 statement), /web/20201022 (October 21 statement).
- EU regulations were read as Official Journal PDFs from the Publications Office. eur-lex.europa.eu returns an empty bot-check page to curl, so the cited ELI addresses are the canonical ones but were not fetched directly.
- The State Department Federal Register notices of 2024-09-11 are the formal determinations. Press coverage dates the action to 2024-09-04.
- The Treasury and GOV.UK pages were fetched directly.

### Not found or not included

- **OFAC and Press TV**: no OFAC press release that I opened names Press TV. The Treasury releases tg1847 (IRIB, 2013) and jy1109 (2022) do not mention it. Press TV domains were seized by the US Department of Justice in June 2021, which is a forfeiture action and not a designation. The justice.gov page returned a bot-check page and was not read, so there is no Press TV row. The Treasury release sm1158 (2020-10-22) designates the Iranian Islamic Radio and Television Union. Secondary sources link the seized domains to that entity; I could not confirm that in a primary document.
- **OFAC and Russian outlets**: Treasury release jy2559 (2024-09-04) does not designate RT or Rossiya Segodnya. It cites the State Department's foreign-mission designation of the Rossiya Segodnya group "and five of its subsidiaries, RIA Novosti, RT, TV-Novosti, Ruptly, and Sputnik". OFAC designated ANO Dialog, Dialog Regions and individuals. No OFAC row for Russian outlets.
- **OFAC and state media of other countries (Venezuela, Nicaragua, Belarus, Cuba, Syria)**: one search of treasury.gov found no press release designating a state media outlet. The search was not exhaustive. Unknown.
- **Other State Department 2020 designations**: the Confucius Institute U.S. Center (August 2020) and the National Association for China's Peaceful Unification are foreign-mission designations of non-media bodies and are not included. No State Department media designations after October 2020 were found.
- **EU Annex XV after 2024-05-17**: one search found no later regulation amending Annex XV. Measures in 2025 and 2026 under the hybrid-threat regime (for example Euromore) were not read in the Official Journal. Unverified. Regulations 2023/2878, 2024/753, 2024/1745 and 2024/2642 were opened and do not amend Annex XV.
- **Council Implementing Decision (CFSP) 2024/1770** (2024-06-24), which makes the 2024/1428 listings applicable, was not opened.
- **UK**: the 2022-03-31 GOV.UK press release names TV-Novosti and Rossiya Segodnya. The OFSI consolidated list entries were not read, so the legal names and current status on the list are unconfirmed. UK designations of Iranian, Belarusian or Chinese outlets: one search found none.
- **EU Belarus**: Belteleradio Company is entry 35 in Council Implementing Regulation (EU) 2022/876 (Annex I to Regulation 765/2006). Other Belarusian outlets were not searched.
- **EU Iran**: one search did not surface an Annex IX entry for IRIB or Press TV under Regulation 267/2012. Unknown.
- **Chinese outlets under any EU or UK regime**, and Iranian media under the EU human-rights regime: not searched.

## Unverified

- Google TAG bulletins other than the four opened.
- Annex XV status after 2024-05-17, OFSI list entries, and EU Iran media listings.
- The link between Press TV domains and the IRTVU designation (DOJ 2021 release not read).
- The OpenAI February 2026 report PDF could not be text-extracted (rotated pages). The Fish Food row cites the OpenAI case-study page, which says it was first published in that report.
- `scripts/verify-reports.mjs` was not run (instruction: do not run build scripts). The new report rows were checked by a substring test against local copies of the source texts: all 143 additions were found. Designation outlet names were checked the same way for the State Department statements; the EU, Treasury, UK and Federal Register names were read directly from the extracted text.
- Meta Q3 2023 and Q2 2024 lists were extracted by pattern from layout text. A target country is in a row name only where the Q1 to Q3 2024 table column was unambiguous.


## Added by the lead session (2026-10-18)

- Treasury press release jy2559, "Treasury Takes Action as Part of a U.S. Government Response to Russia's Foreign Malign Influence Operations" (2024-09-04), https://home.treasury.gov/news/press-releases/jy2559: `rrussianews.com` and `rrn.world`, actor `government` (the release says ANO Dialog's work was for the Russian government).
- Removed `andaluciamorisca.org`: the cited page does not say who runs the site.
- OpenAI Stop News rows set to `individuals or group`: OpenAI wrote that the operation "appeared consistent with" a marketing company but named none.
- Press TV, still a gap: the Justice Department's 2021-06-22 release on seizing 33 IRTVU websites (read through the Internet Archive copy) does not name the domains.
