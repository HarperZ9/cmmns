// The research the lessons rest on. Each entry was read from the paper itself (full text or the
// publisher's abstract) on 2026-10-20; `found` is what the paper reports, `limit` what it says it
// did not show. Lessons cite these by key.

export const RESEARCH = {
  "badnews-2019": {
    cite: "Roozenbeek, J. and van der Linden, S. (25 June 2019). Fake news game confers psychological resistance against online misinformation. Palgrave Communications 5, 65.",
    url: "https://doi.org/10.1057/s41599-019-0279-9",
    found: "Bad News lets players practise six techniques: impersonation, emotional language, polarisation, conspiracy theories, discrediting opponents and trolling. About 15,000 players rated fake posts as less reliable after playing (d from 0.16 to 0.36 by technique), across education, age and political ideology.",
    limit: "Players chose to take part, the study lacked a control group, and the sample leaned young, male and liberal.",
  },
  "enders-2023": {
    // Read from the publisher's abstract on 2026-10-21.
    cite: "Enders, A., Farhart, C., Miller, J., Uscinski, J., Saunders, K. and Drochon, H. (2023). Are Republicans and conservatives more likely to believe conspiracy theories? Political Behavior 45, 2001 to 2024.",
    url: "https://doi.org/10.1007/s11109-022-09812-3",
    found: "Across 20 US surveys from 2012 to 2021 (37,776 people) and surveys in 20 more countries (26,416 people), any lean of conspiracy belief toward the right was small and inconsistent. When the story was held constant and only the villain's party changed, both sides endorsed it at similar rates.",
    limit: "Surveys measure what people say they believe, which can differ from what they post, and the result depends on which theories are asked about.",
  },
  "badnews-2020": {
    cite: "Basol, M., Roozenbeek, J. and van der Linden, S. (10 January 2020). Good News about Bad News: gamified inoculation boosts confidence and cognitive immunity against fake news. Journal of Cognition 3(1), 2.",
    url: "https://doi.org/10.5334/joc.91",
    found: "With a control group (196 people, 18 headlines), Bad News players got better at spotting the techniques, and their confidence rose in step with judgements that moved in the right direction.",
    limit: "A small sample, tested straight after play.",
  },
  "longterm-2021": {
    cite: "Maertens, R., Roozenbeek, J., Basol, M. and van der Linden, S. (March 2021). Long-term effectiveness of inoculation against misinformation: three longitudinal experiments. Journal of Experimental Psychology: Applied 27(1), 1 to 16.",
    url: "https://doi.org/10.1037/xap0000315",
    found: "When people were tested again at intervals, the effect lasted at least three months. Tested once, people lost it over two months.",
    limit: "Three experiments of 151 to 194 people each, and the headlines were made for the study.",
  },
  "goviral-2021": {
    cite: "Basol, M., Roozenbeek, J., Berriche, M., Uenal, F., McClanahan, W. P. and van der Linden, S. (11 May 2021). Towards psychological herd immunity: cross-cultural evidence for two prebunking interventions against COVID-19 misinformation. Big Data and Society 8(1).",
    url: "https://doi.org/10.1177/20539517211013868",
    found: "Go Viral!, a five-minute game on fearmongering, fake experts and conspiracy theories, raised how manipulative people found COVID-19 misinformation and their confidence in spotting it, in English, French and German (about 1,770 people in each of two studies). Both effects held for at least a week.",
    limit: "Willingness to share was self-reported, and the follow-up was one week.",
  },
  "youtube-2022": {
    cite: "Roozenbeek, J., van der Linden, S., Goldberg, B., Rathje, S. and Lewandowsky, S. (24 August 2022). Psychological inoculation improves resilience against misinformation on social media. Science Advances 8(34), eabo6254.",
    url: "https://doi.org/10.1126/sciadv.abo6254",
    found: "Five videos of about 90 seconds each covered emotional language, incoherence, false dichotomies, scapegoating and ad hominem attacks. Each gave a warning, a refutation and a small made-up example. In six trials (6,464 people) recognition of the technique improved (d from 0.28 to 0.68), with no consistent difference by political ideology. Run as YouTube ads (22,632 answers), recognition rose by about 5 points within a day.",
    limit: "The field effect was small (h = 0.09). The paper did not measure how long the effect lasts, or whether it carries over to techniques the videos did not cover.",
  },
  "roc-2023": {
    cite: "Modirrousta-Galian, A. and Higham, P. A. (online 30 March 2023). Gamified inoculation interventions do not improve discrimination between true and fake news: reanalyzing existing research with receiver operating characteristic analysis. Journal of Experimental Psychology: General 152(9), 2411 to 2437.",
    url: "https://doi.org/10.1037/xge0001395",
    found: "A reanalysis of five Bad News and Go Viral! studies with signal detection methods. Where true and fake items were comparable, the games left the skill of telling them apart unchanged. Players answered \"false\" more often to every item.",
    limit: "A reanalysis of other teams' data, so it inherits their items and samples.",
  },
  "mixed-2023": {
    cite: "Graham, M. E., Skov, B., Gilson, Z., Heise, C., Fallow, K. M., Mah, E. Y. and Lindsay, D. S. (9 October 2023). Mixed news about the Bad News game. Journal of Cognition 6(1).",
    url: "https://doi.org/10.5334/joc.324",
    found: "Four teams repeated the 2020 study with more true posts. Playing lowered belief in false posts, and lowered belief in true posts by the same or nearly the same amount: more doubt, the same discrimination.",
    limit: "Student-run replications, loosely coordinated, with different versions of the game.",
  },
  "india-2025": {
    cite: "Seabrooke, T., Modirrousta-Galian, A. and Higham, P. A. (15 December 2025). Re-examining the Bad News game: no evidence of improved discrimination of Indian true and fake news headlines. Psychonomic Bulletin and Review 33(1).",
    url: "https://doi.org/10.3758/s13423-025-02827-x",
    found: "A preregistered repeat with 150 Indian participants and counterbalanced headlines found discrimination unchanged.",
    limit: "One sample of 150 people, recruited online.",
  },
  "inductive-2026": {
    cite: "Modirrousta-Galian, A., Seabrooke, T., Hanoch, Y., Kelley, N. J. and Higham, P. A. (online 11 May 2026). An inductive learning intervention to improve news veracity discernment. Journal of Experimental Psychology: Applied.",
    url: "https://doi.org/10.1037/xap0000580",
    found: "Sorting true and false headlines with feedback on each one improved discernment (1,135 people over three experiments). With performance badges on an easy-to-hard sequence the effect shrank, and the authors think the badges made the falling scores visible. Switching to hard-to-easy gave the clearest gain.",
    limit: "Headline sorting in a study setting. How long the effect lasts is an open question.",
  },
};

// How the lessons follow the research, in the order a lesson reads.
export const METHOD = [
  "Each lesson names one move before you meet it in the wild, then shows a small, made-up example. The inoculation studies above use the same order: a warning, a refutation and a weakened dose.",
  "The examples are synthetic, written for these lessons. The 2022 video study used made-up, non-political examples so that every viewer felt their own side was spared. Daylight Commons adds examples from left, right and centre in equal numbers, so the move is visible whoever makes it. A test counts them.",
  "Later studies found a catch. Bad News players got more suspicious of everything, true posts included, and no better at telling true from false. So every lesson here also shows a fair use of the same words, or an ordinary account that trips the same sign, and every lesson says the sign can sit on a true post.",
  "The self-check mixes posts that lean on a move with posts that give real support, in equal numbers. It counts both kinds of answer, so calling everything suspect scores at chance. It runs hard to easy and explains every answer.",
  "The self-check is optional, and your answers stay in this browser. In the long-term study, people who came back to practise kept the skill for months.",
];
