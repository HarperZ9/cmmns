// Lessons for the language signs: the strong rhetoric families (src/core/rhetoric.js) and the
// writing signs (src/core/machine.js). Examples are made up and mild on purpose: a weakened dose,
// as in the inoculation studies. Hateful terms are never printed; a placeholder stands in. Each
// rhetoric lesson has a sign example read as left, right and centre, and a fair example that uses
// similar words without the move (often reported speech, which CMMNS does not count).

const WORDS_DNP = "People also quote these words, use them as irony, or report what someone else said. This sign describes the words in the post. The writer and the motive are a separate question.";

export const LANGUAGE_LESSONS = [
  {
    id: "dehumanise", title: "Dehumanising language", research: ["badnews-2019"],
    what: "Dehumanising language describes a group of people as vermin, disease, animals or filth. The post moves people out of the category of people.",
    examples: [
      { side: "left", topic: "housing", kind: "sign", text: "Landlords are parasites feeding on this city." },
      { side: "right", topic: "economy", kind: "sign", text: "Those benefit claimants are parasites feeding on this country." },
      { side: "centre", topic: "local", kind: "sign", text: "The protesters are a plague on this city, a pack of animals." },
      { side: "none", topic: "media", kind: "fair", text: "The councillor called tenants \"parasites\" at Tuesday's meeting, and he has since apologised. Video of the meeting is linked." },
    ],
    why: "When a post calls a group less than human, harm to that group feels less like harm. Historians of mass violence find this language before atrocities again and again. So CMMNS treats it as strong.",
    spot: "Look for a group name next to a word for pests, disease or animals. Then check if the post says it or reports what someone else said.",
    counter: "Put a group you belong to in the sentence and read it again. If it now sounds like an attack, it was an attack before. You can criticise what people do and still call them people.",
    dnp: WORDS_DNP,
  },
  {
    id: "stereotype", title: "Group stereotype", research: ["badnews-2019"],
    what: "A group stereotype names a whole group by one trait. They are all lazy, all criminals, all violent, all stupid.",
    examples: [
      { side: "left", topic: "elections", kind: "sign", text: "Rural voters are all ignorant, and that is the whole story." },
      { side: "right", topic: "education", kind: "sign", text: "Students at that university are all lazy and spoiled." },
      { side: "centre", topic: "crime", kind: "sign", text: "Typical protesters. They are violent every single time." },
      { side: "none", topic: "health", kind: "fair", text: "Smokers in the national survey were twice as likely to report a cough, 31% against 15%. Most smokers, 69%, reported being cough-free." },
    ],
    why: "A stereotype saves effort: one trait stands for millions of different people. When people repeat it, the group starts to feel like one person you already know. Bad News taught polarisation, which uses the same move.",
    spot: "Look for \"all\", \"typical\" or a group name with one trait and a missing number.",
    counter: "Ask how many people the sentence covers, and how the writer met them all. A rate with a source, like the survey in the fair example, describes a group honestly. One counterexample breaks a claim about all of them.",
    dnp: WORDS_DNP,
  },
  {
    id: "violence", title: "Call for violence", research: [],
    what: "A call for violence asks for violence or collective punishment against people. They should be dragged out, they deserve what is coming, someone should make them pay.",
    examples: [
      { side: "left", topic: "economy", kind: "sign", text: "The bosses should be dragged out of their offices and taught a lesson." },
      { side: "right", topic: "immigration", kind: "sign", text: "The officials who allowed this should be dragged out and taught a lesson." },
      { side: "centre", topic: "war", kind: "sign", text: "Flatten the whole region. They all deserve what is coming to them." },
      { side: "none", topic: "crime", kind: "fair", text: "The men who attacked the shop owner should be arrested and charged. The police say they have the camera footage." },
    ],
    why: "A call to harm makes harm seem normal and expected. When a thread repeats it many times, violence can seem like what everyone wants.",
    spot: "Look for three parts: a call to act, a group or a person as the target, and a violent verb. A call for an arrest or a trial is a call for the law.",
    counter: "Keep the anger apart from the act. You can share the anger and refuse the call. If you see a credible threat against a person, report it to the site.",
    dnp: WORDS_DNP,
  },
  {
    id: "vigilante", title: "Call for vigilantes", research: [],
    what: "A call for vigilantes asks people outside the law, or soldiers, to act against people. Form patrols, take it into our own hands, send in the army.",
    examples: [
      { side: "left", topic: "economy", kind: "sign", text: "We should organise and visit the owner's house ourselves." },
      { side: "right", topic: "crime", kind: "sign", text: "Locals should form patrols and deal with the squatters themselves." },
      { side: "centre", topic: "local", kind: "sign", text: "Send in the army and clear the camp tonight." },
      { side: "none", topic: "local", kind: "fair", text: "Neighbours are meeting at the hall on Thursday to plan a litter pick and to ask the council for better street lights." },
    ],
    why: "It makes private force look like a civic duty. People who feel ignored by institutions find that appealing. A group that acts outside the law can harm people before a court hears their side.",
    spot: "Look for a call to put action against people into private hands, or to use soldiers on civilians. A group that asks officials for help does the opposite.",
    counter: "Ask who decides who the target is, and who checks that decision. Courts and police are slow and often fail, and that is a reason to fix them. A crowd gives the target no appeal.",
    dnp: WORDS_DNP,
  },
  {
    id: "slur", title: "Slur or coded hate term", research: ["badnews-2019"],
    what: "This sign finds a slur, a dog whistle or a coined term with a documented hateful meaning. CMMNS matches against cited lists such as the ADL Hate Symbols database and Hatebase.",
    examples: [
      { side: "left", topic: "elections", kind: "sign", text: "Another post from the [coined insult for rural conservatives] crowd." },
      { side: "right", topic: "elections", kind: "sign", text: "Another post from the [coined insult for city liberals] crowd." },
      { side: "centre", topic: "immigration", kind: "sign", text: "Typical [coined insult for migrants], as usual." },
      { side: "none", topic: "media", kind: "fair", text: "A news report explains what a new coded term means and where it started, quoting it once in quotation marks." },
    ],
    why: "Coded terms let a writer speak to insiders while outsiders miss the meaning. New terms spread before the lists catch up. A term that is easy to repeat becomes a badge of belonging.",
    spot: "An odd word or number can appear again and again in hostile posts. Look it up in a hate symbols database before you repeat it.",
    counter: "If the term has a hateful meaning, a repeat does the writer's work. An explanation in quotation marks, as in the fair example, helps readers see it.",
    dnp: WORDS_DNP,
  },
  {
    id: "leaked-ai", title: "Leaked AI text", research: [],
    what: "Leaked AI text is chatbot text, posted as it came out. For example, a stock line such as \"As an AI language model\" stays inside a reply.",
    examples: [
      { side: "none", topic: "tech", kind: "sign", text: "\"As an AI language model, I cannot share opinions, but this phone is the best value of the year.\" Posted as a reply to a stranger's question." },
      { side: "none", topic: "tech", kind: "ordinary", text: "\"Asked a chatbot, it said 'As an AI language model I cannot…', classic.\" A person joking about a chatbot." },
    ],
    why: "Operators who run many accounts use chatbots to write replies at scale. When the output goes straight to the post, the chatbot's stock phrases slip through.",
    spot: "Look for the stock phrases that chatbots write, such as \"As an AI\" and canned apologies. Then check if the post quotes a chatbot or speaks as one.",
    counter: "Read the account's other replies. One leak can be a joke or a test. Many fast replies in the same flat voice make a pattern worth your attention.",
    dnp: "People also quote chatbots, joke, or paste a chatbot reply on purpose.",
  },
  {
    id: "machine-writing", title: "Machine-writing signs", research: [],
    what: "This sign finds three or more independent signs of machine writing in a post of 25 words or more. The signs are stock phrases, a set rhythm and padding.",
    examples: [
      { side: "none", topic: "sport", kind: "sign", text: "\"Great question! It is important to note that the coach's strategy, while bold, highlights the delicate balance of the team's journey this season.\"" },
      { side: "none", topic: "sport", kind: "ordinary", text: "A careful fan, writing in a second language, who uses the same set phrases she learned in class." },
    ],
    why: "Machine text reads smoothly and says little. A reader skims it and keeps the tone. When many accounts post the same tone, a view can look common.",
    spot: "Say the post's claim in your own words. If your sentence is empty, the post was filler.",
    counter: "Treat this sign as weak. On its own it means little, and it fires more often on non-native writers. It matters next to stronger signs on the same account.",
    dnp: "Machine-writing detectors make mistakes on short posts, and they flag non-native English writers more often. Use this sign as a reason to look at the claim.",
  },
  {
    id: "conspiracy-theory", title: "Named conspiracy theory", research: ["enders-2023", "badnews-2019"],
    what: "This sign finds a documented conspiracy theory, by name or by its stock line: chemtrails, a stolen election, a staged shooting, a hidden cure. CMMNS names the theory and shows what checkers found.",
    examples: [
      { side: "left", topic: "elections", kind: "sign", text: "Satellites flipped the votes in the swing states. That is how they stole it." },
      { side: "right", topic: "elections", kind: "sign", text: "The machines flipped the votes overnight. That is how they stole it." },
      { side: "centre", topic: "health", kind: "sign", text: "Look up. Those trails are chemicals, and they are spraying us." },
      { side: "none", topic: "elections", kind: "fair", text: "Every audit in the state matched the machine count within a few votes. The full report is on the election office site." },
    ],
    why: "A theory gives a messy event one hidden author. That feels better than chance or failure. Survey studies find that people on the left and the right accept these claims at similar rates when the story stays the same and only the villain changes. CMMNS matches every direction the same way.",
    spot: "Look for a secret plan, a hidden group and a claim that someone hid the evidence too. Then open the sources in the window and read what investigators found.",
    counter: "Ask what evidence would change the writer's mind. If the answer is none, nobody can check the claim. Real wrongdoing leaves records, court cases and named people, and you can look those up.",
    dnp: "People also name these theories to quote, mock or argue against them. CMMNS skips the obvious debunking. This sign is still unmeasured, so the thread report leaves it out.",
  },
  {
    id: "spam-pattern", title: "Spam pattern", research: [],
    what: "This sign finds a pattern that is common in scam and spam posts: giveaways, crypto offers, \"message me\" bait, and links to strangers' channels.",
    examples: [
      { side: "none", topic: "tech", kind: "sign", text: "\"I made 4,000 last week with this one trick. Message me on the app to learn how.\" Under a post about rent." },
      { side: "none", topic: "local", kind: "ordinary", text: "A bakery posting \"Message us to order a cake for Saturday\"." },
    ],
    why: "Scam replies sit under popular posts because the readers are there. They borrow the trust of the thread and of the person who wrote the post.",
    spot: "Look for a promise of money, a move to a private chat, or a link away from the thread's topic.",
    counter: "When a stranger offers money, keep the talk in public. Check the account's age and its other replies. Scam accounts often post the same offer everywhere.",
    dnp: "Some real people also post giveaways and contact details.",
  },
  {
    id: "x-spam", title: "X: probable spam", research: [],
    what: "X itself filed this reply under \"Probable spam\". CMMNS shows the site's own label as it is.",
    examples: [
      { side: "none", topic: "sport", kind: "sign", text: "A reply under a match result, offering free streams, hidden by X behind \"Show probable spam\"." },
      { side: "none", topic: "sport", kind: "ordinary", text: "A fan's ordinary reply, hidden in the same section because it had a link." },
    ],
    why: "Sites hide replies that they think are spam, and many readers skip that section. CMMNS shows the label, so you know the site made a decision and which way it went.",
    spot: "At the bottom of a thread on X, look for \"Show probable spam\" or \"Show more replies\". X filed the replies in that section.",
    counter: "Treat the label as one opinion from the site. Read the reply and the account, and decide for yourself. The filter misses some spam and catches some real people.",
    dnp: "X's spam filter makes mistakes in both directions.",
  },
  {
    id: "hate-symbol-name", title: "Hate symbol in name", research: [],
    what: "This sign finds a display name or a handle with a documented hate symbol or number code, from a hate symbols database.",
    examples: [
      { side: "none", topic: "media", kind: "sign", text: "A display name ending in a number code that a hate symbols database lists, on an account that replies to every post about one group." },
      { side: "none", topic: "sport", kind: "ordinary", text: "A display name ending in the same digits because they are the owner's shirt number." },
    ],
    why: "A symbol in the name tells insiders which side the account is on. Every reply from the account then carries that badge into the thread.",
    spot: "Look up the symbol or the number in a hate symbols database. Then read some of the account's posts for context.",
    counter: "Look before you decide, because some numbers are birth years or shirt numbers. When the posts make the meaning clear, read the replies with that in mind.",
    dnp: "",
  },
];
