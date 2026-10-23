<!-- writing-profile: docs -->
# Definition catalogue changelog

Every change to an entry's quotes, elements or signals bumps that entry's version and adds a line
here, with the date and the reason. A badge names the entry and version it used
(`<id>@<version>`), so an old badge can always be read against the text it was built from.
Challenges and their decisions are linked from the line they changed.

## 1.0.1 entries (2026-10-23)

Plain-language rewrite of Daylight Commons' own notes, on the author's direction of 2026-10-23. Each entry's
`binding_note`, `in_force` note, element notes and `does_not_prove` text now say what the entry compares
and what a match shows, in short active sentences. Quotes, titles, element labels, signals, sources and
hashes are unchanged.

- `eu-dsa-art26-advertising@1.0.1`: wording of the notes.
- `eu-dsa-art39-ad-repository@1.0.1`: wording of the notes.
- `eu-ucpd-annex1-11-advertorial@1.0.1`: wording of the notes.
- `eu-ucpd-annex1-22-posing-as-consumer@1.0.1`: wording of the notes.
- `eu-ucpd-annex1-23c-false-reviews-endorsements@1.0.1`: wording of the notes.
- `uk-dmcc-sch20-12-advertorial@1.0.1`: wording of the notes.
- `uk-dmcc-sch20-13-fake-reviews@1.0.1`: wording of the notes.
- `uk-dmcc-sch20-25-posing-as-consumer@1.0.1`: wording of the notes.
- `uk-fraud-act-2006-s2@1.0.1`: wording of the notes.
- `us-ftc-act-s5-deception@1.0.1`: wording of the notes.
- `us-ftc-endorsement-material-connection@1.0.1`: wording of the notes.
- `us-ftc-fake-social-media-indicators@1.0.1`: wording of the notes.
- `us-wire-fraud-18usc1343@1.0.1`: wording of the notes.
- `x-authenticity-engagement-spam@1.0.1`: wording of the notes.
- `x-paid-partnerships@1.0.1`: wording of the notes.

## Signal registry 1.1.0 (2026-10-23)

- `timing-burst` added as a context-only signal: it never evidences an element. It needs times to the
  second and, with coarser times, is not observable at this time precision and never fires.
- `quote-bunching` now states that it needs times to the minute.
- Each timing signal carries `needs_precision`. No entry's quotes, elements or signals changed, so no
  entry version moved.

## 1.0.0 (2026-10-22)

First release of the catalogue: 15 entries, all verified against their official sources on
2026-10-22. Each source's SHA-256 is in the entry.

United States:
- `us-ftc-endorsement-material-connection@1.0.0`: 16 CFR 255.5(a), with 255.0(b). Role: match.
- `us-ftc-fake-social-media-indicators@1.0.0`: 16 CFR 465.8(b), with 465.1(h) and (j). Role: match.
- `us-ftc-act-s5-deception@1.0.0`: 15 U.S.C. 45(a)(1) and the FTC Policy Statement on Deception. Role: comparison.
- `us-wire-fraud-18usc1343@1.0.0`: 18 U.S.C. 1343, with the DOJ Criminal Resource Manual 941 elements. Role: comparison.

European Union:
- `eu-ucpd-annex1-11-advertorial@1.0.0`: Directive 2005/29/EC, Annex I point 11. Role: match.
- `eu-ucpd-annex1-22-posing-as-consumer@1.0.0`: Directive 2005/29/EC, Annex I point 22. Role: match.
- `eu-ucpd-annex1-23c-false-reviews-endorsements@1.0.0`: Annex I point 23c, inserted by Directive (EU) 2019/2161. Role: match.
- `eu-dsa-art26-advertising@1.0.0`: Regulation (EU) 2022/2065, Article 26. Role: context.
- `eu-dsa-art39-ad-repository@1.0.0`: Regulation (EU) 2022/2065, Article 39. Role: context.

United Kingdom:
- `uk-dmcc-sch20-12-advertorial@1.0.0`: DMCC Act 2024, Schedule 20 paragraph 12. Role: match.
- `uk-dmcc-sch20-13-fake-reviews@1.0.0`: DMCC Act 2024, Schedule 20 paragraph 13. Role: match.
- `uk-dmcc-sch20-25-posing-as-consumer@1.0.0`: DMCC Act 2024, Schedule 20 paragraph 25. Role: match.
- `uk-fraud-act-2006-s2@1.0.0`: Fraud Act 2006, section 2. Role: comparison.

X (platform rules):
- `x-paid-partnerships@1.0.0`: X Help Center, Paid Partnerships Policy. Role: match.
- `x-authenticity-engagement-spam@1.0.0`: X Help Center, Authenticity. Role: match.

Signal registry `catalogue/signals.json` 1.0.0: 17 signals. `ad-library-link` is pending the
evidence layer (PR #47).

Not legal advice. A media lawyer reviews the wording before any public release.
