// Lessons for the technique signs of project-docs/TECHNIQUES.md: material carried across languages
// and material passed through other accounts. Examples describe made-up posts and accounts; none
// is a real post. The does-not-prove lines match src/core/crosslang.js and src/core/chain.js.

export const TECHNIQUE_LESSONS = [
  {
    id: "cross-language", title: "Same link or upload in several languages", research: [],
    what: "Replies in different languages, from different accounts, carry the same link, the same uploaded file or a claim the same fact-checker reviewed. Daylight Commons reads the language the site itself assigns, and it leaves out the material of the post being answered.",
    examples: [
      { side: "none", topic: "health", kind: "sign", text: "Within an hour, one video about a clinic appears under a news story in Turkish, Indonesian and Korean replies, each from an account with no other posts in that language." },
      { side: "none", topic: "climate", kind: "ordinary", text: "A weather agency's storm map is shared by people in English, Spanish and French along a coast that speaks all three." },
    ],
    why: "A claim that seems to come up everywhere at once feels confirmed. Pushing one item into several language communities at the same time makes each audience think it found the story on its own.",
    spot: "Open two of the replies. Compare their wording, their timing and what else each account posts in that language.",
    counter: "If the accounts post in that language every day, it is ordinary sharing. If they appeared for this item only, look for the first copy and who posted it.",
    dnp: "Multilingual people, translators, news agencies and diaspora communities share the same link or video in several languages. This shows the material crossing languages, not who sent it or whether anyone coordinated.",
  },
  {
    id: "laundered", title: "Material passed through other accounts", research: [],
    what: "The post's material reached it through other accounts or a linked site, and the post does not point at the earliest source Daylight Commons has seen. Daylight Commons follows only what the site records: quotes, reposts, \"media from\", and the same upload or link seen earlier.",
    examples: [
      { side: "none", topic: "economy", kind: "sign", text: "A chart first posted by an anonymous account is quoted by a mid-sized account, then shared by a large one as \"reports say\", with no trace of the first post." },
      { side: "none", topic: "science", kind: "ordinary", text: "A teacher shares a science magazine's post, which quotes the university that ran the study." },
    ],
    why: "A claim gains weight each time it passes through a voice people trust. After two or three steps the original source drops out of sight, and one source looks like several independent ones.",
    spot: "Open the origin in the chain. Ask who said it first, what they based it on, and whether each step added evidence or only reach.",
    counter: "If every step adds a source or a check, the chain is reporting. If each step only repeats the one before, you are looking at a single claim with many voices.",
    dnp: "Daylight Commons cannot see past the first upload or link it has seen: who filmed, wrote or paid for the material. Passing material along through other accounts is also how ordinary sharing works.",
  },
  {
    id: "person-story", title: "One person's story, no wider picture", research: [],
    what: "The post explains an issue only through one person's case: a name, an age, what happened to them. It gives no numbers, trends, causes or policies. Iyengar called this episodic framing, and its opposite, which places the issue in context, thematic framing. Daylight Commons does not show this sign yet: it has no labelled check.",
    examples: [
      { side: "left", topic: "housing", kind: "sign", text: "A 71-year-old widow was evicted on Tuesday after 30 years in her flat. This is what the new rules do." },
      { side: "right", topic: "immigration", kind: "sign", text: "This father lost his son to a driver who had been told to leave. Meet the family the system forgot." },
      { side: "centre", topic: "economy", kind: "sign", text: "My neighbour lost her job when the plant moved, and now she drives for three apps to pay the rent." },
      { side: "none", topic: "local", kind: "fair", text: "Evictions in the county rose 14% since 2023, court data show. One of them was a 71-year-old tenant who had lived there 30 years." },
    ],
    why: "A single story is vivid and easy to remember. Iyengar found that viewers shown episodic coverage tended to blame the person in it, and viewers shown thematic coverage tended to hold government or society responsible. The choice of frame moves the blame before any argument is made.",
    spot: "Ask how common the case is, and what causes it. Look for one number or one cause beyond the person.",
    counter: "A story beside the figures, like the fair example, shows both the person and the pattern. A story alone tells you about one life.",
    dnp: "A person's story can be true, typical and the best way to explain an issue. This describes how the post explains the issue, not whether it is right or who wrote it.",
  },
];
