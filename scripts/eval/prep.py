"""Flattens the downloaded corpora into JSON Lines for scripts/eval.mjs.

This is a format conversion only: every label mapping, aggregation and split lives in
scripts/eval/corpora.mjs so the decisions sit in one place. Needs pyarrow (parquet reader).
Usage: python -I scripts/eval/prep.py D:/radar-data
"""
import csv, json, os, sys
import pyarrow.parquet as pq

MHS_ITEMS = ["sentiment", "respect", "insult", "humiliate", "status", "dehumanize", "violence",
             "genocide", "attack_defend", "hatespeech", "hate_speech_score"]


def write(path, rows):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def mhs(root):
    t = pq.read_table(os.path.join(root, "mhs", "measuring-hate-speech.parquet")).to_pylist()
    for r in t:
        targets = [k[len("target_"):] for k, v in r.items()
                   if k.startswith("target_") and k.count("_") >= 2 and v]
        yield {"id": str(r["comment_id"]), "text": r["text"], "targets": targets,
               **{k: r[k] for k in MHS_ITEMS}}


def hatexplain(root):
    with open(os.path.join(root, "hatexplain", "dataset.json"), encoding="utf-8") as f:
        d = json.load(f)
    for pid, v in d.items():
        yield {"id": pid, "text": " ".join(v["post_tokens"]),
               "labels": [a["label"] for a in v["annotators"]],
               "targets": [a["target"] for a in v["annotators"]]}


def civil(root):
    t = pq.read_table(os.path.join(root, "civil", "test.parquet")).to_pylist()
    for i, r in enumerate(t):
        yield {"id": str(i), **r}


def mlma(root):
    p = os.path.join(root, "mlma", "hate_speech_mlma", "fr_dataset.csv")
    with open(p, encoding="utf-8", errors="replace", newline="") as f:
        for r in csv.DictReader(f):
            yield {"id": r["HITId"], "text": r["tweet"], "sentiment": r["sentiment"],
                   "directness": r["directness"], "target": r["target"], "group": r["group"]}


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "D:/radar-data"
    out = os.path.join(root, "prepared")
    os.makedirs(out, exist_ok=True)
    for name, fn in [("mhs", mhs), ("hatexplain", hatexplain), ("civil", civil), ("mlma-fr", mlma)]:
        write(os.path.join(out, name + ".jsonl"), fn(root))
        print("wrote", name)


if __name__ == "__main__":
    main()
