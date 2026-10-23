"""Screen recording and captions for scripts/demo/capture.py. Development tool only.

Frames come from the DevTools screencast of each page in turn; encode() resamples them to a fixed
frame rate and writes a WebM with ffmpeg and a small GIF with Pillow. Captions are drawn into the page
itself as a bar in Hanken Grotesk, so the recording shows exactly what the page showed.
"""
import base64
import io
import pathlib
import subprocess
import time

from PIL import Image

HANKEN = pathlib.Path(__file__).resolve().parents[2] / "src" / "ext" / "fonts" / "hanken-grotesk.woff2"
FONT = base64.b64encode(HANKEN.read_bytes()).decode()
CAPTION_JS = """([text, font]) => {
  let bar = document.getElementById('dc-demo-caption');
  if (!text) { if (bar) bar.remove(); return; }
  if (!document.getElementById('dc-demo-font')) {
    const st = document.createElement('style'); st.id = 'dc-demo-font';
    st.textContent = `@font-face{font-family:"DC Demo Hanken";src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:100 900}`;
    document.head.append(st);
  }
  if (!bar) { bar = document.createElement('div'); bar.id = 'dc-demo-caption'; document.body.append(bar); }
  bar.setAttribute('style', 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:14px 28px;background:#0b070a;color:#eaf5f6;font:600 21px/1.35 "DC Demo Hanken",system-ui,sans-serif;letter-spacing:0;border-top:2px solid #8ee3f2;pointer-events:none');
  bar.textContent = text;
}"""


async def caption(page, text):
    await page.evaluate(CAPTION_JS, [text, FONT])


class Recorder:
    def __init__(self):
        self.frames = []   # (seconds, jpeg bytes)
        self.cdp = None

    async def follow(self, page):
        """Record this page from now on (one page at a time)."""
        await self.stop()
        self.cdp = await page.context.new_cdp_session(page)
        self.cdp.on("Page.screencastFrame", self._frame)
        await self.cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 88, "everyNthFrame": 1})

    async def _frame(self, ev):
        self.frames.append((time.monotonic(), base64.b64decode(ev["data"])))
        try:
            await self.cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})
        except Exception as e:  # the page closed between frames
            print("screencast ack failed:", e)

    async def stop(self):
        if self.cdp:
            try:
                await self.cdp.send("Page.stopScreencast")
            except Exception as e:
                print("screencast stop failed:", e)
            self.cdp = None

    def encode(self, ffmpeg, webm, gif, fps=12, gif_fps=6, gif_width=960):
        if not self.frames:
            raise RuntimeError("no frames recorded")
        t0, t1 = self.frames[0][0], self.frames[-1][0] + 1.5
        # Playwright's ffmpeg build reads JPEG frames from a pipe and writes VP8, as its own recorder does.
        enc = subprocess.Popen([ffmpeg, "-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", str(fps), "-i", "pipe:0",
                                "-an", "-c:v", "vp8", "-qmin", "0", "-qmax", "40", "-crf", "8", "-b:v", "2M", "-pix_fmt", "yuv420p", str(webm)], stdin=subprocess.PIPE)
        n, i, t = 0, 0, t0
        size = Image.open(io.BytesIO(self.frames[0][1])).size
        gif_frames = []
        while t <= t1:
            while i + 1 < len(self.frames) and self.frames[i + 1][0] <= t:
                i += 1
            img = Image.open(io.BytesIO(self.frames[i][1])).convert("RGB")
            if img.size != size:
                img = img.resize(size)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=92)
            enc.stdin.write(buf.getvalue())
            if n % max(1, fps // gif_fps) == 0:
                g = img.resize((gif_width, round(size[1] * gif_width / size[0])), Image.LANCZOS)
                gif_frames.append(g.quantize(colors=128, method=Image.Quantize.MEDIANCUT))
            n += 1
            t += 1 / fps
        enc.stdin.close()
        if enc.wait() != 0:
            raise RuntimeError(f"ffmpeg failed with {enc.returncode}")
        gif_frames[0].save(gif, save_all=True, append_images=gif_frames[1:], duration=int(1000 / gif_fps), loop=0, optimize=True)
        return n / fps
