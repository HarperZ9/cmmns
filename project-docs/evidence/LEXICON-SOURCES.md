# Lexicon sources

Where the non-English rhetoric word lists come from (`src/core/lexicon-{fr,es,de,pt,it}.js`), and the
English terms added for side recall.
Checked 2026-10-21. The English list cites its own sources in `lexicon.js`.

## How the lists were built

- **No list is copied from a database.** Hurtlex is CC BY-NC-SA 4.0 (not CC BY-SA), and the
  SINAI Spanish lexicons state no licence. Radar's licence is undecided, so both were used only to
  check single words: is this word recorded as a slur, and with which sense. A word in Radar's
  list is a fact about usage, typed in by hand, with no rows, ids or scores taken.
- **Slurs** are only words recorded as offensive by at least one source below and with no
  common innocent sense in any of the five languages, since every language's grammar runs on
  every reply. Left out for that reason: Italian "negro" (ordinary Spanish and Portuguese),
  Spanish "moro" and "panchito" (a demonym, a snack), Portuguese "crioulo" (a language name),
  "bicha" (a queue in Portugal), "veado" (a deer), German "Mongo" (MongoDB), Zigeuner and
  zingaro (kept as group names, where the grammar decides).
- **Group names** include the nicknames each side coins for the other (below), so "esas ratas de
  feminazis" and "esas ratas de fachas" read alike. Symmetry tests hold every list to that.
- **Dehumanising nouns, kill verbs, stereotype traits** are ordinary vocabulary translated from
  the English families and checked against Hurtlex categories AN (animals), QAS and CDS
  (derogatory words), with physical-harm verbs only: deport, expel, jail stay at zero.

## Sources

| Source | Licence | Used for |
|---|---|---|
| Bassignana, Basile, Patti, "Hurtlex: A Multilingual Lexicon of Words to Hurt", CLiC-it 2018. github.com/valeriobasile/hurtlex, lexica/{ES,DE,PT,IT}/1.2 | CC BY-NC-SA 4.0 | Word checks: ES maricón, joto (OM, conservative), mongoloide (PS); DE Neger, Nigger (PS), Schwuchtel (OM); PT viado (OM, conservative), paneleiro, mongolóide (PS); IT negro, so plural negri (PS, conservative), frocio, culattone (OM, conservative), mongoloidi (PS) |
| Plaza-del-Arco, Molina-González, Ureña-López, Martín-Valdivia, "Detecting Misogyny and Xenophobia in Spanish Tweets Using Language Technologies", ACM TOIT 20(2), 2020. github.com/fmplaza/hate-speech-spanish-lexicons | none stated; cite on use | Word checks: sudaca(s), negrata(s), moromierda in the xenophobia list; feminazi in the misogyny list |
| Duden online, entries Kanake and Kümmeltürke | reference | Both marked "diskriminierendes Schimpfwort" |
| Unwort des Jahres jury: Lügenpresse (2014), Volksverräter (2016); unwortdesjahres.net | reference | Lügenpresse as media-conspiracy framing. Volksverräter is absolutist and not yet covered |
| Universität Trier, "Umvolkung" leaflet (uni-trier.de/fileadmin/fb3/GES/IIAS/08_Umvolkung.pdf); IDZ Jena factsheet "Identitärer Neorassismus"; Friedrich-Naumann-Stiftung on "Großer Austausch" (after an Amadeu Antonio Stiftung brochure) | reference | Umvolkung, Bevölkerungsaustausch, großer Austausch, Kalergi plan as replacement conspiracy |
| Il Foglio glossary entry "zecca" (2015) and press coverage of "zecca rossa" graffiti against Teresa Bellanova | reference | Italian far-right coinage "zecche" for leftists, added as a group name and a dehumanising noun |
| Brazilian polarisation studies (UNISC Rizoma 2018 "narratives of hatred and radicalism"; Mosaico, UFMG 2025) | reference | Coined camps: petralhas, coxinhas, bolsonaristas, esquerdistas; bolsominions and mortadelas from common usage, not from a study |

## Coined political terms, by direction

| Language | Coined for the left | Coined for the right | Coined for others |
|---|---|---|---|
| Spanish | rojos, progres, perroflautas, podemitas, zurdos, kukas, chairos, feminazis | fachas, fachos, fifís, peperos, voxeros | menas (unaccompanied migrant minors) |
| German | Zecken, Gutmenschen | Nazis, AfDler | Kartoffeln (Germans), Bonzen (the rich) |
| Portuguese | petralhas, petralhada, esquerdopatas, comunas, mortadelas | bolsominions, bolsonarada, coxinhas, minions, gado | isentões (the uncommitted) |
| Italian | zecche, zecche rosse, piddini, sinistroidi, buonisti, radical chic | fasci, fasciorazzisti, destrorsi | sbirri (police) |

