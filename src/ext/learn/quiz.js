// The self-check: made-up posts, half that lean on a persuasion move in place of support and half
// that make the same kind of point with something you can check. Scored by discernment (hits
// against false alarms, src/core/learn.js), so answering "leans" to everything earns nothing.
// Sides are balanced within each half (tests/learn.symmetry.test.js). Items run hard to easy:
// in Modirrousta-Galian et al. (2026) that order, with feedback on every item and no performance
// badges, improved discernment, and easy-to-hard with badges did worse.

export const QUESTION = "Does this post lean on a move in place of support, or does it give you something to check?";
export const ANSWERS = [["leans", "Leans on a move"], ["support", "Gives something to check"]];

export const ITEMS = [
  // Hard: the move and the support look alike.
  { id: "q-rent-survey", leans: false, side: "left", topic: "housing", level: 3, lesson: "bandwagon",
    text: "Most tenants in the city want rent controls: 62% in the council's own survey of 3,000 renters, published last week.",
    explain: "A consensus claim with its count and its source. You can open the survey and check the question it asked." },
  { id: "q-border-poll", leans: true, side: "right", topic: "immigration", level: 3, lesson: "bandwagon",
    text: "Everyone I talk to says the same thing: the new border rules have failed. The whole country knows it.",
    explain: "The crowd here is \"everyone I talk to\". The post offers you a feeling to share and leaves you empty-handed on facts to count or check." },
  { id: "q-minister-record", leans: false, side: "centre", topic: "economy", level: 3, lesson: "name-calling",
    text: "The minister misled parliament about the contract: the committee report of 4 June found her statement inaccurate.",
    explain: "A hard word with a named finding behind it. The committee report is the evidence, and you can read it." },
  { id: "q-wind-shill", leans: true, side: "left", topic: "climate", level: 3, lesson: "name-calling",
    text: "Of course the senator opposes the wind farm. He is an oil industry puppet, plain and simple.",
    explain: "\"Puppet\" stands in for an argument. The post never says what the senator claimed, or shows a funding link." },
  { id: "q-crime-figures", leans: false, side: "right", topic: "crime", level: 3, lesson: "appeal-to-fear",
    text: "Burglaries in our district rose 40% this year, from 210 to 294, according to the police monthly figures. Lock your back doors.",
    explain: "A warning with its size and its source. The fear is attached to a number you can check." },
  { id: "q-treaty-fear", leans: true, side: "centre", topic: "war", level: 3, lesson: "appeal-to-fear",
    text: "If this treaty fails, every family in this country will be in danger. Think of your children.",
    explain: "Fear with the size and the mechanism left out. How likely, compared with what, and according to whom?" },
  // Middle.
  { id: "q-wage-feeling", leans: false, side: "left", topic: "economy", level: 2, lesson: "loaded-language",
    text: "It is shameful: cleaners at the hospital earn 30% less than in 2015 after inflation, says the union's pay audit.",
    explain: "A charged word, and then the fact that earns it, with a source. Take the word out and the claim still stands." },
  { id: "q-school-outrage", leans: true, side: "right", topic: "education", level: 2, lesson: "loaded-language",
    text: "This sickening, insane curriculum is a disgrace to every parent in the land.",
    explain: "Take out the charged words and the sentence is empty: the curriculum itself goes unmentioned." },
  { id: "q-two-options", leans: true, side: "centre", topic: "economy", level: 2, lesson: "black-and-white",
    text: "Either we pass this budget tonight or the economy collapses. Those are the two choices.",
    explain: "Two options presented as the only ones. A smaller budget, a delay or a different plan are all missing." },
  { id: "q-ballot-two", leans: false, side: "right", topic: "elections", level: 2, lesson: "black-and-white",
    text: "The referendum has two choices: keep the current voting age or lower it to 16. Polls close at 10 pm.",
    explain: "This choice really has two options. Describing a two-box ballot as two options is accurate." },
  { id: "q-funding-note", leans: false, side: "centre", topic: "health", level: 2, lesson: "doubt",
    text: "Worth knowing: the trial's funding statement says the drug's maker paid for the study and employed three of its authors.",
    explain: "The doubt rests on the study's own funding statement. It tells you what to weigh, and where to look." },
  { id: "q-who-paid", leans: true, side: "left", topic: "science", level: 2, lesson: "doubt",
    text: "Interesting that this study found the chemical safe. I wonder who paid for it?",
    explain: "A question in place of a claim. The post hints at a payment and leaves who paid, and how it changed the result, unstated." },
  // Easy: the move is plain.
  { id: "q-real-patriots", leans: true, side: "right", topic: "war", level: 1, lesson: "flag-waving",
    text: "Real patriots back the troops and keep their questions to themselves. Anyone who asks is an enemy of this country.",
    explain: "Loyalty stands in for a reason. The policy itself goes unargued." },
  { id: "q-science-settled", leans: true, side: "left", topic: "science", level: 1, lesson: "thought-terminating",
    text: "The science is settled. End of discussion.",
    explain: "A closing phrase standing where the reason should be. Which science, settled by whom, on which question?" },
  { id: "q-experts-say", leans: true, side: "centre", topic: "health", level: 1, lesson: "appeal-to-authority",
    text: "Experts say the new guidance is completely safe, so stop asking questions.",
    explain: "Which experts? The post leaves them unnamed and unlinked." },
  { id: "q-report-link", leans: false, side: "left", topic: "climate", level: 1, lesson: "appeal-to-authority",
    text: "The national weather service's annual report, out today, says last summer was the hottest on record by 0.3 C. Link in the reply.",
    explain: "A named authority, a date, a figure and a link. That is a citation you can check." },
  { id: "q-same-rule", leans: false, side: "right", topic: "media", level: 1, lesson: "whataboutism",
    text: "The regulator was right to fine our station for the error. It should apply the same rule to the two others that made it this month.",
    explain: "It answers the first question (the fine was right) before it raises the second. Both stand apart." },
  { id: "q-record-rain", leans: false, side: "centre", topic: "local", level: 1, lesson: "exaggeration",
    text: "The wettest week since records began in 1890, says the met office's weekly summary. The river path is closed.",
    explain: "A record, with the record book it comes from. The size is measured." },
];

// Hard first, then middle, then easy; the data order within a level is kept.
export const ORDERED = [...ITEMS].sort((a, b) => b.level - a.level);
