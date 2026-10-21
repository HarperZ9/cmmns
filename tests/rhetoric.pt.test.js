// Portuguese rhetoric markers (Brazil and Portugal): the same symmetry rule as English and French.
import { languageSuite } from "./lang-suite.js";

languageSuite({
  name: "Portuguese",
  targets: ["imigrantes", "muçulmanos", "judeus", "cristãos", "evangélicos", "ciganos", "negros", "brancos", "nordestinos",
    "comunistas", "petistas", "petralhas", "esquerdistas", "bolsonaristas", "bolsominions", "fascistas", "ricos",
    "policiais", "jornalistas", "manifestantes", "feministas", "mulheres", "homens"],
  templates: [
    ["os {G} são ratos", "dehumanise"],
    ["esses {G} são uma praga", "dehumanise"],
    ["os {G} não passam de parasitas", "dehumanise"],
    ["esses {G} é tudo verme", "dehumanise"],
    ["temos que matar todos os {G}", "violence"],
    ["vamos fuzilar os {G}", "violence"],
    ["os {G} merecem ser fuzilados", "violence"],
    ["morte aos {G}", "violence"],
    ["os {G} são todos criminosos", "stereotype"],
    ["os {G} são pagos pelo soros", "conspiracy"],
    // controls
    ["os {G} não são ratos", ""],
    ["discordo dos {G} sobre a economia", ""],
    ["estou com raiva dos {G} hoje", ""],
    ["não temos que matar os {G}", ""],
    ["os {G} não são criminosos", ""],
  ],
  cases: [
    ["é a grande substituição", "conspiracy"],
    ["isso é marxismo cultural", "conspiracy"],
    ["bandido bom é bandido morto", "violence"],
    ["seu viado", "slur"],
    ["um paneleiro qualquer", "slur"],
    // boundaries
    ["os árabesXYZ são ratos", ""],
    ["os livros dos comunistas são baratos", ""],
    ["vi um veado na floresta", ""],
  ],
  policy: [
    "imigrantes ilegais devem ser deportados conforme a lei",
    "taxar os ricos e financiar as escolas",
    "precisamos de mais polícia",
    "precisamos de menos polícia",
    "o governo é incompetente",
  ],
  pairs: [
    ["vamos fuzilar a petralhada", "vamos fuzilar os bolsominions", "violence"],
    ["são pagos pelo soros", "são pagos pelo putin", "conspiracy"],
  ],
});