## English terms added for side recall (2026-10-21)

Added to close the recall gap between the two sides (`EVALUATION.md`, "Side comparison"). The
misses were read on the dev split; each term below is in the list only because a dictionary records
it as a slur or derogatory, and only after it passed the dev precision rule. The labels were read
from each Wiktionary entry's source (`action=raw`) on 2026-10-21. Wiktionary is CC BY-SA 4.0;
only the usage label is cited, no text is copied.

| Term | Label in Wiktionary | Aimed at | Dev precision, pooled |
|---|---|---|---|
| white trash | US, pejorative, ethnic slur, offensive | white people, the rural poor | 76/93 |
| trailer trash | US, slang, derogatory | white people, the rural poor | 18/29 |
| wigger, whigger | pejorative, ethnic slur | white people | 8/10 |
| mudshark ("mud shark" entry) | slang, derogatory, offensive, ethnic slur | white women with Black partners | 35/38 |
| cuck | derogatory, slang | men; coined in the alt-right | 233/259 |
| cuckservative | US politics, slang, derogatory | conservatives; coined in the alt-right | 8/8 |
| soy boy, soyboy | Internet slang, pejorative | men, often on the left | 19/20 |
| Bible thumper | pejorative | Christians | 3/5 |
| fundie | pejorative, slang | Christians | 2/5 |
| Christofascist | pejorative, political | Christians | no dev hits |
| papist | religious slur | Catholics | no dev hits |
| Christard | slang, religious slur, derogatory, offensive | Christians | no dev hits |

Group names, not slurs, from both directions: trumptards ("Trumptard": pejorative, derogatory),
trumpanzees (pejorative), rethuglicans and repugnicans (derogatory), demonrats (derogatory), next to
the existing libtards ("libtard": derogatory), magats ("MAGAt": derogatory) and conservatards. On
Civil dev, libtard sat on toxic text 4 times in 21, so the political coinages stay group names for
every side. "incels" is a self-name and is a group name too.

The grammar "<identity word> <gendered slur>" ("white bitch", "black hoes") joins two kinds of
recorded word: an identity word from the group list, and a word Wiktionary labels offensive or
derogatory when used of a person (bitch, hoe, whore, slut, cunt). The fifteen identity words are the
same in every direction. Dev precision, pooled: 84/96.

Left out, with the reason: redneck ("usually pejorative, offensive, ethnic slur") and hillbilly
("often pejorative") are also self-names and sat on toxic text 1 in 10 and 3 in 12 times on Civil
dev; they stay group names. Cracker has a food sense; it stays on the weak list. "beta male" has no
derogatory label in Wiktionary. "mud shark" with a space is also a fish (the spiny dogfish).

Background on the anti-white and anti-rural terms: Matt Wray, "Not Quite White: White Trash and the
Boundaries of Whiteness", Duke University Press, 2006 (cited from memory, not re-read for this list).

## Known gaps

- Coded terms beyond these lists: dog whistles, numbers and emoji, and new coinages. They change
  fast and need the same live-thread checks the English list gets.
- Dialects: Rioplatense, Mexican and Caribbean Spanish are partly covered by group names only;
  Austrian and Swiss German, African Portuguese and Italian regional slurs are not covered.
- Families English-only for now: motive, essentialise, vigilante, absolutist. Removal slogans
  ("Ausländer raus", "Nazis raus") are left out in every language until there is a rule for them
  that treats both directions alike.
- Hurtlex lookups covered the visible parts of each file through a web reader, not a full local
  read; a word marked "not found" there may still be present.
- None of these lists has measured precision or recall yet (EVALUATION.md).

## Arabic, Russian, Ukrainian, Chinese and Hindi (2026-10-21)

Lists: `src/core/lexicon-{ar,ru,uk,zh,hi}.js`. Same rule as above: each word is typed by hand as a
fact about usage, no rows or scores are copied, and a word is a slur only when a source below
records it as one and it has no common innocent sense in these languages. The dictionary labels
were read from each Wiktionary entry's source (`action=raw`) on 2026-10-21. Wiktionary is CC BY-SA
4.0; only the usage label is cited.

