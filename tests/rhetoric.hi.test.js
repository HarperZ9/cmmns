// Hindi rhetoric markers: the same symmetry rule as English, in Devanagari and in the Latin
// spelling. Targets include the names each camp coins for the other (संघी / लिबरांडू, भक्त / सिकुलर),
// each in the direct and the oblique plural.
import { languageSuite } from "./lang-suite.js";

languageSuite({
  name: "Hindi",
  targets: [["मुसलमान", "मुसलमानों"], ["हिंदू", "हिंदुओं"], ["ईसाई", "ईसाइयों"], ["सिख", "सिखों"], ["दलित", "दलितों"],
    ["ब्राह्मण", "ब्राह्मणों"], ["बिहारी", "बिहारियों"], ["कश्मीरी", "कश्मीरियों"], ["संघी", "संघियों"], ["भक्त", "भक्तों"],
    ["लिबरांडू", "लिबरांडुओं"], ["सिकुलर", "सिकुलरों"], ["कांग्रेसी", "कांग्रेसियों"], ["भाजपाई", "भाजपाइयों"],
    ["वामपंथी", "वामपंथियों"], ["अमीर", "अमीरों"], ["पत्रकार", "पत्रकारों"], ["मर्द", "मर्दों"], ["नारीवादी", "नारीवादियों"]],
  templates: [
    ["{G} कीड़े हैं", "dehumanise"],
    ["ये {G} सब दीमक हैं", "dehumanise"],
    ["{G1} को गोली मार दो", "violence"],
    ["सारे {G1} को जला दो", "violence"],
    ["{G} सब गद्दार हैं", "stereotype"],
    // controls
    ["{G} कीड़े नहीं हैं", ""],
    ["मैं {G1} से सहमत नहीं हूं", ""],
    ["{G1} को मत मारो", ""],
    ["{G} आतंकवादी गिरफ्तार", ""],
    ["{G} गद्दार नहीं हैं", ""],
  ],
  cases: [
    ["musalman keede hain", "dehumanise"],
    ["sanghi sab keede hain", "dehumanise"],
    ["sanghiyon ko goli maar do", "violence"],
    ["librandu sab gaddar hain", "stereotype"],
    ["musalmano ko mat maaro", ""],
    ["कटुआ", "slur"],
    ["katua", "slur"],
    ["लव जिहाद है ये", "conspiracy"],
    ["गोली मारो सालों को", "violence"],
    // nukta typed as two code points
    ["मुसलमान कीड़े हैं", "dehumanise"],
    // boundaries
    ["पुलिस कुत्ते खोज रहे हैं", ""],
    ["मुझे चीनी चाहिए", ""],
  ],
  policy: [
    "अवैध घुसपैठियों को कानून के अनुसार वापस भेजना चाहिए",
    "अमीरों को ज़्यादा टैक्स देना चाहिए",
    "सरकार नाकाम है",
    "हमें और पुलिस चाहिए",
  ],
  pairs: [
    ["गोदी मीडिया", "प्रेस्टीट्यूट", "conspiracy"],
    ["चीन के पैसे पर पलने वाले", "सोरोस के पैसे पर पलने वाले", "conspiracy"],
    ["संघी सब कीड़े हैं", "लिबरांडू सब कीड़े हैं", "dehumanise"],
    ["भक्त सब गद्दार हैं", "सिकुलर सब गद्दार हैं", "stereotype"],
  ],
});
