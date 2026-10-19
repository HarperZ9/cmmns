# state-reports.json: sources, counts and gaps

Built 2026-10-18 for Radar. Every row is a domain or X handle that appears verbatim in the cited document (defanged `[.]` restored). Each row carries the document title, a direct URL and a date. This file is generated from `state-reports.json`, so its counts match the data.

## Row format

`domain` or `x` (handle without @, lower case), `state`, `actor`, `name`, optional `operation`, `source {title, url, date}`.

- `state`: the single country the report says the operation came from. Where a report names a firm in one country that ran a network aimed elsewhere, the firm's country is used.
- `actor`, from the report's own wording: `government` (report ties the operation to a government, military, intelligence service, law enforcement or state media), `commercial firm` (report names a PR, marketing, political-consultancy or IT firm; the firm is in `operation`), `individuals or group` (anything else, including operations with no stated principal). A firm is never upgraded to `government` unless the cited document says so.
- `date`: `YYYY-MM-DD` where the publisher's own page or file gives the day. Where only the month is confirmed the value is `YYYY-MM`. Those are: Meta Q3 2023 (2023-11), Q4 2023 (2024-02), Q3 2024 (2024-12), Q4 2024 (2025-02), Q1 2025 (2025-05), Q2/Q3 2025 (2025-12), H1 2026 (2026-03). Meta Q2 2023 (2023-08-29), Q1 2024 (2024-05-29) and Q2 2024 (2024-08-15) take the day from news coverage and, for Q2 2024, the PDF creation stamp; Meta's own listing shows the month only.
- Several X handles are fake personas that the reports list by name (for example Spamouflage accounts). Most are suspended. No IP addresses are included.

## Totals

- Rows: 977 (811 domains, 166 X handles). Distinct domain-or-handle and state pairs: 869 (a domain named by two documents has two rows, one per document).

### Rows per state

| State | Rows | government | commercial firm | individuals or group |
|---|---|---|---|---|
| Russia | 698 | 34 | 148 | 516 |
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
| **All** | **977** | **86** | **217** | **674** |

## Documents used (every document that supplied at least one row)

| # | Title | Date | URL | Rows | States |
|---|---|---|---|---|---|
| 1 | Taking down coordinated inauthentic behavior from Russia and China (Meta detailed report, September 2022; Russia domain list last updated November 22, 2022) | 2022-09-27 | https://about.fb.com/wp-content/uploads/2022/10/CIB-Report_-China-Russia_Sept-2022-1-1.pdf | 516 | Russia 516 |
| 2 | Meta's Adversarial Threat Report, First Quarter 2023 | 2023-05-03 | https://about.fb.com/wp-content/uploads/2023/06/Meta-Quarterly-Adversarial-Threat-Report-Q1-2023.pdf | 46 | Togo 29, Venezuela 7, Iran 6, China 4 |
| 3 | Meta's Adversarial Threat Report, Third Quarter 2023 | 2023-11 | https://transparency.meta.com/sr/Q3-2023-Adversarial-threat-report/ | 91 | China 85, Iran 6 |
| 4 | Meta's Adversarial Threat Report, Fourth Quarter 2023 | 2024-02 | https://transparency.meta.com/sr/Q4-2023-Adversarial-threat-report/ | 4 | Myanmar 4 |
| 5 | Meta's Adversarial Threat Report, First Quarter 2024 | 2024-05-29 | https://transparency.meta.com/sr/Q1-2024-Adversarial-threat-report/ | 34 | Bangladesh 18, Iran 7, China 5, Israel 4 |
| 6 | Meta's Adversarial Threat Report, Second Quarter 2024 | 2024-08-15 | https://transparency.meta.com/sr/Q2-2024-Adversarial-threat-report/ | 21 | United States 11, Vietnam 10 |
| 7 | Meta's Adversarial Threat Report, Third Quarter 2024 | 2024-12 | https://transparency.meta.com/sr/Q3-2024-Adversarial-threat-report/ | 12 | Iran 8, Lebanon 4 |
| 8 | Meta's Adversarial Threat Report, Fourth Quarter 2024 | 2025-02 | https://transparency.meta.com/sr/Q4-2024-Adversarial-threat-report/ | 5 | Benin 2, United Arab Emirates 2, China 1 |
| 9 | Meta's Adversarial Threat Report, First Quarter 2025 | 2025-05 | https://transparency.meta.com/sr/Q1-2025-Adversarial-threat-report/ | 3 | Iran 3 |
| 10 | AI and Covert Influence Operations: Latest Trends (OpenAI threat report, May 2024) | 2024-05-30 | https://cdn.openai.com/threat-intelligence-reports/threat-intel-report-may-2024.pdf | 7 | Israel 4, Iran 2, China 1 |
| 11 | Disrupting a covert Iranian influence operation | 2024-08-16 | https://openai.com/index/disrupting-a-covert-iranian-influence-operation/ | 5 | Iran 5 |
| 12 | Disrupting malicious uses of our models: an update (OpenAI threat report, February 2025) | 2025-02-21 | https://cdn.openai.com/threat-intelligence-reports/disrupting-malicious-uses-of-our-models-february-2025-update.pdf | 5 | Iran 4, United Arab Emirates 1 |
| 13 | Affidavit in Support of Seizure Warrant, United States v. Certain Domains, No. 24-mj-1395 (E.D. Pa.), filed 2024-09-04 | 2024-09-04 | https://www.justice.gov/d9/2024-09/doppelganger_affidavit_9.4.24.pdf | 32 | Russia 32 |
| 14 | Alerting the World to RT's Global Covert Activities (U.S. Department of State fact sheet) | 2024-09-13 | https://2021-2025.state.gov/alerting-the-world-to-rts-global-covert-activities/ | 2 | Russia 2 |
| 15 | Meta's Semiannual Adversarial Threat Report, Second and Third Quarter 2025 | 2025-12 | https://transparency.meta.com/sr/Q2-Q3-2025-Adversarial-threat-report/ | 3 | Iran 3 |
| 16 | Meta's Semiannual Adversarial Threat Report, First Half 2026 | 2026-03 | https://transparency.meta.com/sr/first-half-2026-Adversarial-threat-report/ | 1 | Pakistan 1 |
| 17 | Meta's Adversarial Threat Report, Second Quarter 2023 (Doppelganger domain list last updated November 30, 2023) | 2023-08-29 | https://transparency.meta.com/sr/Q2-2023-Adversarial-threat-report/ | 190 | Russia 148, China 35, Turkiye 7 |

