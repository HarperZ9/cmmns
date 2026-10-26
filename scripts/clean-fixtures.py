"""Builds the Share clean test fixtures in tests/fixtures/clean/. Development only; the fixtures are
committed, so tests never need Python, Pillow or ffmpeg.

    python scripts/clean-fixtures.py

Every fixture carries metadata in as many places as its format allows, and every value holds a
marker beginning DLSECRET, so tests/clean.test.js can prove by a byte scan that none survives.
markers.json lists, per fixture, the markers planted in it. Video uses the ffmpeg binary that
ships with the imageio-ffmpeg package.
"""
import io
import json
import pathlib
import struct
import subprocess
import zipfile
import zlib

from PIL import Image, PngImagePlugin

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "tests" / "fixtures" / "clean"
MARK = {}


def icc_profile():
    """A small RGB profile whose text tags and header carry markers."""
    def desc(text):
        a = text.encode() + b"\0"
        return b"desc" + b"\0" * 4 + struct.pack(">I", len(a)) + a + b"\0" * 8 + b"\0\0\0" + b"\0" * 67

    def mluc(text):
        u = text.encode("utf-16-be")
        return b"mluc" + b"\0" * 4 + struct.pack(">III", 1, 12, 0) + b"enUS" + struct.pack(">II", len(u), 28) + u

    text = b"text" + b"\0" * 4 + b"DLSECRET-ICCCPRT\0"
    xyz = b"XYZ " + b"\0" * 4 + struct.pack(">iii", 63190, 65536, 54061)
    tags = [(b"desc", desc("DLSECRET-ICCDESC")), (b"cprt", text), (b"dmnd", mluc("DLSECRET-ICCMAKER")), (b"wtpt", xyz)]
    table, data, at = b"", b"", 128 + 4 + 12 * len(tags)
    for sig, body in tags:
        body += b"\0" * (-len(body) % 4)
        table += sig + struct.pack(">II", at + len(data), len(body))
        data += body
    size = at + len(data)
    head = struct.pack(">I", size) + b"lcms" + b"\x02\x10\x00\x00" + b"mntrRGB XYZ " + struct.pack(">6H", 2024, 5, 1, 10, 0, 0)
    head += b"acspAPPL" + b"\0" * 4 + b"DLSMDLSD" + b"\0" * 8 + b"\0" * 4 + struct.pack(">iii", 63190, 65536, 54061) + b"DLSC"
    head += b"\0" * (128 - len(head))
    return head + struct.pack(">I", len(tags)) + table + data


def picture(w=40, h=30):
    im = Image.new("RGB", (w, h))
    im.putdata([((x * 7) % 256, (y * 11) % 256, ((x + y) * 5) % 256) for y in range(h) for x in range(w)])
    return im


def exif():
    e = Image.Exif()
    e[0x013B] = "DLSECRET-EXIFARTIST"
    e[0x010F] = "DLSECRET-EXIFMAKE"
    e[0x0110] = "DLSECRET-EXIFMODEL"
    e[0x8298] = "DLSECRET-EXIFCOPYRIGHT"
    gps = e.get_ifd(0x8825)
    gps[1], gps[2], gps[3], gps[4] = "N", (40.0, 42.0, 46.08), "W", (74.0, 0.0, 21.6)
    gps[0x001B] = b"ASCII\0\0\0DLSECRET-GPSMETHOD"
    return e


XMP = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Seq><rdf:li>DLSECRET-XMPCREATOR</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>'


def jpeg():
    buf = io.BytesIO()
    picture().save(buf, "JPEG", quality=90, exif=exif(), icc_profile=icc_profile(), comment=b"DLSECRET-JPEGCOMMENT")
    b = buf.getvalue()
    xmp = b"http://ns.adobe.com/xap/1.0/\0" + XMP.encode()
    iptc = b"\x1c\x02\x50" + struct.pack(">H", 19) + b"DLSECRET-IPTCBYLINE"
    irb = b"8BIM\x04\x04\0\0" + struct.pack(">I", len(iptc)) + iptc + b"\0" * (len(iptc) % 2)
    app13 = b"Photoshop 3.0\0" + irb
    seg = lambda m, d: bytes([0xFF, m]) + struct.pack(">H", len(d) + 2) + d
    b = b[:2] + seg(0xE1, xmp) + seg(0xED, app13) + seg(0xEB, b"JP\0\0DLSECRET-C2PA") + b[2:] + b"DLSECRET-TRAILER"
    MARK["photo.jpg"] = ["DLSECRET-EXIFARTIST", "DLSECRET-EXIFMAKE", "DLSECRET-EXIFMODEL", "DLSECRET-EXIFCOPYRIGHT", "DLSECRET-GPSMETHOD", "DLSECRET-ICCDESC", "DLSECRET-ICCCPRT", "DLSECRET-ICCMAKER", "DLSM", "DLSECRET-JPEGCOMMENT", "DLSECRET-XMPCREATOR", "DLSECRET-IPTCBYLINE", "DLSECRET-C2PA", "DLSECRET-TRAILER"]
    return b


