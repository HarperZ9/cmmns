// The pressure family of the reading lens: six moves that push a reader to act before they check,
// whoever writes the message (a person, a scammer, a sock puppet or an AI agent). Seeded from the
// five sock-puppet messages in Anthropic's 2026-10-23 assessment of the UK AISI incident, and
// written against the dev set in project-docs/evidence/pressure/dev.jsonl only. The held-out set
// (test.jsonl) was written by a separate model that never saw these cues, and is scored once by
// scripts/eval-pressure.mjs. No cue names a group, person, party or side.
// The family is off by default: it shows only when the user turns on the pressure lens in Options.

export const PRESSURE_DEFINITIONS = {
  "urgency": "The message presses for speed: something is blocked, about to expire or available today only, or the writer apologises for pushing. Look for \"blocked on\", \"today only\" or \"sorry to push\".",
  "shrinking-ask": "The message makes the request look small so it is easier to say yes. Look for \"three quick steps\", \"~5 minutes\" or \"just one click\".",
  "manufactured-consensus": "A voice presents itself as an outside party and vouches for the request. Look for \"chiming in as a user\", \"no stake here\" or \"everyone on our team agrees\".",
  "false-even-handedness": "The message credits both sides to make a dispute look settled. Look for credit to the person who raised a concern and to the person accused, or \"both sides are right\".",
  "burden-shifting": "The message hands the work of checking to the reader instead of answering. Look for \"check it yourself\", \"prove it\" or \"if you can't show it, merge\".",
  "deflection-by-label": "The message answers a concern with a label instead of a reason. Look for \"noise\", \"FUD\" or \"drama\" said of an objection.",
};

const SELF = "(?:yoursel(?:f|ves))";
// "you can verify it yourself" is help, not a demand, so these lead-ins skip the match.
const OFFERED = "(?<!\\b(?:you can|you may|you could|feel free to|easy to|able to|lets you|so you can|to help you) )";

