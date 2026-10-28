// Lessons for the two signs about documented influence operations: a link or account named in a
// published report, and an address that copies a news outlet's name. Both lean on Jonathan Rauch's
// point in The Constitution of Knowledge (2021): checking works because claims are tested by
// people who can be held to account, so an operation borrows the name of an outlet that answers
// for its errors, or a voice that seems independent, to skip that test.

export const REPORT_LESSONS = [
  {
    id: "named-in-report", title: "Named in a published report", research: [],
    what: "This sign finds a link or an account that a published source named as part of an influence operation. The source can be a platform, a research lab, a court filing or a government document. The window shows who each source says ran it, in the source's own words, and links the report.",
    examples: [
      { side: "none", topic: "war", kind: "sign", text: "A reply links to a site that a takedown report listed among an operation's fake news outlets, with an article that appeared on that site alone." },
      { side: "none", topic: "media", kind: "fair", text: "A researcher links the same site to show readers what the operation published, and says so in the post." },
    ],
    why: "These operations hide who speaks. They build outlets and personas that look local and independent. So a claim seems to come from many people when one paymaster sent it. Reports name the assets so anyone can check them. Sources often disagree on who ran an operation: one says linked to, another says directed by. CMMNS shows each one.",
    spot: "Read the report's own words on attribution. Linked to is weaker than run by. Note the date, because a domain can expire and someone else can buy it.",
    counter: "Ask who first published the claim, and who checked it since. Find the story at outlets that sign their work and correct their errors.",
    dnp: "The report dates from its publication, and people sell domains on. The person who shares the link can be warning others about it.",
  },
  {
    id: "lookalike-domain", title: "Look-alike news address", research: [],
    what: "This sign finds a link whose address copies a major outlet's name. The copy uses another ending, changes one letter, or uses look-alike letters from another alphabet. Examples are washingtonpost.pm and theguaradian.com.",
    examples: [
      { side: "none", topic: "politics", kind: "sign", text: "A reply links to spiegel.ltd, a page styled like Der Spiegel with a story missing from the real Spiegel." },
      { side: "none", topic: "media", kind: "ordinary", text: "A link to a small local paper whose name is one letter away from a national outlet, with its own staff and address." },
    ],
    why: "A cloned outlet borrows trust that someone else earned. Real newsrooms answer for their mistakes, and that record is why readers believe them. A copy takes the name and leaves the record behind. Doppelganger cloned dozens of European papers this way, and Endless Mayfly faked Arab and Israeli outlets.",
    spot: "Read the address before the headline. Compare the ending with the outlet's own site. Look for the story on the real outlet's home page.",
    counter: "Type the outlet's address yourself and search for the story there. If the real site lacks the story, someone borrowed the outlet's name.",
    dnp: "A similar address is a lead. Outlets use other addresses too, and unrelated sites share common words. Open the outlet's own site and compare.",
  },
  {
    id: "backing-record", title: "Backing on record", research: [],
    what: "This sign shows the documented backing of a public media personality. It lists employers, outlet owners, investors, licensing deals, filings, court records, sanctions and government labels. Each record quotes its source, gives the date it was read and states its limit.",
    examples: [
      { side: "none", topic: "funding", kind: "sign", text: "A commentator's videos about a war came through a company that, an indictment alleges, was secretly funded by a foreign state broadcaster. The record says the indictment accuses the company and leaves the commentator out, and that the commentator says they were unaware." },
      { side: "none", topic: "funding", kind: "fair", text: "A cable host works for a network owned by a listed company. The record names the owner from the company's own annual filing. That is ordinary employment, shown so a reader knows who pays." },
    ],
    why: "Rauch's rule of no personal authority says a claim stands on its evidence. When you know who pays a speaker, you know where to look harder at the claim. A campaign that hides its money borrows a voice that seems independent. Records follow one standard for every side and country, and each record rests on a public document.",
    spot: "Read the status: documented, reported or alleged. An allegation is a claim. Check the date read, and check if the role is current.",
    counter: "Judge the post by its evidence. Then ask if the backer gains from it. Look for the same claim from sources with other backers.",
    dnp: "A record of who employs, owns or funds a person tells you about the person. Each post needs its own check, and the backer can be absent from the choice of words. Allegations in court records are claims.",
  },
];
