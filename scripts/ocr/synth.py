"""Synthetic training lines: text drawn in a font on a screenshot-like background, degraded the way
screenshots are (blur, rescaling, JPEG, noise), cropped by the extension's own line-box rule and
normalised by prep.py. R&D only."""
import io
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from prep import luminance, line_box, normalize_line

LIGHT = [(255, 255, 255), (247, 249, 249), (250, 250, 250), (242, 242, 242), (255, 252, 240), (236, 240, 243)]
DARK = [(0, 0, 0), (21, 32, 43), (30, 30, 30), (18, 18, 18), (36, 37, 38), (13, 17, 23)]
ON_LIGHT = [(15, 20, 25), (0, 0, 0), (83, 100, 113), (29, 155, 240), (26, 13, 171), (60, 60, 60), (180, 30, 30), (0, 102, 51)]
ON_DARK = [(231, 233, 234), (255, 255, 255), (139, 152, 165), (29, 155, 240), (200, 200, 200), (255, 212, 0)]
STYLE = {"'": ["'", "’", "‘"], '"': ['"', "“", "”"], "-": ["-", "-", "-", "–", "—"]}


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


class Synth:
    def __init__(self, fonts, texts, seed):
        self.r = random.Random(seed)
        self.np = np.random.default_rng(seed)
        self.fonts, self.texts, self.cache = fonts, texts, {}

    def font(self, path, size):
        k = (path, size)
        if k not in self.cache:
            if len(self.cache) > 600:
                self.cache.clear()
            self.cache[k] = ImageFont.truetype(path, size)
        return self.cache[k]

    def colours(self):
        r = self.r
        if r.random() < 0.12:
            bg = tuple(r.randint(0, 255) for _ in range(3))
            light = lum(bg) < 128
            fg = tuple(r.randint(215, 255) for _ in range(3)) if light else tuple(r.randint(0, 40) for _ in range(3))
            return bg, fg
        if r.random() < 0.65:
            return r.choice(LIGHT), r.choice(ON_LIGHT)
        return r.choice(DARK), r.choice(ON_DARK)

    def styled(self, label):
        r = self.r
        return "".join(r.choice(STYLE[c]) if c in STYLE and r.random() < 0.35 else c for c in label)

    def sample(self):
        """One (image 32 x W float32, label) pair."""
        for _ in range(30):
            out = self._try()
            if out is not None:
                return out
        raise RuntimeError("could not draw a line")

    def _try(self):
        r = self.r
        if r.random() < 0.04:
            return self.blank()
        size = int(r.choice([r.randint(9, 16), r.randint(12, 22), r.randint(12, 22), r.randint(18, 56)]))
        font = self.font(r.choice(self.fonts), size)
        label = self.texts.sample(max_words=r.choice([4, 8, 12, 16]))
        drawn = self.styled(label)
        if any(font.getmask(ch).getbbox() is None for ch in set(drawn) - {" "}):
            return None
        bg, fg = self.colours()
        spacing = size * r.uniform(1.15, 1.7)
        width = int(font.getlength(drawn)) + 4 * size
        if width > 6000:
            return None
        H = int(size * 4 + 2 * spacing)
        img = Image.new("RGB", (width, H), bg)
        img = self.texture(img)
        d = ImageDraw.Draw(img)
        x, y = 2 * size + r.randint(0, 3), int(spacing + size * 0.5)
        for dy in (-spacing, spacing):
            if r.random() < 0.45:
                d.text((x + r.randint(-size, size), y + dy), self.texts.sample(16), font=font, fill=fg)
        d.text((x, y), drawn, font=font, fill=fg)
        mask = Image.new("L", (width, H), 0)
        ImageDraw.Draw(mask).text((x, y), drawn, font=font, fill=255)
        contrast = abs(lum(fg) - lum(bg)) or 1
        ys, xs = np.nonzero(np.asarray(mask) > 255 * min(0.9, 28 / contrast))
        if not len(xs):
            return None
        img = self.degrade(img)
        box = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
        j = max(1, round((box[3] - box[1]) * 0.08))
        box = [b + r.randint(-j, j) for b in box]
        if box[3] - box[1] < 5 or box[2] - box[0] < 3:
            return None
        x0, y0, x1, y1 = line_box(*box, width, H)
        line = normalize_line(luminance(np.asarray(img)[y0:y1, x0:x1]))
        if line.shape[1] > 1600:
            return None
        return line, label

    def texture(self, img):
        k = self.r.random()
        if k < 0.08:
            a = np.asarray(img).astype(np.float32)
            g = np.linspace(0, self.r.uniform(-40, 40), a.shape[1], dtype=np.float32)[None, :, None]
            return Image.fromarray(np.clip(a + g, 0, 255).astype(np.uint8))
        if k < 0.14:
            a = np.asarray(img).astype(np.float32) + self.np.normal(0, self.r.uniform(2, 10), (img.size[1], img.size[0], 1))
            return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
        return img

    def degrade(self, img):
        r = self.r
        if r.random() < 0.25:
            f = r.uniform(0.55, 0.95)
            small = img.resize((max(1, int(img.width * f)), max(1, int(img.height * f))), Image.BILINEAR)
            img = small.resize(img.size, r.choice([Image.BILINEAR, Image.BICUBIC]))
        if r.random() < 0.2:
            img = img.filter(ImageFilter.GaussianBlur(r.uniform(0.3, 0.9)))
        if r.random() < 0.45:
            buf = io.BytesIO()
            img.save(buf, "JPEG", quality=r.randint(25, 92))
            img = Image.open(io.BytesIO(buf.getvalue())).convert("RGB")
        return img

    def blank(self):
        """A crop with no text: an icon-like ring or a photo-like patch, labelled empty."""
        r = self.r
        h, w = r.randint(10, 60), r.randint(10, 200)
        if r.random() < 0.5:
            img = Image.new("RGB", (w, h), r.choice(LIGHT + DARK))
            ImageDraw.Draw(img).ellipse([r.randint(0, w // 3), 0, r.randint(w // 2, w - 1), h - 1], outline=r.choice(ON_LIGHT), width=r.randint(1, 3))
        else:
            a = self.np.integers(0, 255, (h // 4 + 1, w // 4 + 1, 3), dtype=np.uint8)
            img = Image.fromarray(a).resize((w, h), Image.BICUBIC)
        return normalize_line(luminance(np.asarray(img))), ""
