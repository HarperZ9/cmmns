// Spanish rhetoric markers: the same symmetry rule as English and French.
import { languageSuite } from "./lang-suite.js";

languageSuite({
  name: "Spanish",
  // origin and faith, the left, the right, class and role, identity; Spain and Latin America
  targets: ["inmigrantes", "musulmanes", "judíos", "cristianos", "gitanos", "negros", "blancos", "árabes", "españoles",
    "rojos", "progres", "comunistas", "zurdos", "fachas", "fifís", "conservadores", "ricos", "policías", "periodistas",
    "manifestantes", "feministas", "hombres", "mujeres"],
  templates: [
    ["los {G} son ratas", "dehumanise"],
    ["esos {G} son una plaga", "dehumanise"],
    ["esas ratas de {G}", "dehumanise"],
    ["los {G} no son más que parásitos", "dehumanise"],
    ["hay que matar a todos los {G}", "violence"],
    ["los {G} merecen ser fusilados", "violence"],
    ["{G} al paredón", "violence"],
    ["muerte a los {G}", "violence"],
    ["los {G} son todos unos criminales", "stereotype"],
    ["los {G} están pagados por soros", "conspiracy"],
    // controls: negation, disagreement, anger
    ["los {G} no son ratas", ""],
    ["no estoy de acuerdo con los {G} en economía", ""],
    ["estoy enfadado con los {G} hoy, esta ley es un desastre", ""],
    ["no hay que matar a los {G}", ""],
    ["los {G} no son criminales", ""],
  ],
  cases: [
    ["esto es el gran reemplazo", "conspiracy"],
    ["la plandemia y el nuevo orden mundial", "conspiracy"],
    ["sudaca de mierda", "slur"],
    ["menudo maricón", "slur"],
    ["negratas por todas partes", "slur"],
    // boundaries: accented first letters match, longer words do not
    ["los árabesXYZ son ratas", ""],
    ["los periodistas son piratas", ""],
    ["los demócratas votan hoy", ""],
    ["el negro es mi color favorito", ""],
    ["las sudaderas están rebajadas", ""],
  ],
  policy: [
    "hay que deportar a los inmigrantes ilegales según la ley",
    "hay que subir los impuestos a los ricos",
    "necesitamos más policías en las calles",
    "necesitamos menos policías y más servicios sociales",
    "el gobierno es un desastre",
    "los políticos corruptos deben ir a la cárcel",
  ],
  pairs: [
    ["rojos al paredón", "fachas al paredón", "violence"],
    ["están pagados por soros", "están pagados por putin", "conspiracy"],
    ["esas ratas de feminazis", "esas ratas de fachas", "dehumanise"],
  ],
});
