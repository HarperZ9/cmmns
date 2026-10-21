"""Prepare the PHEME thread corpus (Zubiaga et al.; CC BY 4.0) for the technique baselines.

Reads PHEME_veracity.tar.bz2 without unpacking it and writes prepared/pheme-techniques.jsonl beside
it: one thread per line with, for each reaction, a hashed author id, its time, X's language code,
its expanded links, its media ids, and the account's post count and creation time as the tweet
recorded them. No text is written. scripts/techniques-baselines.mjs reduces it to counts.

    python -I scripts/eval/prep-pheme-techniques.py <data dir>/pheme
"""
import hashlib
import json
import os
import sys
import tarfile
from email.utils import parsedate_to_datetime


def when(s):
    return parsedate_to_datetime(s.replace("+0000", "GMT")).timestamp() if s else None


def row(t):
    u = t.get("user") or {}
    ent = t.get("entities") or {}
    ext = (t.get("extended_entities") or {}).get("media") or ent.get("media") or []
    uid = u.get("id_str") or ""
    lang = t.get("lang")
    return {
        "user": hashlib.sha256(uid.encode()).hexdigest()[:16] if uid else None,
        "t": when(t.get("created_at")),
        "lang": lang if lang not in (None, "und", "zxx") else None,
        "links": [x.get("expanded_url") for x in ent.get("urls") or [] if x.get("expanded_url")],
        "media": [m.get("id_str") for m in ext if m.get("id_str")],
        "posts": u.get("statuses_count"),
        "joined": when(u.get("created_at")),
    }


def main():
    root = sys.argv[1]
    threads = {}
    with tarfile.open(os.path.join(root, "PHEME_veracity.tar.bz2"), "r:*") as tar:
        for m in tar:
            parts = m.name.split("/")
            if not m.isfile() or len(parts) != 6 or parts[-1].startswith("._") or not parts[-1].endswith(".json"):
                continue
            _, event, _kind, tid, folder, _name = parts
            if folder not in ("source-tweets", "reactions"):
                continue
            r = row(json.load(tar.extractfile(m)))
            th = threads.setdefault((event, tid), {"event": event.replace("-all-rnr-threads", ""), "id": tid, "root": None, "replies": []})
            if folder == "source-tweets":
                th["root"] = r
            else:
                th["replies"].append(r)
    out = os.path.join(root, "prepared")
    os.makedirs(out, exist_ok=True)
    n = 0
    with open(os.path.join(out, "pheme-techniques.jsonl"), "w", encoding="utf-8") as f:
        for th in threads.values():
            if not th["root"]:
                continue
            th["replies"].sort(key=lambda r: r["t"] or 0)
            f.write(json.dumps(th) + "\n")
            n += 1
    print(f"{n} threads written")


if __name__ == "__main__":
    main()
