"""Train the Latin line recogniser on synthetic lines. R&D only: PyTorch never ships; export.py
writes the weights the extension reads.

    python scripts/ocr/train.py --text DIR --out DIR [--steps N] [--device cuda]

Checkpoints every 2000 steps to OUT/last.pt and resumes from it, so a stopped run continues.
"""
import argparse
import os
import sys
import time
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, IterableDataset

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fonts import TRAIN, TEST, available  # noqa: E402
from text import Texts, CHARSET  # noqa: E402
from synth import Synth  # noqa: E402

ALPHABET = "\0" + CHARSET          # index 0 is the CTC blank, as in src/ocr/charset.js
INDEX = {c: i for i, c in enumerate(ALPHABET)}


class Lines(IterableDataset):
    def __init__(self, fonts, text, seed):
        self.fonts, self.text, self.seed = fonts, text, seed

    def __iter__(self):
        info = torch.utils.data.get_worker_info()
        wid = info.id if info else 0
        s = Synth(self.fonts, Texts(self.text, self.seed * 1000 + wid), self.seed * 1000 + wid)
        while True:
            img, label = s.sample()
            if img.shape[1] // 4 >= need(label):
                yield img, label


def quiet_worker(_):
    torch.set_num_threads(1)


def need(label):
    return len(label) + sum(1 for a, b in zip(label, label[1:]) if a == b)


def collate(batch):
    W = max(-(-b[0].shape[1] // 4) * 4 for b in batch)
    x = torch.zeros(len(batch), 1, 32, W)
    for i, (img, _) in enumerate(batch):
        x[i, 0, :, : img.shape[1]] = torch.from_numpy(img.copy())
    targets = torch.tensor([INDEX[c] for _, l in batch for c in l], dtype=torch.long)
    return x, targets, torch.tensor([b[0].shape[1] // 4 for b in batch]), torch.tensor([len(l) for _, l in batch]), [l for _, l in batch]


class Recogniser(nn.Module):
    """Mirrors the layer list export.py writes and src/ocr/model.js runs."""

    def __init__(self, classes=len(ALPHABET)):
        super().__init__()
        def block(i, o):
            return nn.Sequential(nn.Conv2d(i, o, 3, padding=1, bias=False), nn.BatchNorm2d(o), nn.ReLU())
        self.convs = nn.ModuleList([block(1, 16), block(16, 32), block(32, 64), block(64, 96)])
        self.pools = [(2, 2), (2, 2), (2, 1), (2, 1)]
        def t(i, o):
            return nn.Sequential(nn.Conv1d(i, o, 3, padding=1, bias=False), nn.BatchNorm1d(o), nn.ReLU())
        self.t1, self.t2, self.t3 = t(192, 128), t(128, 128), t(128, 128)
        self.out = nn.Conv1d(128, classes, 1)
        self.drop = nn.Dropout(0.1)

    def forward(self, x):
        for c, p in zip(self.convs, self.pools):
            x = nn.functional.max_pool2d(c(x), p)
        n, ch, h, w = x.shape
        x = self.t1(x.reshape(n, ch * h, w))
        x = self.t2(x) + x
        x = self.t3(x) + x
        return self.out(self.drop(x))   # N x classes x T


def greedy(scores):
    best = scores.argmax(1).cpu().tolist()
    out = []
    for row in best:
        s, prev = [], 0
        for k in row:
            if k and k != prev:
                s.append(ALPHABET[k])
            prev = k
        out.append("".join(s))
    return out


def edits(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def evaluate(model, loader, device, batches=20):
    model.eval()
    errs = chars = 0
    with torch.no_grad():
        for i, (x, _, _, _, labels) in enumerate(loader):
            if i >= batches:
                break
            for hyp, ref in zip(greedy(model(x.to(device))), labels):
                errs += edits(hyp, ref.strip())
                chars += max(1, len(ref.strip()))
    model.train()
    return errs / chars


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--steps", type=int, default=60000)
    ap.add_argument("--batch", type=int, default=96)
    ap.add_argument("--workers", type=int, default=20)
    ap.add_argument("--device", default="cuda")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    dev = torch.device(a.device)
    train = DataLoader(Lines(available(TRAIN), os.path.join(a.text, "train.txt"), 1), batch_size=a.batch, collate_fn=collate, num_workers=a.workers, persistent_workers=True, prefetch_factor=4, worker_init_fn=quiet_worker)
    val = DataLoader(Lines(available(TEST), os.path.join(a.text, "test.txt"), 99), batch_size=100, collate_fn=collate, num_workers=2)
    model = Recogniser().to(dev)
    opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=2e-3, total_steps=a.steps, pct_start=0.05)
    ctc = nn.CTCLoss(blank=0, zero_infinity=True)
    step, ck = 0, os.path.join(a.out, "last.pt")
    if os.path.exists(ck):
        st = torch.load(ck, map_location=dev)
        model.load_state_dict(st["model"]); opt.load_state_dict(st["opt"]); sched.load_state_dict(st["sched"]); step = st["step"]
        print(f"resumed at step {step}", flush=True)
    t0, run = time.time(), 0.0
    for x, tg, il, tl, _ in train:
        if step >= a.steps:
            break
        logp = model(x.to(dev)).log_softmax(1).permute(2, 0, 1)
        loss = ctc(logp, tg.to(dev), il.to(dev), tl.to(dev))
        opt.zero_grad(set_to_none=True)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 5.0)
        opt.step(); sched.step(); step += 1
        run = 0.98 * run + 0.02 * loss.item()
        if step % 500 == 0:
            print(f"step {step} loss {run:.3f} {(time.time() - t0) / 500 * 1000:.0f} ms/step", flush=True)
            t0 = time.time()
        if step % 2000 == 0 or step == a.steps:
            cer = evaluate(model, val, dev)
            print(f"step {step} held-out-font CER {cer:.4f}", flush=True)
            torch.save({"model": model.state_dict(), "opt": opt.state_dict(), "sched": sched.state_dict(), "step": step}, ck + ".tmp")
            os.replace(ck + ".tmp", ck)
    torch.save(model.state_dict(), os.path.join(a.out, "final.pt"))
    print("done", flush=True)


if __name__ == "__main__":
    main()
