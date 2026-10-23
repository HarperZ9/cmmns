// Word lists for the reading lens (reading.js). Every list that names a target runs in every
// direction: nations from every region, peoples of every faith and origin, parties and movements
// from left and right, leaders from every bloc. tests/reading.symmetry.test.js runs each targeted
// cue over each entry and expects the same answer, so no list entry can carry a side.

import { IDENTITY_GROUPS, ORIGIN_GROUPS } from "./lexicon.js";

// UN member and observer states plus a few widely used short names.
export const NATIONS = [
  "afghanistan", "albania", "algeria", "andorra", "angola", "argentina", "armenia", "australia", "austria", "azerbaijan",
  "bahrain", "bangladesh", "barbados", "belarus", "belgium", "belize", "benin", "bhutan", "bolivia", "bosnia", "botswana",
  "brazil", "brunei", "bulgaria", "burkina faso", "burundi", "cambodia", "cameroon", "canada", "chad", "chile", "china",
  "colombia", "comoros", "congo", "costa rica", "croatia", "cuba", "cyprus", "czechia", "denmark", "djibouti", "dominica",
  "ecuador", "egypt", "el salvador", "eritrea", "estonia", "eswatini", "ethiopia", "fiji", "finland", "france", "gabon",
  "gambia", "georgia", "germany", "ghana", "greece", "grenada", "guatemala", "guinea", "guyana", "haiti", "honduras",
  "hungary", "iceland", "india", "indonesia", "iran", "iraq", "ireland", "israel", "italy", "jamaica", "japan", "jordan",
  "kazakhstan", "kenya", "kosovo", "kuwait", "kyrgyzstan", "laos", "latvia", "lebanon", "lesotho", "liberia", "libya",
  "lithuania", "luxembourg", "madagascar", "malawi", "malaysia", "maldives", "mali", "malta", "mauritania", "mexico",
  "moldova", "monaco", "mongolia", "montenegro", "morocco", "mozambique", "myanmar", "namibia", "nepal", "the netherlands",
  "new zealand", "nicaragua", "niger", "nigeria", "north korea", "north macedonia", "norway", "oman", "pakistan", "palestine",
  "panama", "paraguay", "peru", "the philippines", "poland", "portugal", "qatar", "romania", "russia", "rwanda", "samoa",
  "saudi arabia", "senegal", "serbia", "sierra leone", "singapore", "slovakia", "slovenia", "somalia", "south africa",
  "south korea", "south sudan", "spain", "sri lanka", "sudan", "suriname", "sweden", "switzerland", "syria", "taiwan",
  "tajikistan", "tanzania", "thailand", "togo", "tunisia", "turkey", "turkmenistan", "uganda", "ukraine",
  "the united kingdom", "the uk", "britain", "england", "scotland", "wales", "the united states", "the us", "america",
  "uruguay", "uzbekistan", "venezuela", "vietnam", "yemen", "zambia", "zimbabwe", "greenland", "puerto rico", "gaza",
];

// Political groups, both directions, named as wholes.
export const POLITICAL_GROUPS = [
  "leftists", "liberals", "libs", "progressives", "socialists", "communists", "marxists", "democrats", "dems",
  "conservatives", "right-wingers", "rightists", "republicans", "maga", "trumpists", "nationalists", "fascists", "libertarians",
  "zionists", "anti-zionists", "feminists", "the woke", "globalists", "tories", "labour voters", "boomers", "gen z",
];

// Peoples named as wholes: faith, origin, nationality and politics, from lexicon.js plus a few more.
const MORE_PEOPLES = ["haitians", "israelis", "palestinians", "iranians", "chinese people", "jamaicans", "irish people",
  "venezuelans", "salvadorans", "ecuadorians", "indigenous people", "settlers", "christians", "hindus", "buddhists"];
export const PEOPLES = [...new Set([...IDENTITY_GROUPS, ...ORIGIN_GROUPS, ...MORE_PEOPLES])];
export const TARGET_GROUPS = [...new Set([...PEOPLES, ...POLITICAL_GROUPS])];

