// Named conspiracy theories: an extension of the conspiracy family in rhetoric.js. The conspiracy
// family finds framing ("wake up", "false flag"); this file finds a documented theory by name or by
// its stock claim ("chemtrails", "the 2020 election was stolen"), so the window can say which
// theory it is, what the record shows, and where that record comes from.
//
// Theories come from every direction. Survey work finds that people on the left and the right
// endorse conspiracy claims at similar rates when the content is held constant (Enders et al.
// 2023), so election and staged-event claims are matched both ways and tests/theories.symmetry.test.js
// pairs each claim with its other-side twin. Political side is never an input here.
//
// Not measured: no corpus with conspiracy labels and a usable licence was found (see
// project-docs/EVALUATION.md). Until one is, these markers carry weight 0 and never count toward
// the thread report's "extreme".

import { GROUPS } from "./lexicon.js";

const S = (title, url, date) => ({ title, url, date });
const ENDERS = S("Enders et al., Are Republicans and Conservatives More Likely to Believe Conspiracy Theories? Political Behavior 45", "https://doi.org/10.1007/s11109-022-09812-3", "2023");
const AP_QANON = S("AP, QAnon's 'Save the Children' morphs into popular slogan", "https://www.wsls.com/news/politics/2020/10/28/qanons-save-the-children-morphs-into-popular-slogan/", "2020-10-28");
const NAMING = "People quote, mock and argue against these claims, and Daylight Commons skips only obvious debunking.";

export const THEORY_DOES_NOT_PROVE = `Naming a theory is not believing it. ${NAMING} This describes the post, not who wrote it or why, and a post that names a theory can still contain true statements.`;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const G = GROUPS.map(esc).sort((a, b) => b.length - a.length).join("|");
const YEAR = "(?:(?:19|20)\\d\\d\\s+)?";

