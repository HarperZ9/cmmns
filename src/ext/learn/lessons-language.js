// Lessons for the language signs: the strong rhetoric families (src/core/rhetoric.js) and the
// writing signs (src/core/machine.js). Examples are made up and mild on purpose: a weakened dose,
// as in the inoculation studies. Hateful terms are never printed; a placeholder stands in. Each
// rhetoric lesson has a sign example read as left, right and centre, and a fair example that uses
// similar words without the move (often reported speech, which Daylight Commons does not count).

const WORDS_DNP = "Words can be quoted, ironic or reported speech. This describes the post, not who wrote it or why.";

export const LANGUAGE_LESSONS = [
  {
    id: "dehumanise", title: "Dehumanising language", research: ["badnews-2019"],
    what: "A group of people described as vermin, disease, animals or filth. The post moves people out of the category of people.",
    examples: [
      { side: "left", topic: "housing", kind: "sign", text: "Landlords are parasites feeding on this city." },
      { side: "right", topic: "economy", kind: "sign", text: "Those benefit claimants are parasites feeding on this country." },
      { side: "centre", topic: "local", kind: "sign", text: "The protesters are a plague on this city, a pack of animals." },
      { side: "none", topic: "media", kind: "fair", text: "The councillor called tenants \"parasites\" at Tuesday's meeting, and he has since apologised. Video of the meeting is linked." },
    ],
    why: "Once a group is described as less than human, harm to it feels less like harm. Historians of mass violence find this language before atrocities again and again, which is why Daylight Commons treats it as strong.",
    spot: "Look for a group name next to a word for pests, disease or animals. Then check whether the post says it or reports someone else saying it.",
    counter: "Swap the group for one you belong to and read the sentence again. If it now sounds like an attack, it was one before. You can criticise what people do without calling them pests.",
    dnp: WORDS_DNP,
  },
  {
    id: "stereotype", title: "Group stereotype", research: ["badnews-2019"],
    what: "A whole group named by one trait. They are all lazy, all criminals, all violent, all stupid.",
    examples: [
      { side: "left", topic: "elections", kind: "sign", text: "Rural voters are all ignorant, and that is the whole story." },
      { side: "right", topic: "education", kind: "sign", text: "Students at that university are all lazy and spoiled." },
      { side: "centre", topic: "crime", kind: "sign", text: "Typical protesters. They are violent every single time." },
      { side: "none", topic: "health", kind: "fair", text: "Smokers in the national survey were twice as likely to report a cough, 31% against 15%. Many smokers had no cough at all." },
    ],
    why: "A stereotype saves effort: one trait stands in for millions of different people. Repeated, it makes the group feel like one person you already know. Bad News taught polarisation, which leans on the same move.",
    spot: "Look for \"all\", \"typical\" or a group name followed by one trait, with no number.",
    counter: "Ask how many people the sentence covers and how the writer met them all. A rate with a source, like the survey in the fair example, describes a group honestly. A claim about all of them fails on one counterexample.",
    dnp: WORDS_DNP,
  },
  {
    id: "violence", title: "Call for violence", research: [],
    what: "A call for violence or collective punishment against people. They should be dragged out, they deserve what is coming, someone should make them pay.",
    examples: [
      { side: "left", topic: "economy", kind: "sign", text: "The bosses should be dragged out of their offices and taught a lesson." },
      { side: "right", topic: "immigration", kind: "sign", text: "The officials who allowed this should be dragged out and taught a lesson." },
      { side: "centre", topic: "war", kind: "sign", text: "Flatten the whole region. They all deserve what is coming to them." },
      { side: "none", topic: "crime", kind: "fair", text: "The men who attacked the shop owner should be arrested and charged. The police say they have the camera footage." },
    ],
    why: "A call to harm spreads the idea that harm is normal and expected. Read many times in one thread, it can make violence seem like what everyone wants.",
    spot: "Look for a call to act, a group or person as the target, and a violent verb. A call for arrest or a trial is a call for the law.",
    counter: "Separate the anger from the act. You can share the anger and refuse the call. If you see a credible threat against a person, report it to the site.",
    dnp: WORDS_DNP,
  },
  {
    id: "vigilante", title: "Call for vigilantes", research: [],
    what: "A call for people outside the law, or soldiers, to act against people. Form patrols, take it into our own hands, send in the army.",
    examples: [
      { side: "left", topic: "economy", kind: "sign", text: "We should organise and visit the owner's house ourselves." },
      { side: "right", topic: "crime", kind: "sign", text: "Locals should form patrols and deal with the squatters themselves." },
      { side: "centre", topic: "local", kind: "sign", text: "Send in the army and clear the camp tonight." },
      { side: "none", topic: "local", kind: "fair", text: "Neighbours are meeting at the hall on Thursday to plan a litter pick and to ask the council for better street lights." },
    ],
    why: "It recasts private force as civic duty. People who feel ignored by institutions find that appealing, and a group acting outside the law can harm people who never get a hearing.",
    spot: "Look for a call to take action into private hands against people, or to use soldiers on civilians. Organising to ask officials for help is the opposite.",
    counter: "Ask who decides who the target is, and who checks them. Courts and police are slow and often fail, and that is a reason to fix them. A crowd has no appeal.",
    dnp: WORDS_DNP,
  },
  {
    id: "slur", title: "Slur or coded hate term", research: ["badnews-2019"],
    what: "A slur, a dog whistle or a coined term with a documented hateful meaning. Daylight Commons matches against cited lists such as the ADL Hate Symbols database and Hatebase.",
    examples: [
      { side: "left", topic: "elections", kind: "sign", text: "Another post from the [coined insult for rural conservatives] crowd." },
      { side: "right", topic: "elections", kind: "sign", text: "Another post from the [coined insult for city liberals] crowd." },
      { side: "centre", topic: "immigration", kind: "sign", text: "Typical [coined insult for migrants], as usual." },
      { side: "none", topic: "media", kind: "fair", text: "A news report explains what a new coded term means and where it started, quoting it once in quotation marks." },
    ],
    why: "Coded terms let a writer speak to insiders while outsiders miss it. New coinages spread before the lists catch up, and a term that is easy to repeat becomes a badge of belonging.",
    spot: "When an odd word or number keeps appearing in hostile posts, look it up in a hate symbols database before you repeat it.",
    counter: "If it has a hateful meaning, repeating it does the writer's work. Explaining it in quotation marks, as the fair example does, helps readers see it.",
    dnp: WORDS_DNP,
  },
  {
    id: "leaked-ai", title: "Leaked AI text", research: [],
    what: "Text a chatbot writes, posted without editing. \"As an AI language model\" or \"I cannot help with that request\" left inside a reply.",
    examples: [
      { side: "none", topic: "tech", kind: "sign", text: "\"As an AI language model, I cannot share opinions, but this phone is the best value of the year.\" Posted as a reply to a stranger's question." },
      { side: "none", topic: "tech", kind: "ordinary", text: "\"Asked a chatbot, it said 'As an AI language model I cannot…', classic.\" A person joking about a chatbot." },
    ],
    why: "Operators who run many accounts use chatbots to write replies at scale. When nobody reads the output before posting, the chatbot's stock phrases slip through.",
    spot: "Look for the stock refusals and disclaimers chatbots write. Then look at whether the post is quoting a chatbot or speaking as one.",
    counter: "Read the account's other replies. One leak can be a joke or a test. A run of replies in the same flat voice, posted fast, is a pattern worth noticing.",
    dnp: "People quote chatbots, joke, or paste a reply on purpose.",
  },
  {
    id: "machine-writing", title: "Machine-writing signs", research: [],
    what: "Three or more independent signs of machine writing in a post of at least 25 words: stock phrases, a set rhythm, padding that says little.",
    examples: [
      { side: "none", topic: "sport", kind: "sign", text: "\"Great question! It is important to note that the coach's strategy, while bold, highlights the delicate balance of the team's journey this season.\"" },
      { side: "none", topic: "sport", kind: "ordinary", text: "A careful fan, writing in a second language, who uses the same set phrases she learned in class." },
    ],
    why: "Machine text reads smoothly and says little, so a reader skims it and keeps the tone. Many accounts posting the same tone can make a view look common.",
    spot: "Say the post's claim in your own words. If you cannot find one, it was filler.",
    counter: "Treat this sign as weak. On its own it means little, and it fires on non-native writers more often. It matters next to stronger signs on the same account.",
    dnp: "No detector reliably tells human from machine writing in a few sentences, and detectors flag non-native English writers more often.",
  },
  {
    id: "conspiracy-theory", title: "Named conspiracy theory", research: ["enders-2023", "badnews-2019"],
    what: "The post uses a documented conspiracy theory by name or by its stock line: chemtrails, a stolen election, a staged shooting, a hidden cure. Daylight Commons names the theory and shows what checkers found.",
    examples: [
      { side: "left", topic: "elections", kind: "sign", text: "Satellites flipped the votes in the swing states. Nobody wins like that." },
      { side: "right", topic: "elections", kind: "sign", text: "The machines flipped the votes overnight. Nobody wins like that." },
      { side: "centre", topic: "health", kind: "sign", text: "Look up. Those trails are chemicals, and they are spraying us." },
      { side: "none", topic: "elections", kind: "fair", text: "Every audit in the state matched the machine count within a few votes. The full report is on the election office site." },
    ],
    why: "A theory gives a messy event one hidden author, and that feels better than chance or failure. Survey studies find people on the left and the right accept these claims at similar rates when the story is the same and only the villain changes. Daylight Commons matches every direction the same way.",
    spot: "Look for a secret plan, a hidden group and a claim that the evidence was hidden too. Then open the sources in the window and read what investigators found.",
    counter: "Ask what evidence would change the writer's mind. If no evidence could, the claim cannot be checked. Real wrongdoing leaves records, courts and named people, and you can look those up.",
    dnp: "Naming a theory is not believing it. People quote, mock and argue against these claims, and Daylight Commons skips only obvious debunking. This sign is not measured yet and never counts toward the thread report.",
  },
  {
    id: "spam-pattern", title: "Spam pattern", research: [],
    what: "A pattern common in scam and spam posts: giveaways, crypto offers, \"message me\" bait, links to strangers' channels.",
    examples: [
      { side: "none", topic: "tech", kind: "sign", text: "\"I made 4,000 last week with this one trick. Message me on the app to learn how.\" Under a post about rent." },
      { side: "none", topic: "local", kind: "ordinary", text: "A bakery posting \"Message us to order a cake for Saturday\"." },
    ],
    why: "Scam replies sit under popular posts because that is where the readers are. They borrow the trust of the thread and the person who wrote the post.",
    spot: "Look for money promised, a move to a private chat, or a link that has nothing to do with the thread.",
    counter: "Never move to a private chat with a stranger who offers money. Check the account's age and other replies. Scam accounts tend to post the same offer everywhere.",
    dnp: "Some real people do post giveaways and contact details.",
  },
  {
    id: "x-spam", title: "X: probable spam", research: [],
    what: "X itself filed this reply under \"Probable spam\". Daylight Commons repeats the site's own label and adds nothing to it.",
    examples: [
      { side: "none", topic: "sport", kind: "sign", text: "A reply under a match result, offering free streams, hidden by X behind \"Show probable spam\"." },
      { side: "none", topic: "sport", kind: "ordinary", text: "A fan's ordinary reply, hidden in the same section because it had a link." },
    ],
    why: "Sites hide replies they think are spam, and many readers never open that section. Daylight Commons shows the label so you know the site made a call, and which way.",
    spot: "At the bottom of a thread on X, look for \"Show probable spam\" or \"Show more replies\". The replies inside are the ones X filed away.",
    counter: "Treat the label as one opinion from the site. Read the reply and the account and decide for yourself, since the filter misses some spam and catches some real people.",
    dnp: "X's spam filter makes mistakes in both directions.",
  },
  {
    id: "hate-symbol-name", title: "Hate symbol in name", research: [],
    what: "A display name or handle that carries a documented hate symbol or number code, from a hate symbols database.",
    examples: [
      { side: "none", topic: "media", kind: "sign", text: "A display name ending in a number code that a hate symbols database lists, on an account that replies to every post about one group." },
      { side: "none", topic: "sport", kind: "ordinary", text: "A display name ending in the same digits because they are the owner's shirt number." },
    ],
    why: "A symbol in the name tells insiders who the account is with. Every reply it posts then carries that badge into the thread.",
    spot: "Look the symbol or number up in a hate symbols database, then read a few of the account's posts for context.",
    counter: "Look before you assume, since some numbers are birth years or shirt numbers. When the meaning is clear from the posts, read the replies with that in mind.",
    dnp: "",
  },
];
