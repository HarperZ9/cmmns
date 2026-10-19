// Main languages per country, to decide whether "written in X" is worth a chip. A French reply
// from an account based in France says nothing new; a Russian reply from an account based in
// France might. Only widely spoken national and official languages are listed. A language or
// country missing here keeps the chip, so gaps add noise, never hide anything.

const SPOKEN = {
  French: "France Belgium Switzerland Canada Luxembourg Monaco Senegal Ivory Coast Côte d'Ivoire Cameroon Mali Burkina Faso Niger Guinea Benin Togo Gabon Congo Democratic Republic of the Congo Madagascar Haiti Tunisia Algeria Morocco Lebanon Chad Rwanda Burundi Djibouti",
  English: "United States United Kingdom Ireland Canada Australia New Zealand India Pakistan Nigeria Kenya Ghana South Africa Singapore Philippines Malta Jamaica Uganda Zambia Zimbabwe",
  German: "Germany Austria Switzerland Luxembourg Liechtenstein Belgium",
  Spanish: "Spain Mexico Argentina Colombia Chile Peru Venezuela Ecuador Bolivia Uruguay Paraguay Cuba Dominican Republic Guatemala Honduras El Salvador Nicaragua Costa Rica Panama Puerto Rico United States Equatorial Guinea",
  Portuguese: "Portugal Brazil Angola Mozambique Cape Verde Guinea-Bissau",
  Italian: "Italy Switzerland San Marino",
  Dutch: "Netherlands Belgium Suriname",
  Arabic: "Saudi Arabia Egypt United Arab Emirates Qatar Kuwait Bahrain Oman Yemen Iraq Syria Jordan Lebanon Palestine Libya Tunisia Algeria Morocco Sudan Mauritania Israel",
  Russian: "Russia Belarus Kazakhstan Kyrgyzstan Ukraine Moldova Latvia Estonia",
  Ukrainian: "Ukraine", Polish: "Poland", Czech: "Czechia Czech Republic", Slovak: "Slovakia", Hungarian: "Hungary Romania Slovakia",
  Romanian: "Romania Moldova", Bulgarian: "Bulgaria", Greek: "Greece Cyprus", Turkish: "Turkey Türkiye Cyprus",
  Swedish: "Sweden Finland", Norwegian: "Norway", Danish: "Denmark", Finnish: "Finland", Icelandic: "Iceland",
  Lithuanian: "Lithuania", Latvian: "Latvia", Estonian: "Estonia", Serbian: "Serbia Bosnia and Herzegovina Montenegro", Croatian: "Croatia Bosnia and Herzegovina",
  Slovenian: "Slovenia", Albanian: "Albania Kosovo North Macedonia", Hebrew: "Israel", Persian: "Iran Afghanistan", Urdu: "Pakistan India",
  Hindi: "India", Bengali: "Bangladesh India", Japanese: "Japan", Korean: "South Korea North Korea", Chinese: "China Taiwan Hong Kong Singapore Macau",
  Thai: "Thailand", Vietnamese: "Vietnam", Indonesian: "Indonesia", Malay: "Malaysia Brunei Singapore", Tagalog: "Philippines", Filipino: "Philippines",
  Catalan: "Spain Andorra", Basque: "Spain", Welsh: "United Kingdom", Irish: "Ireland", Armenian: "Armenia", Georgian: "Georgia", Azerbaijani: "Azerbaijan",
};

const MAP = new Map(Object.entries(SPOKEN).map(([lang, list]) => [lang.toLowerCase(), list.toLowerCase()]));

// True when `language` is a main language of `country`; null when either is unknown.
export function languageFits(language, country) {
  const list = MAP.get(String(language || "").trim().toLowerCase());
  const c = String(country || "").trim().toLowerCase();
  if (!list || !c) return null;
  return (" " + list + " ").includes(" " + c + " ");
}
