// Italian rhetoric markers: the same symmetry rule as English and French.
import { languageSuite } from "./lang-suite.js";

languageSuite({
  name: "Italian",
  targets: ["immigrati", "migranti", "stranieri", "musulmani", "ebrei", "cristiani", "rom", "neri", "bianchi",
    "meridionali", "comunisti", "zecche", "piddini", "fascisti", "leghisti", "sovranisti", "ricchi", "poliziotti",
    "sbirri", "giornalisti", "femministe", "donne", "uomini"],
  templates: [
    ["i {G} sono ratti", "dehumanise"],
    ["questi {G} sono dei parassiti", "dehumanise"],
    ["quei vermi di {G}", "dehumanise"],
    ["i {G} non sono altro che vermi", "dehumanise"],
    ["bisogna sterminare tutti i {G}", "violence"],
    ["i {G} vanno fucilati", "violence"],
    ["i {G} meritano di essere impiccati", "violence"],
    ["morte ai {G}", "violence"],
    ["i {G} sono tutti criminali", "stereotype"],
    ["i {G} sono pagati da soros", "conspiracy"],
    // controls
    ["i {G} non sono ratti", ""],
    ["non sono d'accordo con i {G} sull'economia", ""],
    ["sono arrabbiato con i {G} oggi", ""],
    ["non bisogna uccidere i {G}", ""],
    ["i {G} vanno ascoltati", ""],
  ],
  cases: [
    ["è la sostituzione etnica", "conspiracy"],
    ["il piano kalergi", "conspiracy"],
    ["sporco frocio", "slur"],
    ["quei culattoni", "slur"],
    // boundaries
    ["i comunisti firmano contratti", ""],
    ["gli immigratiXYZ sono ratti", ""],
    ["gli animali feroci", ""],
    ["un negroni al bar", ""],
  ],
  policy: [
    "gli immigrati irregolari vanno espulsi secondo la legge",
    "bisogna tassare i ricchi",
    "servono più poliziotti",
    "servono meno poliziotti",
    "il governo è incompetente",
  ],
  pairs: [
    ["uccidere un fascista non è reato", "uccidere un comunista non è reato", "violence"],
    ["sono pagati da soros", "sono pagati da putin", "conspiracy"],
  ],
});
