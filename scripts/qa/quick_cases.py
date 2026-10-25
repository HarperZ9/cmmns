"""The pages scripts/qa/quick_save_check.py visits, X and Reddit first. Development tool only.
`discover` finds a current item on a listing page, so the check never depends on one post staying up."""

FIRST = r"([...document.querySelectorAll('a[href]')].map((a) => a.href).find((h) => {pat}) || location.href)"

CASES = [
    {"name": "x-photo", "url": "https://x.com/NASA/status/2113655288687431819", "inline": "article .dc-dl", "menu": None, "settle": 8},
    {"name": "x-video-inline", "url": "https://x.com/NASA/status/2113776971603689874", "inline": "article .dc-dl", "menu": None, "settle": 8, "timeout": 180},
    {"name": "x-video-rightclick", "url": "https://x.com/NASA/status/2113776971603689874", "menu": "pb-dl", "selector": "article video", "settle": 8, "timeout": 180},
    {"name": "x-gif-inline", "url": "https://x.com/GIPHY/status/1957913446118285360", "inline": "article .dc-dl", "menu": None, "settle": 8},
    {"name": "x-gif-as-gif", "url": "https://x.com/GIPHY/status/1957913446118285360", "menu": "pb-dl-gif", "selector": "article video", "settle": 8, "timeout": 180},
    {"name": "reddit-dash-inline", "url": "https://www.reddit.com/r/test/comments/v1/harbour/", "inline": "#vid .dc-dl", "menu": None, "settle": 3},
    {"name": "reddit-packaged-inline", "url": "https://www.reddit.com/r/test/comments/v2/clip/", "inline": "#pkg .dc-dl", "menu": None, "settle": 3},
    {"name": "reddit-gallery-inline", "url": "https://www.reddit.com/r/test/comments/g1/photos/", "inline": "#gal .dc-dl", "menu": None, "settle": 3, "want": 4},
    {"name": "reddit-video-rightclick", "url": "https://www.reddit.com/r/test/comments/v1/harbour/", "menu": "pb-dl", "selector": "#p1", "settle": 3},
    {"name": "giphy", "url": "https://giphy.com/explore/cat", "discover": FIRST.format(pat=r"/giphy\.com\/gifs\/[\w-]+-\w{8,}$/.test(h)"), "menu": "pb-dl-here", "selector": "largest", "settle": 8},
    {"name": "giphy-as-gif", "url": "https://giphy.com/explore/cat", "discover": FIRST.format(pat=r"/giphy\.com\/gifs\/[\w-]+-\w{8,}$/.test(h)"), "menu": "pb-dl-gif", "selector": "largest", "settle": 8},
    {"name": "tenor", "url": "https://tenor.com/search/cat-gifs", "discover": FIRST.format(pat=r"/tenor\.com\/view\//.test(h)"), "menu": "pb-dl-here", "selector": "largest", "settle": 8},
    {"name": "wikipedia-srcset", "url": "https://en.wikipedia.org/wiki/Mount_Rainier", "menu": "pb-dl", "selector": ".infobox img", "settle": 3},
    {"name": "wikipedia-copy", "url": "https://en.wikipedia.org/wiki/Mount_Rainier", "menu": "pb-copy", "selector": ".infobox img", "settle": 3},
    {"name": "wikipedia-copy-link", "url": "https://en.wikipedia.org/wiki/Mount_Rainier", "menu": "pb-copy-link", "selector": ".infobox img", "settle": 3},
    {"name": "imgur-gifv", "url": "https://imgur.com/t/gifs", "menu": "pb-dl", "selector": "largest", "settle": 8},
    {"name": "overlay-webp-as-jpg", "url": "http://127.0.0.1:8765/overlay.html", "menu": "pb-dl-here", "selector": "#m", "settle": 1},
    {"name": "html5-mp4", "url": "https://www.w3schools.com/html/html5_video.asp", "menu": "pb-dl", "selector": "#video1", "settle": 4},
    {"name": "hls-fmp4-separate-audio", "url": "http://127.0.0.1:8765/hls-player.html", "menu": "pb-dl", "selector": "#m", "settle": 8, "timeout": 300},
    {"name": "dash-separate-audio", "url": "http://127.0.0.1:8765/dash-player.html", "menu": "pb-dl", "selector": "#m", "settle": 8, "timeout": 300},
    {"name": "canvas", "url": "http://127.0.0.1:8765/canvas.html", "menu": "pb-dl-here", "selector": "#m", "settle": 1},
    {"name": "iframe", "url": "http://127.0.0.1:8765/iframe.html", "menu": "pb-dl", "selector": "#m", "frame": "http://localhost:8765/inner.html", "settle": 2},
    {"name": "drm-refused", "url": "http://127.0.0.1:8765/drm.html", "menu": "pb-dl", "selector": "#m", "settle": 3, "timeout": 15},
    {"name": "hls-ts-mux", "url": "https://hlsjs.video-dev.org/demo/?src=https%3A%2F%2Ftest-streams.mux.dev%2Fx36xhzz%2Fx36xhzz.m3u8", "menu": "pb-dl", "selector": "largest", "settle": 12, "timeout": 300},
]
