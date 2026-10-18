// Stance-neutral rhetoric markers. Four marker families from the dehumanisation and
// violent-extremism literature, written so they never depend on which side a post supports:
//   dehumanise   a group described as vermin, disease, animals, filth
//   violence     a call for violence or collective punishment against a group
//   conspiracy   conspiracy framing ("they don't want you to know", "paid actors")
//   absolutist   us-versus-them framing ("traitors", "enemy of the people", "civil war now")
// Group words and coded slogans are listed from every side so the symmetry test in
// tests/rhetoric.symmetry.test.js can hold the scoring to equal treatment. Disagreement,
// anger and strong opinions score 0; only the marker grammar counts.
//
// A score never flags a person. It is only used in the thread-level comparison in report.js.

export const GROUPS = [
  // origin, faith, ethnicity
  "immigrants", "migrants", "refugees", "foreigners", "asylum seekers", "muslims", "jews", "christians", "hindus", "atheists",
  "arabs", "africans", "blacks", "whites", "asians", "latinos", "mexicans", "chinese", "russians", "americans", "french",
  // politics
  "leftists", "liberals", "progressives", "socialists", "communists", "commies", "conservatives", "republicans", "democrats",
  "rightists", "nationalists", "fascists", "libtards", "maga", "woke", "tories", "the left", "the right",
  // derogatory nicknames from several sides; listed so "mussie scum" reads like "muslims are scum"
  "mussie", "mussies", "muzzie", "muzzies", "third world", "third worlders", "magats", "magat", "fash", "nazis", "zionists", "globalists", "leftards", "rednecks",
  // class, role, identity
  "the rich", "billionaires", "elites", "the elite", "landlords", "bankers", "politicians", "police", "cops", "protesters",
  "rioters", "journalists", "the media", "boomers", "men", "women", "gays", "trans people", "feminists", "farmers", "unions",
];

const DEHUMANISE = ["vermin", "rats", "cockroaches", "roaches", "parasites", "leeches", "animals", "savages", "subhuman", "sub-human",
  "infestation", "plague", "disease", "cancer", "filth", "scum", "pigs", "insects", "invaders", "a virus"];

// Physical harm only. Policy words such as "deported" or "jailed" are left out on purpose: a
// call to deport or jail people under a law is a policy position, not a marker. "Deport them
// all" stays in the slogans, because it targets a whole group.
const VIOLENCE_VERBS = ["shot", "hanged", "hung", "executed", "killed", "exterminated", "eradicated", "wiped out", "gassed", "lynched",
  "beaten", "burned alive", "purged", "eliminated"];

// Coded calls for violence from several sides, kept in matched pairs by the symmetry test.
const VIOLENT_SLOGANS = ["helicopter rides", "day of the rope", "string them up", "line them up", "round them up", "hang them all",
  "kill them all", "deport them all", "send them all back", "nuke them", "nuke the bastards", "pull out the guns", "get rid of them all", "guillotine them", "guillotines for", "bring out the guillotines",
  "bash the fash", "punch a nazi", "death to"];

const CONSPIRACY = ["they don't want you to know", "they dont want you to know", "wake up people", "wake up, people", "time to wake up", "wake up sheeple", "sheeple", "do your own research",
  "it's all planned", "its all planned", "false flag", "paid actors", "crisis actors", "controlled opposition", "the media is hiding",
  "the media won't tell you", "the media wont tell you", "puppet masters", "great replacement", "funded by soros", "paid by soros",
  "soros funded", "soros-funded", "funded by the kochs", "koch funded", "koch-funded", "paid by the cia", "cia op", "psyop",
  "it's a plandemic", "plandemic", "new world order", "deep state", "shadow government"];

// Calls for people outside the law (gangs, mobs, "real men", militias) to act against a group,
// and calls to send soldiers against civilians.
const VIGILANTE = ["will deal with them", "deal with them ourselves", "take care of them ourselves", "take matters into our own hands",
  "take matters into their own hands", "bring in the army", "bring their armies in", "bring their armies", "send in the army", "send in the military",
  "where's the military", "wheres the military", "where is the military", "where's the army", "where is the army", "time to arm up", "lock and load"];

// Claims that a whole group behaves a given way by nature, and replacement framing.
const ESSENTIALISE = ["import third world", "import the third world", "importing the third world", "become third world",
  "is cultural", "it's in their blood", "its in their blood", "in their culture", "in their dna", "it's in their nature",
  "the natives are", "defend their own country", "defend our own country", "replace us", "replacing us", "demographic replacement",
  "cultural suicide", "acab", "all cops are bastards"];

