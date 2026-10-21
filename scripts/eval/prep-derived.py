"""Flattens the corpora behind the derived word lists (Hebrew, Turkish, Korean, Japanese, Persian,
Indonesian and Hindi) into JSON Lines for scripts/derive-lexicon.mjs and scripts/eval-derived.mjs.
A format conversion only: every label mapping and the split live in scripts/eval/derived-corpora.mjs.
Needs pyarrow and openpyxl. Sources: project-docs/evidence/CORPORA.md.
Usage: python -I scripts/eval/prep-derived.py D:/radar-data
"""
import csv, glob, json, os, sys
import openpyxl
import pyarrow.parquet as pq


def write(path, rows):
    n = 0
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        for r in rows:
            if r["text"] and str(r["text"]).strip():
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
                n += 1
    return n


def xlsx(path):
    ws = openpyxl.load_workbook(path, read_only=True).active
    rows = ws.iter_rows(values_only=True)
    next(rows)
    return rows


def olah(root):
    for r in xlsx(os.path.join(root, "olah", "OLaH-dataset-filtered.xlsx")):
        if r[0] is not None and r[2] is not None:
            yield {"id": str(r[0]), "text": str(r[1] or ""), "offensive": int(r[2])}


def offenseval_tr(root):
    base = os.path.join(root, "offenseval-tr", "offenseval2020-turkish")
    # No quoting in these files: split each line at tabs (README.txt).
    with open(os.path.join(base, "offenseval-tr-training-v1", "offenseval-tr-training-v1.tsv"), encoding="utf-8") as f:
        next(f)
        for line in f:
            p = line.rstrip("\n").split("\t")
            if len(p) == 3:
                yield {"id": "train-" + p[0], "text": p[1], "off": p[2] == "OFF"}
    gold = {}
    with open(os.path.join(base, "offenseval-tr-testset-v1", "offenseval-tr-labela-v1.tsv"), encoding="utf-8") as f:
        for line in f:
            i, lab = line.strip().split(",")
            gold[i] = lab
    with open(os.path.join(base, "offenseval-tr-testset-v1", "offenseval-tr-testset-v1.tsv"), encoding="utf-8") as f:
        next(f)
        for line in f:
            p = line.rstrip("\n").split("\t")
            if len(p) == 2 and p[0] in gold:
                yield {"id": "test-" + p[0], "text": p[1], "off": gold[p[0]] == "OFF"}


def hatemap_tr(root):
    for path in sorted(glob.glob(os.path.join(root, "turkishhatemap", "*", "*.jsonl"))):
        topic = os.path.basename(os.path.dirname(path))
        part = os.path.splitext(os.path.basename(path))[0]
        with open(path, encoding="utf-8") as f:
            for i, line in enumerate(f):
                r = json.loads(line)
                yield {"id": f"{topic}-{part}-{i}", "text": r["text"], "label": int(r["label"]), "topic": topic,
                       "title": r.get("baslik", "")}


def kmhas(root):
    for part in ["train", "valid", "test"]:
        with open(os.path.join(root, "kmhas", f"kmhas_{part}.txt"), encoding="utf-8") as f:
            next(f)
            for i, line in enumerate(f):
                text, _, labels = line.rstrip("\n").rpartition("\t")
                yield {"id": f"{part}-{i}", "text": text.strip('"'), "labels": [int(x) for x in labels.split(",")]}


def beep(root):
    # The test part on the mirror has no labels, so only train and valid are used.
    for part in ["train", "valid"]:
        for i, r in enumerate(pq.read_table(os.path.join(root, "beep", part + ".parquet")).to_pylist()):
            yield {"id": f"{part}-{i}", "text": r["comments"], "hate": r["hate"], "bias": r["bias"]}


def llmjp(root):
    with open(os.path.join(root, "llmjp", "toxicity_dataset_v2.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            yield {k: r[k] for k in ["id", "text", "label", "discriminatory", "violent", "obscene"]}


def inspection_ja(root):
    with open(os.path.join(root, "inspection-ja", "subset.csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            yield {"id": r["id"], "text": r["text"], "not": int(r["Not Toxic"]), "hard": int(r["Hard to Say"]),
                   "toxic": int(r["Toxic"]), "very": int(r["Very Toxic"]), "discrimination": int(r["category_差別"]),
                   "annotators": int(r["annotation_num"])}


def persian_off(root):
    for part in ["train", "test"]:
        for i, r in enumerate(xlsx(os.path.join(root, "persian-off", f"persian_{part}.xlsx"))):
            if r[1] is not None and r[2] is not None:
                yield {"id": f"{part}-{r[0] if r[0] is not None else i}", "text": str(r[1]), "cls": str(r[2]).strip()}


def indodiscourse(root):
    with open(os.path.join(root, "indodiscourse", "indotoxic2024_annotated_data_v2_final.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            yield {"id": r["text_id"], "text": r["text"], "toxicity": r["toxicity"], "identity": r["identity_attack"],
                   "threat": r["threat_incitement_to_violence"], "spam": r["is_noise_or_spam_text"]}


def idhsd(root):
    # Old Mac line endings and a Latin-1 export.
    raw = open(os.path.join(root, "idhsd", "IDHSD_RIO_unbalanced_713_2017.txt"), "rb").read().decode("latin-1")
    for i, line in enumerate(raw.replace("\r\n", "\n").replace("\r", "\n").split("\n")[1:]):
        lab, _, text = line.partition("\t")
        if lab in ("HS", "Non_HS"):
            yield {"id": str(i), "text": text, "hs": lab == "HS"}


def nsmc(root):
    # Naver movie reviews: a general Korean reference text. The sentiment label is not used.
    with open(os.path.join(root, "nsmc", "ratings.txt"), encoding="utf-8") as f:
        next(f)
        for line in f:
            p = line.rstrip("\n").split("\t")
            if len(p) == 3:
                yield {"id": p[0], "text": p[1]}


JOBS = {"olah": olah, "offenseval-tr": offenseval_tr, "hatemap-tr": hatemap_tr, "kmhas": kmhas, "beep": beep,
        "llmjp": llmjp, "inspection-ja": inspection_ja, "persian-off": persian_off, "indodiscourse": indodiscourse,
        "idhsd": idhsd, "nsmc": nsmc}


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "D:/radar-data"
    out = os.path.join(root, "prepared")
    os.makedirs(out, exist_ok=True)
    for name, fn in JOBS.items():
        print("wrote", name, write(os.path.join(out, f"derive-{name}.jsonl"), fn(root)))


if __name__ == "__main__":
    main()
