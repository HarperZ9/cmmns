"""Flattens the corpora for the Arabic, Russian, Ukrainian, Chinese and Hindi evaluation into JSON
Lines for scripts/eval-langs.mjs. A format conversion only: every label mapping and the split live
in scripts/eval/lang-corpora.mjs. Needs pyarrow. Sources: project-docs/evidence/CORPORA.md.
Usage: python -I scripts/eval/prep-langs.py D:/radar-data
"""
import csv, json, os, sys
import pyarrow.parquet as pq


def write(path, rows):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def textdetox(root, lang):
    t = pq.read_table(os.path.join(root, "textdetox", lang + ".parquet")).to_pylist()
    for i, r in enumerate(t):
        yield {"id": str(i), "text": r["text"], "toxic": int(r["toxic"])}


def mlma_ar(root):
    p = os.path.join(root, "mlma", "hate_speech_mlma", "ar_dataset.csv")
    with open(p, encoding="utf-8", errors="replace", newline="") as f:
        for r in csv.DictReader(f):
            yield {"id": r["HITId"], "text": r["tweet"], "sentiment": r["sentiment"], "group": r["group"]}


def mhc(root, lang):
    with open(os.path.join(root, "mhc", lang + ".csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            yield {"id": r["mhc_case_id"], "text": r["test_case"], "label": r["label_gold"],
                   "functionality": r["functionality"], "target": r["target_ident"]}


def cold(root):
    with open(os.path.join(root, "cold", "test.csv"), encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            yield {"id": r[""] or r.get("\ufeff", ""), "text": r["TEXT"], "label": int(r["label"]),
                   "fine": int(r["fine-grained-label"]), "topic": r["topic"]}


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "D:/radar-data"
    out = os.path.join(root, "prepared")
    os.makedirs(out, exist_ok=True)
    jobs = [("lang-mlma-ar", lambda: mlma_ar(root)), ("lang-cold", lambda: cold(root))]
    jobs += [("lang-textdetox-" + l, (lambda l=l: textdetox(root, l))) for l in ["ar", "ru", "uk", "hi"]]
    jobs += [("lang-mhc-" + l, (lambda l=l: mhc(root, l))) for l in ["arabic", "hindi", "mandarin"]]
    for name, fn in jobs:
        write(os.path.join(out, name + ".jsonl"), fn())
        print("wrote", name)


if __name__ == "__main__":
    main()
