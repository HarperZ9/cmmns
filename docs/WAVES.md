<!-- writing-profile: research -->
# Wave plan

Packages of about one agent run each, drawn from the gaps in `docs/COMPLETION.md`. Each names the
files it owns, the check it starts from, the check that ends it, and whether it can run beside the
others. "Author" marks a package that needs a decision or work only the author can give.

Order follows the hard line "accuracy before breadth": evaluations that unlock detectors come
first, then the exports and the routes that let others check our work, then new reach.

## Wave 1 (shipped in this pull request)

| Package | Owns | Entry | Exit | Parallel |
|---|---|---|---|---|
| W1-A Export profiles in the CLI | `src/core/export-*.js`, `bin/lib/export.mjs`, `tests/export-profiles.test.js`, the export section of `EVIDENCE-LAYER.md` | E1 to E6 not built | `radar export` builds all four; refusal controls pass; full suite green | yes |

## Wave 2: evaluation and the routes that check us

| Package | Owns | Entry | Exit | Parallel | Author |
|---|---|---|---|---|---|
| W2-A X campaign labelling kit | `scripts/label/`, `project-docs/LABELLING.md`, `tests/label.*` | protocol in `EVALUATION.md`; 0 graded cases | a local labelling page that stores structure only, two-labeller agreement (Cohen's kappa), Wilson intervals and per-stratum organic false-positive rates from a labels file; synthetic controls | yes | no |
| W2-B X campaign labelling run | labels outside the repository; results JSON | W2-A merged | 30 organic and 30 paid cases, two labellers, the fairness bound read; M2 and M3 rows updated | no (needs W2-A) | **yes**: labellers and paid-undisclosed evidence |
| W2-C Modern X baseline | `project-docs/evidence/campaign-baselines.json` | 0 posts per stratum | 200 ordinary posts per follower stratum, counts only | yes | **yes**: collection in the author's browser |
| W2-D Challenge route as a product | `.github/ISSUE_TEMPLATE/`, `catalogue/DECISIONS.md`, `scripts/decisions-check.mjs`, `tests/decisions.test.js`, badge links in the window | template only | a dispute template for findings; a decisions log every challenge lands in, checked in CI; each badge and element table links to its entry, version and the template | yes | no |
| W2-E Commons phase 1 | `CONTRIBUTING.md`, `.github/workflows/dco.yml`, `scripts/catalogue-page.mjs`, `docs/catalogue.html` | DCO by hand; no public catalogue | DCO check on every pull request; a public catalogue page generated from `catalogue/` in the site canon, regenerated in CI, no entry missing (test); Codeberg mirror listed as an author step | yes | mirror only |
| W2-F Element tables in the window | `src/ext/definitions-view.js`, `src/ext/card.js` hooks, `tests/definitions.window.test.js` | library built, not shown | the campaign window shows each applicable jurisdiction's table; captures in light and dark | after W2-D badge links, or same files carefully | no |

## Wave 3: the catalogue in full, and exports finished

| Package | Owns | Entry | Exit | Parallel | Author |
|---|---|---|---|---|---|
| W3-A Platform policies | `catalogue/definitions/{meta,youtube,tiktok,reddit,linkedin}-*.json` | X only | each supported platform's paid-partnership and manipulation policy, quoted from the platform's own page with hashes | yes | no |
| W3-B More jurisdictions | `catalogue/definitions/` new files | US, EU, UK | Canada (Competition Act deceptive marketing), Australia (ACL s18 and s29), and the largest UCPD transpositions, each verified at source | yes | no |
| W3-C Legal dossier to PDF/A | `src/core/pdfa.js`, tests | Markdown only | a dependency-free PDF/A-2b writer; veraPDF passes in R&D | yes | no |
| W3-D Export in the extension | `src/ext/export-ui.js`, options and history hooks | CLI only | one step from the history page writes any profile; capture | yes | no |
| W3-E Engagement-mechanics guard | `tests/no-engagement.test.js` | no guard | a test bans the notifications permission, badge counts and streak state | yes | no |

## Wave 4: reach, each with its own evaluation

| Package | Owns | Entry | Exit | Parallel | Author |
|---|---|---|---|---|---|
| W4-A Reddit labelled set and thresholds | `scripts/eval/reddit-*`, results JSON | no labelled set | per-platform precision with intervals before any Reddit campaign claim | yes | labellers |
| W4-B Bluesky labelled set from the open firehose | `scripts/eval/bsky-*` | no labelled set | the same, from Jetstream, deletions honoured | yes | labellers |
| W4-C LinkedIn adapter | `src/ext/linkedin.js`, fixtures | not built | fixture and rotation tests; live check; no claims until its evaluation | yes | live check |
| W4-D Phone share target | `android/` or a PWA share target, reusing `src/ocr/` | OCR built | share a screenshot or link, read on the device, same receipts, works offline | yes | store account |
| W4-E Explainer, first piece | `docs/explainers/01-*` | slate only | "Run it on us" or "Bought attention that looks earned", every line sourced, Articulate clean, right-of-reply note | yes | **yes**: legal review if it names anyone; nothing posted |
| W4-F Store readiness | `docs/store/`, release notes | kit exists | listing, screenshots and data declarations current for the release; the author submits | yes | **yes**: submission, Mozilla signing, private vulnerability reporting |

## Rules for every package

- Branch from `main`; one pull request; merge on green CI with `--match-head-commit`, in a call of
  its own.
- Update the package's rows in `docs/COMPLETION.md` in the same commit.
- Public text goes through `articulate check`. Nothing is posted and no store is submitted to.
- A detector that has no passing evaluation shows "not measured yet" and makes no claim.

## Does not prove

A package's exit check shows the package does what it says on the cases it was checked on. It does
not show the feature helps readers judge for themselves; that needs its own study.