def png():
    info = PngImagePlugin.PngInfo()
    info.add_text("Author", "DLSECRET-PNGTEXT")
    info.add_text("Comment", "DLSECRET-PNGZTXT", zip=True)
    info.add_itxt("XML:com.adobe.xmp", XMP)
    buf = io.BytesIO()
    picture().save(buf, "PNG", pnginfo=info, exif=exif(), icc_profile=icc_profile())
    b = buf.getvalue()
    t = b"tIME" + struct.pack(">HBBBBB", 2024, 5, 1, 10, 0, 0)
    chunk = struct.pack(">I", 7) + t + struct.pack(">I", zlib.crc32(t))
    end = b.rindex(b"IEND") - 4
    b = b[:end] + chunk + b[end:]
    MARK["picture.png"] = ["DLSECRET-PNGTEXT", "DLSECRET-XMPCREATOR", "DLSECRET-EXIFARTIST", "DLSECRET-GPSMETHOD"]
    return b


def gif():
    frames = [picture().quantize(16), picture().transpose(Image.FLIP_LEFT_RIGHT).quantize(16)]
    buf = io.BytesIO()
    frames[0].save(buf, "GIF", save_all=True, append_images=frames[1:], duration=200, loop=0, comment=b"DLSECRET-GIFCOMMENT")
    b = buf.getvalue()
    data = XMP.encode()
    blocks = b"".join(bytes([len(data[i:i + 255])]) + data[i:i + 255] for i in range(0, len(data), 255))
    ext = b"\x21\xff\x0bXMP DataXMP" + blocks + b"\0"
    at = b.index(b"\x21\xf9")
    MARK["anim.gif"] = ["DLSECRET-GIFCOMMENT", "XMP DataXMP"]
    return b[:at] + ext + b[at:]


def webp():
    buf = io.BytesIO()
    picture().save(buf, "WEBP", lossless=True, exif=exif(), icc_profile=icc_profile(), xmp=XMP.encode())
    MARK["picture.webp"] = ["DLSECRET-EXIFARTIST", "DLSECRET-GPSMETHOD", "DLSECRET-XMPCREATOR", "DLSECRET-ICCDESC"]
    return buf.getvalue()


def ffmpeg(args, name):
    import imageio_ffmpeg
    out = OUT / name
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=64x48:rate=10", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=22050", "-t", "1", *args, str(out)], check=True)
    return out.read_bytes()


def videos():
    meta = ["-metadata", "title=DLSECRET-VIDTITLE", "-metadata", "artist=DLSECRET-VIDARTIST", "-metadata", "comment=DLSECRET-VIDCOMMENT", "-metadata", "creation_time=2024-05-01T10:00:00Z"]
    ffmpeg(["-c:v", "mpeg4", "-c:a", "aac", *meta, "-movflags", "+faststart"], "clip.mp4")
    ffmpeg(["-c:v", "mpeg4", "-c:a", "aac", *meta, "-metadata", "location=+40.7128-074.0060/", "-movflags", "+use_metadata_tags"], "clip.mov")
    ffmpeg(["-c:v", "libvpx", "-b:v", "200k", "-c:a", "libvorbis", *meta, "-metadata:s:v", "title=DLSECRET-TRACKNAME"], "clip.webm")
    MARK["clip.mp4"] = ["DLSECRET-VIDTITLE", "DLSECRET-VIDARTIST", "DLSECRET-VIDCOMMENT", "Lavf"]
    MARK["clip.mov"] = ["DLSECRET-VIDTITLE", "DLSECRET-VIDARTIST", "DLSECRET-VIDCOMMENT", "+40.7128-074.0060"]
    MARK["clip.webm"] = ["DLSECRET-VIDTITLE", "DLSECRET-VIDARTIST", "DLSECRET-VIDCOMMENT", "DLSECRET-TRACKNAME"]


