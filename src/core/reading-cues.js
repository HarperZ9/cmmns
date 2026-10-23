// The techniques the reading lens names, each with its cues. A cue is a regular expression over the
// post; {NATION}, {GROUP}, {ACTOR} and {STRONGMAN} expand to the lists in reading-lists.js, which run
// in every direction, so a cue describes how a post argues and never whom it is about.
// Cues were written from feed tests 1 to 5 (the dev sets) and the families in the 2026-10-23 brief.

import { NATIONS, TARGET_GROUPS, STRONGMEN, ALLUSIONS, CODED_TERMS } from "./reading-lists.js";
import { COERCION_ACTORS } from "./theories-coercion.js";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alt = (list) => [...new Set(list)].map(esc).sort((a, b) => b.length - a.length).join("|");
export const SLOTS = {
  NATION: `(?:${alt(NATIONS)})`,
  GROUP: `(?:the\\s+)?(?:${alt(TARGET_GROUPS)})`,
  ACTOR: `(?:the\\s+)?(?:${alt(COERCION_ACTORS)})`,
  STRONGMAN: `(?:${alt(STRONGMEN)})`,
};
const BE = "(?:is|are|was|were|'s|'re|isn't|aren't|is not|are not|wasn't)";
// Who owns a system, firm or place is a fact, not secret coercion ("Starshield systems are owned and
// controlled by the US government", found by the 3.4.0 case run). These lookbehinds skip the legal
// "owned and controlled", "wholly owned" and a thing as the subject.
const THINGS = "systems?|satellites?|compan(?:y|ies)|firms?|platforms?|networks?|stations?|outlets?|subsidiar(?:y|ies)|assets?|infrastructure|facilit(?:y|ies)|terminals?|services?|contracts?|programm?e?s?|shares?|stakes?|lands?|propert(?:y|ies)|territor(?:y|ies)|airspace|ports?|bases?";
const NOT_OWNERSHIP = "\\b(?<!\\b(?:owned|operated|run|managed|built) and )(?<!\\b(?:wholly|majority|jointly|publicly|privately|partly|fully|state|government)[- ])"
  + `(?<!\\b(?:${THINGS})\\s+(?:are|is|was|were|remain|remains)\\s+(?:\\w+\\s+)?)`;

// What each technique is and how to spot it, in plain English: one idea per sentence.
const DEFINITIONS = {
  "nation-denial": "The post says a nation or a people does not exist. Look for \"is not a real country\" or \"no man's land\".",
  "dehumanising": "The post calls people animals, pests or a disease. Look for words like \"vermin\", \"parasites\" or \"spreading like a plague\".",
  "punitive-annexation": "The post asks to take over a place or remove a group as a punishment. Look for \"turn it into a penal colony\", \"wipe them off the map\" or \"deport them all\".",
  "strongman": "The post asks for one hard ruler to fix things. Look for \"we need our own\" followed by a named ruler, or \"iron fist\".",
  "question-insinuation": "The post puts an accusation in a question. The reader supplies the answer. Look for a run of questions or \"who benefits?\".",
  "true-leap": "The post starts from a true or documented item. Then it jumps to a larger claim. Look for \"this proves\", \"that is why\" or \"not a coincidence\".",
  "case-to-group": "The post takes one case and applies it to a whole group. Look for \"typical\", \"they always\" or \"all of them\".",
  "essentialism": "The post says a group has a fixed nature. Look for \"in their blood\", \"inherently\" or \"genetically\".",
  "coded-term": "The post uses a word that stands in for a slur or a group name. The window shows the word.",
  "replacement": "The post says a group plans to replace a people, or accuses a group of ritual crimes. Look for \"replacement\", \"flood the country with\" or \"ritual abuse\".",
  "secret-coercion": "The post says a leader is secretly controlled. Look for \"blackmailed\", \"compromised\", \"owned by\" or \"puppet of\".",
  "election-theft": "The post says an election was stolen or rigged. Look for \"rigged election\", \"fake president\" or \"machines flipped votes\".",
  "metaphor": "The post describes people or events as something else. Look for \"invasion\", \"flood\" or \"cancer\".",
  "hyperbole": "The post makes something much bigger than the facts. Look for \"in history\", \"of all time\" or \"every single one\".",
  "irony": "The post says the opposite of what it means. Look for \"funny how\", \"what a coincidence\" or \"/s\".",
  "allusion": "The post borrows force from a known story, book or event. Look for names like \"Orwellian\", \"Weimar\" or \"Judas\".",
  "dog-whistle": "The post uses a phrase that one audience reads as a coded message. Look for \"certain people\" or \"we are not supposed to notice\".",
};

