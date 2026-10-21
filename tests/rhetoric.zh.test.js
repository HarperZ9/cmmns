// Chinese rhetoric markers: the same symmetry rule as English. Targets include both sides of the
// strait, of Hong Kong (废青 / 黑警), of the online camps (五毛 / 美分, 小粉红 / 公知) and of the
// gender quarrel (女拳 / 直男癌).
import { languageSuite } from "./lang-suite.js";

languageSuite({
  name: "Chinese",
  targets: ["犹太人", "穆斯林", "黑人", "白人", "日本人", "美国人", "河南人", "上海人", "台湾人", "大陆人", "香港人", "台独", "废青",
    "黑警", "五毛", "美分", "小粉红", "公知", "白左", "共产党", "国民党", "女拳", "直男癌", "女人", "男人", "同性恋"],
  templates: [
    ["{G}都是蟑螂", "dehumanise"],
    ["这些{G}就是一群畜生", "dehumanise"],
    ["{G}根本不是人", "dehumanise"],
    ["杀光{G}", "violence"],
    ["应该把{G}都杀了", "violence"],
    ["{G}都该死", "violence"],
    ["{G}都是骗子", "stereotype"],
    ["{G}素质真低", "stereotype"],
    // controls
    ["{G}不是蟑螂", ""],
    ["我不同意{G}的看法", ""],
    ["不应该杀光{G}", ""],
    ["今天我对{G}很生气", ""],
    ["{G}不是骗子", ""],
  ],
  cases: [
    ["支那", "slur"],
    ["台巴子", "slur"],
    ["黑鬼", "slur"],
    ["境外势力又来了", "conspiracy"],
    // traditional characters
    ["台灣人都是蟑螂", "dehumanise"],
    ["殺光日本人", "violence"],
    // everyday compounds
    ["上海人垃圾分类做得好", ""],
    ["我爱吃猪肉", ""],
    ["买了狗粮", ""],
    ["黑人脏辫很好看", ""],
    ["台湾人懒得理你", ""],
  ],
  policy: [
    "非法移民应该依法遣返",
    "富人应该多交税",
    "政府太无能了",
    "我们需要更多警察",
  ],
  pairs: [
    ["拿了美国的钱", "拿了中共的钱", "conspiracy"],
    ["五毛都是狗", "美分都是狗", "dehumanise"],
    ["支那", "台巴子", "slur"],
    ["女拳都是畜生", "直男癌都是畜生", "dehumanise"],
  ],
});
