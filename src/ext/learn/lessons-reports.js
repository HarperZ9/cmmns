// Lessons for the two signs about documented influence operations: a link or account named in a
// published report, and an address that copies a news outlet's name. Both lean on Jonathan Rauch's
// point in The Constitution of Knowledge (2021): checking works because claims are tested by
// people who can be held to account, so an operation borrows the name of an outlet that answers
// for its errors, or a voice that seems independent, to skip that test.

export const REPORT_LESSONS = [
  {
    id: "named-in-report", title: "Named in a published report", research: [],
    what: "A link or account that a platform, a research lab, a court filing or a government document named as part of an influence operation. The window shows who the sources say ran it, in each source's own words, and links the report.",
    examples: [
      { side: "none", topic: "war", kind: "sign", text: "A reply links to a site that a takedown report listed among an operation's fake news outlets, with an article that appeared on that site alone." },
      { side: "none", topic: "media", kind: "fair", text: "A researcher links the same site to show readers what the operation published, and says so in the post." },
    ],
    why: "These operations hide who is speaking. They build outlets and personas that look local and independent, so a claim seems to come from many people when it comes from one paymaster. Reports name the assets so anyone can check. Sources often disagree on who ran an operation: one says linked to, another says directed by. Daylight Commons shows each one.",
    spot: "Read the report's own words on attribution. Linked to is weaker than run by. Note the date: a domain can expire and be bought by someone else.",
    counter: "Ask who first published the claim and who has checked it since. Find the story at outlets that sign their work and correct their errors.",
    dnp: "The report dates from when it was published, and domains get sold on. The person sharing the link may be warning others about it.",
  },
  {
    id: "lookalike-domain", title: "Look-alike news address", research: [],
    what: "A link whose address copies a major outlet's name with another ending, one letter changed, or letters from another alphabet that look the same, such as washingtonpost.pm or theguaradian.com.",
    examples: [
      { side: "none", topic: "politics", kind: "sign", text: "A reply links to spiegel.ltd, a page styled like Der Spiegel with a story missing from the real Spiegel." },
      { side: "none", topic: "media", kind: "ordinary", text: "A link to a small local paper whose name is one letter away from a national outlet, with its own staff and address." },
    ],
    why: "A cloned outlet borrows trust someone else earned. Real newsrooms answer for their mistakes, and that record is why readers believe them. A copy takes the name and leaves the record behind. Doppelganger cloned dozens of European papers this way, and Endless Mayfly faked Arab and Israeli outlets.",
    spot: "Read the address before the headline. Check the ending against the outlet's own site. Look for the story on the real outlet's home page.",
    counter: "Type the outlet's address yourself, skip the link, and search for the story there. If the story is missing from the real site, someone borrowed the outlet's name.",
    dnp: "A similar address is a lead: outlets use other addresses too, and unrelated sites share common words. Open the outlet's own site and compare.",
  },
  {
    id: "backing-record", title: "Backing on record", research: [],
    what: "A public media personality's documented backing: who employs them, who owns their outlet, investors, licensing deals, filings, court records, sanctions and government labels. Each record quotes its source, gives the date it was read and states its limit.",
    examples: [
      { side: "none", topic: "funding", kind: "sign", text: "A commentator's videos about a war came through a company that, an indictment alleges, was secretly funded by a foreign state broadcaster. The record says the indictment accuses the company and leaves the commentator out, and that the commentator says they were unaware." },
      { side: "none", topic: "funding", kind: "fair", text: "A cable host works for a network owned by a listed company. The record names the owner from the company's own annual filing. That is ordinary employment, shown so a reader knows who pays." },
    ],
    why: "Rauch's rule of no personal authority means a claim stands on its evidence. Knowing who pays a speaker tells you where to look harder at the claim. A campaign that hides its money borrows a voice that seems independent. Records are kept to one standard for every side and country, and each one rests on a public document.",
    spot: "Read the status: documented, reported or alleged. An allegation is not a finding. Check the date read, and whether the role is current.",
    counter: "Judge the post by its evidence. Then ask whether the backer gains from it, and look for the same claim from sources with other backers.",
    dnp: "A record of who employs, owns or funds a person tells you about the person; each post still needs its own check, and the backer may have had no say in its words. Allegations in court records are unproven.",
  },
];
