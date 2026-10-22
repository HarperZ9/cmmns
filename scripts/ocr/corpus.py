"""Build the text the recogniser trains and tests on, from the author's own documents only.

No one else's posts are used. Sentences come from Radar's docs and lessons and the author's
workspace notes; held-out files never feed training. Writes train.txt and test.txt (one
sentence per line) into the output folder. R&D only: nothing here ships.

    python scripts/ocr/corpus.py OUT_DIR
"""
import glob, os, random, re, sys

WORKSPACE = os.environ.get("OCR_WORKSPACE", "C:/dev")   # the author's own notes, outside this repo
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TRAIN = [os.path.join(ROOT, p) for p in ["project-docs/*.md", "CHANGELOG.md", "README.md", "PRIVACY.md", "src/ext/learn/*.js"]] + [
    WORKSPACE + "/*.md", WORKSPACE + "/public/flywheel/docs/*.md"]
TEST = [WORKSPACE + p for p in ["/CREDO.md", "/MISSION.md", "/Just-Culture-and-Commons-Rule.md"]]

def clean(text):
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"[`*_#>|]+", " ", text)
    text = re.sub(r"\[nt]", " ", text)
    return text

def sentences(path):
    try:
        raw = open(path, encoding="utf-8", errors="ignore").read()
    except OSError:
        return []
    if path.endswith(".js"):
        raw = " ".join(m.group(2) for m in re.finditer(r"([\"'`])((?:(?!\1).){20,})\1", raw))
    out = []
    for s in re.split(r"(?<=[.!?])\s+|\n\s*\n", clean(raw)):
        s = re.sub(r"\s+", " ", s).strip()
        if 12 <= len(s) <= 400 and re.search(r"[a-z]{3}", s) and not re.search(r"[A-Z]:[\/]", s):
            out.append(s)
    return out

def main(out_dir):
    held = {os.path.normcase(os.path.abspath(p)) for p in TEST}
    train, test = [], []
    for pattern in TRAIN:
        for path in sorted(glob.glob(pattern)):
            if os.path.normcase(os.path.abspath(path)) not in held:
                train += sentences(path)
    for path in TEST:
        test += sentences(path)
    train = sorted(set(train) - set(test))
    random.Random(7).shuffle(train)
    os.makedirs(out_dir, exist_ok=True)
    for name, rows in [("train.txt", train), ("test.txt", sorted(set(test)))]:
        with open(os.path.join(out_dir, name), "w", encoding="utf-8") as f:
            f.write("\n".join(rows) + "\n")
    print(f"train {len(train)} sentences, test {len(set(test))}")

if __name__ == "__main__":
    main(sys.argv[1])
