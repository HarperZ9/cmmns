# Changelog

All notable changes to Radar. Dates are UTC. Versions before 1.0.0 were development builds and
were not published to a store.

## Unreleased

### Added (text in images)
- Read text in this image. With "Read text in images" turned on in the options page (off by
  default), the window's Media area offers "Read text in this image" under each image of a post. On
  that click only, Radar reads the words in the image on your device with its own recogniser and runs
  the same theory, rhetoric, persuasion and fact-check checks on them. Each sign found that way is
  labelled "in image:", stays at info level, shows the recogniser's confidence, reads "not measured
  yet" and never counts toward the thread report. The image and its text never leave the browser.
  Latin-script text only.
- Radar's own recogniser, with no third-party code: an ink mask, line and word finding, and a small
  convolutional network read by CTC, in JavaScript with a 546-byte WebAssembly SIMD kernel (plain
  JavaScript where WebAssembly is not allowed). Weights 270 KB, trained by Radar on synthetic lines.
  It runs in the background worker, never in the page.
- Fact-check matching for image text mends one misread letter in a word when exactly one claim
  word is one edit away. Typed text is matched as before.
- A lesson, "Words inside a picture".

### Measured (text in images)
- Character error rate 1.03% (95% interval 0.56 to 1.66) on 120 synthetic screenshots rendered by
  Chrome, and 3.00% (2.13 to 4.20) on 22 screenshots of Radar's own published pages; target 5%.
  Tesseract.js, as a research baseline only: 5.76% and 4.03%.
- Median time from bytes to text 0.16 s on synthetic screenshots and 0.50 s on dense text pages on
  a desktop; 0.72 s and 2.58 s with the CPU slowed four times, where dense pages miss the 1.5 s
  target. Details and limits in project-docs/IMAGE-TEXT.md.

## 2.1.0 (2026-10-21)

Named in published reports: 98 documented influence operations from 27 countries, with the investigators' own
attribution wording. Techniques read from behaviour, not wording: flooding, cross-language repetition and
laundering chains. Named conspiracy theories, brand-borrowing accounts, and Korean and Indonesian markers
derived from labelled data.

### Added (derived word lists)
- Korean and Indonesian slur signs from word lists derived from human-labelled research corpora,
  not typed by hand. A script picks each term on the dev split by weighted log-odds against the
  corpora's group-hate labels, drops group, party and public names and terms that fire on other
  languages, and keeps only terms that clear a dev precision bar. Korean (54 terms, K-MHaS and
  BEEP!): 93.8% of test signs on text people labelled hostile (95% interval 93.3 to 94.3, 8,635
  checked), with terms aimed at both political camps and at both men and women. Indonesian (one
  term, IDHSD and IndoDiscourse): 85.0% (70.9 to 92.9, 40 checked).
- Held back, with their figures recorded in project-docs/EVALUATION.md: Japanese (63.0%, lower
  bound under 0.7), Hebrew and Hindi (their corpora label offensive-or-not only, so the lists hold
  insults, not group slurs), Turkish and Persian (no term cleared the dev bar). Held-back lists
  never run on a reply.
- Unicode handling for each script: Korean and Japanese as character n-grams, Korean only at a
  word start; Hebrew points and prefixes; Turkish dotted and dotless i and stems; Persian yeh,
  kaf and the zero-width non-joiner.
- Symmetry suite for all seven languages, with targets from every direction.

### Added
- Named conspiracy theories. A post that uses a documented theory by name or by its stock line
  (chemtrails, adrenochrome, QAnon slogans, satanic ritual abuse, "Great Reset" plot framing, stolen
  or rigged elections, machine or satellite vote-flipping, staged shootings, 9/11 inside job, 5G and
  COVID-19, vaccine harm, hidden cures) gets an info sign in the Language area. It names the theory,
  says what the record shows and links the dated sources. Election and staged-event claims match in
  both directions, checked by matched pairs. Posts that debunk, mock or report a theory are skipped.
  Not measured yet: no conspiracy-labelled corpus with a usable licence was found, so the sign
  never counts toward the thread report.
- Name borrows a brand. An account whose name or handle borrows a platform's or a major outlet's
  brand ("X Global", "BBC Breaking") and is not one of its accounts gets a weak account sign on X.
  X's affiliation badge, an organisation check, or X's parody, commentary or fan label clears it.
  The brand list names each outlet's Wikidata item. Alone it never counts toward "flagged". Not
  measured yet.
- A lesson for each new sign.