The Meta `transparency.meta.com/sr/...` links redirect to the report PDF. The Sept 2022 and Q1 2023 reports are hosted at about.fb.com.

## Documents opened that supplied no rows

These were read and gave no usable domain or handle (see the next section for reasons):

- Meta Adversarial Threat Report Q1 2022 and Q2 2022 (about.fb.com PDFs, 2022-04-07 and 2022-08-04): indicators are malware and command-and-control infrastructure of cyber-espionage groups.
- Meta Adversarial Threat Report Q3 2022, filed as `Quarterly-Adversarial-Threat-Report-Q2-2022-1.pdf` (2022-11-22): the US network 'linked to individuals associated with the US military' has no domain or handle list.
- Meta Adversarial Threat Report Q4 2022 (2023-02-23): no indicator appendix beyond the Doppelganger domains already covered by the Sept 2022 report.
- Meta Adversarial Threat Report December 2021.
- OpenAI, Influence and cyber operations: an update (October 2024), June 2025, October 2025 and February 2026 'Disrupting malicious uses of AI' reports: no usable operation domains or handles for the non-Russian cases (details below). The Oct 2024 report's domains belong to Russian operations, which were paused this round.
- US Treasury press releases jy2195 (2024-03-20), jy2559 (2024-09-04) and jy2766 (2024-09-27): no domains found by pattern search.
- Council Regulations (EU) 2022/350, 2022/879, 2022/2474, 2023/427, 2023/1214, Annex XV: outlet names only.

## Searched, nothing usable

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
- **Social platform pages**: Telegram, TikTok, YouTube, Medium, Reddit and Blogspot addresses are not included (Radar matches domains and X handles only).
- **Malware, hacking-forum and registrar domains** named in the same appendices (for example leakzone.net, cracked.io, fastdomains.com) are excluded.
- **Ghana network, X handle `YamoahFestus` (Meta Q4 2024)**: the report lists it with the network's assets, but the name looks like a real person. Excluded as a possible private individual's account.
- **Victim accounts**: OpenAI February 2026 names @whyyoutouzhele, @huikezhen and @xu96175836 as targets of harassment by a Chinese operation. They are victims, not operation accounts. Excluded.
- **Legitimate outlets named as venues**: wapa.pe (OpenAI February 2025, sponsored content) and perfil.com (OpenAI February 2026). Excluded.
- **OpenAI June 2025, October 2025, February 2026**: operation websites and accounts for the non-Russian cases are not named, apart from revealscum.com (already in the data from May 2024). OpenAI October 2024: the domains are Russian (paused).
- **US Treasury (OFAC)**: the 2024-03-20 (SDA, Structura), 2024-09-04 (RT, ANO Dialog) and 2024-09-27 releases name entities and brands but no domains.