def pdf():
    photo = jpeg()
    xmp = XMP.encode()
    content = b"q 40 0 0 30 20 20 cm /Im1 Do Q"
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R /Metadata 6 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 80] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream",
        b"<< /Type /XObject /Subtype /Image /Width 40 /Height 30 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n" % len(photo) + photo + b"\nendstream",
        b"<< /Type /Metadata /Subtype /XML /Length %d >>\nstream\n" % len(xmp) + xmp + b"\nendstream",
        b"<< /Author (DLSECRET-PDFAUTHOR) /Creator (DLSECRET-PDFCREATOR) /Producer (DLSECRET-PDFPRODUCER) /Title (DLSECRET-PDFTITLE) /CreationDate (D:20240501100000Z) >>",
    ]
    out, offsets = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % x for x in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R /Info 7 0 R /ID [<DEADBEEF0123456789ABCDEF01234567> <DEADBEEF0123456789ABCDEF01234567>] >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    MARK["doc.pdf"] = ["DLSECRET-PDFAUTHOR", "DLSECRET-PDFCREATOR", "DLSECRET-PDFPRODUCER", "DLSECRET-PDFTITLE", "D:20240501100000Z", "DLSECRET-XMPCREATOR", "DLSECRET-EXIFARTIST", "DLSECRET-GPSMETHOD", "DEADBEEF"]
    return out


def office():
    core = '<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"><dc:creator>DLSECRET-DOCXAUTHOR</dc:creator><cp:lastModifiedBy>DLSECRET-DOCXEDITOR</cp:lastModifiedBy><dcterms:created>2024-05-01T10:00:00Z</dcterms:created></cp:coreProperties>'
    app = '<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Company>DLSECRET-DOCXCOMPANY</Company><Manager>DLSECRET-DOCXMANAGER</Manager></Properties>'
    types = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'
    rels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'
    doc = '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Body text stays.</w:t></w:r></w:p></w:body></w:document>'
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, text in [("[Content_Types].xml", types), ("_rels/.rels", rels), ("word/document.xml", doc), ("docProps/core.xml", core), ("docProps/app.xml", app)]:
            info = zipfile.ZipInfo(name, date_time=(2024, 5, 1, 10, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.comment = b"DLSECRET-ZIPCOMMENT"
            z.writestr(info, text)
    MARK["letter.docx"] = ["DLSECRET-DOCXAUTHOR", "DLSECRET-DOCXEDITOR", "DLSECRET-DOCXCOMPANY", "DLSECRET-DOCXMANAGER", "DLSECRET-ZIPCOMMENT"]
    odt = io.BytesIO()
    meta = '<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"><office:meta><meta:initial-creator>DLSECRET-ODTAUTHOR</meta:initial-creator><meta:generator>DLSECRET-ODTGEN</meta:generator></office:meta></office:document-meta>'
    with zipfile.ZipFile(odt, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype", (2024, 5, 1, 10, 0, 0)), "application/vnd.oasis.opendocument.text")
        z.writestr("content.xml", '<?xml version="1.0"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"/>', zipfile.ZIP_DEFLATED)
        z.writestr("meta.xml", meta, zipfile.ZIP_DEFLATED)
        z.writestr("META-INF/manifest.xml", '<?xml version="1.0"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>', zipfile.ZIP_DEFLATED)
    MARK["note.odt"] = ["DLSECRET-ODTAUTHOR", "DLSECRET-ODTGEN"]
    return buf.getvalue(), odt.getvalue()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, data in [("photo.jpg", jpeg()), ("picture.png", png()), ("anim.gif", gif()), ("picture.webp", webp()), ("doc.pdf", pdf())]:
        (OUT / name).write_bytes(data)
    docx, odt = office()
    (OUT / "letter.docx").write_bytes(docx)
    (OUT / "note.odt").write_bytes(odt)
    videos()
    (OUT / "markers.json").write_text(json.dumps(MARK, indent=2) + "\n", encoding="utf-8")
    for p in sorted(OUT.iterdir()):
        print(p.name, p.stat().st_size)


if __name__ == "__main__":
    main()