### Research
- project-docs/IMAGE-TEXT.md compares on-device options for reading text inside images and
  recommends a path, with targets and a privacy statement. Nothing ships yet.

### Added (techniques)
- A technique map, `project-docs/TECHNIQUES.md`: flooding, laundering, cloned outlets, coordinated
  amplification, repetition across languages, "just asking questions" and demoralisation, and
  swarming, each mapped from Rauch, RAND's "firehose of falsehood" (Paul and Matthews 2016) and
  DISARM ids to what Radar can observe, with its status, gap and precision target.
- Same link, upload or fact-checked claim in several languages: a sign on replies when accounts
  writing in different languages carry the same item, in one thread or across threads you viewed.
  The root post's own material is set aside.
- Flooding: a thread line when three or more accounts posting 100 or more times a day write a
  quarter of the replies, or a timing burst is made of such accounts. Repeat posters show as context.
- The laundering chain: the post, the accounts and sites its material passed through, and the
  earliest origin Radar saw, in the card's trail and as a Sources sign when the post does not point
  at the origin. Built only from pointers the site records.
- Lessons for the two new post signs.

### Measured (techniques)
- On ordinary threads (PHEME), flooding fires on 0.55% to 3.3% of threads by size and
  cross-language on 0% to 1.1%. Neither has a labelled campaign set, so no precision is claimed.
### Added (influence operations)
- "Named in a published report": a link in a post, an account, or a website, domain or @handle in
  an account's profile that a published report named as an influence operation's asset. The window
  names the operation, who each source says ran it in the source's own words (linked to stays linked
  to), the report and its date, and what the match does not prove. It is about the link or account,
  never the person who shared it.
- The table behind it: 98 operations from 27 attributed countries, 2017 to 2026, cited field by field
  to 176 primary documents (platform threat reports, research labs, court filings, sanctions texts and
  government reports, and reporting that names its sources), with 1,237 domains and accounts.
  `data/ops.README.md` lists what was left out and why, and the licence of each kind of source.
- "Look-alike news address", a separate weaker sign: a link that copies a major outlet's name on
  another ending, with one letter off, or with look-alike letters (washingtonpost.pm, theguaradian.com).
  It matches none of the 50,000-odd real outlet domains in Radar's owner and site tables.
- Documented operations per year and per attributed country on the dashboard and the transparency
  page, with the caveat beside the numbers: they count what investigators found and published, not
  how much activity there was.
- Two lessons, one per new sign.

### Tests (influence operations)
- One evidence rule for every country (`src/core/ops-schema.js`): a read source, an operator type a
  source states, a citation for every field. A symmetry test checks that relabelling an operation's
  country changes nothing, and that the rule code names no country.
- False-match controls: no real outlet's domain is shipped as an indicator, and no real outlet matches
  a look-alike pattern.

## 2.0.0 (2026-10-21)

Radar now answers, in one hover: where a post comes from, who is pushing it, how it argues, whether a
fact-checker has reviewed it, and whether its media carries Content Credentials. Every answer is sourced
and states its limit. Nothing leaves the browser unless you turn on Other coverage and click.

### Added (sources)
- Site cards on links. Rest the pointer on an outbound link in a post, or focus it, for the linked
  site's owner, owner type, founding year and country (Wikidata), any cited state link, and its
  fact-check record: "N reviews by M fact-checkers since <date>, ratings as the checkers wrote
  them", the three newest reviews and the full list on its own page. The post window's Sources area
  shows the same card. Redirects from X, Facebook, YouTube, Reddit and the search engines resolve to
  the real address first.
- "Site card for this page" in the toolbar menu shows the card for the news site you are reading.
  Radar runs on that page only when you press it.
- Labels under Google, Bing and DuckDuckGo results, off until you turn an engine on in the options
  page; the browser asks for that engine's access then. The labels name the owner and any state
  link; the review count stays in the card beside its limits.
- Other coverage, off by default: on a click, other outlets covering the same story from the GDELT
  Project, each labelled by owner type (state media, public broadcaster, regional govt, nonprofit,
  commercial, or not stated), never by a left or right score. It sends the four longest words of the
  article's title to api.gdeltproject.org and nothing else. The options page says so before you turn
  it on, Firefox asks for the "website content" permission then, and the first use shows the exact
  words and waits for your click. It is the only feature that sends anything.