// Strongman figures from every bloc and era, for "we need our own X" and "do an X".
export const STRONGMEN = ["bukele", "putin", "xi", "pinochet", "franco", "mussolini", "stalin", "mao", "castro", "chavez",
  "maduro", "duterte", "orban", "erdogan", "kim jong un", "lee kuan yew", "napoleon", "caesar", "cromwell", "lenin",
  "trump", "modi", "netanyahu", "sisi", "kagame", "lukashenko", "ortega", "museveni", "ataturk", "peron"];

// Allusions: named historical episodes, works and scriptures a post borrows force from.
export const ALLUSIONS = ["another hitler", "hitler", "nazi germany", "1930s germany", "the third reich", "weimar", "kristallnacht",
  "reichstag fire", "kapo", "kapos", "nuremberg", "goebbels", "riefenstahl", "stalin's", "the gulag", "gulags", "the holocaust",
  "orwellian", "1984", "big brother", "ministry of truth", "brave new world", "handmaid's tale", "animal farm", "ender's game",
  "fahrenheit 451", "the matrix", "red pill", "blue pill", "hunger games", "fall of rome", "rome fell", "neville chamberlain",
  "appeasement", "munich agreement", "trojan horse", "judas", "thirty pieces of silver", "pharisees", "the antichrist",
  "mark of the beast", "babylon", "pontius pilate", "salem", "witch hunt", "mccarthyism", "jim crow", "apartheid", "the inquisition",
  "the crusades", "a crusade", "jihad", "intifada", "the trail of tears", "slow horses", "house of cards", "the godfather",
  "the sopranos", "squid game", "idiocracy"];

// Coded terms: words used in place of a slur or a group name, from every direction. Each one is
// documented by ADL, ISD or the Southern Poverty Law Center glossaries.
export const CODED_TERMS = ["jq", "the jq", "(((", ")))", "goyim", "goy", "oy vey", "shabbos goy", "zog", "khazar", "khazarian", "khazarians",
  "kalergi", "rootless cosmopolitan", "rootless cosmopolitans", "happy merchant", "globohomo", "1488", "14 words", "14/88", "13/50",
  "dindu", "dindu nuffin", "groomers", "cuckservative", "cuckservatives", "libtard", "libtards", "magat", "magats", "trumptard",
  "feminazi", "feminazis", "zionazi", "zionazis", "zio", "zios", "shitlib", "shitlibs", "fashy", "kulak", "kulaks", "wetback",
  "anchor babies", "third worlders", "sandn", "jogger", "joggers", "noticer", "noticers"];

// Words that place a post as reporting, mocking or rebutting what it names (the stance factor).
export const REPORT_VERBS = ["said", "says", "say", "writes", "wrote", "claims", "claimed", "claiming", "according to", "per", "reports",
  "reported", "alleges", "alleged", "allegedly", "told", "tweeted", "posted", "calls", "called", "argues", "argued"];
export const REBUT_WORDS = ["not true", "untrue", "false", "debunked", "nonsense", "myth", "a lie", "lies", "no evidence", "baseless",
  "conspiracy theory", "conspiracy theories", "obsess", "obsessed", "obsession", "obsessives", "obsessive", "fixated", "fixation",
  "so-called", "racist", "racism", "bigot", "bigotry", "antisemitic", "antisemitism", "islamophobic", "islamophobia", "xenophobic",
  "propaganda", "unable to see", "stop spreading", "grifter", "grifters", "brainrot", "brain rot", "bent into a pretzel", "unhinged",
  "deranged", "disgusting that", "shame on", "condemn", "condemns", "denounce", "denounces", "smear", "slander", "dog whistle"];
export const MOCK_WORDS = ["lol", "lmao", "lmfao", "rofl", "/s", "imagine thinking", "imagine believing", "sure, jan", "yeah right",
  "clown", "clowns", "🤡", "😂", "🤣", "😆", "🙄"];
export const IRONY_WORDS = ["funny that", "funny how", "what a coincidence", "how convenient", "totally normal", "nothing to see here",
  "of course", "shocking", "who could have guessed", "who could have known", "color me surprised", "colour me surprised"];
export const NEWS_WORDS = ["breaking", "report:", "reports", "according to", "per ", "writes", "excerpt", "via", "source:", "sources say",
  "officials said", "statement", "announced", "announces", "press release", "update:"];
export const PROFANITY = ["fuck", "fucking", "fucked", "shit", "damn", "hell", "bullshit", "crap", "bastards", "pissed"];
