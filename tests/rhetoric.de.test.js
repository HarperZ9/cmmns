// German rhetoric markers: the same symmetry rule as English and French. German nouns take an
// -n in the dative plural ("Tod den Ausländern"), so targets are written in the nominative.
import { languageSuite } from "./lang-suite.js";

languageSuite({
  name: "German",
  targets: ["Ausländer", "Flüchtlinge", "Muslime", "Juden", "Christen", "Türken", "Schwarze", "Weiße", "Deutsche",
    "Linke", "Kommunisten", "Grüne", "Rechte", "Nazis", "AfDler", "Reiche", "Milliardäre", "Polizisten", "Bullen",
    "Journalisten", "Feministinnen", "Männer", "Frauen"],
  templates: [
    ["die {G} sind Ratten", "dehumanise"],
    ["diese {G} sind doch alle Ungeziefer", "dehumanise"],
    ["{G} sind nichts als Parasiten", "dehumanise"],
    ["man sollte alle {G} erschießen", "violence"],
    ["die {G} gehören alle erschossen", "violence"],
    ["{G} gehören an die Wand gestellt", "violence"],
    ["die {G} sollten vergast werden", "violence"],
    ["Tod den {G}", "violence"],
    ["die {G} sind alle kriminell", "stereotype"],
    ["{G} sind Verbrecher", "stereotype"],
    ["die {G} sind von Soros bezahlt", "conspiracy"],
    // controls
    ["die {G} sind keine Ratten", ""],
    ["ich bin mit den {G} nicht einverstanden", ""],
    ["ich bin heute wütend auf die {G}", ""],
    ["man sollte die {G} nicht erschießen", ""],
    ["{G} sind nicht kriminell", ""],
  ],
  cases: [
    ["das ist die Umvolkung", "conspiracy"],
    ["Tod den Ausländern", "violence"],
    ["Tod den Linken und den Rechten", "violence"],
    ["Lügenpresse halt", "conspiracy"],
    ["der große Austausch läuft", "conspiracy"],
    ["dieses Asylantenpack", "dehumanise"],
    ["dieses Nazipack", "dehumanise"],
    ["diese Bullenschweine", "dehumanise"],
    ["scheiß Kanaken", "slur"],
    ["du Schwuchtel", "slur"],
    ["die Kümmeltürken wieder", "slur"],
    // boundaries
    ["die Weißen sind Ratten", "dehumanise"],
    ["die Türkenschanze ist ein Park", ""],
    ["die Journalisten sind Parasitenforscher", ""],
    ["das Paket ist da", ""],
    ["ich trinke Kümmel", ""],
  ],
  policy: [
    "abgelehnte Asylbewerber sollten nach dem Gesetz abgeschoben werden",
    "die Reichen sollten höhere Steuern zahlen",
    "wir brauchen mehr Polizei",
    "wir brauchen weniger Polizei",
    "die Regierung ist unfähig",
  ],
  pairs: [
    ["Juda verrecke", "Deutschland verrecke", "violence"],
    ["linkes Pack", "rechtes Pack", "dehumanise"],
    ["alle von Soros bezahlt", "alle von Putin bezahlt", "conspiracy"],
  ],
});
