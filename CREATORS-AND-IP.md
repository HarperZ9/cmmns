# Creators and intellectual property

**Draft for counsel review. Not legal advice. Not in force: this page awaits a lawyer's review and
is not part of CMMNS' terms until that review is done.**

Drafted 2026-10-28. How CMMNS treats other people's creative work: how study and
decomposition work, what stays private, what can be shared, how credit travels, how
text-and-data-mining reservations are treated, and how a creator can raise a concern.

## The purpose: distill

CMMNS distills. It takes material apart into its cleanest measurable parts, keeps the
source of every part, and from those parts builds understanding and new work. The project calls this
pure data synthesis in its cleanest form. "Clean" has a working definition, and each part of it is
checkable:

- **Measured:** every part carries the method that produced it.
- **Sourced:** every part links to the hash and location it came from.
- **Controlled:** every pattern is tested against a shuffled or structureless control.
- **Complete:** model layers plus an exact residual rebuild the source byte for byte, and the
  residual's size states how much is still unexplained.
- **Separated:** measured parts, model readings and human conclusions are stored apart.

Study of this kind honours its sources. It names them, measures them exactly, and shows how a work
was made, which is how people have always learned a craft. It is a learning tool first.

## What is built, and what is in development

| Part | State on 2026-10-28 |
|---|---|
| Save, Study, Capture as evidence, study boards, collections, convert and compress | released (3.8.0) |
| Credit carried with every save: author, handle, post address, time, alt text, in a `.md` and `.json` beside the file and in the file's own description | released |
| Lineage: a hash chain from every converted copy back to the original | released |
| Refusal of protected media (DRM, encrypted streams) | released, tested |
| The study engine: measured descriptors, licence-gated recomposition, the similarity gate | built as a companion research engine; not in this repository or any release |
| Exact reconstruction from layers plus residual | design target of the study engine; not built |
| Library capture of a creator's public catalogue | in development; not in any release |

This page states the rules each part ships under. Where a part is not built, the rule is the
condition of its release.

## How study and decomposition work

**Descriptors are measurements, not copies.** The study engine reads a work and writes what it
measured into the project's own formats: palette (colour clusters and weights), grain, texture and
stroke direction, brush marks, layers and blend modes, type proportions, composition (grid, focal
points, negative space), motion (cadence, cuts, easing), and for sound, tempo, swing, loudness curve
and fades. No melody, chroma or note sequence is stored as a descriptor. The descriptors describe how
a work is built. They do not contain the work.

**Exact reconstruction, for private study.** The engine's design target is completeness: model layers
plus an exact residual that together rebuild the source byte for byte. That rebuild shows that the
decomposition missed nothing and states, through the residual's size, how much the layers leave
unexplained. It is a study copy. It is made only from a copy the user lawfully obtained, it stays on
the user's device, and it is never redistributed by the tool, the project or any export.

**Source pixels and samples enter a shared output only when the licence allows.** Every descriptor
file records the source's SHA-256, its address, its licence class and whether its own pixels, frames
or samples may be copied into an output:

| Licence class | May source material be copied into an output? |
|---|---|
| public domain, CC0 | yes |
| CC BY | yes, with the credit line carried into the output's record |
| a recorded free-use offer, with no "reference only" decision | yes |
| reference only | no; descriptors only |
| unknown | no; treated as reference only, the strictest case |

**The similarity gate blocks near-copies.** Anything made from descriptors and meant to be shared
passes a gate that compares it with its reference and blocks it if any one rule fires. For pictures
and video keyframes: a perceptual hash, structural similarity (SSIM), a colour-blind structure
correlation that catches recoloured copies, and a layout and palette rule, each also checked against
the mirrored image. For sound: centred chroma over all twelve transpositions, log-mel correlation
that catches reuse of the same audio, and spectral-peak landmarks that catch a buried sample.
Thresholds come from a recorded calibration on unrelated pairs and honest recompositions, with a
false-success control that copies the source and must be blocked. Passing the gate shows
only that these measures found no close match. It does not prove originality.

**Provenance and credit stay on every derived item.** Each descriptor and each recomposition carries
a sealed record naming its source, the source's hash and licence class, the extractor and its
version, and for any CC BY material the credit line. A reader can always trace a result back to what
it learned from.

**Protected media is never processed.** DRM and encrypted streams are refused before any protected
segment is fetched. Nothing in CMMNS decrypts anything.

## Lawful bases for study

Study copies and analysis rest on several legal bases. Which one applies depends on where the user
is and what they do. The project claims each for the uses it was built for, and lists the open
questions for counsel (`project-docs/LEGAL-REVIEW-CHECKLIST.md`, "Creators and IP").

**United States: fair use (17 U.S.C. 107).** The statute names "criticism, comment, news reporting,
teaching ... scholarship, or research" as fair-use purposes and weighs four factors: the purpose and
character of the use, the nature of the work, the amount used, and the effect on the market for the
work. Private study that measures how a work is built, shares only descriptors and gated new work,
and never redistributes the source is designed to fall on the favourable side of each factor:
analytical purpose, no substitute placed on the market, the copy kept private. The courts so far:

