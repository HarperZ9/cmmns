// Lessons for the technique signs of project-docs/TECHNIQUES.md: material carried across languages
// and material passed through other accounts. Examples describe made-up posts and accounts; none
// is a real post. The does-not-prove lines match src/core/crosslang.js and src/core/chain.js.

export const TECHNIQUE_LESSONS = [
  {
    id: "cross-language", title: "Same link or upload in several languages", research: [],
    what: "This sign finds replies in different languages, from different accounts, with the same link, the same uploaded file or a claim that the same fact-checker reviewed. CMMNS uses the language that the site assigns. It leaves out the material of the post that the replies answer.",
    examples: [
      { side: "none", topic: "health", kind: "sign", text: "Within an hour, one video about a clinic appears under a news story in Turkish, Indonesian and Korean replies, each from an account whose other posts are in another language." },
      { side: "none", topic: "climate", kind: "ordinary", text: "A weather agency's storm map is shared by people in English, Spanish and French along a coast that speaks all three." },
    ],
    why: "A claim that seems to appear everywhere at once feels confirmed. When someone pushes one item into several language communities at the same time, each audience thinks it found the story on its own.",
    spot: "Open two of the replies. Compare their wording, their timing, and what else each account posts in that language.",
    counter: "If the accounts post in that language every day, this is ordinary sharing. If they appeared for this item alone, look for the first copy and who posted it.",
    dnp: "This shows the same material crossing languages. Multilingual people, translators, news agencies and diaspora communities share links and videos this way too.",
  },
  {
    id: "laundered", title: "Material passed through other accounts", research: [],
    what: "This sign finds material that reached the post through other accounts or a linked site, while the post leaves out the earliest source CMMNS saw. CMMNS follows what the site records: quotes, reposts, \"media from\", and the same upload or link seen earlier.",
    examples: [
      { side: "none", topic: "economy", kind: "sign", text: "A chart first posted by an anonymous account is quoted by a mid-sized account, then shared by a large one as \"reports say\", with the first post dropped from view." },
      { side: "none", topic: "science", kind: "ordinary", text: "A teacher shares a science magazine's post, which quotes the university that ran the study." },
    ],
    why: "A claim gains weight each time it passes through a voice that people trust. After two or three steps, the original source drops out of sight. Then one source looks like several independent sources.",
    spot: "Open the origin in the chain. Ask who said it first and what they based it on. Ask if each step added evidence or only reach.",
    counter: "If every step adds a source or a check, the chain is reporting. If each step repeats the step before, you are looking at one claim with many voices.",
    dnp: "The chain starts at the first upload or link CMMNS has seen; who filmed, wrote or paid for the material sits further back. Passing material along through other accounts is also how ordinary sharing works.",
  },
  {
    id: "person-story", title: "One person's story, no wider picture", research: [],
    what: "This sign finds a post that explains an issue through one person's case alone: a name, an age, what happened to them. The post leaves out numbers, trends, causes and policies. Iyengar called this episodic framing. He called the opposite, which puts the issue in context, thematic framing. CMMNS will show this sign when it has a labelled check.",
    examples: [
      { side: "left", topic: "housing", kind: "sign", text: "A 71-year-old widow was evicted on Tuesday after 30 years in her flat. This is what the new rules do." },
      { side: "right", topic: "immigration", kind: "sign", text: "This father lost his son to a driver who had been told to leave. Meet the family the system forgot." },
      { side: "centre", topic: "economy", kind: "sign", text: "My neighbour lost her job when the plant moved, and now she drives for three apps to pay the rent." },
      { side: "none", topic: "local", kind: "fair", text: "Evictions in the county rose 14% since 2023, court data show. One of them was a 71-year-old tenant who had lived there 30 years." },
    ],
    why: "One story is vivid and easy to remember. Iyengar found that viewers of episodic coverage often blamed the person in it. Viewers of thematic coverage often held government or society responsible. The frame moves the blame before any argument starts.",
    spot: "Ask how common the case is, and what causes it. Look for one number or one cause beyond the person.",
    counter: "A story next to the figures, like the fair example, shows both the person and the pattern. A story alone tells you about one life.",
    dnp: "A person's story can be true, typical and the best way to explain an issue. This sign describes how the post explains the issue. Whether it is right, and who wrote it, are separate questions.",
  },
];
