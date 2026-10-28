# Requests from people named or shown in material

**Draft for counsel review. Not legal advice. Not in force: this page awaits a lawyer's review and
is not part of CMMNS' terms until that review is done.**

Drafted 2026-10-28. This page is for a person who is the subject of material connected with CMMNS: someone named in the project's data tables or examples, or someone whose posts, pictures or
account a CMMNS user has captured or written about. It says how to reach the project, what
the project can do, and what it cannot do because of how the tool is built.

## Two kinds of material

**1. Material on a user's own device.** CMMNS runs on each user's computer. What a user
captures, analyses, concludes or exports stays on that user's device, in their browser or their
folders, unless the user chooses to share it. The project has no server that receives it, no account
system, no telemetry and no copy (`DATA-PROTECTION.md`). The project cannot see this material, cannot
search for it, and cannot change or delete it. The user who holds it is responsible for it, and in
data protection terms is usually its controller.

**2. Material the project itself publishes.** The project's repository and pages publish:

| What | Where | What it holds about people |
|---|---|---|
| Media personalities table | `src/ext/personalities.json`, built from `data/personalities-sources/` (`data/personalities.README.md`) | documented backing of public media personalities: employers, outlet owners, investors, deals, filings, court records, sanctions and government labels, each with its source's own words and date |
| Outlet ownership and state links | `src/ext/owners.json`, `src/ext/state.json`, `data/state-reports.json`, `data/state-designations*.json` | owners of outlets, which may include named people; state labels on outlets and accounts, each from a cited official or published source |
| Fact-check table | `src/ext/claims*.json` | claims as worded by fact-checkers with their ratings; the names of the people each checker says made a claim are dropped and not republished |
| Operations indicators | `src/ext/ops.json`, `data/ops-sources/` | domains and handles named in cited reports on influence operations |
| Discourse name list | shipped inside the extension (`data/discourse/`) | names of people who have died, from Wikidata, used to spot accounts named after them; names a living person shares are left out |
| Worked examples | `examples/` | a case built from public reporting about public figures |
| Documentation and evaluation | `project-docs/` | aggregate results; raw captures of other people's posts are kept out of the repository |

For this material the project is responsible, and can correct or remove it.

## How to contact the project

- **Private requests** (anything involving your personal data, your safety, or material you do not
  want repeated in public): write to the contact address on the maintainer's GitHub profile
  (https://github.com/HarperZ9) with "CMMNS subject request" in the subject. Say which
  material you mean (file and entry, or a link), what is wrong or what you ask for, and how to reach
  you. You do not need to give a reason for a data protection request.
- **Public challenges** to an entry, a badge, a definition or a finding: open an issue titled
  "Challenge:" under the process in `GOVERNANCE.md`. Anyone can use it, with no standing needed.
  Keep private data out of a public issue.
- **Security problems**: `SECURITY.md`.

The project may ask for enough information to confirm that a request about personal data comes from
the person concerned or someone acting for them. It will not ask for more than it needs, and it
deletes identity documents once the check is done.

## What the project can do

For material the project publishes:

1. **Correct it.** An entry shown to be wrong is corrected in a pull request that cites the request
   (or, for a private request, a neutral reference to it), with the date. Earlier versions stay in
   the repository history; the correction is never silent (`GOVERNANCE.md`).
2. **Add context.** Where an entry is accurate but incomplete, the project can add the subject's own
   published response or a later primary record, with its source.
3. **Remove it from future releases.** Where an entry has no sufficient basis, falls outside the
   table's own published method, or concerns a private person, the project removes it from the
   working tables and from the next release.
4. **Restrict it.** Where an objection or a dispute is being looked at, the project can mark the
   entry as under review or leave it out of the next build until the question is settled.
5. **Explain it.** On request the project says what it holds about you, where it came from, and why.

The project weighs each request against the purpose of the table: public-interest reporting on the
public conduct of public figures, organisations and governments. Accurate, sourced entries about a
public figure's public role may be kept after an objection, with the reason written down. An entry
about a private person who is not acting in a public role is removed on request.

## What the project cannot do

- It cannot reach any copy a user holds. Released versions, forks and copies are irrevocably
  licensed and outside the project's control (`GOVERNANCE.md`, "Permanence"), so a removal applies
  to the working tables and to later releases.
- It cannot rewrite git history or recall a published release. A removed entry stays in earlier
  commits and releases; where the law requires more, counsel will advise what is possible
  (`project-docs/LEGAL-REVIEW-CHECKLIST.md`).
- It cannot identify, contact, or act against a user. It does not know who its users are.
- It cannot remove anything from the sites where it was first posted, or from the Internet Archive.
  Those requests go to that site or archive.

If you believe a user has misused CMMNS against you, the acceptable use policy
(`ACCEPTABLE-USE.md`) says what the project does on a misuse report. Where a user published something
about you, the publisher is the person to approach, and the platform or a court is the route if they
do not respond.

## A published, shared catalogue

As of this draft the project publishes no catalogue of user-contributed material about people, and
hosts no user content. Data packs travel as files that users pick, and the project does not collect
them (`project-docs/DATA-SOVEREIGNTY.md`).

If the project ever publishes a shared catalogue built from contributions, it will, before the first
entry:

1. publish a takedown and notice route for each entry, reachable without an account, that takes
   precise, substantiated notices by electronic means and answers each one with its decision and
   reasons;
2. record every entry's contributor key, source and date, so a notice can be checked against the
   record;
3. take down or restrict an entry while a substantiated notice about a private person is reviewed;
4. publish an annual count of notices, decisions and reversals;
5. obtain counsel's advice on hosting-provider duties, including the EU Digital Services Act if the
   service is offered in the EU (`project-docs/LEGAL-REVIEW-CHECKLIST.md`).

## Response times

CMMNS is maintained by one person, so no response time is promised for a challenge.
Requests about personal data are answered within the time the applicable law sets; under the EU and
UK GDPR that is one month, extendable in some cases.
