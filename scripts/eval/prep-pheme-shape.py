"""Engagement counts of PHEME source posts (Zubiaga et al.; CC BY 4.0) for the campaign lens's
engagement-shape baseline.

Reads PHEME_veracity.tar.bz2 without unpacking it and writes prepared/pheme-shape.jsonl beside it:
one line per source post with its event, the author's follower count and the post's repost and
like counts as captured. No text, no account id and no post id are written, so the file is counts
only. scripts/campaign-baselines.mjs reduces it to quantiles per audience stratum.

    python -I scripts/eval/prep-pheme-shape.py <data dir>/pheme
"""
import json
import os
import sys
import tarfile


def main():
    root = sys.argv[1]
    src = os.path.join(root, "PHEME_veracity.tar.bz2")
    rows = []
    with tarfile.open(src, "r:*") as tar:
        for m in tar:
            parts = m.name.split("/")
            if not m.isfile() or len(parts) != 6 or parts[-1].startswith("._") or not parts[-1].endswith(".json"):
                continue
            _, event, _kind, _tid, folder, _name = parts
            if folder != "source-tweets":
                continue
            t = json.load(tar.extractfile(m))
            u = t.get("user") or {}
            rows.append({
                "event": event.replace("-all-rnr-threads", ""),
                "followers": u.get("followers_count"),
                "reposts": t.get("retweet_count"),
                "likes": t.get("favorite_count"),
            })
    out = os.path.join(root, "prepared")
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "pheme-shape.jsonl"), "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    print(f"{len(rows)} source posts written")


if __name__ == "__main__":
    main()
