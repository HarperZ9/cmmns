<!-- writing-profile: research -->
# Legal review checklist

**Draft for counsel review. Not legal advice. Not in force: this page awaits a lawyer's review and
is not part of CMMNS' terms until that review is done.**

Drafted 2026-10-28, for the lawyer who reviews the legal and responsible-use pack before CMMNS' new capabilities (library capture, the conduct record, the study engine) go public. The pack:
`ACCEPTABLE-USE.md`, `RESPONSIBLE-USE.md`, `LEGAL-NOTICE.md`, `SUBJECT-REQUESTS.md`,
`DATA-PROTECTION.md`, `PLATFORM-CAPTURE.md`, `CREATORS-AND-IP.md`.

The facts counsel needs first: CMMNS is AGPL-3.0 software (CC BY 4.0 for data and docs)
that runs on the user's device. The project runs no server, holds no user data and receives no
telemetry (`DATA-PROTECTION.md`, section 2, lists every network request in the code). It is
maintained by one person, Zain Dana Harper, a sole proprietor with no employees (country and state
of residence, and any entity choice: to confirm with the maintainer). The project publishes data tables
that name public figures and organisations (`SUBJECT-REQUESTS.md`).

Every statute and case below has a source link and a status:
- **text read**: the operative text was read at the link for this draft;
- **confirmed**: the citation and holding were confirmed from the court's or an official page, a
  docket copy, or two or more independent legal commentaries, without reading the full opinion;
- **unverified**: not checked; do not rely on the citation as written.

Questions marked **(priority)** are the ones most in need of a lawyer before launch.

## 1. United States

### Computer access (CFAA)
1. **(priority)** Does library capture with auto-scroll in the self-distributed build, run logged in
   with the user's own session, raise any CFAA exposure for users under *Van Buren*'s "gates-up-or-
   down" reading and *hiQ*'s holding on public pages? Does the answer change logged out?