export const THEORIES = [
  { id: "qanon", name: "QAnon", terms: ["wwg1wga", "where we go one we go all", "q sent me", "q drops", "qanon was right", "qanon is right"],
    claim: "A secret cabal of elites runs the world and an insider called Q leaks its coming downfall.",
    record: "None of Q's dated predictions came true. ADL and ISD document the movement and its slogans.",
    sources: [S("ADL, QAnon backgrounder", "https://www.adl.org/resources/backgrounder/qanon", "2022"), S("ISD, QAnon explainer", "https://www.isdglobal.org/explainers/qanon/", "2023"), AP_QANON],
    dnp: "QAnon slogans are also quoted by reporters, researchers and former followers." },
  { id: "adrenochrome", name: "Adrenochrome harvesting", terms: ["adrenochrome", "adrenochrome harvesting", "harvesting adrenochrome"],
    claim: "Celebrities and elites traffic children to harvest a drug from their blood.",
    record: "Adrenochrome is an ordinary oxidation product of adrenaline with no such use. AP reported the claim as baseless.",
    sources: [AP_QANON, S("ADL, QAnon backgrounder", "https://www.adl.org/resources/backgrounder/qanon", "2022")],
    dnp: "The word also appears in chemistry, in fiction and in posts mocking the claim." },
  { id: "satanic-abuse", name: "Satanic ritual abuse network", terms: ["satanic ritual abuse", "satanic pedophile", "satanic pedophiles", "satanic paedophiles", "satanic cabal", "satanic elites", "pizzagate", "frazzledrip"],
    claim: "Organised satanic groups abuse children in rituals, protected by people in power.",
    record: "An FBI guide for investigators (Lanning, 1992) found no corroboration for the claims of organised satanic abuse it reviewed.",
    sources: [S("Lanning, Investigator's Guide to Allegations of Ritual Child Abuse (FBI, NCJ 136592)", "https://www.ojp.gov/ncjrs/virtual-library/abstracts/investigators-guide-allegations-ritual-child-abuse", "1992-01")],
    dnp: "Real abuse cases are discussed with some of these words, and historians write about the panic itself." },
  { id: "chemtrails", name: "Chemtrails", terms: ["chemtrails", "chemtrail", "chem trails", "chem-trails", "they are spraying us", "they're spraying us"],
    claim: "Aircraft trails are chemicals sprayed in secret on the public.",
    record: "76 of 77 atmospheric scientists and geochemists surveyed had seen no evidence of a secret spraying programme (Shearer et al., 2016).",
    sources: [S("Shearer, West, Caldeira and Davis, Environmental Research Letters 11", "https://doi.org/10.1088/1748-9326/11/8/084011", "2016-08-10")],
    dnp: "Solar geoengineering is a real research field, and people ask honest questions about contrails." },
  { id: "great-reset", name: "\"Great Reset\" plot", terms: ["great reset agenda", "great reset plot", "great reset plan to", "you will own nothing and be happy", "you'll own nothing and be happy", "you will own nothing and you will be happy"],
    claim: "The World Economic Forum's Great Reset is a hidden plan by elites to take property and freedoms.",
    record: "The Great Reset is a public WEF initiative from June 2020. ADL and ISD document how the plot framing grew from it.",
    sources: [S("ISD, The Great Reset explainer", "https://www.isdglobal.org/explainers/the-great-reset/", "2021"), S("ADL, Great Reset conspiracy flourishes amid continued pandemic", "https://www.adl.org/resources/blog/great-reset-conspiracy-flourishes-amid-continued-pandemic", "2021")],
    dnp: "People criticise the WEF and its policies openly. The \"own nothing\" line is also used as a joke about rents and subscriptions." },
  { id: "stolen-election", name: "Stolen or rigged election", terms: ["stop the steal", "stolen election"],
    patterns: [`\\b(?:the\\s+)?${YEAR}election\\s+(?:was|got|is being|has been)\\s+(?:stolen|rigged)\\b`, `\\b(?:${G}|they)\\s+(?:rigged|stole)\\s+the\\s+${YEAR}election\\b`],
    claim: "An election result was reversed by fraud on a scale that changed who won.",
    record: "Courts, audits and election officials found no fraud that changed the 2020 result (CISA joint statement), and the Senate Intelligence Committee found no evidence that votes were changed in 2016.",
    sources: [S("CISA, Joint statement from the Elections Infrastructure Government Coordinating Council", "https://www.cisa.gov/news-events/news/joint-statement-elections-infrastructure-government-coordinating-council-election", "2020-11-12"), S("US Senate Select Committee on Intelligence, Report Volume 1, Russian Efforts Against Election Infrastructure", "https://www.intelligence.senate.gov/sites/default/files/documents/Report_Volume1.pdf", "2019-07-25"), ENDERS],
    dnp: "Real election fraud cases exist and are prosecuted. Claims about one race, one county or past history can be true." },
  { id: "vote-flipping", name: "Machines or satellites flipped the votes", terms: [],
    patterns: ["\\b(?:dominion|smartmatic|starlink|the machines|voting machines|the satellites)\\s+(?:flipped|switched|changed|rigged|altered)\\s+(?:the\\s+)?(?:votes?|election|results?|tallies|totals)\\b",
      "\\b(?:russia|china|iran|they)\\s+(?:hacked|changed|altered|flipped)\\s+(?:the\\s+)?(?:vote\\s+(?:totals|tallies|counts)|voting machines|votes)\\b"],
    claim: "Voting machines, satellites or a foreign government changed vote counts.",
    record: "The Senate Intelligence Committee found no evidence that 2016 tallies were altered. PolitiFact rated the 2024 Starlink claim Pants on Fire: tabulators are not online during counting.",
    sources: [S("US Senate Select Committee on Intelligence, Report Volume 1", "https://www.intelligence.senate.gov/sites/default/files/documents/Report_Volume1.pdf", "2019-07-25"), S("PolitiFact, No, Elon Musk's Starlink wasn't used to rig the 2024 election", "https://www.politifact.com/factchecks/2024/nov/12/threads-posts/no-elon-musks-starlink-wasnt-used-to-rig-the-2024/", "2024-11-12"), ENDERS],
    dnp: "Foreign influence campaigns and machine faults are real and documented. They are different from changed counts." },
  { id: "staged-shooting", name: "Staged shooting", terms: [],
    patterns: ["\\b(?:the\\s+)?(?:[\\w-]+\\s+){0,2}(?:shooting|assassination attempt|massacre)\\s+was\\s+(?:staged|fake|faked|a false flag|a hoax)\\b",
      "\\b(?:sandy hook|butler|parkland|uvalde)\\b[^.!?]{0,40}\\b(?:staged|crisis actors|false flag|hoax)\\b"],
    claim: "A shooting was staged with actors or faked to win sympathy or a policy.",
    record: "Researchers tracked staging claims about the 2024 Butler attempt from both sides (QUT, 2024). Courts found the Sandy Hook hoax claims defamatory.",
    sources: [S("QUT Digital Media Research Centre, Conspiracy theories on the Trump assassination attempt are spreading like wildfire", "https://www.qut.edu.au/news/realfocus/conspiracy-theories-on-the-trump-assassination-attempt-are-spreading-like-wildfire", "2024-07"), ENDERS],
    dnp: "Asking how security failed is not a staging claim, and official accounts are sometimes corrected." },
  { id: "inside-job", name: "9/11 inside job", terms: ["9/11 was an inside job", "911 was an inside job", "bush did 9/11", "bush did 911", "jet fuel can't melt steel beams", "jet fuel cant melt steel beams"],
    claim: "The US government planned or carried out the 11 September 2001 attacks.",
    record: "NIST's investigation explained the collapses of the towers and of WTC 7 by impact damage and fire.",
    sources: [S("NIST, World Trade Center Disaster Study", "https://www.nist.gov/world-trade-center-investigation", "2008")],
    dnp: "Intelligence failures before 9/11 are documented, and the phrase is also used as a joke." },
  { id: "covid-5g", name: "5G caused COVID-19", terms: [],
    patterns: ["\\b5g\\s+(?:causes|caused|spreads|spread|is spreading)\\s+(?:the\\s+)?(?:covid|coronavirus|the virus)\\b", "\\b(?:covid|coronavirus)\\s+(?:is|was)\\s+(?:caused|spread)\\s+by\\s+5g\\b"],
    claim: "5G mobile networks cause or spread COVID-19.",
    record: "A virus cannot travel on radio waves. Ahmed et al. (2020) traced how the claim spread on Twitter.",
    sources: [S("Ahmed et al., COVID-19 and the 5G Conspiracy Theory: Social Network Analysis of Twitter Data, JMIR 22(5)", "https://doi.org/10.2196/19458", "2020-05-06")],
    dnp: "People ask honest questions about radio exposure, which is studied and regulated." },
  { id: "vaccine-harm", name: "Vaccines cause autism or carry microchips", terms: ["microchips in the vaccine", "microchips in vaccines", "vaccine microchips", "vaccines have microchips"],
    patterns: ["\\bvaccines?\\s+(?:cause|causes|caused)\\s+autism\\b"],
    claim: "Childhood vaccines cause autism, or vaccines carry tracking microchips.",
    record: "A meta-analysis of studies covering over 1.2 million children found no link between vaccines and autism (Taylor et al., 2014).",
    sources: [S("Taylor, Swerdfeger and Eslick, Vaccines are not associated with autism: an evidence-based meta-analysis, Vaccine 32(29)", "https://doi.org/10.1016/j.vaccine.2014.04.085", "2014-06-17")],
    dnp: "Vaccines have real, documented side effects, and parents ask honest questions about them." },
  { id: "hidden-cure", name: "Hidden cure", terms: ["hiding the cure for cancer", "hiding the cure", "suppressing the cure", "they have the cure for cancer", "sitting on the cure"],
    claim: "Drug companies or regulators hide a cure to protect profits.",
    record: "In a 2013 US survey, 37% agreed the FDA suppresses natural cures for cancer (Oliver and Wood, 2014); no such hidden cure has been shown.",
    sources: [S("Oliver and Wood, Medical Conspiracy Theories and Health Behaviors in the United States, JAMA Internal Medicine 174(5)", "https://doi.org/10.1001/jamainternmed.2014.190", "2014-05")],
    dnp: "Drug pricing, buried trial results and industry lobbying are real and documented." },
];

