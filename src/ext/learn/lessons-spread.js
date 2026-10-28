// Lessons for coordination, media and source signs, and for the thread report. Examples describe
// made-up posts and accounts; none is a real post. Each has a sign example and an ordinary one
// that trips the same sign.

export const SPREAD_LESSONS = [
  {
    id: "duplicates", flag: "same-text", title: "Same text as other replies", research: ["badnews-2019"],
    what: "This sign finds several accounts in one thread that posted the same words, or nearly the same words. CMMNS compares replies word by word. It needs a close match from different accounts.",
    examples: [
      { side: "none", topic: "tech", kind: "sign", text: "Five replies under a phone review read \"Switched last month, battery lasts two days, best phone I've owned\", from five accounts that joined the same week." },
      { side: "none", topic: "sport", kind: "ordinary", text: "Forty fans reply \"What a goal!\" under the same clip." },
    ],
    why: "When many accounts repeat one voice, it looks like many people agree. Bad News taught impersonation and fake accounts. A crowd is easy to fake when readers count posts and forget to count authors.",
    spot: "Read the replies in order. When a long, specific sentence appears word for word from different accounts, open two or three of those accounts.",
    counter: "Check when the accounts joined and what else they post. A real crowd often says the same thing in different words. Short stock phrases repeat for ordinary reasons.",
    dnp: "",
  },
  {
    id: "copied-elsewhere", title: "Same words in other threads", research: [],
    what: "This sign finds an account that posted the same words in other threads you viewed. CMMNS keeps a log of what it saw, stored in this browser.",
    examples: [
      { side: "none", topic: "health", kind: "sign", text: "One account posts \"My cousin had the same reaction, the media is hiding this\" under six different health stories in a day." },
      { side: "none", topic: "local", kind: "ordinary", text: "A charity posts the same appeal for blood donors under several local news stories." },
    ],
    why: "A message pasted across many threads reaches many audiences for little effort. Each thread sees it once, so readers miss the copy.",
    spot: "Put a distinctive phrase from the post in quotation marks. Search for it in the site's search box.",
    counter: "If the phrase appears word for word across many accounts or threads, treat it as a campaign line until you find a better explanation. Ask who benefits if you believe it.",
    dnp: "",
  },
  {
    id: "same-upload", title: "Same upload, many accounts", research: [],
    what: "This sign finds the exact same media file in posts by three or more accounts you saw. X media ids show that it is one upload of one file.",
    examples: [
      { side: "none", topic: "local", kind: "sign", text: "One video of a flooded street is posted by nine accounts within an hour, each with a caption about a different town." },
      { side: "none", topic: "sport", kind: "ordinary", text: "A goal clip reposted by hundreds of fans, all with the same caption about the same match." },
    ],
    why: "Old footage with a new caption can move a real event to a new place or date. When many accounts post it at once, the new story looks confirmed.",
    spot: "Open the first post with the upload. Compare its caption with the caption in front of you.",
    counter: "When the captions disagree about where or when, the footage is old or from another place, so look for the original. When they agree, the footage is popular.",
    dnp: "Many accounts on one upload shows spread. Ordinary people repost popular videos widely, so coordination needs other evidence.",
  },
  {
    id: "old-media", title: "Media older than the post", research: [],
    what: "This sign finds a picture or video that someone first uploaded days, months or years before this post. X media ids record when the file was uploaded.",
    examples: [
      { side: "none", topic: "war", kind: "sign", text: "A post about this morning's strike carries a video first uploaded three years ago." },
      { side: "none", topic: "climate", kind: "ordinary", text: "A post marking ten years since a storm, with a photo from that day, captioned as an archive photo." },
    ],
    why: "Old footage feels like news when it comes with today's caption. Real images make a false story easy to believe, and few readers check dates.",
    spot: "Take a still from the media and run a reverse image search. The earliest copy often gives the real date and place.",
    counter: "Compare the caption with the earliest copy. A labelled archive photo is honest. The problem is old footage presented as today's footage.",
    dnp: "An old upload can be honest, such as a labelled archive photo.",
  },
  {
    id: "lifted-media", title: "Media from another post", research: [],
    what: "This sign finds media that this post took from an earlier post by another account. X records the post that the media came from.",
    examples: [
      { side: "none", topic: "sport", kind: "sign", text: "A clip first posted by a fan, reposted by a betting account as its own with a new claim in the caption." },
      { side: "none", topic: "science", kind: "ordinary", text: "A teacher sharing a museum's video with \"via\" and the museum's name." },
    ],
    why: "A post that takes someone else's media borrows its reach and its credibility. It also breaks the trail back to the person who filmed it and to what they said it showed.",
    spot: "On X, lifted media often shows \"From\" and the original account under the video. Open the original account and scroll to the date.",
    counter: "The original post shows who filmed the media, when, and what they said it was. Compare that with the caption you are reading now.",
    dnp: "To share someone else's video with credit is normal.",
  },
  {
    id: "community-note", title: "Community Note", research: [],
    what: "A Community Note is a note that X users wrote and rated as helpful, attached to this post. CMMNS shows it first because people from different viewpoints agreed on it.",
    examples: [
      { side: "none", topic: "science", kind: "sign", text: "A note under a chart: \"The chart cuts off before 2010, which hides the earlier peak. Full data: link.\"" },
      { side: "none", topic: "health", kind: "ordinary", text: "A note that adds a missing date to an accurate post." },
    ],
    why: "A note travels with the post, and it is often the fastest context you can get. X shows a note when raters who usually disagree find it helpful.",
    spot: "Notes appear under the post as \"Readers added context\". On X you can rate notes yourself when you join the program.",
    counter: "Open the note's source links. A note is a summary by other users, and the links are the evidence. Some notes add context to a true post.",
    dnp: "A note shows what X users from different viewpoints rated helpful. It is a crowd rating, separate from any ruling by X or CMMNS.",
  },
  {
    id: "fact-check", title: "Fact-checked claim", research: [],
    what: "This sign finds a claim that a fact-checker reviewed, worded like this one. CMMNS shows the rating in the fact-checker's own words, with the date and a link.",
    examples: [
      { side: "none", topic: "health", kind: "sign", text: "A post says a common painkiller was banned in Europe. A fact-checker rated a near-identical claim false in March." },
      { side: "none", topic: "health", kind: "ordinary", text: "A post reports that a painkiller was recalled in one country, which is a different claim from a ban, and true." },
    ],
    why: "False claims come back in new posts long after a check. A match lets you read the earlier work in one click.",
    spot: "Search the claim's key words with \"fact check\" in a search engine, or in Google's Fact Check Explorer.",
    counter: "Open the review. Check that it is about the same claim, place and date. Similar words can carry a different claim, as in the ordinary example.",
    dnp: "Similar words can carry a different claim, so open the review and check its source.",
  },
  {
    id: "ad", title: "Ad label", research: [],
    what: "X labels this post an ad or a promoted post. Someone paid money for this post to reach you.",
    examples: [
      { side: "none", topic: "economy", kind: "sign", text: "A post about a savings app appears in a political thread, marked as promoted, with claims about the economy." },
      { side: "none", topic: "local", kind: "ordinary", text: "A promoted post from a local theatre about this week's show." },
    ],
    why: "Paid posts can look like ordinary replies. When you know someone paid, you read the claim differently, because the payer chose the audience.",
    spot: "Look for \"Ad\" or \"Promoted\" near the account name. Meta and Google publish ad libraries. These libraries show who ran an ad and who saw it.",
    counter: "Ask who paid and what they want from you. Many ads are ordinary business. Political ads and issue ads need the same checks as any other claim.",
    dnp: "Ads can be accurate, and many ads come from ordinary businesses.",
  },
  {
    id: "state-link", title: "State link", research: [],
    what: "This sign finds a link or an account that a cited source ties to a government. The tie comes from ownership records or from a published report on influence operations. The card names the source and its date.",
    examples: [
      { side: "none", topic: "war", kind: "sign", text: "A reply links to a news site that a platform's threat report named as part of a government campaign." },
      { side: "none", topic: "media", kind: "ordinary", text: "A link to a public broadcaster with a charter that protects editorial independence." },
    ],
    why: "State media and covert operations both try to look like independent voices. When you know the owner, you know whose interests the outlet serves.",
    spot: "Search the outlet's name with \"owned by\", or look it up on Wikipedia or Wikidata. Platform threat reports are public.",
    counter: "Read the cited report. Then look for the same story from outlets with different owners.",
    dnp: "Public broadcasters with editorial independence are state-owned too, so ownership alone is weak evidence of disinformation. A report names a domain at the time of publication, and domains change hands.",
  },
  {
    id: "owner", title: "Outlet owner", research: [],
    what: "This sign shows the company or the person that owns the outlet a post links to. The owner comes from Wikidata.",
    examples: [
      { side: "none", topic: "media", kind: "sign", text: "Three replies in a thread about a merger link to papers owned by one of the merging companies." },
      { side: "none", topic: "local", kind: "ordinary", text: "A reply links to a local paper owned by a national media group, reporting a road closure." },
    ],
    why: "Owners choose editors and budgets, and sometimes coverage. Ownership matters most in a story about the owner's own business. When you know who owns an outlet, you can read its choices better.",
    spot: "Most outlets name their owner on an \"About\" page, often in the last line. Wikidata and Wikipedia list owners with sources.",
    counter: "Compare how outlets with different owners cover the same story. The differences show what each outlet chose to stress.",
    dnp: "An owner and an editor do different jobs, and Wikidata can lag a sale.",
  },
  {
    id: "site-record", title: "Site facts and fact-check record", research: [],
    what: "The site card shows facts about a linked site: its owner type, founding year and country from Wikidata. It also counts the fact-check reviews that list the site as a place where a claim appeared, with each rating in the fact-checker's own words.",
    examples: [
      { side: "none", topic: "health", kind: "sign", text: "A reply links to a site founded last year whose record lists nine reviews of health claims, each rated false by a different fact-checker." },
      { side: "none", topic: "politics", kind: "ordinary", text: "A link to a national paper with a long record, because fact-checkers often cite the interviews it prints of politicians." },
    ],
    why: "The site behind a link tells you who stands behind the words. A young site with a hidden owner and many reviews is a reason to check the claim yourself. An old outlet with many reviews can simply be a place where powerful people get quoted.",
    spot: "Open the list of reviews and read who made each claim. A site that printed a speech is a different party from the speaker.",
    counter: "Look up the claim yourself and find who said it first. Then read the same story at outlets with different owners.",
    dnp: "Each rating is about one claim the site carried, sometimes in a report of someone else's words. Fact-checkers choose what to check, so read the count as a list of reviews. It is a separate thing from a score for the site.",
  },
  {
    id: "client", title: "Posting app", research: [],
    what: "This sign shows the app that sent this post, from the data X loaded. Scheduling tools, automation services and custom apps appear here.",
    examples: [
      { side: "none", topic: "tech", kind: "sign", text: "A personal-looking reply to a stranger, posted through a bulk scheduling service under a breaking news story." },
      { side: "none", topic: "media", kind: "ordinary", text: "A news desk posting its headlines through the same service." },
    ],
    why: "Replies that automation sends can look like a person who types in the moment. The app name is one of the few clues that X still records.",
    spot: "X now hides the app from the page. On other sites, look for \"via\" lines, or for posting tools named in the post details.",
    counter: "A news desk that schedules its headlines is normal. A personal account that replies to strangers through an automation app is worth a second look.",
    dnp: "News desks, brands and many people schedule posts with tools like these.",
  },
  {
    id: "thread-report", title: "The thread report", research: [],
    what: "The thread report compares the harshest replies in a thread with the rest. It asks if flagged accounts make up more of the harshest group. It shows a 95% interval for each share.",
    examples: [
      { side: "none", topic: "local", kind: "sign", text: "In a thread about a bus lane, 40% of the harshest replies come from flagged accounts, against 8% of the rest. The two intervals sit apart." },
      { side: "none", topic: "local", kind: "ordinary", text: "In another thread, the shares are 12% and 10% and the intervals overlap. The harsh replies look like everyone else." },
    ],
    why: "A few loud accounts can set the tone of a thread. Readers then take that tone as what people think. The report checks if the tone comes from accounts with other warning signs.",
    spot: "You can do it by hand. Pick the ten harshest replies and ten calm replies. Check each account's age and location label. Then compare the two groups.",
    counter: "When the report says skewed, read the calmer replies too, because they can be a better sample. When the report says too few, the thread is too small to tell.",
    dnp: "A skew can come from how the platform ranks replies, from which accounts you looked up, or from real people who joined during the event. It describes the thread as a whole. Each reply and each account needs its own look.",
  },
];