| Term | Language | Label in Wiktionary | Used as |
|---|---|---|---|
| хохлы (plural only) | ru, uk | ethnic slur, pejorative (singular also "tuft of hair") | slur |
| москаль | uk | derogatory, ethnic slur | slur |
| кацап | ru, uk | slang, pejorative, ethnic slur | slur |
| русня | ru, uk | collective, ethnic slur, offensive | slur |
| жид | ru | offensive, ethnic slur (uk: dated, potentially offensive) | slur |
| хач | ru | offensive, ethnic slur | slur |
| пидор, підар | ru, uk | vulgar, offensive | slur |
| чурка | ru | racial slur, but also "block of wood" | group name only |
| укроп | ru | ethnic slur, but also "dill" | group name only |
| ватник, рашист, либераст, бандеровец, колорад, порохобот | ru, uk | pejorative or derogatory, political | group names (coined camps) |
| орк | ru, uk | pejorative neologism for Russian soldiers | dehumanising noun and group name |
| رافضي | ar | religious slur (for Shia) | slur |
| ناصبي | ar | religious slur (for Sunnis) | slur |
| 支那 | zh | ethnic slur, derogatory, offensive | slur |
| 臺巴子 | zh | derogatory (Taiwanese) | slur |
| 黑鬼, 小日本, 白皮豬 | zh | ethnic slur | slur |
| 娘炮 | zh | derogatory, offensive | slur |
| 蝗蟲 | zh | Hong Kong slang ethnic slur, but also "locust" | dehumanising noun; "大陆蝗虫" as slur |
| 五毛, 小粉紅, 白左, 美分黨, 公知, 女拳, 直男癌, 國男, 共匪 | zh | derogatory or disparaging, political | group names (coined camps) |
| 阿三 | zh | slur by extension, also a Shanghai nickname | group name only |
| रंडी | hi | derogatory | only fused with a group ("<group> रंडी") |
| भक्त, अंधभक्त | hi | politics slang; Indian politics, derogatory | group names |
| चमार | hi | derogatory sense, but also a caste self-name | not listed as a slur |

Other sources:
- कटुआ, कटमुल्ला: Center for the Study of Organized Hate, "Decoding Hate" glossary entry
  "Katua / Katmulla / Katmulli" (csohate.org), which records them as slurs for Muslims.
- लव जिहाद and the other "X jihad" forms: documented as conspiracy narratives in press and academic
  coverage of Indian politics (for example the Wikipedia article "Love jihad conspiracy theory",
  cited for the label only). गोदी मीडिया ("lapdog media") and "presstitute" are the two camps'
  terms for distrusted media and are listed together.
- Arabic "أحفاد القردة والخنازير" (descendants of apes and pigs): an antisemitic trope documented
  by the ADL and by scholarship on antisemitic discourse; listed as a dehumanising phrase.
- "الموت لـ" ("death to"), "смерть ..." and "杀光 ..." are written as grammar over any target, so
  "الموت لأمريكا" and "الموت لإسرائيل", or "смерть ватникам" and "смерть бандеровцам", score alike.
- The war's slogan "москаляку на гілляку" ("the Moskal to the branch") is a lynching chant recorded
  in reporting on the war; the grammar "<group> на гілляку / на ножі" covers every target.
- Funding accusations ("проплачены госдепом" / "проплачены кремлем", "ممولين من قطر" / "ممولين من
  الإمارات", "拿了美国的钱" / "拿了中共的钱", "चीन के पैसे पर" / "सोरोस के पैसे पर") list paymasters from
  every direction, as the German "von Soros bezahlt" / "von Putin bezahlt" pair does.

Coined political terms, by direction:

| Language | Coined for one camp | Coined for the other | Others |
|---|---|---|---|
| Russian | ватники, путинисты, рашисты, колорады (pro-Kremlin) | либерасты, навальнисты, бандеровцы (liberal, opposition, Ukrainian) | совки, релоканты |
| Ukrainian | ватники, рашисти, ждуни, сепари | бандерівці, укропи (used by the other side) | порохоботи / зеботи (domestic camps) |
| Arabic | خرفان, إخوانجية (Brotherhood supporters) | عبيد البيادة, مطبلين (army and regime supporters) | روافض / نواصب (sects), ذباب إلكتروني |
| Chinese | 五毛, 小粉红 (pro-government) | 美分, 公知, 白左 (pro-Western, liberal) | 女拳 / 直男癌, 废青 / 黑警 |
| Hindi | भक्त, अंधभक्त, संघी, चड्डीधारी | लिबरांडू, सिकुलर, आंदोलनजीवी, अर्बन नक्सल | गद्दार, देशद्रोही |

Group names for disabled people, trans people and castes (Arabic معاقين, متحولين جنسيا; Hindi
शूद्र, विकलांग, असमिया and their Latin spellings) were added after reading misses on the
Multilingual HateCheck dev half. They belong in any group list, but see CORPORA.md on why HateCheck
test numbers move with dev tuning.

Known gaps in these five: Hindi has no motive, contempt or conspiracy grammar beyond the listed
phrases, and its Latin spelling varies far more than the list does; Chinese pinyin and homophone
spellings are not read; Arabic dialect spellings beyond Egyptian and Gulf fillers are partly covered;
Russian and Ukrainian have no essentialise grammar.