const word = (list) => list.map(esc).sort((a, b) => b.length - a.length).join("|");
const COMPILED = THEORIES.map((t) => ({ id: t.id,
  res: [...((t.terms || []).length ? [new RegExp(`(?:^|[^\\w])(${word(t.terms)})(?=$|[^\\w])`, "i")] : []), ...(t.patterns || []).map((p) => new RegExp(p, "i"))] }));
const BY_ID = new Map(THEORIES.map((t) => [t.id, t]));
export const theoryById = (id) => BY_ID.get(id) || null;

// Text that discusses a theory as false or as a theory, group-blind. A post that says "the
// chemtrails conspiracy theory", "no evidence", "debunked" or "fact check" is about the claim.
const DISCUSSED = /\b(?:conspiracy theor(?:y|ies|ist|ists)|debunk(?:ed|ing|s)?|baseless|no evidence|false claims?|the claim that|myths?|hoax claims?|fact[- ]?checks?|misinformation|disinformation|panic|is false|are false|not true|pants on fire)\b/i;
// Mockery is discussion too ("Pizzagate nonsense", "let me guess, chemtrails").
const MOCKED = /\b(?:nonsense|tin ?foil|crackpots?|loony|kooks?|gullib\w*|let me guess|nutjobs?|wackos?)\b/i;
// A claim reported or argued about, not made: "he keeps saying the election was rigged", "if you
// believe that, you also believe 9/11 was an inside job". This also skips some first-person belief
// ("I believe ..."): precision comes first.
const REPORTED_CLAIM = /\b(?:say|says|said|saying|claim|claims|claimed|claiming|tout(?:s|ed|ing)|suggest(?:s|ed|ing)|insist(?:s|ed|ing)|alleg(?:e|es|ed|ing)|assum(?:e|es|ed|ing)|believ(?:e|es|ed|ing)|think|thinks|thinking|heard)\b[^.!?]{0,40}$/i;
const NEGATED = /\b(?:not|never|wasn't|wasnt|isn't|isnt|no|didn't|didnt)\s+(?:\w+\s+){0,2}$/i;

// [{ theory, match, index }], one per theory, for text that uses a theory (not one that debunks it).
export function theoryMatches(text) {
  const s = String(text || "");
  if (DISCUSSED.test(s) || MOCKED.test(s)) return [];
  const out = [];
  for (const c of COMPILED) {
    for (const re of c.res) {
      const m = s.match(re);
      if (!m) continue;
      const match = (m[1] || m[0]).trim(), index = m.index + m[0].indexOf(match);
      const before = s.slice(Math.max(0, index - 60), index);
      if (NEGATED.test(before.slice(-30)) || REPORTED_CLAIM.test(before) || /\b(?:not|never)\b/i.test(m[0])) continue;
      out.push({ theory: c.id, match: match.slice(0, 80), index });
      break;
    }
  }
  return out;
}