// [id, name, family, cues]. Family names follow the brief; literary devices are one family.
export const READING_TECHNIQUES = [
  ["nation-denial", "Nation denial", "dehumanising", [
    `\\b{NATION}\\s+(?:isn't|is not|ain't|was never|has never been)\\s+(?:even\\s+)?(?:a\\s+)?(?:real\\s+)?(?:country|nation|state|people)\\b`,
    "\\bno man'?s land\\b", "\\b(?:not|never) (?:a|even a) real (?:country|nation|people)\\b", "\\bso-called (?:country|nation|state|people)\\b",
    "\\b(?:fake|invented|made-up) (?:country|nation|people)\\b", "\\bthere (?:is|was) no such (?:thing as a |)(?:country|nation|people)\\b"]],
  ["dehumanising", "Dehumanising metaphor", "dehumanising", [
    "\\b(?:are|like|as)\\s+(?:a\\s+)?(?:cockroaches|roaches|rats|vermin|parasites|leeches|locusts|lice|termites|maggots|insects|animals|savages|subhumans?|a plague|a cancer|a disease|a virus|an infestation)\\b",
    "\\b(?:infest(?:ing|ed|s)?|infect(?:ing|ed|s)?|spreading like a (?:plague|virus|disease|cancer))\\b",
    "\\b(?:subhuman|untermensch|human garbage|human trash|not even human|not human)\\b"]],
  ["punitive-annexation", "Punitive annexation or elimination", "punitive", [
    `\\b(?:take|seize|annex|conquer|occupy|invade|buy|colonise|colonize)\\s+{NATION}\\s+and\\s+(?:turn|convert|make)\\s+it\\s+into\\b`,
    "\\b(?:convert|turn|make)\\s+(?:it|them|the (?:country|island|place))\\s+into\\s+(?:a\\s+)?(?:penal colony|prison colony|prison|colony|parking lot|wasteland|glass|reservation)\\b",
    `\\b(?:nuke|glass|flatten|level|carpet[- ]bomb|wipe out|erase)\\s+{NATION}\\b`, "\\bwipe(?:d)? (?:them|it) off the (?:map|face of the earth)\\b",
    "\\bpenal colony\\b", "\\b(?:remigrat(?:e|ion|ing)|mass deportations? now|deport them all|send them all back|round them (?:all )?up)\\b",
    "\\b(?:put down|crush|exterminate|eradicate)\\s+(?:the\\s+)?(?:insurgency|uprising|rioters|vermin|them all)\\b",
    "\\b(?:criminali[sz]e|abolish|outlaw|ban)\\s+(?:and\\s+(?:abolish|ban|outlaw)\\s+)?{GROUP}\\b", "\\bat maximum intensity\\b", "\\blet (?:the|them|it)\\b[^.\\n]{0,24}\\bimplode\\b"]],
  ["strongman", "Strongman appeal", "strongman", [
    "\\bwe need (?:a|our own|an?)\\s+(?:strong\\s?man|iron fist|dictator|{STRONGMAN})\\b", "\\b(?:do|pull) (?:a|an)\\s+{STRONGMAN}\\b",
    "\\b{STRONGMAN}[- ]style\\b", "\\b{STRONGMAN} (?:did it right|had it right|knows how|is the model|is what we need)\\b",
    "\\b(?:only|just) (?:a|one) (?:strong\\s?man|strong leader|man) can (?:fix|save)\\b", "\\b(?:iron fist|strong hand|martial law now|suspend the constitution|dictator for a day)\\b",
    "\\bbenevolent dictator(?:ship)?\\b"]],
  ["question-insinuation", "Question insinuation", "insinuation", [
    "\\b(?:why|how|who|what|when)\\b[^?.!\\n]{0,120}\\b(?:blackmail\\w*|compromised|paid off|bought|owned|hiding|hide|cover(?:ing)? up|covered up|rigged|hacked|funded|controls?|really)\\b[^?.!\\n]{0,80}\\?",
    "\\b(?:anyone|coincidence|ask yourself|makes you wonder|just asking|i wonder if|i'm just saying|just saying|connect the dots|think about it)\\b[^\\n]{0,4}[?!.]",
    "\\b(?:what are they hiding|who benefits|cui bono|follow the money|why is no one talking about)\\b",
    "\\b(?:and )?what happened\\?", "\\bwho (?:hired|paid|sent|knew|ordered|benefits|gave)\\b[^?\\n]{0,80}\\?",
    "(?:[^?.!\\n]{6,160}\\?\\s*){2,}", "\\b(?:conveniently|coincidentally|seemingly|suspiciously)\\b",
    // Added for 3.4.1 from dev-set misses (feed tests 1 to 12).
    "\\bwonder (?:what|who|which)\\b[^?.!\\n]{0,80}\\b(?:benefits?|profits?|gains?)\\b", "\\bwhy do you think (?:that|this) is\\b",
    "\\bwhat does (?:that|this) (?:\\w+ )?say about\\b", "\\bimagine what (?:they|he|she) (?:do|did|would do|will do)\\b"]],
  ["true-leap", "True item carries a leap", "leap", [
    "\\b(?:it'?s|that'?s|this is)\\s+(?:true|a fact|documented|on record|real)\\b[^.\\n]{0,80}\\b(?:so|which means|therefore|proves|that'?s why)\\b",
    "\\b(?:this|it|which)\\s+(?:proves|confirms|shows)\\s+(?:just how|that|exactly)\\b", "\\b(?:not|no) (?:a )?coincidence\\b",
    "\\bcan be (?:hacked|rigged|faked|manipulated)\\b", "\\bnot hard at all if\\b", "\\bthe only explanation\\b",
    "\\bthere is an explanation\\b", "\\b(?:it all|everything) (?:makes sense|adds up) now\\b",
    "\\b(?:obviously|clearly|undeniably) (?:ended up|means|shows|proves|is why|say)\\b", "\\b(?:and )?(?:that|this) is why\\b", "\\bwhich is why\\b", "\\btheir plan to\\b"]],
  ["case-to-group", "Case to group", "generalisation", [
    "\\b(?:all|every(?: single)?|most|typical)\\s+{GROUP}\\b", "\\b{GROUP}\\s+(?:always|never|all|are all|will always|will never)\\b",
    "\\b(?:that'?s|this is) (?:what|how) {GROUP}\\s+(?:do|are|act|behave)\\b", "\\b{GROUP}\\s+(?:will probably|will|are going to)\\s+(?:attack|rape|kill|destroy|take over|ruin|replace)\\b",
    "\\b(?:the|these|those)\\s+(?:people|kind|types?)\\s+(?:always|never|all)\\b", "\\bthe whole (?:bunch|lot) of them\\b",
    "\\brampant (?:throughout|in|among)\\b", "\\b(?:their|these people's) (?:depravity|nature|evil|savagery|degeneracy)\\b", "\\bif they do this to their own\\b",
    "\\bimagine what they do to\\b", "\\ball the other\\b[^.?\\n]{0,40}\\b(?:members|people|ones) who\\b", "\\b\\w+ (?:rape|crime|terror|hate) culture\\b"]],
  ["essentialism", "Essentialism", "essentialism", [
    "\\b(?:in their|it'?s in their)\\s+(?:blood|dna|nature|genes|culture)\\b", "\\b{GROUP}\\s+(?:are|is)\\s+(?:naturally|inherently|genetically|by nature)\\b",
    "\\b(?:incompatible|not compatible)\\s+with\\s+(?:western|our|european|american|civili[sz]ed)\\b", "\\b(?:can'?t|cannot|won'?t) (?:be )?(?:integrate|assimilate)d?\\b",
    "\\bcompletely different cultures?\\b", "\\b(?:third[- ]world|backward) (?:culture|people|mentality)\\b",
    "\\b(?:genetically|biologically|innately|racially) (?:inhibited|predisposed|incapable|inferior|superior|prone|wired)\\b"]],
  ["coded-term", "Coded term", "coded", [`(?<![\\w])(?:${alt(CODED_TERMS)})(?![\\w])`, "\\b(?:stop noticing|starting to notice|aren'?t supposed to notice|you'?re not allowed to notice)\\b"]],
  ["replacement", "Replacement or blood libel", "replacement", [
    "\\bgreat replacement\\b", "\\b(?:replac(?:e|ing|ement of)) (?:us|white|native|christian|european|american|the native)\\w*\\b", "\\bdemographic (?:replacement|war|takeover)\\b",
    "\\bimport(?:ing|ed)? (?:voters|a new electorate|the third world|people from completely different)\\b", "\\bcommit(?:ting)? (?:cultural |national )?suicide by importing\\b",
    "\\b(?:white|christian|european) genocide\\b", "\\bblood libel\\b", "\\bdrink(?:ing|s)? (?:the )?blood of\\b", "\\britual(?:istic)?,? (?:\\w+ )?(?:murder|sacrifice|abuse)\\b",
    "\\b(?:harvest(?:ing)?|adrenochrome)\\b[^.\\n]{0,40}\\b(?:children|kids|babies|organs)\\b", "\\bpoison(?:ing|ed)? the wells\\b", "\\bcultural suicide\\b",
    "\\bflood(?:s|ed|ing)? (?:the|our|this) (?:country|nation|cities|towns|continent) with\\b", "\\bswamp(?:s|ed|ing)? the (?:natives|locals|voters|country)\\b",
    "\\btraffick(?:ing|s|ed)? (?:kids|children|babies)\\b", "\\b(?:rape|abuse) (?:ceremonies|assembly line|rings?)\\b", "\\bdivine permission to\\b",
    "\\bdemographic engineering\\b", "\\bit(?:'s| is) (?:replacement|conquest)\\b", "\\bship(?:ping)? millions of foreign\\b"]],
  ["secret-coercion", "Secret coercion", "coercion", [
    "\\bblackmail(?:ed|ing|s)?\\b", "\\bkompromat\\b", "\\b(?:has|have|holds?|got)\\s+(?:the\\s+)?dirt on\\b",
    "\\bcompromised\\s+(?:by|to|into)\\b", "\\b(?:is|was|were|are|being)\\s+compromised\\b(?![^.\\n]{0,30}\\b(?:account|system|server|network|password|data|phone|device)s?\\b)",
    `${NOT_OWNERSHIP}(?:owned(?! and)|controlled|bought(?: and paid for)?|handled|infiltrated)\\s+by\\s+{ACTOR}\\b`, "\\bin the pocket of\\b", "\\b{ACTOR}\\s+(?:owns|controls|runs)\\s+(?:him|her|them|congress|the president|our government)\\b",
    "\\b(?:asset|puppet|stooge|plant) (?:of|for) {ACTOR}\\b", "\\b(?:deep state|cia|mossad|kremlin|ccp)[- ]controlled\\b", "\\bcontrolled (?:nations?|governments?|media)\\b",
    "\\b(?:fully |completely |totally )?taken over by\\b", "\\b(?:cement|entrench|hold)(?:ing)? (?:control|power)(?: indefinitely| forever)?\\b", "\\bthe playbook\\b",
    "\\bcalling the shots\\b", "\\b{GROUP}\\s+money\\b[^.\\n]{0,40}\\b(?:controls?|runs?|owns?|buys?)\\b",
    "\\bworks? for (?:the )?(?:cia|mossad|kremlin|fsb|kgb|ccp|mss)\\b", "\\b(?:cia|mossad|kremlin|fsb|ccp|mss) runs (?:the|our|global)\\b"]],
  ["election-theft", "Election theft", "election", [
    "\\b(?:rigged|stolen|fraudulent|fake)\\s+(?:the\\s+)?(?:election|vote|ballots?)\\b", "\\b(?:rig|rigged|steal|stole|stealing)\\s+(?:the\\s+)?(?:election|vote|votes|machines|ballots)\\b",
    "\\b(?:fake|illegitimate|selected,? not elected)\\s+president\\b", "\\belection fraud\\b", "\\bmachines?\\b[^.\\n]{0,60}\\b(?:hacked|flipp(?:ed|ing)|switch(?:ed|ing)|sabotage)\\b",
    "\\b(?:hacked|flipped)\\b[^.\\n]{0,40}\\b(?:votes?|machines?|ballots?|election)\\b", "\\bannul(?:ment of)?\\b[^.\\n]{0,30}\\belection\\b"]],
  ["metaphor", "Metaphor", "literary", [
    "\\b(?:invasion|invaders|flood(?:ed|ing)? of|tidal wave|swarms?|hordes?)\\b", "\\b(?:is|are) (?:a )?(?:cancer|poison|tumou?r|disease|virus|plague)\\b",
    "\\bburn(?:ed|t)? (?:it )?out of\\b", "\\bbled (?:dry|white)\\b", "\\b(?:robbing|pillaging|raping) (?:and \\w+ )?(?:this|the|our) country\\b", "\\bone body\\b"]],
  ["hyperbole", "Hyperbole", "literary", [
    "\\bin (?:american|world|human|modern|recorded|our|the) history\\b", "\\bof all time\\b", "\\bmore \\w+ than (?:basically )?every\\b",
    "\\bcombined[!.]*$", "\\b(?:nothing is being done|completely mad|every single one)\\b", "\\bthe (?:worst|biggest|most \\w+) (?:\\w+ )?(?:ever|in the world|on earth)\\b",
    "\\bliterally (?:destroying|killing|everyone|everything)\\b", "\\b(?:absolutely|completely|totally) (?:insane|toxic|destroyed|corrupt)\\b"]],
  ["irony", "Irony", "literary", ["\\bfunny (?:that|how)\\b", "\\bwhat a coincidence\\b", "\\bhow convenient\\b", "\\byeah,? right\\b",
    "\\b(?:sure|totally),? (?:jan|buddy|pal)\\b", "(?:^|\\s)/s\\b", "\\bwalk into a bank\\b", "\\bwalk into a bar\\b", "\\bcolou?r me surprised\\b"]],
  ["allusion", "Allusion", "literary", [`\\b(?:${alt(ALLUSIONS)})\\b`]],
  ["dog-whistle", "Dog-whistle", "literary", ["\\b(?:certain people|you know who|those people|these people|their kind|globalists?|international bankers|rootless|the usual suspects|\\(\\(\\()\\b",
    "\\b(?:we aren'?t supposed to|you'?re not supposed to) (?:notice|talk about|say)\\b", "\\boften it'?s in the (?:last )?name\\b", "\\b(?:jewish|zionist|muslim|catholic|white|black) (?:money|cabal|lobby|power brokers)\\b"]],
].map(([id, name, family, cues]) => ({ id, name, family, cues, definition: DEFINITIONS[id] }));

const fill = (cue) => cue.replace(/\{(NATION|GROUP|ACTOR|STRONGMAN)\}/g, (_, k) => SLOTS[k]);
export const READING_RULES = READING_TECHNIQUES.flatMap((t) => t.cues.map((cue, i) => ({ technique: t.id, cue: `${t.id}#${i}`, re: new RegExp(fill(cue), "giu") })));
export const TECHNIQUE_BY_ID = new Map(READING_TECHNIQUES.map((t) => [t.id, t]));
