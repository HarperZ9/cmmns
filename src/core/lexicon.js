// Radar's word lists, kept apart from the matching code so they can be reviewed and updated in
// one place. Every list covers targets in every direction; tests/rhetoric.symmetry.test.js holds
// the scoring to equal treatment. Sources for slurs and coded terms: the ADL Hate Symbols
// database, Hatebase, GNET and ISD extremism glossaries. Words that people also use innocently
// (a jogger, crackers, gypsy as a self-name) go in the SOFT lists, which count for less.

// People named as groups. Matching any of these lets the grammar rules ("X are vermin",
// "all X are", "X want to destroy") apply.
export const GROUPS = [
  // origin, faith, ethnicity, nationality
  "immigrants", "migrants", "refugees", "foreigners", "asylum seekers", "muslims", "jews", "christians", "hindus", "sikhs", "atheists",
  "arabs", "africans", "blacks", "black people", "whites", "white people", "asians", "latinos", "hispanics", "mexicans", "chinese",
  "indians", "pakistanis", "somalis", "haitians", "russians", "ukrainians", "americans", "europeans", "french", "roma", "natives",
  // faiths named as a whole, so "war on Islam" reads like "war on Muslims"
  "islam", "christianity", "judaism", "hinduism", "the church", "the west",
  // politics
  "leftists", "liberals", "progressives", "socialists", "communists", "commies", "conservatives", "republicans", "democrats",
  "rightists", "nationalists", "fascists", "libtards", "maga", "woke", "tories", "the left", "the right",
  // derogatory nicknames, so "mussie scum" reads like "muslims are scum"
  "mussie", "mussies", "muzzie", "muzzies", "third world", "third worlders", "magats", "magat", "fash", "nazis", "zionists",
  "globalists", "leftards", "rednecks",
  // class, role, identity
  "the rich", "billionaires", "elites", "the elite", "landlords", "bankers", "politicians", "police", "cops", "protesters",
  "rioters", "journalists", "the media", "boomers", "men", "women", "gays", "lesbians", "trans people", "transgenders",
  "feminists", "disabled people", "the disabled", "farmers", "unions",
];

export const DEHUMANISE = ["vermin", "rats", "cockroaches", "roaches", "parasites", "leeches", "animals", "savages", "subhuman",
  "sub-human", "infestation", "plague", "disease", "cancer", "filth", "scum", "pigs", "insects", "invaders", "a virus", "apes",
  "monkeys", "beasts", "dogs"];

// Physical harm only: deporting or jailing people under a law is a policy position, not a marker.
export const VIOLENCE_VERBS = ["shot", "hanged", "hung", "executed", "killed", "exterminated", "eradicated", "wiped out", "gassed",
  "lynched", "beaten", "burned alive", "purged", "eliminated"];

export const VIOLENT_SLOGANS = ["helicopter rides", "day of the rope", "string them up", "line them up", "round them up",
  "hang them all", "kill them all", "deport them all", "send them all back", "nuke them", "nuke the bastards", "pull out the guns",
  "get rid of them all", "guillotine them", "guillotines for", "bring out the guillotines", "bash the fash", "punch a nazi", "death to"];

export const VIGILANTE = ["will deal with them", "deal with them ourselves", "take care of them ourselves",
  "take matters into our own hands", "take matters into their own hands", "bring in the army", "bring their armies in",
  "bring their armies", "send in the army", "send in the military", "where's the military", "wheres the military",
  "where is the military", "where's the army", "where is the army", "time to arm up", "lock and load"];

export const CONSPIRACY = ["they don't want you to know", "they dont want you to know", "wake up people", "wake up, people",
  "time to wake up", "wake up sheeple", "sheeple", "do your own research", "it's all planned", "its all planned", "false flag",
  "paid actors", "crisis actors", "controlled opposition", "the media is hiding", "the media won't tell you",
  "the media wont tell you", "puppet masters", "great replacement", "funded by soros", "paid by soros", "soros funded",
  "soros-funded", "funded by the kochs", "koch funded", "koch-funded", "paid by the cia", "cia op", "psyop", "plandemic",
  "new world order", "deep state", "shadow government"];

export const ABSOLUTIST = ["traitors", "traitor", "enemy of the people", "enemies of the people", "enemies within", "enemy within",
  "civil war now", "civil war is coming", "time for civil war", "no middle ground", "you're either with us", "youre either with us",
  "real americans", "real patriots", "true french", "vrais français", "real french", "race traitor", "class traitor",
  "purge them", "the final solution", "treason", "treasonous"];

