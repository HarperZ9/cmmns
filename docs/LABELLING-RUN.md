<!-- writing-profile: procedure -->
# Labelling run: what the author needs to set up

Package W2-B in `docs/WAVES.md`. The kit is built (`scripts/label/`, guide in
`project-docs/LABELLING.md`). The run needs people, so it needs you. Nothing has been labelled yet.

## Who to recruit

Recruit two labellers and one coordinator. You can be the coordinator. You cannot be a labeller,
because you built the lens and know its signs.

Each labeller should:
- read X daily and know how reposts, quotes and the Paid partnership label look;
- have some background in social media research, trust and safety, open-source investigation or
  journalism (a graduate student in one of these fits);
- read the languages of the cases they get, or say so before the run.

Rule out anyone who:
- works for, or is paid by, a brand, agency or creator in the case list;
- has used Daylight Commons on the case posts;
- manages or is managed by the other labeller.

Pay by the hour or by the case, never by the label chosen. Ask each labeller to state any conflict in
writing before they start.

## Blinding

1. The coordinator picks the cases and writes two files, both kept outside the repository:
   - the case list: `[{"case": "c001", "open": "https://x.com/..."}]`, given to both labellers;
   - the lens file: one `{"format": "dc-label/1", "kind": "lens", "case": "c001", "lens": "strong"}`
     line per case, from running Daylight Commons on each post. Labellers never see it.
2. Labellers work in a browser profile without the extension.
3. Labellers do not talk about cases until both files are in.
4. The coordinator finds the outside evidence for `paid-undisclosed` cases and gives each labeller
   the same evidence for the same case, without the lens's status.

## The cases

The protocol minimum is 30 `organic` and 30 paid cases on X. Only consensus cases count, and
disagreements become `unsure`. Pick about 70 cases to end with 60 usable ones.

The fairness bound needs at least two language strata, or two region strata, with 30 organic cases
each. A run with 30 organic cases can read at most one stratum, so the bound reads `not readable`.
To read it, label at least 60 organic cases split evenly across two languages or two regions. Plan
that as the second round.

## How long it takes

These are my estimates from the form and the reading each case needs. No one has been timed yet.
Time the first five cases and revise.

| Who | Task | Estimate |
|---|---|---|
| Each labeller | Read the guide and do five practice cases outside the 60 | 1 hour |
| Each labeller | 70 cases at 8 to 15 minutes each | 9 to 18 hours |
| Coordinator | Find 30 to 35 paid cases, most with the Paid partnership label | 4 to 8 hours |
| Coordinator | Find outside evidence for each `paid-undisclosed` case, 30 to 60 minutes each | depends on how many; 5 to 10 hours for 10 cases |
| Coordinator | Find about 35 organic cases across topics and audience bands | 3 to 5 hours |
| Coordinator | Lens file, joining files, `results.mjs`, ledger update | 2 hours |

At four hours a day, each labeller needs about three to five working days.

## When the files are in

```
cat labels-L1.jsonl labels-L2.jsonl lens.jsonl > all-labels.jsonl
node scripts/label/results.mjs all-labels.jsonl --out project-docs/evidence/campaign-labels-results.json
```

Commit only the results file. Update rows M2 and M3 in `docs/COMPLETION.md` with the numbers and
their intervals, and the `MEASURED` entry for the campaign lens if precision clears the bar.

## Does not prove

A run that meets the minimums shows how the lens did on these cases, labelled by these two people.
It does not show the lens works on other platforms or other kinds of launch.