- The fact-check table keeps, for each review, the site where the fact-checker said the claim
  appeared (domain only; null for posts on platforms, archives, transcripts and aggregators). A new
  site table holds facts for 48,341 sites and fact-check records for 2,451 (`data/sites.README.md`).
  The owner table grows from 7,374 to 19,864 domains: where Wikidata names no owner, the parent
  organisation or publisher, labelled as such.

### Measured (sources)
- On the feed of 2026-10-20, 66.8% of 87,647 reviews list where the claim appeared and 5.6% name a
  site; 74.7% of those with an appearance were on platforms only. A hand read of 40 random
  attributions found 36 correct, 2 citing a site as context, 2 malformed rows now dropped.
- Every site a shipped review names has a record (100%, tested).
- Of 500 news links sampled from Google News search feeds in 14 editions, 42.2% resolve to an owner
  row and 55.4% to any site fact (target 85%: not met).
- Other coverage on 100 headlines from Google News feeds in 10 editions (2026-10-21, one request
  every 12 s plus one retry): GDELT answered 24 and refused or dropped 76 (55 "please limit
  requests", 20 network failures, 1 title too short). 9 of 100 found at least 3 other outlets (9 of
  the 24 answered); median time 25.5 s overall, 18.6 s when answered. Targets of 70% and 3 s: not
  met. The limit is GDELT's availability from this machine, not the query.

### Added (research)
- What normal looks like, beside every coordination sign. Near-identical replies, bursts of replies,
  accounts seen together and wording seen in other threads now show how often the same sign turned
  up in ordinary threads of the same size, with its interval and source: the PHEME corpus of Twitter
  threads from 2014 and 2015 news events (CC BY 4.0), with independent-posting simulations beside it
  in `project-docs/EVALUATION.md`. In threads of 20 to 49 replies, a same-text group shows up in 1.4%
  of ordinary threads and a burst in 2.2%.
