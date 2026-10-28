"""Fixture pages and a slow server for scripts/qa/download_timing.py. Development tool only.

Builds an X-shaped status page (one picture, a gallery of four, an MP4 video, an HLS video, each
post with X's action row and a clear link over its pictures, plus a quoted post nested in a reply),
an Instagram-shaped page for the hover control (one clear layer over two pictures and a caption, a
picture that loads late), and a page on a site CMMNS does not name, for the first hover click. The
server maps x.com, pbs.twimg.com, video.twimg.com, www.instagram.com and news.example to these
files and adds a fixed delay per request and a bandwidth cap, so timings look like a network.
"""
import functools
import http.server
import json
import os
import pathlib
import random
import shutil
import ssl
import subprocess
import threading
import time

from PIL import Image

HOSTS = ("x.com", "pbs.twimg.com", "video.twimg.com", "www.instagram.com", "news.example")
RTT_S = float(os.environ.get("DC_RTT_MS", "60")) / 1000
BYTES_PER_S = float(os.environ.get("DC_MBIT", "80")) * 125000

POSTS = [("301", "one", ["p301a"], None), ("302", "four", ["p302a", "p302b", "p302c", "p302d"], None),
         ("303", "mp4", [], "mp4"), ("304", "hls", [], "hls")]


def photo(path, seed):
    rnd = random.Random(seed)
    img = Image.effect_noise((1600, 1200), 60).convert("RGB")
    img.paste((rnd.randrange(256), 90, 120), (200, 200, 900, 700))
    img.save(path, "JPEG", quality=92)


def fake_mp4(path, mb):
    head = b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2"
    body = os.urandom(mb * 1048576)
    path.write_bytes(head + len(body).to_bytes(4, "big") + b"mdat" + body)


