# Data protection

**Draft for counsel review. Not legal advice. Not in force: this page awaits a lawyer's review and
is not part of CMMNS' terms until that review is done.**

Drafted 2026-10-28. `PRIVACY.md` is the user-facing privacy policy and lists every store and every
request in detail. This page answers the data protection questions behind it: who is responsible
for which data, what the project itself processes, which legal exemptions apply to users, and how
users should handle what they keep. The network list below was taken from the code on 2026-10-28
(release 3.8.0).

## 1. Who the controller is

| Mode | Personal data | Controller |
|---|---|---|
| The extension and the command line, on your device | everything you read, capture, analyse, conclude or export; it stays on your device | **you**, the user, who decides why and how it is processed |
| Sharing an export, a bundle or a capture | what you choose to send | **you**, and then the recipient for their copy |
| A model endpoint or a service you configure (GitHub token, OpenAI-compatible endpoint, a time-stamping service) | what you send to it | **you**, with that service as your processor or as a controller in its own right under its terms |
| The project's repository, data tables, examples and pages | the material listed in `SUBJECT-REQUESTS.md` | **the project** (Zain Dana Harper) |
| Issues, discussions and pull requests on GitHub | what you post there | **the project** for its use of them; **GitHub** for its platform |
| Releases and downloads from GitHub and browser stores | download and update logs | **GitHub** and **the store**, under their own policies; the project receives no logs |

The project publishes software. It does not run a service that processes users' data, holds no user
accounts and receives no copy of anything a user does. Software that a person installs and runs
alone is not, by that fact, a processor or controller for that person's use of it. GDPR Recital 18
says the Regulation still applies to "controllers or processors which provide the means for
processing personal data" for household activities; whether publishing local software counts as
providing the means is listed for counsel.

## 2. What the project processes

**By default, nothing.** CMMNS sends no telemetry, no analytics, no crash reports and no
usage data to the project or anyone else. No request in the code goes to a project server, because
there is none.

Every network request the code makes, all of it started by the user or by a setting the user turned
on:

**Browser extension**

