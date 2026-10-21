// Lessons for the technique signs of project-docs/TECHNIQUES.md: material carried across languages
// and material passed through other accounts. Examples describe made-up posts and accounts; none
// is a real post. The does-not-prove lines match src/core/crosslang.js and src/core/chain.js.

export const TECHNIQUE_LESSONS = [
  {
    id: "cross-language", title: "Same link or upload in several languages", research: [],
    what: "Replies in different languages, from different accounts, carry the same link, the same uploaded file or a claim the same fact-checker reviewed. Radar reads the language the site itself assigns, and it leaves out the material of the post being answered.",
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
    what: "The post's material reached it through other accounts or a linked site, and the post does not point at the earliest source Radar has seen. Radar follows only what the site records: quotes, reposts, \"media from\", and the same upload or link seen earlier.",
    examples: [
      { side: "none", topic: "economy", kind: "sign", text: "A chart first posted by an anonymous account is quoted by a mid-sized account, then shared by a large one as \"reports say\", with no trace of the first post." },
      { side: "none", topic: "science", kind: "ordinary", text: "A teacher shares a science magazine's post, which quotes the university that ran the study." },
    ],
    why: "A claim gains weight each time it passes through a voice people trust. After two or three steps the original source drops out of sight, and one source looks like several independent ones.",
    spot: "Open the origin in the chain. Ask who said it first, what they based it on, and whether each step added evidence or only reach.",
    counter: "If every step adds a source or a check, the chain is reporting. If each step only repeats the one before, you are looking at a single claim with many voices.",
    dnp: "Radar cannot see past the first upload or link it has seen: who filmed, wrote or paid for the material. Passing material along through other accounts is also how ordinary sharing works.",
  },
];
