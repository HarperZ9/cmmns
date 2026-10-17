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
  "kill them all", "deport them all", "send them all back", "guillotine them", "guillotines for", "bring out the guillotines",
  "bash the fash", "punch a nazi", "death to"];

const CONSPIRACY = ["they don't want you to know", "they dont want you to know", "wake up people", "wake up, people", "time to wake up", "wake up sheeple", "sheeple", "do your own research",
  "it's all planned", "its all planned", "false flag", "paid actors", "crisis actors", "controlled opposition", "the media is hiding",
  "the media won't tell you", "the media wont tell you", "puppet masters", "great replacement", "funded by soros", "paid by soros",
  "soros funded", "soros-funded", "funded by the kochs", "koch funded", "koch-funded", "paid by the cia", "cia op", "psyop",
  "it's a plandemic", "plandemic", "new world order", "deep state", "shadow government"];

const ABSOLUTIST = ["traitors", "traitor", "enemy of the people", "enemies of the people", "enemies within", "enemy within",
  "civil war now", "civil war is coming", "time for civil war", "no middle ground", "you're either with us", "youre either with us", "real americans", "real patriots",
  "true french", "vrais français", "real french", "race traitor", "class traitor", "purge them", "the final solution"];

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
};

// "Immigrants are not animals" and "nobody should be killed" are the opposite of the marker.
const NEGATION = /\b(?:not|never|no one|nobody|aren't|arent|isn't|isnt|shouldn't|shouldnt|don't|dont)\b/i;

export const WEIGHTS = { dehumanise: 2, violence: 3, conspiracy: 1, absolutist: 1 };
// "Extreme" for the thread report: any violence marker, any dehumanising marker, or both of the
// two weaker families together.
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
  const total = markers.reduce((a, m) => a + WEIGHTS[m.family], 0);
  return { score: total, markers, extreme: total >= EXTREME_AT };
}
