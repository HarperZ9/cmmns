"""Prepare the PHEME thread corpus (Zubiaga et al.; CC BY 4.0) for the organic baselines.

Reads PHEME_veracity.tar.bz2 (a gzip tar despite its name) without unpacking it and writes
prepared/pheme-threads.jsonl beside it: one ordinary Twitter thread per line, with the source
post's time and author id and each reaction's author id, time and text. Nothing from this file is
committed; scripts/baselines.mjs reduces it to counts.

    python -I scripts/eval/prep-pheme.py <data dir>/pheme
"""
import json
import os
import sys
import tarfile
from email.utils import parsedate_to_datetime


def when(s):
    return parsedate_to_datetime(s.replace("+0000", "GMT")).timestamp() if s else None


def main():
    root = sys.argv[1]
    src = os.path.join(root, "PHEME_veracity.tar.bz2")
    threads = {}
    with tarfile.open(src, "r:*") as tar:
        for m in tar:
            parts = m.name.split("/")
            if not m.isfile() or len(parts) != 6 or parts[-1].startswith("._") or not parts[-1].endswith(".json"):
                continue
            _, event, _kind, tid, folder, _name = parts
            if folder not in ("source-tweets", "reactions"):
                continue
            t = json.load(tar.extractfile(m))
            user = (t.get("user") or {}).get("id_str")
            row = {"user": user, "t": when(t.get("created_at")), "text": t.get("full_text") or t.get("text") or ""}
            th = threads.setdefault((event, tid), {"event": event.replace("-all-rnr-threads", ""), "id": tid, "root": None, "replies": []})
            if folder == "source-tweets":
                th["root"] = {"user": user, "t": row["t"], "text": row["text"]}
            else:
                th["replies"].append(row)
    out = os.path.join(root, "prepared")
    os.makedirs(out, exist_ok=True)
    n = 0
    with open(os.path.join(out, "pheme-threads.jsonl"), "w", encoding="utf-8") as f:
        for th in threads.values():
            if not th["root"]:
                continue
            th["replies"].sort(key=lambda r: r["t"] or 0)
            f.write(json.dumps(th, ensure_ascii=False) + "\n")
            n += 1
    print(f"{n} threads written")


if __name__ == "__main__":
    main()