- Look-alike letters no longer hide a copy. A Cyrillic "а" or a Greek "ο" swapped into an English
  word, fullwidth or mathematical letters, and invisible splitters are folded before the duplicates
  sign, the cross-thread fingerprint, claim matching and the word lists, using the Unicode
  confusables table (UTS #39, Unicode License v3). On 100 seeded copies the duplicates sign finds 100,
  up from 75. Text written in one script, such as Russian, Greek or Arabic, is never changed.
- Community Note timing: when X loads a note, the window says when it was written, how long after
  the post and how long ago, from the note's own id. The page does not say when X began to show it.
- Content Credentials survival on the feed page: of the files you checked, per site, how many still
  carried intact credentials, how many were changed and how many had none. Radar keeps a short hash
  of each file's address, never the address (`pb.media.v1`, pruned with your history setting).
  A CI conformance test holds the count to c2patool's verdicts on the c2pa-rs test files: they agree
  on which files carry credentials for 42 of 43, and the one miss is named.

### Changed (research)
- Near-identical replies no longer count text a reply quotes ("RT @outlet: ..." or a quoted post) or
  the wording of the post it answers. Before this, the sign fired on a third of ordinary threads.
- Bursts are tested against the thread's local pace as well as its average. The rush of replies
  after a post had fired the sign on 39% of ordinary threads with 50 or more replies; it now fires
  on 1.1% to 3.3% by size.
- Persuasion techniques show only at 80% measured precision or more, with the interval starting at
  70%, from at least 20 hits; whataboutism never shows on one reply. Published systems score about
  30 to 44 F1 on these techniques. No technique clears the bar yet, so none shows, as before.

### Changed (design follow-ups)
- The transparency page leads with one figure per sign: a plain sentence, the interval drawn as a
  figure, and the counts under "How we know", as on the author's product pages. The dense tables
  sit in disclosures.
- The thread card image no longer prints its SHA-256 hash; the hash stays in the JSON file and under
  "Check a copy" on the card page.
- Keyboard hints name Conso directly and never fall below 14px.

### Changed (design)
- Every Radar surface now uses the design of the author's site: bone and void grounds, ink text,
  Hanken Grotesk for words and Conso for figures, square controls, sections that open on a
  hairline and a registration cross, and colour only for a verdict. One shared stylesheet
  (`canon.css`) carries the site's tokens for the first-run, options, feed, history, lessons,
  self-check, thread card, popup, transparency and privacy pages.
- The window and panel on social sites set their text in Hanken Grotesk and Conso, sent to the
  page as bytes so no extension file becomes web-accessible. The ground still follows X's light,
  dim and dark themes. Signs worth a look use the canon's drift colour beside their words.
- The history page is one column of ruled sections, with no blue links, orange bars or rounded
  boxes. Section labels in the window and the lessons are in mixed case.
- The icons and the first-run drawing use the site's void and bone; the reading mark is bone.
- The public pages link back to the author's site.
- `tests/canon.test.js` fails on an em dash in anything a user reads, on a page without the shared
  tokens, on a colour outside the canon and on a pill shape or an uppercase label.
  `project-docs/DESIGN-CANON-CHECK.md` lists every value and the audit.

### Fixed (design)
- "Save card" opened a page that does not exist (`card.html`); it now opens the thread card page.

### Added
- Threads, Mastodon and TikTok comments. Threads and Mastodon were read live (Mastodon 4.x and
  5.0); TikTok follows its public markup and is not checked live yet. Mastodon works on any server,
  and only on servers you choose: open the server, click Radar's button, and your browser asks you
  to allow that one server. Options lists them and takes access back. On Mastodon, Radar shows the
  account's join date and whether the account marked itself as automated, from the data the
  server already loaded. No new requests on any of the three.
- Rhetoric in Arabic, Russian, Ukrainian, Chinese and Hindi (Devanagari and Latin spelling):
  dehumanising language, calls for violence, stereotypes, slurs and conspiracy framing, with the
  names each side coins for the other and symmetry tests across 19 to 26 targets per language.
  Measured on held-out human-labelled text where a usable corpus exists: Arabic 96.6% (82.8 to
  99.4, 29 signs, MLMA and OSACT4), Russian 100% (96.1 to 100, 95 signs, all slurs), Chinese 75.9%
  (57.9 to 87.8, 29 signs, COLD). Ukrainian and Hindi show "not measured": too few signs in
  labelled text. Each sign now says which language's word list found it.
- Firefox for Android: the same package installs on Firefox 128 or later. On a touch screen each
  post gets one "Radar" button that opens the window on a tap; the window and the popup fit the
  screen. Testing steps in `project-docs/ANDROID.md`; not yet run on a phone.
- Content Credentials fail-safe: a version 1 manifest in MP4 now reads "could not fully verify
  (older manifest format)", never "has not changed since it was signed", and a CI property test
  holds Radar to never giving a more favourable verdict than c2patool on the c2pa-rs test files.
- Media checks in the window, on click only. "Check this file" reads Content Credentials (C2PA 2.x
  and 1.x manifests) from JPEG, PNG, WebP and MP4 files the page already loaded, with no library
  and no network call beyond re-reading that file. It checks the claim signature (ES256, ES384,
  ES512, PS256, PS384, PS512, Ed25519), every assertion hash and the hash that binds the claim to
  the file's bytes, and shows who signed, which tool, and what the credentials say, such as "made
  with generative AI (trainedAlgorithmicMedia)", including in earlier versions of an edited file.
  It also reads IPTC digital source type in XMP, image-generator settings in PNG text and the EXIF
  Software field. A file with none says "no Content Credentials found (platforms often strip
  them)"; Radar never calls a file authentic. Three new families: Content Credentials,
  Credentials do not match, and AI-generation metadata.
- Video frames for reverse search, as InVID does: "Take 4 frames" copies frames from the loaded
  part of the page's own video and restores playback; each frame has Google Lens, Bing, TinEye and
  Yandex buttons that copy it to the clipboard and open the service, so nothing is sent until you
  paste it.
- "First seen" for each piece of media: the earliest post Radar has seen with the same upload, and
  the "From @account" post X credits it to. Reverse search links now say that a click sends the
  image address to that service.
- Lessons: every sign and persuasion technique has a local lesson of one to two minutes, opened
  from the sign's "Learn" link in the window (52 lessons). Each says what the move is, shows
  made-up examples, explains why it works on people and how to spot it without Radar, gives the
  counter-move and what the sign does not prove, and says a post with the sign can still be true.
  Examples come evenly from left, right and centre (a test counts them), and every lesson pairs
  the sign with a fair use or an ordinary account that trips the same sign.
