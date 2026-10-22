// Lessons for coordination, media and source signs, and for the thread report. Examples describe
// made-up posts and accounts; none is a real post. Each has a sign example and an ordinary one
// that trips the same sign.

export const SPREAD_LESSONS = [
  {
    id: "duplicates", flag: "same-text", title: "Same text as other replies", research: ["badnews-2019"],
    what: "Several accounts in one thread posted the same or nearly the same words. Daylight Commons compares replies word by word and needs a close match from different accounts.",
    examples: [
      { side: "none", topic: "tech", kind: "sign", text: "Five replies under a phone review read \"Switched last month, battery lasts two days, never going back\", from five accounts that joined the same week." },
      { side: "none", topic: "sport", kind: "ordinary", text: "Forty fans reply \"What a goal!\" under the same clip." },
    ],
    why: "One voice repeated by many accounts looks like many people agreeing. Bad News taught impersonation and fake accounts: a crowd is easy to fake when nobody counts the authors.",
    spot: "Read the replies in order. When a long, specific sentence shows up word for word from different accounts, open two or three of them.",
    counter: "Check when they joined and what else they post. A real crowd tends to say the same thing in different words. Short stock phrases repeat for ordinary reasons.",
    dnp: "",
  },
  {
    id: "copied-elsewhere", title: "Same words in other threads", research: [],
    what: "This account posted the same words in other threads you have viewed. Daylight Commons keeps a local log of what it has seen, in this browser only.",
    examples: [
      { side: "none", topic: "health", kind: "sign", text: "One account posts \"My cousin had the same reaction, nobody talks about this\" under six different health stories in a day." },
      { side: "none", topic: "local", kind: "ordinary", text: "A charity posts the same appeal for blood donors under several local news stories." },
    ],
    why: "A message pasted across many threads reaches many audiences for little effort. Each thread sees it once, so nobody notices the copy.",
    spot: "Put a distinctive phrase from the post in quotation marks in the site's search box.",
    counter: "If it shows up word for word across many accounts or threads, treat it as a campaign line until shown otherwise. Ask who benefits if you believe it.",
    dnp: "",
  },
  {
    id: "same-upload", title: "Same upload, many accounts", research: [],
    what: "The exact same media file appears in posts by three or more accounts you have seen. X media ids show it is one upload of the same file.",
    examples: [
      { side: "none", topic: "local", kind: "sign", text: "One video of a flooded street is posted by nine accounts within an hour, each with a caption about a different town." },
      { side: "none", topic: "sport", kind: "ordinary", text: "A goal clip reposted by hundreds of fans, all with the same caption about the same match." },
    ],
    why: "Shared footage with new captions can move a real event to a new place or date. Many accounts at once make the new story look confirmed.",
    spot: "Open the first post that carried the upload and compare its caption with the one in front of you.",
    counter: "When the captions disagree about where or when, the footage is old or from somewhere else, so look for the original. When they agree, it is popular footage.",
    dnp: "Popular videos get reposted widely by ordinary people. Many accounts on one upload shows spread, not who coordinated it.",
  },
  {
    id: "old-media", title: "Media older than the post", research: [],
    what: "The picture or video was first uploaded days, months or years before this post. X media ids encode when the file was uploaded.",
    examples: [
      { side: "none", topic: "war", kind: "sign", text: "A post about this morning's strike carries a video first uploaded three years ago." },
      { side: "none", topic: "climate", kind: "ordinary", text: "A post marking ten years since a storm, with a photo from that day, captioned as an archive photo." },
    ],
    why: "Old footage feels like news when it arrives with today's caption. Real images make a false story easy to believe, and few readers check dates.",
    spot: "Run a reverse image search on a still from the media. The earliest copy often gives the real date and place.",
    counter: "Compare the caption with the earliest copy. A labelled archive photo is honest. Old footage sold as today's is the problem.",
    dnp: "An old upload can be honest, such as a labelled archive photo.",
  },
  {
    id: "lifted-media", title: "Media from another post", research: [],
    what: "The media was taken from an earlier post by another account. X records the post it came from.",
    examples: [
      { side: "none", topic: "sport", kind: "sign", text: "A clip first posted by a fan, reposted by a betting account as its own with a new claim in the caption." },
      { side: "none", topic: "science", kind: "ordinary", text: "A teacher sharing a museum's video with \"via\" and the museum's name." },
    ],
    why: "Taking someone else's media borrows its reach and credibility. It also breaks the trail back to whoever filmed it and what they said it showed.",
    spot: "On X, lifted media often shows \"From\" and the original account under the video. Open it.",
    counter: "The original post shows who filmed it, when, and what they said it was. Compare that with the caption you are reading.",
    dnp: "Sharing someone else's video with credit is normal.",
  },
  {
    id: "community-note", title: "Community Note", research: [],
    what: "A note X users wrote and rated as helpful, attached to this post. Daylight Commons shows it first because people from different viewpoints agreed on it.",
    examples: [
      { side: "none", topic: "science", kind: "sign", text: "A note under a chart: \"The chart cuts off before 2010, which hides the earlier peak. Full data: link.\"" },
      { side: "none", topic: "health", kind: "ordinary", text: "A note that adds a missing date to an accurate post." },
    ],
    why: "A note travels with the post and is often the fastest context available. X shows a note only when raters who usually disagree find it helpful.",
    spot: "Notes appear under the post as \"Readers added context\". On X you can rate notes yourself after you join the program.",
    counter: "Open the note's source links. A note is a summary by other users, and the links are the evidence. Some notes only add context to a true post.",
    dnp: "A note shows what X users from different viewpoints rated helpful. It is not a ruling by X or by Daylight Commons.",
  },
  {
    id: "fact-check", title: "Fact-checked claim", research: [],
    what: "A fact-checker has reviewed a claim worded like this one. Daylight Commons shows their rating in their own words, with the date and a link.",
    examples: [
      { side: "none", topic: "health", kind: "sign", text: "A post says a common painkiller was banned in Europe. A fact-checker rated a near-identical claim false in March." },
      { side: "none", topic: "health", kind: "ordinary", text: "A post reports that a painkiller was recalled in one country, which is a different claim from a ban, and true." },
    ],
    why: "False claims return in new posts long after they were checked. A match lets you read the earlier work in one click.",
    spot: "Search the claim's key words with \"fact check\" on a search engine, or in Google's Fact Check Explorer.",
    counter: "Open the review and check that it is about the same claim, place and date. Similar wording can hide a different claim, as in the ordinary example.",
    dnp: "Similar wording can carry a different claim, so open the review and check its source.",
  },
  {
    id: "ad", title: "Ad label", research: [],
    what: "X labels this an ad or promoted post. Someone paid for it to reach you.",
    examples: [
      { side: "none", topic: "economy", kind: "sign", text: "A post about a savings app appears in a political thread, marked as promoted, with claims about the economy." },
      { side: "none", topic: "local", kind: "ordinary", text: "A promoted post from a local theatre about this week's show." },
    ],
    why: "Paid posts can look like ordinary replies. Knowing someone paid changes how you read the claim, because the payer chose the audience.",
    spot: "Look for \"Ad\" or \"Promoted\" near the account name. Meta and Google publish ad libraries that show who ran an ad and to whom.",
    counter: "Ask who paid and what they want from you. Many ads are ordinary business. Political and issue ads deserve the same checks as any claim.",
    dnp: "Ads can be accurate, and many come from ordinary businesses.",
  },
  {
    id: "state-link", title: "State link", research: [],
    what: "A link or account that a cited source ties to a government, through ownership records or a published report on influence operations. The card names the source and its date.",
    examples: [
      { side: "none", topic: "war", kind: "sign", text: "A reply links to a news site that a platform's threat report named as part of a government campaign." },
      { side: "none", topic: "media", kind: "ordinary", text: "A link to a public broadcaster with a charter that protects editorial independence." },
    ],
    why: "State media and covert operations both try to look like independent voices. Knowing the owner tells you whose interests the outlet serves.",
    spot: "Search the outlet's name with \"owned by\" or look it up on Wikipedia or Wikidata. Platform threat reports are public.",
    counter: "Read the cited report. Then look for the same story from outlets with different owners.",
    dnp: "Public broadcasters with editorial independence are state-owned too, so ownership alone proves no disinformation. A report names a domain at the time it was published, and domains change hands.",
  },
  {
    id: "owner", title: "Outlet owner", research: [],
    what: "The company or person who owns the outlet a post links to, from Wikidata.",
    examples: [
      { side: "none", topic: "media", kind: "sign", text: "Three replies in a thread about a merger link to papers owned by one of the merging companies." },
      { side: "none", topic: "local", kind: "ordinary", text: "A reply links to a local paper owned by a national media group, reporting a road closure." },
    ],
    why: "Owners choose editors and budgets, and sometimes coverage. A story about the owner's own business is where that matters most. Knowing who owns an outlet helps you read its choices.",
    spot: "Most outlets name their owner on an \"About\" page. Wikidata and Wikipedia list owners with sources.",
    counter: "Compare how outlets with different owners cover the same story. The differences show what each one chose to stress.",
    dnp: "Ownership is not editorial control, and Wikidata can lag a sale.",
  },
  {
    id: "site-record", title: "Site facts and fact-check record", research: [],
    what: "The card for a linked site: its owner type, founding year and country from Wikidata, and how many fact-check reviews list the site as a place where a claim appeared, with each rating in the fact-checker's own words.",
    examples: [
      { side: "none", topic: "health", kind: "sign", text: "A reply links to a site founded last year whose record lists nine reviews of health claims, each rated false by a different fact-checker." },
      { side: "none", topic: "politics", kind: "ordinary", text: "A link to a national paper with a long record, because fact-checkers often cite the interviews it prints of politicians." },
    ],
    why: "Where a link points tells you who stands behind the words. A young site with no stated owner and a run of reviews is a reason to check the claim yourself. An old outlet with many reviews may only be a place where powerful people get quoted.",
    spot: "Open the list of reviews and read who made each claim. A site that printed a speech is not the speaker.",
    counter: "Look the claim up yourself and find who said it first. Then read the same story at outlets with different owners.",
    dnp: "A review lists a site as a place where a claim appeared. The site may have been reporting someone else's words, and each rating is about that claim, not the site. Fact-checkers choose what to check, so a count says little about how often a site is right.",
  },
  {
    id: "client", title: "Posting app", research: [],
    what: "The app this post was sent from, from the data X loaded. Scheduling tools, automation services and custom apps show up here.",
    examples: [
      { side: "none", topic: "tech", kind: "sign", text: "A personal-looking reply to a stranger, posted through a bulk scheduling service under a breaking news story." },
      { side: "none", topic: "media", kind: "ordinary", text: "A news desk posting its headlines through the same service." },
    ],
    why: "Replies sent by automation can look like a person typing in the moment. The app name is one of the few clues X still records.",
    spot: "X no longer shows the app on the page. On other sites, look for \"via\" lines or posting tools named in the post details.",
    counter: "A news desk scheduling headlines is normal. A personal account that replies to strangers through an automation app is worth a second look.",
    dnp: "News desks, brands and many people schedule posts with tools like these.",
  },
  {
    id: "thread-report", title: "The thread report", research: [],
    what: "Daylight Commons' report compares the harshest replies in a thread with the rest. It asks whether flagged accounts make up more of the harshest group, and shows a 95% interval for each share.",
    examples: [
      { side: "none", topic: "local", kind: "sign", text: "In a thread about a bus lane, 40% of the harshest replies come from flagged accounts, against 8% of the rest. The intervals do not overlap." },
      { side: "none", topic: "local", kind: "ordinary", text: "In another thread, the shares are 12% and 10% and the intervals overlap. The harsh replies look like everyone else." },
    ],
    why: "A few loud accounts can set the tone of a thread, and readers take that tone as what people think. The report checks whether the tone comes from accounts that carry other warning signs.",
    spot: "By hand: pick the ten harshest replies and ten calm ones, and check each account's age and location label. Compare the two groups.",
    counter: "When the report says skewed, read the calmer replies too, since they may be a better sample. When it says too few, the thread is too small to tell.",
    dnp: "A skew can come from how the platform ranks replies, from which accounts were looked up, or from real people who joined during the event. It says nothing about any one reply or account.",
  },
];