// Claims about a whole group, and replacement framing.
export const ESSENTIALISE = ["import third world", "import the third world", "importing the third world", "become third world",
  "is cultural", "it's in their blood", "its in their blood", "in their culture", "in their dna", "it's in their nature",
  "the natives are", "defend their own country", "defend our own country", "replace us", "replacing us",
  "demographic replacement", "cultural suicide", "acab", "all cops are bastards", "invaders multiply", "the invaders", "they breed",
  "outbreeding us", "civilizational suicide"];

// Stereotype traits: "<group> are <trait>" names a whole group by a trait.
export const STEREOTYPE_TRAITS = ["lazy", "criminals", "criminal", "thieves", "violent", "dirty", "filthy", "stupid", "dumb",
  "terrorists", "rapists", "savage", "greedy", "inbred", "degenerates", "degenerate", "pedophiles", "paedophiles", "groomers",
  "welfare queens", "freeloaders", "invaders", "breeders", "subhuman", "trash", "liars", "cheats", "brainwashed", "sheep", "evil"];

// Invented motives: "<group> want to destroy / replace / ban ..." puts an aim in a whole group's mouth.
export const MOTIVE_VERBS = ["destroy", "replace", "ban", "erase", "kill", "eliminate", "enslave", "take over", "wipe out",
  "outbreed", "control", "groom", "indoctrinate"];

// Slurs and coded terms that read as hateful on their own (weight 2).
export const SLURS = [
  // anti-Black
  "nigger", "niggers", "coon", "coons", "jigaboo", "porch monkey", "porch monkeys", "sambo", "darkie", "darkies", "jungle bunny",
  "spearchucker", "groid", "groids", "sheboon", "pavement ape", "dindu", "dindu nuffin", "chimp out", "chimped out",
  "black fatigue", "13/50", "despite being 13", "basketball americans", "fatherless behavior", "fatherless behaviour",
  "planet of the apes",
  // anti-Asian
  "chink", "chinks", "gook", "gooks", "slant eye", "slant eyes", "slanty", "zipperhead", "ching chong", "kung flu",
  "chinese virus", "china virus",
  // anti-South Asian
  "paki", "pakis", "pajeet", "pajeets", "curry muncher", "poo in loo",
  // anti-Latino
  "wetback", "wetbacks", "beaner", "beaners", "spic", "spics",
  // antisemitic
  "kike", "kikes", "hymie", "heeb", "heebs", "(((", ")))", "goyim know", "the goyim", "zog", "the jq", "6 million wasn't enough",
  "oy vey shut it down", "early life section", "the noticing",
  // anti-Arab and anti-Muslim
  "towelhead", "towelheads", "raghead", "ragheads", "sand nigger", "sand niggers", "camel jockey", "mudslime", "mudslimes",
  "muzrat", "muzrats", "sand people", "goat lovers",
  // anti-Indigenous and anti-Roma
  "redskin", "redskins", "injun", "injuns", "squaw", "gyppo", "gyppos",
  // anti-white
  "honky", "honkies", "honkey", "whitey", "peckerwood", "white devils", "kill all whites",
  // anti-LGBTQ
  "faggot", "faggots", "tranny", "trannies", "troon", "troons", "shemale", "shemales", "poofter",
  // disability
  "retard", "retards", "retarded", "spaz", "spastic", "mongoloid",
  // misogynist and anti-men
  "foid", "foids", "femoid", "femoids", "roastie", "roasties", "kill all men", "men are trash",
  // neo-Nazi
  "1488", "14/88", "14 words", "sieg heil", "hitler was right", "hitler where are you", "hitler... where are you",
];

// Context-dependent: innocent in many uses (weight 1, counted only beside another marker).
export const SLURS_SOFT = ["suicidal empathy", "woke mind virus", "mind virus", "w0keism", "wokeism", "the fatigue is real", "fatigue is real", "jogger", "joggers", "cracker", "crackers", "groomers",
  "religion of peace", "it's always them", "its always them", "thug", "thugs", "ghetto", "illegals", "dyke", "dykes", "thot",
  "thots", "fag", "fags", "cripple", "cripples", "white trash", "gypsy", "gypsies", "jap", "japs", "spook", "spooks", "uppity"];

// Disguised spellings: "n1gg3r", "f@g", "k1ke". Applied before slur matching only.
export const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

// "They hate beauty / us / the West": a hatred put in a whole group's mouth (counts as motive).
export const HATRED_OBJECTS = ["beauty", "us", "the west", "western civilization", "our way of life", "our culture", "our freedom",
  "freedom", "christians", "jews", "muslims", "white people", "black people", "women", "america", "europe", "france"];