| Request | To | When | Sends |
|---|---|---|---|
| Account details (X "About this account", Reddit `about.json`) | the site you are on, with its own session | while "Read account details automatically" is on, at most one account per 1.5 s on X and 2 s on Reddit | the account names on the page you opened |
| Page and app data the site already loaded | nothing sent; read in the tab | while CMMNS is on for that site | nothing |
| Save, Download, Copy, Capture as evidence | the host each file came from | on your click | an ordinary download request; cookies only to the page's own site, or to the file's host for Save to CMMNS |
| Check this file, Read text in this image | the file's own address, without cookies | on your click | an ordinary download request |
| Evidence lookups | api.github.com, rdap.org (forwarded to the domain's registry), web.archive.org | off by default; on your click | repository names and domains the post links to; a GitHub token you added, to api.github.com only |
| Other coverage | each news feed you chose | off by default; on your click | a plain feed download, no cookies and no referrer |
| Ask the Internet Archive to keep a copy | web.archive.org | off unless you tick it on a case save | the saved file's or page's address |
| Reverse image search, Save to the Internet Archive | the service you pick, in a new tab | on your click | what you paste or the address the link carries |

Bundled tables, fonts and models load from inside the extension. Ad and tracker blocking uses the
browser's own engine; CMMNS does not see what it blocked. With Source protection on,
every request CMMNS makes on its own is stopped.

**Command line**

| Command | To | Sends |
|---|---|---|
| `case add <url>`, `case run` | the addresses you give; for X posts, X's public post-data endpoint (cdn.syndication.twimg.com) | an ordinary request with no cookies or credentials, and the user agent `cmmns-case (+https://github.com/HarperZ9/cmmns)`, so the site can see the tool's name |
| `case add --archive`, or a case with archive on | web.archive.org/save | the page address; the copy becomes public |
| `case watch` | each captured address; each open lead's public search address (CourtListener, SEC EDGAR full-text search, the Federal Register, congress.gov); archive.org only with archive on | the address or the search terms in it |
| A model in `case.json` | the command or endpoint you configure | source text and prompts |
| `media fetch` | yt-dlp, to the address you give | whatever yt-dlp sends; protected video is refused |
| `analyze`, `verify`, `export`, `board`, `media convert`, `capture verify` | nothing | nothing; local files only |

`case settings protection on` or `cmmns protect on` refuses every request.

Maintainer scripts that rebuild the data tables (for example `scripts/owners-build.mjs`) reach
Wikidata and other sources when a maintainer runs them. They are not part of what a user runs, and
the offline build runs with the network blocked (`project-docs/DATA-SOVEREIGNTY.md`).

## 3. Exemptions that apply to users

A user who processes personal data with CMMNS is subject to the law where they are. Three
exemptions are designed for the uses CMMNS serves, and the tool's design is built to keep
users inside them.

**Personal and household use (EU and UK GDPR, Article 2(2)(c)).** The GDPR "does not apply" to
processing "by a natural person in the course of a purely personal or household activity". Recital
18 includes "social networking and online activity undertaken within the context of such
activities". Reading your own feeds with CMMNS' context, keeping your own notes and studying for
yourself fall here. Publishing to the world generally does not; the Court of Justice has held the
exemption does not cover making data available to an indefinite number of people (*Lindqvist*,
C-101/01, ECLI:EU:C:2003:596, holding confirmed from commentary; paragraph wording not read).

**Journalism, academic, artistic and literary purposes (EU GDPR Article 85; UK Data Protection Act
2018, Schedule 2, paragraph 26).** Article 85(1) requires member states to "reconcile" data
protection "with the right to freedom of expression and information, including processing for
journalistic purposes and the purposes of academic, artistic or literary expression", and Article
85(2) requires exemptions from most of the Regulation's chapters for those purposes. Each member
state's law sets the exact scope. In the UK, the "special purposes" are journalism and academic,
artistic or literary purposes, and listed GDPR provisions do not apply where the controller
reasonably believes publication would be in the public interest and that applying them would be
incompatible with those purposes. CMMNS' case folders, rungs, source logs and dated corrections
are the kind of record that shows that reasonable belief was formed with care.

**Research (EU GDPR Article 89 and member-state law; UK DPA 2018, Schedule 2, paragraph 27).**
Research and archiving in the public interest carry their own derogations and safeguards
(pseudonymisation, data minimisation). CMMNS' research export uses salted pseudonyms and fixed
splits. Both provisions exist under these headings; their conditions have not been read for this
draft.

**Profiling and automated decisions (GDPR Article 22).** Article 22(1) gives a right "not to be
subject to a decision based solely on automated processing, including profiling, which produces
legal effects" or similarly significant effects. CMMNS makes no decisions about anyone:
it shows evidence with links, and the user writes any conclusion. The acceptable use policy excludes
eligibility screening of private people (`ACCEPTABLE-USE.md`).

## 4. United States: CCPA and CPRA

The California Consumer Privacy Act, as amended by the CPRA, applies to a "business" as defined in
Cal. Civ. Code 1798.140(d): broadly, a for-profit entity doing business in California that meets one
of three thresholds (annual gross revenue above an inflation-adjusted figure, $26,625,000 from
1 January 2025 per the California Privacy Protection Agency; buying, selling or sharing the personal
information of 100,000 or more consumers or households; or deriving half or more of its revenue from
selling or sharing personal information). The project collects no personal information from users,
sells or shares none, and has no revenue from data. An individual user acting for themselves is not
a "business". A newsroom or company that uses CMMNS is responsible for its own position.
Statute text in this paragraph is unverified (the official site refused automated reading); the
revenue figure is from the CPPA's own page.

## 5. International transfers

The project transfers no user data, because it receives none. Transfers happen only when a user
chooses a service: GitHub (United States) for evidence lookups, rdap.org and the registries it
forwards to, the Internet Archive (United States), news feeds anywhere, a model endpoint, or a
recipient of an export. Under GDPR Chapter V the user, as controller, decides whether a transfer is
lawful. For journalistic processing, Article 85(2) lists Chapter V among the chapters from which
member states shall provide exemptions where necessary.

## 6. Retention guidance for users

Keep only what the work needs, for as long as it needs it.

- **Browser stores** expire on their own: account details after 14 days by default, thread history
  after 60, connections and trails after 30 (`PRIVACY.md`). Shorten them in Options if you can.
- **Saved media, captures and cases** are kept until you delete them. Set a review date for each
  case. When a story is published or a project ends, decide what you must keep as evidence and
  delete the rest.
- **Raw captures of other people's posts** belong in the case folder, not in shared drives or
  public repositories. Share exports, which pseudonymise private accounts by default.
- **Keep evidence intact** while a legal hold, complaint, or litigation may need it. Deleting
  evidence then can be unlawful. Ask your lawyer.
- **Clear all CMMNS data** in Options removes the browser stores; removing the extension
  removes everything it kept in the browser. Case folders and downloads are ordinary files on your
  disk.
- **Encrypt the disk** that holds sensitive cases, and back it up to a place you control.

## 7. Security of processing

Integrity: every capture is hashed and chained; bundles and exports are signed. Confidentiality: the
data never leaves the device unless sent; the bundle signing key is stored non-extractable in the
browser; carrier-safe bundles use one-time keys. None of these measures has had an independent
review (`project-docs/SECURITY-REVIEW.md`). Report a vulnerability through `SECURITY.md`.