// Coded hate: slurs, dog whistles and coined terms with a documented hateful meaning (sources:
// ADL Hate Symbols database, GNET and ISD glossaries). Grouped by target so every target group is
// covered; strong terms weigh 2, terms that need context to read as hate weigh 1 (CODED_SOFT).
const CODED = [
  // anti-Black
  "black fatigue", "13/50", "despite being 13", "dindu", "dindu nuffin", "chimp out", "chimped out",
  "pavement ape", "groid", "groids", "sheboon", "basketball americans", "fatherless behavior", "fatherless behaviour",
  "nigger", "niggers", "planet of the apes",
  // neo-Nazi and misogynist
  "1488", "14/88", "14 words", "sieg heil", "hitler was right", "hitler where are you", "hitler... where are you", "foid", "foids",
  // antisemitic
  "(((", ")))", "goyim know", "the goyim", "zog", "the jq", "6 million wasn't enough", "oy vey shut it down", "early life section", "the noticing",
  // anti-Muslim
  "sand people", "goat lovers",
  // anti-Asian
  "kung flu", "chinese virus", "china virus",
  // anti-Latino
  "wetback", "wetbacks", "beaner", "beaners",
  // anti-LGBTQ
  "troon", "troons",
  // anti-white and anti-men
  "white devils", "kill all whites", "kill all men", "men are trash",
];
// Ambiguous on their own (a real jogger, real crackers, real grooming cases): weight 1, so they only
// count as extreme next to another marker.
const CODED_SOFT = ["the fatigue is real", "fatigue is real", "jogger", "joggers", "crackers", "groomers", "religion of peace", "it's always them", "its always them"];

const ABSOLUTIST = ["traitors", "traitor", "enemy of the people", "enemies of the people", "enemies within", "enemy within",
  "civil war now", "civil war is coming", "time for civil war", "no middle ground", "you're either with us", "youre either with us", "real americans", "real patriots",
  "true french", "vrais français", "real french", "race traitor", "class traitor", "purge them", "the final solution",
  "treason", "treasonous"];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alt = (list) => list.map(esc).sort((a, b) => b.length - a.length).join("|");
const G = alt(GROUPS);

const RE = {
  // group ... dehumanising word within a short span, either order
  dehumanise: new RegExp(`\\b(?:${G})\\b(?:\\W+\\w+){0,4}?\\W+(?:${alt(DEHUMANISE)})\\b|\\b(?:${alt(DEHUMANISE)})\\b(?:\\W+\\w+){0,3}?\\W+(?:like\\s+)?(?:these\\s+|those\\s+|the\\s+)?(?:${G})\\b`, "i"),
  // group ... should/must/need to be <violent verb>, or all <group> <violent verb>
  violenceGroup: new RegExp(`\\b(?:${G})\\b(?:\\W+\\w+){0,6}?\\W+(?:should|must|need to|needs to|deserve to|ought to|will)\\s+(?:all\\s+)?(?:be\\s+)?(?:${alt(VIOLENCE_VERBS)})\\b`, "i"),
  violenceSlogan: new RegExp(`\\b(?:${alt(VIOLENT_SLOGANS)})\\b`, "i"),
  conspiracy: new RegExp(`\\b(?:${alt(CONSPIRACY)})\\b`, "i"),
  absolutist: new RegExp(`\\b(?:${alt(ABSOLUTIST)})\\b`, "i"),
  coded: new RegExp(`(?:^|[^\\w])(?:${alt(CODED)})(?:$|[^\\w])`, "i"),
  codedSoft: new RegExp(`\\b(?:${alt(CODED_SOFT)})\\b`, "i"),
  vigilante: new RegExp(`\\b(?:${alt(VIGILANTE)})\\b`, "i"),
  // a fixed phrase, or "all <group> are" / "<group> are all": a claim about every member
  essentialise: new RegExp(`\\b(?:${alt(ESSENTIALISE)})\\b|\\ball (?:the )?(?:${G}) are\\b|\\b(?:${G}) are all\\b`, "i"),
};

// "Immigrants are not animals" and "nobody should be killed" are the opposite of the marker.
const NEGATION = /\b(?:not|never|no one|nobody|aren't|arent|isn't|isnt|shouldn't|shouldnt|don't|dont)\b/i;

export const WEIGHTS = { dehumanise: 2, violence: 3, vigilante: 2, coded: 2, codedSoft: 1, conspiracy: 1, absolutist: 1, essentialise: 1 };
// "Extreme" for the thread report: any violence, vigilante or dehumanising marker, or two of the
// weaker families together.
export const EXTREME_AT = 2;

// Returns { score, markers: [{ family, match }], extreme }.
export function score(text) {
  const s = String(text || "").replace(/[’]/g, "'");
  const markers = [];
  const hit = (family, re, negatable = false) => {
    const m = s.match(re);
    if (!m || (negatable && NEGATION.test(m[0]))) return false;
    markers.push({ family, match: m[0].slice(0, 80) });
    return true;
  };
  hit("dehumanise", RE.dehumanise, true);
  if (!hit("violence", RE.violenceGroup, true)) hit("violence", RE.violenceSlogan);
  hit("conspiracy", RE.conspiracy);
  hit("absolutist", RE.absolutist);
  hit("vigilante", RE.vigilante);
  if (!hit("coded", RE.coded)) hit("codedSoft", RE.codedSoft);
  hit("essentialise", RE.essentialise, true);
  const total = markers.reduce((a, m) => a + WEIGHTS[m.family], 0);
  return { score: total, markers, extreme: total >= EXTREME_AT };
}