def ts_segment(path, mb):
    pkt = bytearray(188 * (mb * 1048576 // 188))
    for i in range(0, len(pkt), 188):
        pkt[i] = 0x47
    path.write_bytes(bytes(pkt))


def article(pid, text, pics, video, nested=""):
    grid = "".join(f'<a href="/ana/status/{pid}/photo/{i + 1}" style="position:relative;display:block;height:{300 if len(pics) == 1 else 150}px">'
                   f'<div style="position:absolute;inset:0;background:url(https://pbs.twimg.com/media/{m}?format=jpg&amp;name=small) center/cover"></div>'
                   f'<img alt="pic {m}" src="https://pbs.twimg.com/media/{m}?format=jpg&amp;name=small" style="position:absolute;inset:0;width:100%;height:100%;opacity:0"></a>'
                   for i, m in enumerate(pics))
    media = f'<div class="grid" style="display:grid;grid-template-columns:{"1fr" if len(pics) == 1 else "1fr 1fr"};gap:2px;width:520px">{grid}</div>' if pics else ""
    if video:
        media = (f'<div data-testid="videoPlayer" style="position:relative;width:520px;height:292px"><video id="v{pid}" muted '
                 f'poster="https://pbs.twimg.com/ext_tw_video_thumb/{pid}/pu/img/poster.jpg" style="width:100%;height:100%;background:#222"></video>'
                 f'<div style="position:absolute;inset:0"></div></div>')
    return (f'<article data-testid="tweet" data-pid="{pid}" style="position:relative;padding:12px;border-bottom:1px solid #ccc">'
            f'<a href="/ana">ana</a> <a href="/ana/status/{pid}"><time datetime="2026-10-27T10:00:00.000Z">Oct 27</time></a>'
            f'<div data-testid="tweetText" lang="en">{text}</div>{media}{nested}'
            f'<div role="group" class="row"><button data-testid="reply" aria-label="2 Replies. Reply">r</button>'
            f'<button data-testid="retweet">rt</button><button data-testid="like" aria-label="9 Likes. Like">l</button></div></article>')


def graphql(base):
    def media(pid, pics, video):
        if video:
            vi = {"variants": [{"content_type": "application/x-mpegURL", "url": f"https://video.twimg.com/ext_tw_video/{pid}/pu/pl/list.m3u8"}]}
            if video == "mp4":
                vi["variants"].append({"content_type": "video/mp4", "bitrate": 2176000, "url": f"https://video.twimg.com/ext_tw_video/{pid}/pu/vid/1280x720/clip.mp4"})
            return [{"id_str": "1851000000000000000", "type": "video", "media_url_https": f"https://pbs.twimg.com/ext_tw_video_thumb/{pid}/pu/img/poster.jpg", "video_info": vi}]
        return [{"id_str": "1851000000000000001", "type": "photo", "media_url_https": f"https://pbs.twimg.com/media/{m}.jpg"} for m in pics]
    tweets = [{"__typename": "Tweet", "rest_id": pid, "core": {"user_results": {"result": {"legacy": {"screen_name": "ana", "name": "Ana"}}}},
               "legacy": {"full_text": text, "created_at": "Mon Oct 27 10:00:00 +0000 2026", "favorite_count": 9, "reply_count": 2,
                          "extended_entities": {"media": media(pid, pics, video)}}} for pid, text, pics, video in POSTS]
    (base / "i" / "api" / "graphql" / "q").mkdir(parents=True, exist_ok=True)
    (base / "i" / "api" / "graphql" / "q" / "TweetDetail").write_text(json.dumps({"data": {"threaded_conversation": tweets}}), encoding="utf-8")


def build_x(site):
    x, pbs, vid = site / "x", site / "pbs" / "media", site / "vid"
    for d in (x, pbs, vid, site / "pbs" / "ext_tw_video_thumb"):
        d.mkdir(parents=True, exist_ok=True)
    for n, (_, _, pics, _) in enumerate(POSTS):
        for m in pics:
            photo(pbs / f"{m}.jpg", m)
    photo(site / "pbs" / "ext_tw_video_thumb" / "poster.jpg", "poster")
    fake_mp4(vid / "clip.mp4", int(os.environ.get("DC_VIDEO_MB", "24")))
    segs = 6
    for i in range(segs):
        ts_segment(vid / f"s{i}.ts", 1)
    (vid / "list.m3u8").write_text("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n" + "".join(f"#EXTINF:4.0,\ns{i}.ts\n" for i in range(segs)) + "#EXT-X-ENDLIST\n", encoding="utf-8")
    quoted = article("399", "quoted post", ["p302a"], None).replace("<article", '<article data-quoted="1"')
    body = "".join(article(pid, f"post {kind}", pics, video) for pid, kind, pics, video in POSTS)
    body += article("305", "a reply quoting another post", [], None, nested=f'<div role="link">{quoted}</div>')
    (x / "status.html").write_text("<!doctype html><title>ana on X</title><main style='width:600px'>" + body +
                                   "</main><script>fetch('/i/api/graphql/q/TweetDetail');</script>", encoding="utf-8")
    graphql(x)


IG = """<!doctype html><title>Instagram fixture</title><body style="margin:0">
<section id="post" style="position:relative;width:840px;margin:20px">
 <header style="height:120px;background:#eee">nasa</header>
 <div style="display:flex;gap:8px"><img id="a" src="/p1.jpg" style="width:400px;height:300px"><img id="b" src="/p2.jpg" style="width:400px;height:300px"></div>
 <div style="height:80px">caption</div>
 <div id="cover" style="position:absolute;inset:0"></div></section>
<div id="late" style="position:relative;width:400px;margin:20px"><img id="c" src="/p3.jpg" style="width:400px;height:40px"></div>
<script>setTimeout(() => { document.getElementById('c').style.height = '300px'; }, Number(new URLSearchParams(location.search).get('late') || 999999));</script>"""


def build(out):
    site = pathlib.Path(out) / "dlsite"
    shutil.rmtree(site, ignore_errors=True)
    build_x(site)
    ig, news = site / "ig", site / "news"
    for d in (ig, news):
        d.mkdir(parents=True)
    (ig / "index.html").write_text(IG, encoding="utf-8")
    for i in (1, 2, 3):
        photo(ig / f"p{i}.jpg", f"ig{i}")
    (news / "index.html").write_text('<!doctype html><title>News</title><img id="m" src="/n.jpg" style="width:640px;height:480px">', encoding="utf-8")
    photo(news / "n.jpg", "news")
    return site


class Slow(http.server.SimpleHTTPRequestHandler):
    ROUTES = {"x.com": "x", "pbs.twimg.com": "pbs", "video.twimg.com": "vid", "www.instagram.com": "ig", "news.example": "news"}

    def translate_path(self, path):
        host = (self.headers.get("Host") or "").split(":")[0]
        p = path.split("?", 1)[0]
        sub = self.ROUTES.get(host, "news")
        if host == "x.com" and not p.startswith("/i/api/"):
            p = "/status.html"
        elif host == "pbs.twimg.com" and p.startswith("/media/"):
            p = "/media/" + p.split("/")[-1].split(".")[0] + ".jpg"
        elif host == "pbs.twimg.com":
            p = "/ext_tw_video_thumb/poster.jpg"
        elif host == "video.twimg.com":
            p = "/" + p.split("/")[-1]
        elif p in ("", "/"):
            p = "/index.html"
        return str(pathlib.Path(self.directory) / sub / p.lstrip("/"))

    def copyfile(self, src, dst):
        while True:
            chunk = src.read(65536)
            if not chunk:
                break
            try:
                dst.write(chunk)
            except (ConnectionError, ssl.SSLError):
                return   # the page read the first bytes and let go (a type probe)
            time.sleep(len(chunk) / BYTES_PER_S)

    def send_head(self):
        time.sleep(RTT_S)
        return super().send_head()

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Range")
        self.send_header("Access-Control-Expose-Headers", "Content-Type, Content-Length, Content-Range")
        super().end_headers()

    def log_message(self, *a):
        pass


def serve(site, cert_dir):
    """https on 127.0.0.1:8443 for every mapped host."""
    cert, key = cert_dir / "cert.pem", cert_dir / "key.pem"
    if not cert.exists():
        subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2", "-subj", "/CN=x.com",
                        "-keyout", str(key), "-out", str(cert)], check=True, capture_output=True)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8443), functools.partial(Slow, directory=str(site)))
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(str(cert), str(key))
    srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv
