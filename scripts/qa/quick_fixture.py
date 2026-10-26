"""Fixture pages and servers for scripts/qa/quick_save_check.py. Development tool only.

Builds, in <out>/site: an overlay page (a WebP served from a .jpg address under a clear layer), a
canvas page, a page with a cross-origin iframe, a ClearKey (EME) page, and a replica of Reddit's
post markup (shreddit-post, shreddit-player, gallery-carousel) for www.reddit.com, with DASH video
and sound served apart for v.redd.it. Reddit asks automated browsers to prove they are human, so
the real site cannot be tested signed out; the browser maps Reddit's hosts to this server instead.
"""
import functools
import http.server
import pathlib
import shutil
import ssl
import subprocess
import threading

from PIL import Image, ImageDraw

REDDIT_HOSTS = ("www.reddit.com", "v.redd.it", "i.redd.it", "preview.redd.it", "packaged-media.redd.it")

MPD = """<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="PT10S" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011">
 <Period><AdaptationSet contentType="video" mimeType="video/mp4"><Representation id="v" bandwidth="800000" width="320" height="176" codecs="avc1.42c00d"><BaseURL>DASH_720.mp4</BaseURL></Representation></AdaptationSet>
 <AdaptationSet contentType="audio" mimeType="audio/mp4"><Representation id="a" bandwidth="128000" codecs="mp4a.40.2"><BaseURL>DASH_AUDIO_128.mp4</BaseURL></Representation></AdaptationSet></Period></MPD>
"""

PAGES = {
    "overlay.html": """<!doctype html><title>Overlay test</title><div style="position:relative;width:400px;height:300px">
<img id="m" src="/pic.jpg" width="400" height="300" alt="harbour"><div style="position:absolute;inset:0;background:transparent"></div></div>""",
    "canvas.html": """<!doctype html><title>Canvas test</title><canvas id="m" width="300" height="200"></canvas><script>
const g=document.getElementById('m').getContext('2d');g.fillStyle='#0a6b61';g.fillRect(0,0,300,200);g.fillStyle='#ebe5d8';g.fillRect(40,40,120,80);</script>""",
    "iframe.html": """<!doctype html><title>Frame test</title><iframe id="f" src="http://localhost:8765/inner.html" width="460" height="340"></iframe>""",
    "inner.html": """<!doctype html><title>Inner</title><img id="m" src="/pic.png" width="400" height="300" alt="inner">""",
    "hls-player.html": """<!doctype html><title>Angel One over HLS</title><video id="m" width="640" height="360" muted autoplay></video>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js"></script><script>
const h = new Hls(); h.loadSource('https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8'); h.attachMedia(document.getElementById('m'));</script>""",
    "dash-player.html": """<!doctype html><title>Angel One over DASH</title><video id="m" width="640" height="360" muted autoplay></video>
<script src="https://cdn.jsdelivr.net/npm/shaka-player@4.12.6/dist/shaka-player.compiled.js"></script><script>
const pl = new shaka.Player(); pl.attach(document.getElementById('m')).then(() => pl.load('https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd'));</script>""",
    "drm.html": """<!doctype html><title>Protected test</title><video id="m" width="320" height="176" src="/bbb.mp4" muted></video><script>
navigator.requestMediaKeySystemAccess('org.w3.clearkey',[{initDataTypes:['cenc'],videoCapabilities:[{contentType:'video/mp4; codecs="avc1.42E01E"'}]}])
.then(a=>a.createMediaKeys()).then(k=>document.getElementById('m').setMediaKeys(k)).then(()=>document.body.dataset.drm='on',e=>document.body.dataset.drm='failed '+e);</script>""",
}

REDDIT = """<!doctype html><title>Reddit replica</title><body style="font-family:sans-serif">
<shreddit-post id="vid" post-title="Harbour at night, with sound" permalink="/r/test/comments/v1/harbour/" post-type="video" author="tidewatch" subreddit-prefixed-name="r/test" created-timestamp="2026-10-20T21:04:00.000000+0000">
 <div slot="text-body"><p>Shot at f/2.8, 1/50 s, ISO 3200.</p><p>Handheld, braced on the rail. #nightphotography</p></div>
 <div slot="post-media-container" style="width:480px"><shreddit-player id="p1" src="https://v.redd.it/abc123/HLSPlaylist.m3u8?a=1" poster="https://preview.redd.it/poster.jpg?width=640&amp;s=1"></shreddit-player></div></shreddit-post>
<shreddit-post id="pkg" post-title="Packaged clip" permalink="/r/test/comments/v2/clip/" post-type="video">
 <div slot="post-media-container" style="width:480px"><shreddit-player-2 id="p2" packaged-media-json='{"playbackMp4s":{"permutations":[{"source":{"url":"https://packaged-media.redd.it/clip-240.mp4?m=1","dimensions":{"width":240,"height":132}}},{"source":{"url":"https://packaged-media.redd.it/clip-320.mp4?m=1","dimensions":{"width":320,"height":176}}}]}}'></shreddit-player-2></div></shreddit-post>
<shreddit-post id="gal" post-title="Three harbour photos" permalink="/r/test/comments/g1/photos/" post-type="gallery" author="tidewatch" subreddit-prefixed-name="r/test" created-timestamp="2026-10-21T07:30:00.000000+0000">
 <div slot="post-media-container" style="width:480px"><gallery-carousel><ul>
 <li><img src="https://preview.redd.it/g1.jpeg?width=640&amp;s=1" width="400" alt="Boats at the north pier"></li><li><img src="https://preview.redd.it/g2.png?width=640&amp;s=2" width="400"></li><li><img src="https://preview.redd.it/g3.webp?width=640&amp;s=3" width="400"></li></ul></gallery-carousel></div></shreddit-post>
<script>
for (const p of document.querySelectorAll('shreddit-player, shreddit-player-2')) {
  const root = p.attachShadow({ mode: 'closed' }), v = document.createElement('video');
  v.width = 320; v.muted = true; v.controls = true;
  v.src = p.id === 'p1' ? 'https://v.redd.it/abc123/DASH_720.mp4' : 'https://packaged-media.redd.it/clip-320.mp4?m=1';
  root.append(v);
}
</script></body>"""


