# Responsible use: a guide for journalists, researchers and creators

**Draft for counsel review. Not legal advice. Not in force: this page awaits a lawyer's review and
is not part of CMMNS' terms until that review is done.**

Drafted 2026-10-28. CMMNS gives you measured, sourced evidence. What you publish from it
is your work and your responsibility (`LEGAL-NOTICE.md`). This guide is the practice that keeps that
work accurate and fair, and keeps you on firm ground if someone challenges it.

## 1. Verify before you publish

Every reading in CMMNS links to where it came from. Open that link before you rely on it.

- **Go to the source.** A badge, a count or a match is a pointer. Read the post, the document or the
  record it points to, in full, and confirm it says what the reading says.
- **Check the capture.** For saved material, run `cmmns capture verify <folder>` or
  `radar verify <bundle>`. A passing check shows the file is unchanged since capture. It does not
  show the content is true.
- **Find a second, independent origin.** Five outlets relaying one wire story are one origin.
  `cmmns case trace` counts origins after collapsing copies and self-sourced claims; use that
  count, not the number of articles.
- **Look for the primary record.** A court filing, a statute, a company filing or the person's own
  words outrank any retelling. `case leads` lists where the primary record for each claim may be.
- **Keep what you checked.** Note what you opened, when, and what it said. The case folder's history
  does this for you if you work inside one.

## 2. How to read a conduct record

A conduct record is a set of rates about what a subject did in public. As of this draft the conduct
record is designed and not yet released; the counts, intervals and origin counts in today's case
folders and evidence windows follow the same rules. Each rate has four parts. Read all four before
you write a sentence about it.

| Part | What to ask | Example |
|---|---|---|
| Events | What exactly was counted, and would a second person count the same? | factual claims that carry a link or a named source |
| Denominator | Counted out of what? | out of all factual claims in the captured posts |
| Interval | How sure is the rate? Under 20 events, the tool shows counts only | 12 of 40, 95% interval 17% to 46% |
| Control | Does the pattern beat a shuffled copy of the same data? | a drift that a shuffled-date control also shows is "not distinguishable from chance" |

Then read the baseline. A rate means little alone; compare it with comparable accounts, drawn by the
stated sampling rule. Check the method tag on each reading: measured readings (hashes, counts,
times) and model readings (claim detection, proposed contradiction pairs) are kept apart, and model
readings carry their published agreement rate. A record built on a weak detector is a weak record.

## 3. What a record cannot show

- **Anything outside the capture.** Posts that were never captured, deleted before capture, private
  messages, and offline life are not in it.
- **Why someone did something.** A deletion after a challenge is a count beside the base deletion
  rate. People delete posts for many reasons.
- **Character.** A record shows conduct. The tool never labels a person honest, dishonest, malicious
  or unwell, and your article should not present a rate as if it were such a label. If you reach a
  judgement, present it as yours, with the evidence that led you there.
- **Identity.** An account's location label, join date or posting clock is what the platform
  disclosed. VPNs, travel and shared accounts move all of them. None of them proves who runs an
  account.
- **Truth.** A fact-check match shows a checker reviewed a similar claim. The rating is the
  checker's, in their words, with their own errors.

## 4. Quote fairly

- **Quote the words in their context.** Read the full source sentence. A quote that drops a nearby
  "not", "but", "unless" or "allegedly" can reverse its meaning; CMMNS' clipped-quote check
  (`src/core/claim-checks.js`, tested and not yet shown in a view) looks for exactly that.
- **Keep the date and the platform.** A post from 2019 is not a statement from this week.
- **Link the original** and an archived copy where you can.
- **Show contradiction as two quotes.** Two dated quotes side by side let the reader judge. A change
  of view that the person announced is a change of view, not a contradiction.
- **Separate what the record shows from what you infer.** CMMNS' case rungs (documented,
  inference, unproven, contradicted) are a good model for your copy: documented conduct stated as
  fact, inference stated as inference with its evidence, and insinuation left out.

## 5. Right of reply

Before you publish something about a person that could harm their reputation, give them a fair
chance to answer.

1. Send the specific claims you intend to publish, the evidence for each, and a reasonable deadline
   that fits the story's urgency.
2. Record what you sent and when. `cmmns case export --profile journalistic --reply replies.json`
   keeps replies beside the claims they answer.
3. Report their answer fairly, including any correction you accept.
4. Correct promptly and visibly if you got something wrong, and say what changed and when.
   `--corrections corrections.json` keeps a dated record in the export.

Right of reply is standard practice in many press codes and often bears on the legal defences open
to a publisher. What it requires where you are is a question for your own lawyer or editor.

## 6. Protect your sources, your subjects and yourself

- **Turn on Source protection** (toolbar menu) when the work is sensitive. It stops every request
  CMMNS makes on its own. `cmmns protect limits` lists what it cannot protect against.
- **Share clean copies.** Share clean strips EXIF and GPS, XMP, IPTC, document authors and similar
  metadata from a copy and keeps your original as evidence.
- **Use carrier-safe bundles** for anything you hand to someone else: a one-time key, the day only,
  no install-wide key id.
- **Keep private people private.** Exports turn accounts into salted pseudonyms unless you mark a
  public figure. Leave it that way for bystanders, sources and private people.
- **Redact faces and identifying detail** before publishing footage of people who did not choose to
  be in it. Use solid fill; blur and pixelation can be partly reversed. CMMNS' own redaction
  editor is planned (`project-docs/REDACTION-PLAN.md`); until it ships, use another tool for this.
- **For material that could put someone at risk,** use a newsroom's SecureDrop or a GlobaLeaks site
  through Tor Browser. No software protects a person whose device is seized or compromised.

## 7. Creators and study

When you study someone's work, credit them, keep study copies private, and publish only what passes
the similarity gate. `CREATORS-AND-IP.md` sets out how.

## 8. When in doubt

Ask an editor, a supervisor, an ethics board or a lawyer before you publish. The project cannot give
legal advice and cannot review individual stories (`LEGAL-NOTICE.md`).