- Self-check: eighteen made-up posts, half leaning on a move and half giving real support, hard to
  easy, with the reason after every answer. It is scored by discernment (hits against false
  alarms, d') and only when you open "How you are doing", because replications found the Bad
  News game made players doubt true posts as much as false ones. Answers stay in this browser.
- First-week tour: three tips over the first uses (the window, the thread report, a lesson), each
  shown once, at most one an hour, none after the first week, and "No more tips" ends it for good.
  Clearing Radar's data keeps that choice.
- Research behind the lessons, read 2026-10-20 and cited with dates on the lessons page:
  Roozenbeek and van der Linden 2019; Basol et al. 2020 and 2021; Maertens et al. 2021;
  Roozenbeek et al. 2022 (Science Advances); and the replications Modirrousta-Galian and Higham
  2023, Graham et al. 2023, Seabrooke et al. 2025 and Modirrousta-Galian et al. 2026.
- "Your feed": a local page, opened from the toolbar popup, of what your feeds and threads carried
  over the last 7, 30 or 60 days. Sites linked most with their owners, the share of links to
  state-linked sites, the share of posts and replies with strong rhetoric signs, persuasion
  techniques (only those that passed their measurement; none yet), the flagged-account share,
  Community Notes and fact-check matches seen, and accounts that keep appearing together with
  links to the threads. Every share shows its count, denominator and 95% interval. It says what
  it does not show, keeps to your retention setting, and makes no network request. No streaks,
  badges or notifications.
- Coordination graph on the history page: accounts that replied in two or more of the same threads,
  as a small force layout with each link labelled by its count. Tab reaches every account; Enter
  or a click lists the threads behind each link. A table holds the same pairs and threads. 500
  accounts draw in about 0.1 s.
- Thread cards: "Save card" in the thread panel opens a card to read, then save or share as a PNG
  and a JSON with a SHA-256 hash of its content. A card carries the thread report, fact-check
  matches, linked sites, upload reuse and the Content Credentials states of any files you checked,
  its sources and what it does not prove. It names no
  account and is refused for threads with fewer than five reply accounts.
- Persuasion techniques: span-level cues for eleven techniques from the SemEval-2020 Task 11 and
  SemEval-2023 Task 3 taxonomy (loaded language, name calling, bandwagon, appeal to fear,
  flag-waving, thought-terminating cliche, whataboutism, black-and-white fallacy, doubt, appeal to
  authority, exaggeration), in English and French. No cue names a group, person, party or side. A
  symmetry test checks that across targets from every political direction in both languages.
- Measured on the held-out split of the Propaganda Techniques Corpus (CC BY 4.0). No technique
  reached the shipping bar, a precision interval starting at 70%. Loaded language came closest at
  60.3% (51.9 to 68.1), so none shows yet. The options page lists each technique with its figure
  and why it is held back. A technique that clears the bar later appears in the Language area with
  the matched words, a one-line definition, "a technique can carry a true claim; it describes how
  the post argues", and its precision. It never counts toward "flagged", and the thread report
  gives it a separate line by flagged and unflagged accounts.

### Added (trust)
- "This was right" and "This was wrong" on every sign in the window. Marks stay in your browser
  with the sign, its kind and the thread; the post text only if you tick "include the text". After
  10 marks on one kind of sign, the window shows "Your feedback: N of M right" under the measured
  figure, never in its place. The options page lists your marks, saves them to a file when you ask,
  and clears them. Nothing is sent.
- A transparency page, inside Radar (options page and popup) and on the public site: every sign
  with its measured precision, recall and interval, the data it was checked on and its licence,
  the side-balance table, what is not measured and the known limits. Generated from the evaluation
  results by `npm run pages`.
- The privacy policy as a public page, generated from PRIVACY.md, now dated and covering feedback.
- Conso for figures on Radar's own pages, beside Hanken Grotesk.
- Store listing text, permission justifications, privacy-practice answers and screenshot plan for
  the Chrome Web Store and Firefox Add-ons.

### Changed (trust)
- Firefox add-on id is now `radar@harperz9.github.io`, permanent, and the manifest declares no
  data collection.
- The fact-check table ships in two files, each under 5 MB, so Firefox's add-on checks can read it.
  The rows are unchanged.
- The manifest description leads with what Radar is: free, no account, nothing leaves your browser.

### Fixed
- The history page read the connections log under its old key, so "Accounts that keep appearing"
  could be empty or stale, and the retention setting did not prune the current log.

## 1.0.0 (2026-10-21)

First public-quality release. Every sign either carries a measured error rate from
`project-docs/EVALUATION.md` or says "not measured yet".

### Added
- Fact-checked claims: posts that closely match a claim reviewed by one of 328 fact-checkers
  (19,728 reviews, Google Data Commons ClaimReview feed, CC BY 4.0) show the checker's own rating
  and a link. Matching runs offline in the browser; Radar never rules a claim false itself.
  Community Notes show first when X loads one.
- Rhetoric markers in French, Spanish, German, Portuguese and Italian, each with symmetry tests
  across targets from every political direction.
- Facebook, Instagram and Bluesky: comments feed duplicate, rhetoric and thread reports; account
  context comes only from what the viewer opens (Page transparency, "About this account") or what
  the app already loads (Bluesky labels).
- Measured precision and recall for the rhetoric families on human-labelled public corpora
  (Measuring Hate Speech, HateXplain, Civil Comments, MLMA), test split only, reproducible with
  `node scripts/eval.mjs`.
- Slur and grammar coverage for hostility aimed at white people, men, Christians and conservatives
  (dictionary-sourced terms, and an identity-plus-gendered-slur rule that is the same for every
  identity). On the HateXplain test split the two sides' recall is now equal within the intervals;
  on Measuring Hate Speech a gap of about 1.28 to 1 remains, reported in EVALUATION.md.
- A YouTube video with no comments still shows its channel and YouTube's funding and
  paid-promotion labels; the collapsed button says "funding label" when YouTube shows one.
- CI on Linux and Windows for every change.
- First-run page on install: what Radar shows, what it never does, site switches and a one-click
  start (which also asks Firefox for site access).
- Options page: per-site switches and a pause for everything, the window's areas, feeds and
  automatic reading, retention for history and account details, "Clear all Radar data",
  reduced motion and larger text, and the measured accuracy of every sign.
- Every sign in the window shows its measured precision from the evaluation, or "not measured
  yet". Signs that repeat a site's own label, or match a cited table, say so instead.
- Icons at 16, 32, 48 and 128 px from original SVG sources, and toolbar states for reading and
  paused.
- Keyboard: focusing a post opens its window, Alt+R moves into it, arrow keys move between its
  tabs, Esc closes it and returns focus to the post. Tabs carry tab and tab-panel roles.
- X's dim theme gets its own window ground; contrast is tested in light, dim and dark.
- `npm run package`: deterministic Chrome zip and Firefox xpi with SHA256SUMS.
- PRIVACY.md, a store listing draft, this changelog, and the FSL-1.1-MIT licence.

### Changed
- An account counts as flagged on one strong sign or two different weak ones. Place and timing
  context alone (app store, typed location, a flag in the name, active hours) no longer does; on
  a live thread it had put half the repliers in the flagged group.
- Violence markers catch active calls ("we should exterminate X") and a violent fate carried
  over to a named group, not only the passive form.
- Automatic About lookups on X follow X's rate-limit headers, keep requests in reserve for the
  viewer's own use of X, and retry a rate-limited account.
- Threads are keyed by post id, so one thread reached by two paths no longer counts its own
  replies as copied from elsewhere. The connections log restarts under a new key.
- Feed pages compare an account with "this page", not "this thread".
- Duplicate detection keeps combining marks inside words (Indic scripts).
- Links and focus outlines in the window use ink instead of an accent blue; colour is kept for
  signs worth a look.
- Settings are read in one place (`src/core/settings.js`), and the background worker deletes data
  older than the user's retention.

## 2026-10-20
- Automatic About lookups pace themselves from X's rate-limit headers.
- Rhetoric recall for active calls, carried-over fate and French replies.

## 2026-10-19
- The hover window: an area strip, tabs, small charts and a comparison with the thread.
- Posting patterns from the posts X loads for an account.
- Reddit account age, karma and sign-up names.
- History page across viewed threads: upstream sources, recurring accounts, trend.
- Deterministic core builds and signal tests.

## 0.3.0 (2026-10-18)
- One compact row per post, hover card, collapsible thread panel, toolbar popup.
- Source trails, upstream summary, government designations and verified report data.
- State links from Wikidata and 17 cited influence-operation reports.
- Media upload dates and reverse image search; YouTube's synthetic-content label.
- Feed mode on X, timing bursts, translation guard, JSON export.

## 0.2.0 (2026-10-18)
- Post metadata X loads but does not show, YouTube page data, cross-thread copied text and pushed
  links.
- Local connections log, inferred active hours and fast-reply flags.
- Machine-writing signs with cautious thresholds, leaked chatbot text, spam patterns.
- Live account data from what X already loaded; automatic in-page About lookups.
- Outlet ownership for links and accounts from 7,374 sourced Wikidata rows.

## 0.1.0 (2026-10-17)
- Duplicate-text clusters, local-claim mismatch and account flags.
- Stance-neutral rhetoric markers with a symmetry test, and the thread norm report.
- The extension: badges, popovers, lookups, thread report; adapters for X, Reddit and YouTube.
- App-store and name-flag location signals; coded-hate markers with precision tests.
