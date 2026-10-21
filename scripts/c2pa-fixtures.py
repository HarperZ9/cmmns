# Builds the synthetic Content Credentials fixtures in tests/fixtures/c2pa/. R&D only: it needs
# c2patool (github.com/contentauth/c2pa-rs releases) and Pillow, neither of which ships with
# Radar. Every image is drawn here from flat colours, so no one else's media is used. The signer is
# the test certificate that ships in c2patool's sample folder; it chains to no trusted root.
#
#   python scripts/c2pa-fixtures.py <path to c2patool.exe> <c2patool sample folder> [only these names]
import io, json, os, struct, subprocess, sys, tempfile
from PIL import Image

TOOL, SAMPLE = sys.argv[1], sys.argv[2]
ONLY = set(sys.argv[3:])   # rebuild just these signed files, leaving the others byte for byte
OUT = os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures", "c2pa")
os.makedirs(OUT, exist_ok=True)
TMP = tempfile.mkdtemp()
# No thumbnails, so each fixture stays a few kilobytes.
SETTINGS = os.path.join(TMP, "settings.json")
json.dump({"builder": {"thumbnail": {"enabled": False}}}, open(SETTINGS, "w"))

def image(fmt, colour=(40, 90, 160)):
    im = Image.new("RGB", (16, 16), colour)
    for x in range(8):
        im.putpixel((x, x), (250, 200, 40))
    b = io.BytesIO()
    im.save(b, fmt, quality=80) if fmt == "JPEG" else im.save(b, fmt)
    return b.getvalue()

def box(kind, payload):
    return struct.pack(">I", 8 + len(payload)) + kind + payload

def mp4():
    # A minimal ISO BMFF file: ftyp, a moov with an mvhd, and a small mdat. No playable track.
    ftyp = box(b"ftyp", b"isom" + struct.pack(">I", 512) + b"isomiso2mp41")
    mvhd = box(b"mvhd", bytes(4) + struct.pack(">IIII", 0, 0, 1000, 0) + struct.pack(">IH", 0x00010000, 0x0100) + bytes(10)
               + struct.pack(">9I", 0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000) + bytes(24) + struct.pack(">I", 2))
    return ftyp + box(b"moov", mvhd) + box(b"mdat", bytes(range(64)))

def manifest(source, title, version=2, extra=None):
    m = {"claim_version": version, "claim_generator_info": [{"name": "Radar fixture builder", "version": "1.0"}], "title": title,
         "assertions": [{"label": "c2pa.actions" + (".v2" if version == 2 else ""), "data": {"actions": [
             {"action": "c2pa.created", "digitalSourceType": "http://cv.iptc.org/newscodes/digitalsourcetype/" + source,
              "softwareAgent": {"name": "Synthetic Generator", "version": "9.9"}}]}}]}
    if extra:
        m.update(extra)
    return m

def sign(name, raw, man, alg="es256", parent=None):
    if ONLY and name not in ONLY:
        return
    src = os.path.join(TMP, "src-" + name)
    open(src, "wb").write(raw)
    cert, key = ("es256_certs.pem", "es256_private.key") if alg == "es256" else ("ps256.pub", "ps256.pem")
    man = {**man, "alg": alg, "private_key": os.path.join(SAMPLE, key), "sign_cert": os.path.join(SAMPLE, cert)}
    mpath = os.path.join(TMP, name + ".json")
    json.dump(man, open(mpath, "w"))
    args = [TOOL, src, "-m", mpath, "-o", os.path.join(OUT, name), "-f", "--settings", SETTINGS] + (["-p", parent] if parent else [])
    subprocess.run(args, check=True, capture_output=True)

sign("ai.jpg", image("JPEG"), manifest("trainedAlgorithmicMedia", "ai.jpg"))
sign("ai.png", image("PNG"), manifest("trainedAlgorithmicMedia", "ai.png"))
sign("ai.webp", image("WEBP"), manifest("trainedAlgorithmicMedia", "ai.webp"))
sign("ai.mp4", mp4(), manifest("trainedAlgorithmicMedia", "ai.mp4"))
sign("camera-v1.jpg", image("JPEG", (120, 60, 30)), manifest("digitalCapture", "camera-v1.jpg", version=1))
# A version 1 claim in MP4: the form whose agreement with the reference checker is not shown,
# so Radar must report it as not fully verified.
sign("camera-v1.mp4", mp4(), manifest("digitalCapture", "camera-v1.mp4", version=1))
sign("camera-ps256.jpg", image("JPEG", (20, 120, 60)), manifest("digitalCapture", "camera-ps256.jpg"), alg="ps256")
edit = {"claim_version": 2, "claim_generator_info": [{"name": "Radar fixture builder", "version": "1.0"}], "title": "edited.jpg",
        "assertions": [{"label": "c2pa.actions.v2", "data": {"actions": [{"action": "c2pa.opened"}, {"action": "c2pa.color_adjustments"}]}}]}
sign("edited.jpg", image("JPEG", (90, 90, 90)), edit, parent=os.path.join(OUT, "ai.jpg"))

if ONLY:
    sys.exit(0)

# Tampered control: one byte of the image data changed after signing. The data hash must fail.
t = bytearray(open(os.path.join(OUT, "ai.jpg"), "rb").read())
sos = t.rfind(b"\xff\xda")
t[sos + 20] ^= 0x55
open(os.path.join(OUT, "tampered.jpg"), "wb").write(t)

# No Content Credentials, but IPTC digital source type in XMP (JPEG APP1) and generator text in PNG.
xmp = (b'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
       b'<rdf:Description xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" '
       b'Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"/>'
       b'</rdf:RDF></x:xmpmeta>')
j = image("JPEG", (200, 30, 90))
app1 = b"http://ns.adobe.com/xap/1.0/\x00" + xmp
j = j[:2] + b"\xff\xe1" + struct.pack(">H", len(app1) + 2) + app1 + j[2:]
open(os.path.join(OUT, "xmp-ai.jpg"), "wb").write(j)
from PIL import PngImagePlugin
info = PngImagePlugin.PngInfo()
info.add_text("parameters", "a lighthouse at dusk\nSteps: 20, Sampler: Euler a, CFG scale: 7, Seed: 1, Model: synthetic")
info.add_text("Software", "Synthetic Diffusion UI")
b = io.BytesIO()
Image.new("RGB", (16, 16), (10, 10, 10)).save(b, "PNG", pnginfo=info)
open(os.path.join(OUT, "sd-params.png"), "wb").write(b.getvalue())
open(os.path.join(OUT, "plain.jpg"), "wb").write(image("JPEG", (60, 60, 60)))

for f in sorted(os.listdir(OUT)):
    print(f, os.path.getsize(os.path.join(OUT, f)))
