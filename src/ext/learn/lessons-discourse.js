// Lessons for the discourse checks (src/core/discourse/, project-docs/DISCOURSE.md). Examples describe
// made-up posts and accounts; none is a real post. Each has a sign example and an ordinary one.

export const DISCOURSE_LESSONS = [
  {
    id: "quote-source", title: "Where a quote comes from", research: [],
    what: "Daylight Commons takes a line a post puts in quotation marks and credits to someone, and looks for it in a small library of old public-domain books that ships inside the extension. It also checks a short list of famous misquotes, each with the investigation that traced it.",
    examples: [
      { side: "none", topic: "philosophy", kind: "sign", text: "A post credits a Roman emperor with a neat line about opinions and perspectives. The line is on the list of misquotes: the investigators found it nowhere in his book." },
      { side: "none", topic: "philosophy", kind: "fair", text: "A post quotes the same emperor in modern words. Daylight Commons finds the passage in a translation from 1862, worded differently but saying the same thing." },
    ],
    why: "A famous name makes a sentence feel settled. Quote pages copy each other, so a line can travel for decades under the wrong name, and the name does the persuading.",
    spot: "Look for a book, a chapter or a date beside the quote. A quote with only a name and a portrait has skipped the step that lets you check it.",
    counter: "Search for the exact words with a quotation site that names its sources, or open the book. If the words are close but not the same, read the passage around them: a paraphrase can drift from what was meant.",
    dnp: "Finding the words shows they are in the passage cited, in one translation. Not finding them proves nothing, since the library holds a few dozen books.",
  },
  {
    id: "quote-list", title: "Lists of one-line sayings", research: [],
    what: "Some posts list famous names, each with a few words: life is a test, life is power, life is love. Daylight Commons counts the lines, how many name someone, and how many give any source.",
    examples: [
      { side: "none", topic: "philosophy", kind: "sign", text: "Fourteen thinkers each get three words about the meaning of life, from an ancient Greek to a tech founder, with no book, speech or date for any of them." },
      { side: "none", topic: "philosophy", kind: "ordinary", text: "A teacher posts a reading list: five philosophers, each with the title of one book and a chapter to start with." },
    ],
    why: "A list borrows the weight of every name on it at once. Lines too short to look up cannot be checked, so the format survives even when most lines were never said.",
    spot: "Count the sources. Notice how many lines are under five words, and whether people from different centuries happen to speak in the same rhythm.",
    counter: "Treat each line as a summary someone else wrote until a source shows otherwise. Some lines will be fair summaries of a person's view, and some will be invented.",
    dnp: "A list without sources is a common format for misquotes. It does not show that any one line is wrong.",
  },
  {
    id: "persona", title: "Accounts named after someone who died", research: [],
    what: "Daylight Commons notices an account whose name is the name of a well-known person who has died, when the handle or the display name also says so. The names come from Wikidata, and names a living person shares are left out.",
    examples: [
      { side: "none", topic: "philosophy", kind: "sign", text: "An account named after a nineteenth-century philosopher, with a checkmark, posts a confident list of what famous people thought about life." },
      { side: "none", topic: "literature", kind: "fair", text: "A museum runs an account named after the novelist whose house it keeps, and its profile says so." },
    ],
    why: "A dead writer's name and portrait make a post look like the writer speaking. A checkmark that can be bought adds to the effect, though it says nothing about who runs the account.",
    spot: "Read the profile. Fan pages, quote accounts and parodies usually say what they are; the problem starts when a post lets you forget it.",
    counter: "Judge the post by its sources, not the name on it. Look for the quote or claim in the person's own work.",
    dnp: "A display name is chosen by whoever runs the account. The sign shows only that the name belongs to someone who died.",
  },
  {
    id: "sample-size", title: "A count and its sample size", research: [],
    what: "When a post gives a count such as 45 out of 50, Daylight Commons works out the range the true share could plausibly sit in, the 95 percent interval, and says when the sample is small.",
    examples: [
      { side: "none", topic: "science", kind: "sign", text: "A post claims a new method works for most people because 7 of 10 testers liked it. The interval runs from about 40 to 89 percent." },
      { side: "none", topic: "science", kind: "fair", text: "A study reports 900 of 1,000 patients improved. The interval is narrow, from 88 to 92 percent, so chance alone moves it little." },
    ],
    why: "Small samples swing a lot. A striking percentage from a handful of cases reads like a law when it may be luck.",
    spot: "Find the number under the percentage. If it is missing, the post has left out the part that tells you how much to trust it.",
    counter: "Ask how the people or cases were chosen and whether anyone else got the same result. A narrow interval says nothing about a biased sample.",
    dnp: "An interval shows how much a count can move by chance. It says nothing about how the sample was chosen or whether the result holds elsewhere.",
  },
  {
    id: "doc-claim", title: "A post's words against the pages it shows", research: [],
    what: "When a post shows a letter, a filing or a report as pictures, Daylight Commons can read the pictures on your device and look for the post's key words in them, saying which appear on which image and which do not.",
    examples: [
      { side: "none", topic: "law", kind: "sign", text: "A post says a lawyer's letter admits a crime. The four pages shown deny every accusation and never use the words the post puts in the lawyer's mouth." },
      { side: "none", topic: "law", kind: "fair", text: "A post says a court ruling ordered a refund, and the ruling's last page shows the order in the same words." },
    ],
    why: "Few readers open every page of a document in a post. The post's summary becomes what the document says, even when the pages say something else.",
    spot: "Read the summary, then read the pages for the words it relies on. Check whether the post shows every page.",
    counter: "Quote the line from the document when you share it, and say which page it is on. If the line is missing, say so.",
    dnp: "A word missing from the pages shown does not mean the document never says it: pages can be missing, and a document can say the same thing in other words.",
  },
  {
    id: "correction-replies", title: "Replies that bring a source", research: [],
    what: "Under a post, Daylight Commons raises replies that link a reference work or a primary record, quote a passage, or name a specific error in the post, and ranks them by the source they bring. Likes are not read.",
    examples: [
      { side: "none", topic: "history", kind: "sign", text: "A post about a famous scientist has five thousand likes. A reply with a hundred likes points out two errors in dates and links an encyclopedia entry." },
      { side: "none", topic: "history", kind: "ordinary", text: "A reply links a reference work only to add a detail the post did not mention, without disagreeing with anything in it." },
    ],
    why: "Corrections usually arrive later and get fewer likes than the post. Feeds sort replies by attention, so the correction sinks.",
    spot: "Scroll past the first replies. Look for a link to a primary record or a reference work, and a reply that names a specific claim.",
    counter: "Read the correction's source as carefully as the post's. A correction can be wrong too.",
    dnp: "A reply that brings a source or names an error can still be wrong. Daylight Commons ranks by the kind of source, not by who is right.",
  },
];