export const PRESSURE_TECHNIQUES = [
  ["urgency", "Urgency", "pressure", [
    "\\bsorry to (?:push|nag|pester|chase|hassle|bug you|keep (?:asking|pushing|chasing))\\b",
    "\\bapolog(?:ies|ise|ize) for (?:the )?(?:hassl|push|nag|pester|chas|bugg)\\w*",
    "\\b(?:rollout|release|launch|pipeline|deploy(?:ment)?|merge|we|we're|we are|i'm|i am|team|customer|everything)\\s+(?:is |are )?(?:currently |still |completely )?blocked (?:on|by|until|waiting)\\b",
    "\\bunblock(?:s|ing)? (?:the|our|this|us|me)\\b",
    "\\b(?:account|access|mailbox|licen[cs]e|password|wallet|domain|subscription|page)s? (?:will be |is being |has been |gets )?(?:suspended|deleted|locked|closed|disabled|terminated|deactivated|frozen)\\b",
    "\\b(?:password|account|licen[cs]e|subscription) (?:expires|ends|lapses) (?:today|tonight|in (?:\\d+|one|two) (?:hours?|minutes?))\\b",
    "\\btoday only\\b", "\\b(?:last|only) (?:\\d+|few) (?:left|licen[cs]es|spots|seats|units)\\b", "\\bfirst \\d+ (?:wallets|people|users|customers|buyers)\\b",
    "\\blimited[- ](?:time|giveaway|offer|window)\\b", "\\bact (?:now|fast|quickly)\\b", "\\bbefore (?:it'?s|it is) too late\\b",
    "\\b(?:slips|is lost|falls through|is off|gets cancell?ed|fails) if (?:this|it|you|we)\\b",
    "\\bif (?:this|it) (?:isn'?t|is not|doesn'?t|does not) (?:get )?(?:in|merged|done|approved|signed|paid|land)\\b[^.\\n]{0,20}\\bby\\b",
    "\\bor (?:i|we) (?:will )?(?:disclose|publish|go public|leak|release it|report you)\\b",
    "\\b(?:need|needs|want)s? (?:this|it|them|gift cards|you|an answer|approval|a decision)\\b[^.\\n]{0,40}\\b(?:today|right now|asap|immediately|urgently|within the hour|by noon|by tonight|before end of day|in the next hour)\\b",
    "\\b(?:discreetly|keep (?:this|it) between us|don'?t (?:mention|tell|say anything about) (?:it|this|anyone))\\b", "\\bare you at your desk\\b",
    "\\btime[- ]sensitive\\b", "\\b(?:final|last) (?:notice|warning|reminder|chance)\\b", "\\bimmediate action (?:is )?required\\b",
    "\\b(?:respond|reply|act|pay|confirm|verify)\\b[^.\\n]{0,25}\\bwithin (?:\\d+|one|two|the next) (?:hours?|minutes?|hrs?)\\b",
    "\\bor (?:your|the) (?:account|access|service|domain|licen[cs]e|funds?)s? (?:will|gets|get) (?:be )?\\w+",
  ]],
  ["shrinking-ask", "Shrinking the ask", "pressure", [
    "\\b(?:three|two|four|a few|a couple of|\\d) (?:quick|simple|small|easy|tiny|short) (?:steps|clicks|questions|things|checks|changes)\\b",
    "~\\s?\\d+\\s?(?:min(?:ute)?s?|sec(?:ond)?s?)\\b", "\\b(?:minutes?|seconds?|moments?) of your time\\b",
    "\\btakes? (?:only )?(?:seconds|a second|a minute|no time|two minutes)\\b",
    "\\b(?:with |in )?(?:one|a single|1) click\\b", "\\bone-click\\b",
    "\\bjust (?:a|one) (?:one-liner|small|tiny|quick|minor|trivial|single)\\b", "\\bbarely worth a review\\b",
    "\\b(?:it'?s|it is|this is) (?:only|just|literally) (?:a )?(?:small|tiny|minor|quick|trivial|harmless|one-line)\\b",
    "\\b(?:it'?s|it is) a small change\\b", "\\bsmall (?:ux |ui )?add-on\\b", "\\b(?:tiny|harmless|trivial|teeny) (?:change|tweak|patch|update|add-on|favou?r)\\b",
    "\\ball you (?:need|have) to do is\\b", "\\bsimply (?:click|reply|confirm|approve|sign|scan|enter|log in)\\b", "\\bwon'?t take (?:long|more than|a minute)\\b",
    "\\breal quick\\b", "\\b(?:quick|small|tiny) favou?r\\b", "\\bonly takes? (?:a|one|two|\\d+)\\b",
  ]],
  ["manufactured-consensus", "Manufactured consensus", "pressure", [
    "\\bchiming in as (?:a|an|just a) (?:\\w+ )?(?:user|outsider|bystander|customer|developer|observer)\\b",
    "\\bas (?:a|an|just a) (?:casual|ordinary|neutral|independent|disinterested|uninvolved|random|outside) (?:user|observer|bystander|reader|developer|customer)\\b",
    "\\b(?:with )?no (?:stake|skin|horse) in (?:this|the race|here)\\b", "\\bno stake here\\b",
    "\\blurker,? first (?:post|comment)\\b", "\\bfirst (?:post|comment) here\\b",
    "\\b(?:our|my) (?:whole|entire) (?:company|team|org|organi[sz]ation|office)\\b[^.\\n]{0,40}\\b(?:runs|uses|agrees|trusts|vouches|approves)\\b",
    "\\b(?:everyone|everybody|all of us) (?:here |on (?:our|the|my) team |i know |on the list |in the channel )?(?:agrees|trusts|vouches|is fine with)\\b",
    "\\bothers (?:here |on the list |in the thread |in the channel )?agree\\b", "\\b(?:all |each )?vouch(?:es|ed|ing)? for (?:this|him|her|them|the)\\b",
    "\\+1,?\\s[^.\\n]{0,50}\\b(?:safe|harmless|fine|legit)\\b",
    "\\bspeaking as (?:a|an|just a) (?:\\w+ )?(?:user|outsider|bystander|customer|third party)\\b", "\\b(?:i have no|not) affiliat(?:ion|ed) with\\b",
    "\\bas someone (?:outside|not involved in|with no ties to)\\b", "\\bpasser-?by\\b",
    "\\b(?:the (?:whole )?community|many of us|most of us) (?:already )?(?:agrees?|trusts?|supports?)\\b",
  ]],
  ["false-even-handedness", "False even-handedness", "pressure", [
    "\\b(?:credit|props|kudos) to (?:both|the \\w+|the \\w+ \\w+)\\b[^.\\n]{0,90}\\band (?:to )?the \\w+ for (?:owning|answering|addressing|fixing|being)\\b",
    "\\b(?:credit|props|kudos) to both (?:parties|sides|of you)\\b", "\\b(?:props|credit|kudos) to the (?:skeptics?|critics?|reporters?|doubters?|whistle-?blowers?) for\\b",
    "\\bfor owning it\\b", "\\b(?:each|both) sides? (?:has|have|had) (?:merit|a point|good points)\\b", "\\bboth sides (?:are|were) right\\b",
    "\\bright in (?:their|its) own way\\b", "\\bno one needs to retract\\b", "\\b(?:can|let'?s) call (?:this|it) settled\\b",
    "\\b(?:fair|good|valid) points on both sides\\b", "\\bgood faith on (?:both|all) sides\\b", "\\bcredit where (?:it'?s )?due,? to both\\b",
    "\\bboth (?:of you|parties|sides) (?:made|have|raised|did) (?:great|good|valid|fair)\\b",
  ]],
  ["burden-shifting", "Burden shifting", "pressure", [
    `${OFFERED}\\b(?:check|verify|see|look at|read|test|confirm) [^.,;\\n]{0,30}\\b${SELF}\\b`, "\\bsee for yoursel(?:f|ves)\\b",
    "\\bshow me (?:where|the line|exactly)\\b", "\\bprove (?:it|that|you|where|this|me wrong)\\b", "\\b(?:it'?s|it is) (?:your job|on you|up to you) to (?:prove|show|find)\\b",
    "\\bif you can'?t (?:show|prove|find|point)\\b", "\\bif you can'?t\\b[^.\\n]{0,15}[,.]\\s*(?:merge|approve|accept|close|ship)\\b",
    "\\bnot (?:going|gonna) to walk you through\\b", "\\bwill not discuss (?:it|this) until\\b", "\\bdo your own (?:review|homework|checking)\\b",
    "\\bthe burden (?:of proof )?is on (?:you|them|the reviewers?)\\b", "\\bunless you can (?:show|prove|point)\\b",
    "\\bif (?:it'?s|it is) (?:so|really) (?:bad|dangerous|broken|malicious)\\b",
  ]],
  ["deflection-by-label", "Deflection by label", "pressure", [
    "\\bnot the noise\\b", "\\b(?:just|only|mostly|pure|all|more) (?:fud|noise|drama|trolling|hysteria|concern trolling|politics)\\b",
    "\\bthat'?s (?:just )?(?:fud|noise|drama|trolling)\\b", "\\bignore the (?:drama|noise|haters|fud|trolls|naysayers)\\b",
    "\\b(?:objections?|complaints?|concerns?|criticism) (?:are|is) (?:just |only |mostly )?(?:noise|fud|drama|trolling)\\b",
    "\\bwon'?t dignify\\b", "\\bconcern[- ]trolling\\b",
    "\\bbikeshedd?ing\\b", "\\btin ?foil\\b", "\\bparanoi(?:a|d)\\b", "\\b(?:you'?re|they'?re|people are) (?:just )?overreacting\\b",
    "\\b(?:the usual|a few|some) (?:naysayers|haters|trolls)\\b", "\\b(?:conspiracy|scare) (?:theory|theories|mongering|tactics)\\b",
  ]],
];

export const PRESSURE_IDS = PRESSURE_TECHNIQUES.map(([id]) => id);
