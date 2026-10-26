<!-- writing-profile: research -->
# Retrospective calibration of the readouts: design and status

**Status: preregistered, not run.** No hit, miss or false-alarm counts exist, so every reading that
links a post-level readout to the risk of mass atrocity is a hypothesis.

## The question

How often do Daylight Commons' post-level readouts (dehumanising language, calls for violence,
coordinated messaging, the claim and gap markers) fire in the media of periods that ended in mass
atrocities, and how often in periods of high tension that did not? The answer calibrates what a
readout is worth. It never becomes a forecast or a risk score for any group, country or person.

## The loose laws it sits beside

Stanton's ten stages (Genocide Watch: "predictable but not inexorable", "not linear"), the UN Framework
of Analysis for Atrocity Crimes (2014; 14 unranked risk factors), and the propaganda-model filters.
Cited, with their confidence, in the counter-repression brief, section 4b. Daylight touches only the
readouts a post carries; the context that splits two identical readouts (institutions, the record of
violence) is not in a post.

## The cases, fixed before any readout ran

`data/calibration/cases.json`, fixed 2026-10-26:

| Id | Place and window | Outcome | Outcome source | Readout corpus |
|---|---|---|---|---|
| P1 | Rwanda, 1993-07 to 1994-07 | atrocity | ICTR Media case judgement (2003) | RTLM broadcast transcripts with English translations (ICTR exhibits, University of Texas Libraries) |
| P2 | Myanmar, Rakhine, 2016-10 to 2017-12 | atrocity | UN Fact-Finding Mission, A/HRC/39/64 and CRP.2 (2018) | posts and speeches quoted by the mission |
| P3 | Kenya, 2007-12 to 2008-02 | atrocity | Waki report (2008); KNCHR, On the Brink of the Precipice (2008) | radio and SMS messages quoted by KNCHR |
| C1 | Kenya, 2012-09 to 2013-05 | high tension, no atrocity | EU Election Observation Mission, Kenya 2013 (final report) | Umati project reports on online dangerous speech |

## What was gathered on 2026-10-26

| Source | Result |
|---|---|
| A/HRC/39/64 (P2 outcome) | fetched, SHA-256 in `cases.json` |
| Umati report, iHub (C1 corpus) | fetched, SHA-256 in `cases.json` |
| Umati in EISF 2014 (C1 corpus) | fetched, SHA-256 in `cases.json` |
| KNCHR report item page (P3) | reached; the 189 MB report itself not downloaded |
| A/HRC/39/CRP.2 (P2 corpus) | the UN library answered 202 with no body |
| RTLM tapes (P1 corpus) | the repository answers scripted requests with 403; a person can download them from the item pages, and this study does not work around the block |

Downloads are kept outside the repository; only their addresses and hashes are committed. Much of
this material is hateful speech kept as evidence of crimes; it stays out of the repository for that
reason and for copyright.

## Why it cannot run as designed, and what would make it run

1. **Curated quotes make every readout a hit.** Three of the four corpora are quotes an inquiry or a
   monitor chose because they were dangerous. A readout that fires on them shows only that it agrees
   with the monitors. A calibration needs samples of what people actually received in each window:
   full broadcasts (the RTLM tapes are this, for P1) or full feeds.
2. **Too few controls.** One no-atrocity period against three atrocity periods cannot give a false-alarm
   rate. The design needs at least as many matched control periods with full samples.
3. **An outside reviewer** (the author's step) checks the case list, the outcome coding and the scoring
   before any result is read.
4. **Language.** RTLM broadcast in Kinyarwanda and French; Daylight's markers read French and the
   English translations, not Kinyarwanda. Kenyan corpora mix English, Swahili and Sheng.

The scoring, once corpora exist: run each readout over each window blind to the outcome, count hits
(fires in an atrocity window), misses (silent in one) and false alarms (fires in a control window),
with Wilson intervals and the base rate stated, since atrocities are rare and even a precise readout
fires mostly where nothing follows.

## Boundaries

Prevention, protection and the exposure of propaganda only. No targeting, profiling or deanonymising
of anyone; individual speakers in the corpora are not named in any output. Identical readouts for
every case. No prediction about any group.