2. Does the X "About this account" request (repeating the request X's own app makes, one account per
   1.5 s, with the user's session) differ legally from reading the page?
3. Could the project be liable as a toolmaker for a user's CFAA violation, given that the code refuses
   login-gated pages on the command line and never circumvents?
4. State computer-crime statutes: which ones are broader than the CFAA and matter here?

### Contract claims from site terms
5. **(priority)** After *Meta v. Bright Data* (logged-off scraping outside Meta's terms) and *X Corp.
   v. Bright Data* (contract claims over public posts preempted by copyright, May 2024), what
   contract exposure do users have when capturing logged in versus logged out? Should the docs tell
   users to capture logged out by default?
6. Can a platform hold the project to its terms when the project never agreed to them as a user of
   that platform for the product's operation?
7. Trespass to chattels and server-load theories: does the human-pace design (and keeping auto-scroll
   out of store builds) answer them? Is a stated maximum rate for auto-scroll advisable?

### Section 230
8. Is the project an "access software provider" under 47 U.S.C. 230(f)(4) (software or tools that
   filter, screen, pick, analyse or display content), and does 230(c)(1) protect it from claims over
   badges and readings about third-party content? Does it matter that the project hosts nothing?
9. If the project later hosts a shared catalogue or packs, what changes?

### DMCA and copyright
10. **(priority)** 17 U.S.C. 1201: the code refuses DRM and encrypted streams before fetching protected
    segments. Is there any remaining anti-circumvention exposure in the self-distributed build's
    YouTube hand-off to yt-dlp (`cmmns media fetch`), which the user runs on an address they give?
11. Contributory and inducement liability (*Sony*, *Grokster*): given substantial non-infringing uses
    and documentation that discourages infringement, what wording in the docs and the release notes
    keeps clear of inducement? Is the YouTube hand-off a risk to remove or to keep?
12. Does the 2024 section 1201 rulemaking's text-and-data-mining exemption (limited to researchers at
    nonprofit institutions of higher education) matter, given the tool does not circumvent?
13. Should the project register a DMCA agent, and does it need one if it hosts nothing beyond GitHub?

### Defamation and false light
14. **(priority)** For the project: can a reading the tool shows (a count, a rate, a contradiction
    pair, a fact-check match, a state label in a published table) be a defamatory statement by the
    project? Does the "conduct, not character" rule, with every reading linked and stated with its
    denominator and does-not-prove line, reduce exposure? Which wording in the window should change?
15. For users: what should `RESPONSIBLE-USE.md` add so that users who publish conclusions about a
    person stay within *New York Times v. Sullivan* and *Gertz*, and avoid false-light claims (where
    recognised)?
16. The project's own tables name public figures (`src/ext/personalities.json`) with their sources'
    words. Is the challenge and correction process (`GOVERNANCE.md`) enough, or is a formal
    retraction policy needed?
17. Exposure to foreign defamation suits (UK, EU, elsewhere), and whether the SPEECH Act limits
    enforcement of foreign judgments in the US.

### Anti-SLAPP
18. Would California's anti-SLAPP statute (Cal. Code Civ. Proc. 425.16) or the maintainer's own
    state's statute protect the project and users sued over published findings? Is there a federal
    anti-SLAPP statute (none known; unverified)?

### Consumer reporting and privacy
19. **(priority)** Could a user who builds conduct records on private people and shares them for
    employment, tenancy, credit or insurance decisions be a "consumer reporting agency" under 15 U.S.C.
    1681a(f)? Could the project be one? Is the acceptable-use exclusion of eligibility screening the
    right response?
20. CCPA and CPRA: confirm the project is not a "business" (Cal. Civ. Code 1798.140(d)). Any other
    state privacy laws (for example Colorado, Virginia, Texas) with no revenue threshold that could
    reach a sole proprietor publishing open-source software?
21. State laws on people-search and data brokers (California's Delete Act, Vermont's data broker law):
    does publishing the personalities table, or a future shared catalogue, trigger registration?

## 2. European Union and United Kingdom

### GDPR and UK GDPR
22. **(priority)** Household exemption, Article 2(2)(c) and Recital 18: does publishing local software
    make the project a controller that "provide[s] the means for processing" under Recital 18's last
    sentence, when it receives no data? Where does a user leave the exemption (*Lindqvist*)?
23. **(priority)** Article 85 journalism exemptions: which member states' laws give the broadest
    coverage to citizen journalists and researchers, and which are narrow? What documentation (case
    folders, rungs, source logs) best supports a UK controller's "reasonable belief" under DPA 2018,
    Schedule 2, paragraph 26?
24. Article 22 and profiling: the conduct record computes per-person rates from public posts. Is that
    "profiling" under Article 4(4) even though no decision is made? What follows for users who are not
    journalists?
25. Special-category data (Article 9): political opinions are likely to appear in captured posts. Which
    conditions apply to users, and does Article 9(2)(e) (data "manifestly made public") help?
26. The project as controller of its own tables: lawful basis (legitimate interests or Article 85),
    transparency duties toward the people named (Article 14), and whether the published personalities
    table needs a DPIA.
27. Territorial scope (Article 3(2)): is the project, as a US publisher of free software, subject to
    the GDPR for its tables about EU people? Does it need an EU or UK representative (Article 27)?
28. Erasure and git history: what does an accepted erasure request require of a public git repository
    and published releases, which `SUBJECT-REQUESTS.md` says cannot be rewritten or recalled?

### Digital Services Act
29. The project hosts nothing today. If it publishes a shared catalogue or accepts packs for hosting,
    is it a "hosting service" (Article 6) with notice-and-action duties (Article 16)? Do the
    micro-enterprise carve-outs apply?

### Creators and IP
30. **(priority)** Exact reconstruction for private study (layers plus residual, byte for byte, kept
    on the user's device, never redistributed): which legal basis covers it in each jurisdiction? US
    fair use; UK s.29(1C) private study; EU Article 5(2)(b) private copying where a member state has
    it; EU Article 3 or 4 text and data mining. The UK has no private-copying exception since 2015.
31. **(priority)** Article 4(3) reservations: does a machine-readable reservation bind a natural
    person's private study, or only text and data mining under Article 4? Which machine-readable forms
    (robots.txt, TDMRep, metadata) count after *Kneschke v. LAION*? No CMMNS code reads
    reservations today; what must the study engine read before release?
32. After *GEMA v. OpenAI*, does an exact reconstruction kept privately count as a reproduction outside
    the text-and-data-mining exceptions?
33. US: after *Bartz*, *Kadrey*, *Thomson Reuters v. Ross* and *Warhol*, how should the docs describe
    study of works obtained from streaming or social platforms, where the copy's lawfulness depends on
    the platform's terms?
34. Does the similarity gate, with its stated thresholds and its "passing is not originality" line,
    help or hurt the project's position if a user's new work is accused of infringing?
35. Sound: is the gate's audio rule set (chroma, log-mel, landmarks) a reasonable stand-in for
    substantial-similarity tests in music cases? Is melody, reported but not blocking, a risk?
36. UK: does *Getty v. Stability AI* help the position that descriptor files are not copies of works?

## 3. Licensing

37. **(priority)** Does an acceptable-use policy stated beside AGPL-3.0 software conflict with AGPL
    Section 10 ("You may not impose any further restrictions") or Section 7 (removal of further
    restrictions), with the Free Software Definition's freedom 0, or with the Open Source Definition's
    criteria 5 and 6? Is framing it as a condition of project support, not of the licence, enough?
38. Can the project lawfully refuse support, block accounts from its spaces and decline contributions
    on acceptable-use grounds without that being a licence condition?
39. Trademark: AGPL Section 7(e) lets the project decline trademark rights. The project was named
    Daylight Commons until 2026-10-28 and is now CMMNS. Is "CMMNS" clear to use, and should it
    be registered, and in which classes and countries? Does the forks-may-say-derived language in
    `GOVERNANCE.md` and `LEGAL-NOTICE.md` hold up?
40. Do the warranty disclaimer and limitation of liability in `LEGAL-NOTICE.md` go as far as AGPL
    Sections 15 to 17 and CC BY 4.0 Section 5 allow, and are they enforceable against consumers in the
    EU and UK? Is a separate end-user notice needed in the browser stores?
41. The DCO-only contribution model: any liability or warranty exposure from contributions?

## 4. Other

42. Export: confirm the software is "published" (15 CFR 734.7) and so outside the EAR under
    734.3(b)(3), with its ECDSA and SHA-256 use. Any OFAC steps for a free download with no paid
    services?
43. Entity and insurance: should the maintainer operate through an LLC, and is media-liability or
    errors-and-omissions insurance available for an open-source maintainer?
44. Store listings: do the Chrome Web Store and Firefox Add-ons policies on data collection and on
    downloading from third-party sites require any change to the store builds or their listings?

## Sources and verification status

| Authority | Link | Status |
|---|---|---|
| Computer Fraud and Abuse Act, 18 U.S.C. 1030(a)(2)(C), (e)(6), (g) | https://www.law.cornell.edu/uscode/text/18/1030 | text read |
| *Van Buren v. United States*, 593 U.S. 374 (2021) | https://supreme.justia.com/cases/federal/us/593/19-783/ ; https://www.supremecourt.gov/opinions/20pdf/19-783_k53l.pdf | confirmed |
| *hiQ Labs v. LinkedIn*, 31 F.4th 1180 (9th Cir. 2022) | https://law.justia.com/cases/federal/appellate-courts/ca9/17-16783/17-16783-2022-04-18.html | confirmed |
| *Meta Platforms v. Bright Data*, No. 23-cv-00077-EMC (N.D. Cal. 23 Jan. 2024) | https://ia904708.us.archive.org/2/items/gov.uscourts.cand.406956/gov.uscourts.cand.406956.181.0.pdf | confirmed (docket copy located, not read) |
| *X Corp. v. Bright Data*, No. C 23-03698 WHA (N.D. Cal. 9 May 2024) | https://www.cnbc.com/2024/05/10/elon-musks-x-loses-lawsuit-against-bright-data-over-data-scraping.html | confirmed (press and commentary only) |
| 47 U.S.C. 230(c)(1), (f)(2), (f)(4) | https://www.law.cornell.edu/uscode/text/47/230 | text read |
| 17 U.S.C. 1201(a)(1)(A), (a)(3) | https://www.law.cornell.edu/uscode/text/17/1201 | text read |
| Section 1201 rulemaking, final rule of 28 Oct. 2024 | https://copyright.gov/1201/2024/ | confirmed |
| 17 U.S.C. 107 | https://www.law.cornell.edu/uscode/text/17/107 | text read |
| *Sony Corp. v. Universal City Studios*, 464 U.S. 417 (1984) | https://www.law.cornell.edu/supremecourt/text/04-480 (cited within *Grokster*) | confirmed (commentary) |
| *MGM Studios v. Grokster*, 545 U.S. 913 (2005) | https://www.law.cornell.edu/supremecourt/text/04-480 | confirmed |
| *Authors Guild v. Google*, 804 F.3d 202 (2d Cir. 2015) | https://www.copyright.gov/fair-use/summaries/authorsguild-google-2dcir2015.pdf | confirmed |
| *Andy Warhol Foundation v. Goldsmith*, 598 U.S. 508 (2023) | https://www.supremecourt.gov/opinions/22pdf/21-869_87ad.pdf | confirmed (opinion located, not read) |
| *Bartz v. Anthropic* (N.D. Cal. 23 June 2025) | https://www.debevoise.com/insights/publications/2025/06/anthropic-and-meta-decisions-on-fair-use | confirmed (commentary) |
| *Kadrey v. Meta* (N.D. Cal. 25 June 2025) | same | confirmed (commentary) |
| *Thomson Reuters v. Ross Intelligence*, No. 1:20-cv-613-SB (D. Del. 11 Feb. 2025) | https://www.jenner.com/en/news-insights/client-alerts/court-decides-that-use-of-copyrighted-works-in-ai-training-is-not-fair-use-thomson-reuters-enterprise-centre-gmbh-v-ross-intelligence-inc | confirmed (commentary) |
| *New York Times Co. v. Sullivan*, 376 U.S. 254 (1964); *Gertz v. Robert Welch*, 418 U.S. 323 (1974) | https://www.fire.org/supreme-court/gertz-v-robert-welch-inc | confirmed (commentary) |
| False light, Restatement (Second) of Torts 652E | none | unverified |
| SPEECH Act, 28 U.S.C. 4101 to 4105 | none | unverified |
| Federal anti-SLAPP statute (believed to be none) | none | unverified |
| Cal. Code Civ. Proc. 425.16 | https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CCP&sectionNum=425.16 | text read |
| Fair Credit Reporting Act, 15 U.S.C. 1681a(d), (f) | https://www.law.cornell.edu/uscode/text/15/1681a | text read |
| CCPA "business", Cal. Civ. Code 1798.140(d); 2025 threshold | https://www.cppa.ca.gov/regulations/cpi_adjustment.html | confirmed (statute page refused automated reading) |
| California Delete Act; Vermont data broker law | none | unverified |
| GDPR, Regulation (EU) 2016/679: Art. 2(2)(c), Recital 18, Art. 12(3), Art. 22(1), Art. 85(1) and (2), Art. 89 | https://eur-lex.europa.eu/eli/reg/2016/679/oj (read through https://publications.europa.eu/resource/celex/32016R0679) | text read |
| GDPR Art. 3(2), 4(4), 9(2)(e), 14, 27 | same | unverified (not read for this draft) |
| *Lindqvist*, C-101/01, ECLI:EU:C:2003:596 | https://curia.europa.eu/juris/liste.jsf?num=C-101/01 | confirmed (commentary) |
| UK Data Protection Act 2018, Sch. 2, para. 26 | https://www.legislation.gov.uk/ukpga/2018/12/schedule/2/paragraph/26 | text read |
| UK Data Protection Act 2018, Sch. 2, para. 27 | https://www.legislation.gov.uk/ukpga/2018/12/schedule/2/paragraph/27 | heading read |
| Digital Services Act, Regulation (EU) 2022/2065, Art. 6 and 16 | https://eur-lex.europa.eu/eli/reg/2022/2065/oj | text read |
| DSM Directive (EU) 2019/790, Art. 3 and 4 | https://eur-lex.europa.eu/eli/dir/2019/790/oj | text read |
| InfoSoc Directive 2001/29/EC, Art. 5(2)(b), 5(3)(d) | https://eur-lex.europa.eu/eli/dir/2001/29/oj | text read |
| *Kneschke v. LAION*, OLG Hamburg 5 U 104/24 (10 Dec. 2025); LG Hamburg 310 O 227/23 (27 Sept. 2024) | https://www.technologyslegaledge.com/2025/12/robert-kneschke-v-laion-judgment-of-10-december-2025-ref-5-u-104-24/ | confirmed (commentary) |
| *GEMA v. OpenAI*, LG München I 42 O 14139/24 (11 Nov. 2025) | https://www.medialaws.eu/gema-v-openai-decision-of-the-munich-regional-court/ | confirmed (commentary) |
| Copyright, Designs and Patents Act 1988, s.29(1), (1C) | https://www.legislation.gov.uk/ukpga/1988/48/section/29 | text read |
| Copyright, Designs and Patents Act 1988, s.29A | https://www.legislation.gov.uk/ukpga/1988/48/section/29A | text read |
| s.28B quashed: *BASCA v. Secretary of State* [2015] EWHC 1723 (Admin) and [2015] EWHC 2041 (Admin) | https://caselaw.nationalarchives.gov.uk/ewhc/admin/2015/1723 | confirmed (commentary) |
| *Getty Images v. Stability AI* [2025] EWHC 2863 (Ch) | https://caselaw.nationalarchives.gov.uk/ewhc/ch/2025/2863 | confirmed (judgment page located, not read) |
| AGPL-3.0, Sections 7, 10, 15, 16, 17 | `LICENSE` | text read |
| CC BY 4.0, Section 5 | `LICENSES/CC-BY-4.0.txt` | text read |
| Open Source Definition, criteria 5 and 6 | https://opensource.org/osd | text read |
| Free Software Definition, freedom 0 | https://www.gnu.org/philosophy/free-sw.html | text read |
| EAR, 15 CFR 734.3(b)(3) | https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-734/section-734.3 | text read |
| EAR, 15 CFR 734.7 | same part | unverified (not read) |
| Chrome Web Store and Firefox Add-ons developer policies | none | unverified |

Commentary sources are law-firm alerts and legal press. They can be wrong on details; counsel should
read each opinion before the pack relies on it.