def picture(path, fmt, colour):
    img = Image.new("RGB", (800, 600), colour)
    d = ImageDraw.Draw(img)
    d.rectangle((100, 100, 500, 400), fill=(235, 229, 216))
    img.save(path, fmt)


def build(out, src):
    site = pathlib.Path(out) / "site"
    shutil.rmtree(site, ignore_errors=True)
    for sub in ("local", "reddit", "vredd/abc123", "iredd", "pkg"):
        (site / sub).mkdir(parents=True, exist_ok=True)
    for name, html in PAGES.items():
        (site / "local" / name).write_text(html, encoding="utf-8")
    picture(site / "local" / "pic.jpg", "WEBP", (22, 19, 15))   # a WebP behind a .jpg address
    picture(site / "local" / "pic.png", "PNG", (10, 107, 97))
    shutil.copy(src / "bbb.mp4", site / "local" / "bbb.mp4")
    (site / "reddit" / "index.html").write_text(REDDIT, encoding="utf-8")
    (site / "vredd" / "abc123" / "DASHPlaylist.mpd").write_text(MPD, encoding="utf-8")
    (site / "vredd" / "abc123" / "HLSPlaylist.m3u8").write_text("#EXTM3U\n", encoding="utf-8")
    shutil.copy(src / "v.mp4", site / "vredd" / "abc123" / "DASH_720.mp4")
    shutil.copy(src / "a.mp4", site / "vredd" / "abc123" / "DASH_AUDIO_128.mp4")
    for n, (fmt, ext) in enumerate((("JPEG", "jpeg"), ("PNG", "png"), ("WEBP", "webp")), 1):
        picture(site / "iredd" / f"g{n}.{ext}", fmt, (40 * n, 60, 90))
    picture(site / "iredd" / "poster.jpg", "JPEG", (90, 60, 40))
    for k in ("240", "320"):
        shutil.copy(src / "bbb.mp4", site / "pkg" / f"clip-{k}.mp4")
    return site


class Handler(http.server.SimpleHTTPRequestHandler):
    ROUTES = {"x.com": "xsite", "www.reddit.com": "reddit", "v.redd.it": "vredd", "i.redd.it": "iredd", "preview.redd.it": "iredd", "packaged-media.redd.it": "pkg"}

    def translate_path(self, path):
        host = (self.headers.get("Host") or "").split(":")[0]
        sub = self.ROUTES.get(host, "local")
        p = path.split("?", 1)[0]
        if host == "www.reddit.com":
            p = "/index.html"
        if host == "x.com" and not p.startswith("/i/api/"):
            p = "/status.html" if "/status/" in p else "/profile.html"
        return str(pathlib.Path(self.directory) / sub / p.lstrip("/"))

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Range")
        self.send_header("Access-Control-Expose-Headers", "Content-Type, Content-Length, Content-Range")
        super().end_headers()

    def log_message(self, *a):
        pass


def serve(site, cert_dir):
    """http on 127.0.0.1:8765 (and localhost:8765 for the cross-origin frame), https on 8443."""
    handler = functools.partial(Handler, directory=str(site))
    plain = http.server.ThreadingHTTPServer(("127.0.0.1", 8765), handler)
    cert, key = cert_dir / "cert.pem", cert_dir / "key.pem"
    if not cert.exists():
        subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2", "-subj", "/CN=www.reddit.com",
                        "-keyout", str(key), "-out", str(cert)], check=True, capture_output=True)
    secure = http.server.ThreadingHTTPServer(("127.0.0.1", 8443), handler)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(str(cert), str(key))
    secure.socket = ctx.wrap_socket(secure.socket, server_side=True)
    for s in (plain, secure):
        threading.Thread(target=s.serve_forever, daemon=True).start()
    return plain, secure
