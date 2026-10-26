// Connectives by logical role, for the argument lens (src/core/discourse/argument.js). Seeded from the
// reference library's study of Aliocha's reading method (2026-10-25) and the grammar of each language.
// Each form lists every role it can take; the lens picks one by position. "clauseStart" forms count only
// at the start of a sentence or after a comma, colon or semicolon, because elsewhere they are something
// else (Portuguese "se" is mostly a pronoun; English "as" and "for" mostly are not connectives).
// Roles: conclusion, continuation, reversal, concession, cause, condition, minor, example.

const L = (spec) => Object.entries(spec).flatMap(([roles, forms]) => forms.split("|").map((f) => ({ form: f, roles: roles.split(",") })));

export const CUES = {
  en: L({
    "conclusion": "therefore|thus|hence|consequently|it follows that|so it follows|accordingly|which means|that means|this means|would mean|proves that",
    "continuation": "moreover|furthermore|in addition|besides|further",
    "reversal": "however|nevertheless|nonetheless|on the contrary|on the other hand|on the other side",
    "reversal,minor": "but|yet",
    "minor,continuation": "now",
    "concession": "although|though|even if|even though|granted that",
    "cause": "because|given that|in that",
    "cause,continuation": "since",
    "condition": "if|unless|provided that",
    "example": "for example|for instance",
    "conclusion,continuation": "so",
  }),
  pt: L({
    "conclusion": "portanto|logo|por conseguinte|por isso|consequentemente|dessa forma|desse modo|segue-se que",
    "conclusion,example": "assim",
    "conclusion,condition": "então",
    "continuation": "além disso|ademais|outrossim|em seguida",
    "reversal": "porém|contudo|todavia|entretanto|no entanto|ao contrário",
    "reversal,minor": "mas",
    "minor": "ora",
    "concession": "embora|ainda que|mesmo que|apesar de|conquanto",
    "cause": "porque|visto que|já que|uma vez que|dado que",
    "cause,conclusion": "pois",
    "condition": "se|caso|desde que",
    "example": "por exemplo",
  }),
  es: L({
    "conclusion": "por lo tanto|por tanto|así pues|por consiguiente|en consecuencia|de modo que",
    "conclusion,continuation": "luego",
    "continuation": "además|asimismo|por otra parte",
    "reversal": "sin embargo|no obstante|en cambio|por el contrario",
    "reversal,minor": "pero",
    "minor": "ahora bien",
    "concession": "aunque|a pesar de|si bien|aun cuando",
    "cause": "porque|ya que|puesto que|dado que",
    "cause,conclusion": "pues",
    "condition": "si|siempre que|a menos que",
    "example": "por ejemplo",
  }),
  fr: L({
    "conclusion": "donc|par conséquent|en conséquence|il s'ensuit que|c'est pourquoi",
    "conclusion,example": "ainsi",
    "continuation": "de plus|en outre|par ailleurs",
    "reversal": "cependant|pourtant|toutefois|néanmoins|au contraire",
    "reversal,minor": "mais",
    "minor,reversal": "or",
    "concession": "bien que|quoique|même si|encore que",
    "cause": "parce que|car|puisque|étant donné que",
    "condition": "si|à condition que|à moins que",
    "example": "par exemple",
  }),
  la: L({
    "conclusion": "ergo|igitur|itaque|ideo|relinquitur quod|sequitur quod|videtur quod",
    "conclusion,cause": "unde",
    "continuation": "praeterea|item|insuper",
    "reversal": "tamen|verum|sed contra",
    "minor,reversal": "sed|atqui",
    "minor,continuation,reversal": "autem",
    "concession": "licet|quamvis|etsi|quamquam",
    "cause": "quia|nam|enim|quoniam",
    "cause,concession": "cum",
    "condition": "si|nisi|dummodo",
    "example": "sicut|ut dicit|ut patet",
  }),
};

// Forms that count only at a clause start (see above), per language.
export const CLAUSE_START = { en: new Set(["so", "now", "yet", "since", "if"]), pt: new Set(["se", "caso", "assim", "então", "ora", "logo"]), es: new Set(["si", "luego", "pues"]), fr: new Set(["or", "si", "ainsi"]), la: new Set(["si", "cum", "item"]) };

// Postpositive Latin particles sit second in their clause ("finiti autem", "Deum enim"); they open the
// clause they sit in.
export const POSTPOSITIVE = { la: new Set(["autem", "enim", "vero", "igitur", "tamen"]) };

export const LANGS = Object.keys(CUES);
