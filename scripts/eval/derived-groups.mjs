// Plain names of groups, per derived language, from every direction: groups the right is often
// hostile to, groups the left is often hostile to, and groups outside the left-right axis. These
// are neutral identity words, not markers. scripts/derive-lexicon.mjs drops any candidate term that
// is, or contains, one of these names, so naming a group never counts as a sign; the symmetry suite
// (tests/rhetoric.derived.test.js) fills its templates with them. Hindi lists the Latin forms that
// Multilingual HateCheck uses for its targets as well as Devanagari.

export const GROUP_NAMES = {
  he: ["ערבים", "יהודים", "מתנחלים", "חרדים", "דתיים", "חילונים", "שמאלנים", "ימנים", "ביביסטים", "מוסלמים", "נוצרים",
    "אתיופים", "מזרחים", "אשכנזים", "פלסטינים", "מהגרים", "פמיניסטיות", "הומואים", "נשים", "גברים", "עיתונאים", "שוטרים"],
  tr: ["kürtler", "türkler", "suriyeliler", "araplar", "aleviler", "sünniler", "ermeniler", "rumlar", "ateistler",
    "muhafazakarlar", "solcular", "sağcılar", "ülkücüler", "akp'liler", "chp'liler", "hdp'liler", "feministler", "eşcinseller",
    "kadınlar", "erkekler", "gazeteciler", "polisler", "göçmenler", "mülteciler", "kürt", "türk", "suriyeli", "arap",
    "alevi", "sünni", "ermeni", "kadın", "erkek", "akp", "chp", "hdp", "mhp"],
  ko: ["중국인", "일본인", "조선족", "무슬림", "기독교인", "불교신자", "페미니스트", "남성", "여성", "노인", "청년", "동성애자",
    "장애인", "난민", "이주노동자", "신천지", "보수", "진보", "민주당", "국민의힘", "경상도", "전라도", "기자", "경찰", "흑인", "백인"],
  ja: ["在日韓国人", "中国人", "韓国人", "アメリカ人", "外国人", "移民", "難民", "ムスリム", "キリスト教徒", "創価学会", "自民党",
    "立憲民主党", "共産党", "右翼", "左翼", "リベラル", "保守派", "フェミニスト", "男性", "女性", "同性愛者", "高齢者", "記者", "警察"],
  fa: ["افغان‌ها", "عرب‌ها", "ترک‌ها", "کردها", "بلوچ‌ها", "بهایی‌ها", "مسلمانان", "یهودیان", "مسیحیان", "سنی‌ها", "شیعه‌ها",
    "اصلاح‌طلبان", "اصولگرایان", "سلطنت‌طلبان", "مجاهدین", "چپ‌ها", "زنان", "مردان", "فمینیست‌ها", "روحانیون", "خبرنگاران",
    "پلیس", "افغان", "عرب", "ترک", "کرد", "بلوچ", "بهایی", "مسلمان", "مسلمین", "یهودی", "مسیحی", "سنی", "شیعه", "زن", "مرد"],
  id: ["orang tionghoa", "orang arab", "orang jawa", "orang papua", "orang batak", "muslim", "kristen", "katolik", "hindu",
    "buddha", "ahmadiyah", "syiah", "kaum feminis", "kaum gay", "perempuan", "laki-laki", "pendukung prabowo",
    "pendukung anies", "pendukung ganjar", "pendukung jokowi", "kader pdip", "kader pks", "wartawan", "polisi", "orang",
    "prabowo", "anies", "ganjar", "jokowi", "pdip", "pks", "islam", "tionghoa", "papua", "yahudi"],
  hi: ["मुसलमान", "मुसलमानों", "मुस्लिम", "हिंदू", "हिन्दू", "हिंदुओं", "ईसाई", "सिख", "दलित", "ब्राह्मण", "बिहारी", "कश्मीरी", "भाजपाई",
    "कांग्रेसी", "वामपंथी", "महिला", "औरत", "औरतों", "पत्रकार", "पुलिस", "musalman", "musalmano", "muslim", "hindu",
    "isai", "sikh", "dalit", "brahmin", "bihari", "kashmiri", "aurat", "auratein", "aurato", "mahila", "hijra", "hijre",
    "hijro", "hijri", "kinnar", "gay", "gays", "assamese", "shudra", "shudro", "negro", "bjp", "congress", "patrakar"],
};

// Other neutral names the derivation must not turn into markers: political labels, public figures,
// places and symbols. A post that names a president or a prophet is not hostile for naming them;
// on dev these names cleared the log-odds step only because hostile posts are often about them.
// "탄핵" (impeachment) and the names of ideologies were added after reading the Korean dev list.
export const NEUTRAL_NAMES = {
  he: ["נתניהו", "ביבי", "לפיד", "בן גביר", "סמוטריץ'", "גנץ", "ישראל", "עזה", "ערבי", "יהודי"],
  tr: ["erdoğan", "kılıçdaroğlu", "bahçeli", "imamoğlu", "atatürk", "türkiye", "suriye", "afgan", "afganistan", "avrupa"],
  ko: ["좌파", "우파", "보수", "진보", "문재인", "윤석열", "이재명", "박근혜", "이명박", "노무현", "조국", "한동훈", "김정은",
    "트럼프", "자유한국당", "자한당", "더불어민주당", "북한", "한국", "일본", "중국", "미국", "태극기", "전라", "경상",
    "이슬람", "탄핵", "공산당", "공산주의"],
  ja: ["朝鮮", "朝鮮人", "北朝鮮", "韓国", "中国", "日本", "日本人", "アメリカ", "安倍", "岸田", "菅", "石破", "習近平",
    "文在寅", "大統領", "首相", "政権", "政府", "天皇"],
  fa: ["خمینی", "خامنه‌ای", "خامنه ای", "علی", "محمد", "فاطمه", "حسین", "ابوطالب", "رسول‌الله", "ایران", "اسلام", "قرآن", "امام",
    "پهلوی", "رهبر", "عمر", "ابوبکر", "عایشه"],
  id: ["ahok", "jokowi", "prabowo", "anies", "ganjar", "rizieq", "habib", "megawati", "gibran", "indonesia", "jakarta",
    "israel", "palestina", "gaza", "allah", "nabi"],
  hi: ["मोदी", "राहुल", "गांधी", "भारत", "पाकिस्तान", "modi", "rahul", "gandhi", "bharat", "pakistan", "india"],
};
