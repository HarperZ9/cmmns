"""Line texts for training and test images: sentences, interface strings, words and random
characters. R&D only."""
import random, string

ASCII = "".join(chr(i) for i in range(32, 127))
EXTRA = "\u2026\u2022\u00b7\u20ac\u00a3\u00b0"
CHARSET = ASCII + EXTRA
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
SYL = "ka ri mo len sa to vi na el ar jo ben tam ra li co de han mi ro su ty ver al ex on".split()

def name(r):
    return " ".join("".join(r.choice(SYL) for _ in range(r.randint(1, 3))).capitalize() for _ in range(r.randint(1, 2)))

def handle(r):
    base = "".join(r.choice(SYL) for _ in range(r.randint(1, 3)))
    return "@" + base + (str(r.randint(1, 9999)) if r.random() < 0.5 else "") + ("_" + r.choice(SYL) if r.random() < 0.3 else "")

def count(r):
    n = r.choice([r.randint(1, 999), r.randint(1000, 999999)])
    return f"{n / 1000:.1f}K" if n >= 1000 and r.random() < 0.6 else (f"{n:,}" if r.random() < 0.5 else str(n))

def ui(r):
    t = f"{r.randint(1, 12)}:{r.randint(0, 59):02d} {r.choice(['AM', 'PM'])}"
    d = f"{r.choice(MONTHS)} {r.randint(1, 31)}, {r.randint(2008, 2026)}"
    picks = [
        lambda: f"{name(r)} {handle(r)} \u00b7 {r.randint(1, 59)}{r.choice('smhd')}",
        lambda: f"{t} \u00b7 {d} \u00b7 {count(r)} Views",
        lambda: f"Replying to {handle(r)}" + (f" and {handle(r)}" if r.random() < 0.3 else ""),
        lambda: f"{count(r)} Reposts {count(r)} Quotes {count(r)} Likes",
        lambda: f"https://{''.join(r.choice(SYL) for _ in range(2))}.{r.choice(['com', 'org', 'net', 'co.uk', 'news'])}/{r.randint(2019, 2026)}/{r.randint(1, 12):02d}/{'-'.join(r.choice(SYL) for _ in range(3))}",
        lambda: " ".join("#" + "".join(r.choice(SYL) for _ in range(2)).capitalize() for _ in range(r.randint(1, 3))),
        lambda: f"{r.choice(['\u20ac', '\u00a3', '$'])}{r.randint(1, 999)}.{r.randint(0, 99):02d} {r.choice(['off', 'today', 'per month', ''])}",
        lambda: f"{r.randint(-20, 45)}\u00b0{r.choice('CF')} \u2022 {name(r)}",
        lambda: f"{d} \u2022 {r.randint(1, 30)} min read",
        lambda: f"Show {r.randint(2, 99)} more replies",
        lambda: f"({r.randint(100, 999)}) {r.randint(100, 999)}-{r.randint(1000, 9999)} ext. {r.randint(1, 99)}",
    ]
    return r.choice(picks)()

def noise(r):
    pool = string.ascii_letters + string.digits + string.punctuation + EXTRA
    return "".join(r.choice(pool) if r.random() > 0.15 else " " for _ in range(r.randint(3, 30))).strip() or "x"

class Texts:
    def __init__(self, path, seed):
        self.r = random.Random(seed)
        self.lines = [l.strip() for l in open(path, encoding="utf-8") if l.strip()]
        self.words = sorted({w for l in self.lines for w in l.split() if w.isalpha()})

    def sentence(self, max_words):
        words = self.r.choice(self.lines).split()
        n = self.r.randint(1, min(max_words, len(words)))
        s = self.r.randint(0, len(words) - n)
        return " ".join(words[s:s + n])

    def sample(self, max_words=12):
        r, k = self.r, self.r.random()
        if k < 0.55: t = self.sentence(max_words)
        elif k < 0.72: t = ui(r)
        elif k < 0.87: t = " ".join(r.choice(self.words) for _ in range(r.randint(1, max_words // 2 + 1)))
        else: t = noise(r)
        c = r.random()
        if c < 0.08: t = t.upper()
        elif c < 0.13: t = t.title()
        return "".join(ch for ch in t if ch in CHARSET).strip() or "a"
