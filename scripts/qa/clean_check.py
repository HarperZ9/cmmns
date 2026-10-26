"""Decoded-frame check of Share clean, with real decoders. Development only.

    python scripts/qa/clean_check.py <work folder>

Runs `daylight clean` on every fixture in tests/fixtures/clean/, then decodes the original and the
clean copy and compares what a viewer sees and hears: Pillow for pictures (every frame of a GIF,
the photo inside the PDF), ffmpeg's framemd5 for every video and audio stream (the decoded frames
and samples, hashed one by one). Writes clean-check.json to the work folder.
"""
import hashlib
import io
import json
import pathlib
import re
import shutil
import subprocess
import sys
import zipfile

from PIL import Image, ImageSequence

ROOT = pathlib.Path(__file__).resolve().parents[2]
FIX = ROOT / "tests" / "fixtures" / "clean"


def pixels(data):
    im = Image.open(io.BytesIO(data))
    return [hashlib.sha256(f.convert("RGBA").tobytes()).hexdigest() for f in ImageSequence.Iterator(im)]


def framemd5(path):
    import imageio_ffmpeg
    out = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", str(path), "-map", "0", "-f", "framemd5", "-"], capture_output=True, text=True, check=True).stdout
    return [line.split(",")[-1].strip() + "@" + line.split(",")[0].strip() for line in out.splitlines() if line and not line.startswith("#")]


def pdf_photo(data):
    m = re.search(rb"/DCTDecode /Length (\d+) >>\nstream\n", data)
    start = m.end()
    return data[start:start + int(m.group(1))]


def office_parts(data):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        return {n: hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if not n.startswith("docProps/") and n != "meta.xml"}


def compare(name, a, b):
    if name.endswith((".jpg", ".png", ".gif", ".webp")):
        return "decoded pixels, every frame", pixels(a.read_bytes()), pixels(b.read_bytes())
    if name.endswith((".mp4", ".mov", ".webm")):
        return "ffmpeg framemd5 of every decoded video frame and audio packet", framemd5(a), framemd5(b)
    if name.endswith(".pdf"):
        return "decoded pixels of the embedded photo", pixels(pdf_photo(a.read_bytes())), pixels(pdf_photo(b.read_bytes()))
    return "every part except the property parts, unzipped", office_parts(a.read_bytes()), office_parts(b.read_bytes())


def main(work):
    work = pathlib.Path(work)
    shutil.rmtree(work / "clean", ignore_errors=True)
    (work / "clean").mkdir(parents=True)
    rows = []
    for f in sorted(FIX.iterdir()):
        if f.name == "markers.json":
            continue
        src = work / "clean" / f.name
        shutil.copy(f, src)
        out = work / "clean" / ("clean-" + f.name)
        subprocess.run(["node", str(ROOT / "bin" / "radar.mjs"), "clean", str(src), "--out", str(out)], check=True, capture_output=True)
        what, x, y = compare(f.name, src, out)
        rows.append({"file": f.name, "compared": what, "units": len(x), "identical": x == y, "original_bytes": src.stat().st_size, "clean_bytes": out.stat().st_size})
        print(f"{f.name}: {what}: {len(x)} units, identical={x == y}")
    (work / "clean-check.json").write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
    return 0 if all(r["identical"] and r["units"] for r in rows) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "qa-clean"))