## Named, no domain given

Outlets or brands that an official document names but for which the document gives no domain. No row is written for them.

- Russia (EU Council Regulation 2022/350 of 1 March 2022, Annex XV): RT - Russia Today English, UK, Germany, France, Spanish; Sputnik.
- Russia (EU Council Regulation 2022/879 of 3 June 2022): Rossiya RTR / RTR Planeta; Rossiya 24 / Russia 24; TV Centre International.
- Russia (EU Council Regulation 2022/2474 of 16 December 2022): NTV/NTV Mir; Rossiya 1; REN TV; Pervyi Kanal.
- Russia (EU Council Regulation 2023/427 of 25 February 2023): RT Arabic; Sputnik Arabic.
- Russia (EU Council Regulation 2023/1214 of 23 June 2023): RT Balkan; Oriental Review; Tsargrad; New Eastern Outlook; Katehon.
- Russia (US State Department fact sheet 'Alerting the World to RT's Global Covert Activities', 2024-09-13): Rossiya Segodnya, TV-Novosti and RT (designations); Sputnik. The same document gives africanstream.media and thered.stream, which are in the data.
- Russia (US Treasury, 2024-09-04 and 2024-03-20): ANO Dialog, Dialog Regions, Social Design Agency, Structura, 'Reliable Recent News' (RRN) and 'War on Fakes', with no domains in the releases. waronfakes.com and rrn.media are in the data from the DOJ affidavit.

## Unverified (could not open the primary document, so no rows)

- **US State Department foreign-mission designations of PRC outlets (2020-02-18 and 2020-06-22)**: state.gov returned 'Technical Difficulties' or 403 to every request and the Internet Archive blocked access, so I could not read the statements. Search-result summaries (not primary) name Xinhua News Agency, China Global Television Network, China Radio International, China Daily Distribution Corporation and Hai Tian Development USA (February), and CCTV, China News Service, People's Daily and Global Times (June). Treat these names as unconfirmed. Statements of this kind may give no domains, so the expected yield is zero rows either way.
- **US State Department designation of Rossiya Segodnya as a foreign mission (2024-09-04)**: not opened. Only the 2024-09-13 fact sheet was read.
- **Google Threat Analysis Group bulletins**: not searched in this round, so no TAG rows exist and the absence says nothing about their content. Same for the other states TAG covers.
- **OpenAI reports other than those listed**: the October 2024 report was read only for domains, which were Russian.
- **Russia (paused at the lead's direction)**: Meta Q3 2023 and Q2 2024 Russian networks (for example PeopleSayNews, militarywave001, IMA Digital domains yerli-media.org, lurermedia.org, sakartvelo-today.org, euronewstop.co.uk, newstop.africa), Meta Q4 2023 onward Doppelganger updates, Meta H2 2026 Russian domains, and OpenAI Russian cases were identified but not added. The Russia rows present come from Meta Sept 2022, Meta Q2 2023, the DOJ affidavit and the State fact sheet.
- **Dates**: see the date note under Row format.
- **Judgment calls to review**: (1) Ghana network (Meta Q4 2024, OpenAI Feb 2025): `state` is United Arab Emirates because the reports name a UAE marketing firm (DigitSol) behind a network that originated in Ghana. (2) Q1 2023 Venezuela row: `state` is Venezuela, the first country named; the network is stated as originating in Venezuela and the United States and tied to a Florida-registered firm. (3) Spamouflage rows are `government` because the Meta Q2 2023 and OpenAI May 2024 reports tie the network to people associated with Chinese law enforcement or, per OpenAI, to a Ministry of Public Security unit. (4) Meta Q3 2024 Iran rows are `government` because the report links the network to a threat actor Microsoft tied to the IRGC and to Emennet Pasargad per a US and Israeli advisory. (5) Meta Sept 2022 Doppelganger rows are `individuals or group` because that report names no principal; Meta's Q2 2023 report names two Russian firms (`commercial firm`) and the DOJ affidavit says the Russian government directed the operation (`government`). A domain can therefore appear with different `actor` values in different rows.
