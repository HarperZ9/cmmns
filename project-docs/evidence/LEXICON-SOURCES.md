# Lexicon sources

Where the non-English rhetoric word lists come from (`src/core/lexicon-{fr,es,de,pt,it}.js`).
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