- *Authors Guild v. Google*, 804 F.3d 202 (2d Cir. 2015): copying whole books to make them searchable
  and to show limited snippets was fair use.
- *Andy Warhol Foundation v. Goldsmith*, 598 U.S. 508 (2023): new expression alone does not make a
  use transformative when it serves the same commercial purpose as the original.
- *Bartz v. Anthropic* (N.D. Cal., 23 June 2025): training on books was fair use, and so was keeping
  scanned copies of purchased books; the court did not resolve copies from pirated sources at
  summary judgment. The case later settled.
- *Kadrey v. Meta* (N.D. Cal., 25 June 2025): training was fair use on that record, with the court
  stressing that market harm decides such cases and its ruling was limited.
- *Thomson Reuters v. Ross Intelligence* (D. Del., 11 February 2025): copying a competitor's legal
  headnotes to build a competing, non-generative product was not fair use.

The thread through them: lawfully obtained copies, an analytical purpose and no market substitute
favour fair use. CMMNS' rules (lawful copies only, private reconstructions, the gate on anything
shared) follow that thread.

**European Union: text and data mining (Directive (EU) 2019/790).** Article 3 requires an exception
for text and data mining by research organisations and cultural heritage institutions for scientific
research, on works to which they have lawful access. Article 4(1) requires an exception for anyone's
reproductions of "lawfully accessible works" for text and data mining, and Article 4(3) makes it
apply "on condition that the use ... has not been expressly reserved by their rightholders in an
appropriate manner, such as machine-readable means in the case of content made publicly available
online". Directive 2001/29/EC Article 5(2)(b) lets member states permit private copies by a natural
person for private, non-commercial ends with fair compensation to rightholders, and Article 5(3)(d)
permits quotation for criticism or review with the source named. Recent rulings:

- *Kneschke v. LAION* (Hamburg Higher Regional Court, 10 December 2025, 5 U 104/24): downloading
  images to build a training dataset fell within the TDM exception, and a reservation written only in
  natural language in a site's terms was not machine-readable. A further appeal is allowed.
- *GEMA v. OpenAI* (Munich Regional Court I, 11 November 2025, 42 O 14139/24): a model that memorised
  song lyrics and reproduced them infringed; memorisation went beyond text and data mining. First
  instance; an appeal is announced.

**United Kingdom.** Fair dealing for "private study" does not infringe copyright (Copyright, Designs
and Patents Act 1988, s.29(1C)); fair dealing for non-commercial research does, with sufficient
acknowledgement (s.29(1)). Section 29A permits copies for computational analysis for non-commercial
research by a person with lawful access, and makes contract terms that prevent it unenforceable. The
private-copying exception (s.28B) was quashed by the High Court in 2015 and is not available. In
*Getty Images v. Stability AI* [2025] EWHC 2863 (Ch) the High Court held that model weights which
never stored a copy of the works were not an "infringing copy".

**Access controls (17 U.S.C. 1201 and its counterparts).** No legal basis above permits
circumventing a technological measure that controls access to a work, and CMMNS does not
do it.

## Text-and-data-mining reservations

Where a rightholder has reserved text and data mining by machine-readable means, the project treats
that reservation as binding on any mining the Article 4 exception would otherwise cover.

- **Today:** no CMMNS code reads machine-readable reservations (such as robots.txt rules,
  TDMRep headers or metadata). This is a gap and is listed for counsel and for the build.
- **When the study engine and library capture ship:** each capture will record any machine-readable
  reservation the page or file carried, beside its hash; a source with a reservation will be
  classed "reference only", so its own material never enters a shared output; and the record will
  show the reservation to the user before they study the work.
- **Private study and non-commercial research** by a natural person may rest on bases other than
  Article 4 (above). Whether a reservation also limits those uses is a question for counsel.

## Uses the project supports, and the line it holds

Supported in full: studying technique, style and method; keeping private study copies of lawfully
obtained work; building reference boards with credit; teaching; criticism, review and commentary;
making new work from measured descriptors that passes the gate; and research on how creative work is
built and spread.

The line: CMMNS does not redistribute anyone's work, does not export a reconstruction,
does not let source material into a shared output against its licence class, and does not process
protected media. Whether a new work made by a user infringes is decided by the law that applies to
that user. The gate is an aid, not a clearance (`LEGAL-NOTICE.md`).

## How a creator can raise a concern

Write to the contact address on the maintainer's GitHub profile (https://github.com/HarperZ9) with
"CMMNS creator concern" in the subject, or open an issue if you are content for it to be
public. Say which work, which material, and what you ask for.

The project can:

- explain exactly what the descriptors and records for a work hold, and what they do not;
- remove any project-published example, fixture or study that uses your work, from the working tree
  and the next release;
- add or correct credit on project-published material;
- record a reservation you send, so the project's own studies treat your work as reference only;
- answer a formal copyright notice through GitHub's DMCA process for anything hosted in the
  project's repository.

The project cannot reach a copy or a study a user made on their own device, and does not know who its
users are (`SUBJECT-REQUESTS.md`).
