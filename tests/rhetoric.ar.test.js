// Arabic rhetoric markers: the same symmetry rule as English. Targets include both sides of the
// sectarian divide (روافض / نواصب) and of Egyptian politics (خرفان / عبيد البيادة). Templates use
// the article, the attached "and" and "for" forms, and spellings with and without hamza.
import { languageSuite } from "./lang-suite.js";

languageSuite({
  name: "Arabic",
  targets: ["اليهود", "المسيحيين", "المسلمين", "الشيعة", "السنيين", "الأكراد", "اللاجئين", "المهاجرين", "السوريين", "الأفارقة",
    "الإخوان", "الخرفان", "عبيد البيادة", "العلمانيين", "الإسلاميين", "الليبراليين", "الصهاينة", "الدواعش", "الحوثيين",
    "الشرطة", "النسويات", "الرجال", "النساء"],
  templates: [
    ["{G} حشرات", "dehumanise"],
    ["{G} كلهم كلاب", "dehumanise"],
    ["هؤلاء {G} ما هم الا خنازير", "dehumanise"],
    ["اقتلوا كل {G}", "violence"],
    ["يجب قتل {G}", "violence"],
    ["{G} يستحقون الموت", "violence"],
    ["{G} كلهم خونة", "stereotype"],
    ["{G} إرهابيين", "stereotype"],
    // controls
    ["{G} ليسوا حشرات", ""],
    ["أنا لا أتفق مع {G}", ""],
    ["لا تقتلوا {G}", ""],
    ["لا يجب قتل {G}", ""],
    ["{G} ليسوا خونة", ""],
  ],
  cases: [
    ["الروافض", "slur"],
    ["النواصب", "slur"],
    ["أحفاد القردة والخنازير", "dehumanise"],
    ["الموت لأمريكا", "violence"],
    ["الموت لإسرائيل", "violence"],
    ["مؤامرة كونية", "conspiracy"],
    // vowel marks and tatweel are read away
    ["اليَهُودُ خَنَازِير", "dehumanise"],
    ["الشيـــعة كلاب", "dehumanise"],
    // boundaries and innocent senses
    ["لا بد من الصبر", ""],
    ["كلاب الحراسة في المزرعة", ""],
    ["السنة الجديدة سعيدة", ""],
  ],
  policy: [
    "يجب ترحيل المخالفين حسب القانون",
    "يجب أن يدفع الأغنياء ضرائب أكثر",
    "الحكومة فاشلة",
    "نحتاج إلى شرطة أكثر",
  ],
  pairs: [
    ["ممولين من قطر", "ممولين من الإمارات", "conspiracy"],
    ["عملاء إيران", "عملاء أمريكا", "conspiracy"],
    ["الخرفان كلاب", "عبيد البيادة كلاب", "dehumanise"],
    ["الروافض", "النواصب", "slur"],
  ],
});
