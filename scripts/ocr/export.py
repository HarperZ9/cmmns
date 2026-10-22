"""Write the trained recogniser as Daylight Commons' weight file (format in src/ocr/weights.js) and the
fixtures the JavaScript tests compare against. R&D only.

    python scripts/ocr/export.py CHECKPOINT OUT.bin FIXTURE_DIR
"""
import json
import os
import struct
import sys
import numpy as np
import torch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from train import Recogniser, ALPHABET, greedy  # noqa: E402
from prep import normalize_line  # noqa: E402

MAGIC = b"RDOCR1\n"


def fold(seq):
    """A conv (no bias) followed by batch norm, as one weight and bias."""
    conv, bn = seq[0], seq[1]
    s = bn.weight / torch.sqrt(bn.running_var + bn.eps)
    w = conv.weight * s.reshape(-1, *([1] * (conv.weight.dim() - 1)))
    return w.detach().numpy(), (bn.bias - bn.running_mean * s).detach().numpy()


def quantise(w):
    flat = w.reshape(w.shape[0], -1)
    scale = np.maximum(np.abs(flat).max(1), 1e-8) / 127.0
    q = np.clip(np.round(flat / scale[:, None]), -127, 127).astype(np.int8)
    return q, scale.astype(np.float32)


def layers(model):
    out = []
    for c, p in zip(model.convs, model.pools):
        w, b = fold(c)
        out.append(({"op": "conv2d", "cin": w.shape[1], "cout": w.shape[0], "kh": 3, "kw": 3, "pool": list(p), "relu": True}, w, b))
    out.append(({"op": "collapse"}, None, None))
    for t, res in [(model.t1, False), (model.t2, True), (model.t3, True)]:
        w, b = fold(t)
        out.append(({"op": "conv1d", "cin": w.shape[1], "cout": w.shape[0], "k": 3, "relu": True, "residual": res}, w, b))
    w, b = model.out.weight.detach().numpy(), model.out.bias.detach().numpy()
    out.append(({"op": "conv1d", "cin": w.shape[1], "cout": w.shape[0], "k": 1, "relu": False, "residual": False}, w, b))
    return out


def pad4(buf):
    buf.extend(b"\0" * (-len(buf) % 4))


def write(model, path):
    spec = layers(model)
    header = {"name": "latin", "charset": ALPHABET, "height": 32, "stride": 4, "layers": [s for s, _, _ in spec]}
    hj = json.dumps(header, ensure_ascii=False).encode("utf-8")
    buf = bytearray(MAGIC + struct.pack("<I", len(hj)) + hj)
    pad4(buf)
    deq = []
    for s, w, b in spec:
        if w is None:
            continue
        q, scale = quantise(w)
        buf += q.tobytes()
        pad4(buf)
        buf += scale.tobytes() + b.astype(np.float32).tobytes()
        deq.append((q.astype(np.float32) * scale[:, None]).reshape(w.shape))
    open(path, "wb").write(bytes(buf))
    return deq


def load_dequantised(model, deq):
    """Put the int8-rounded weights back into a plain float model, for the parity fixture."""
    m = Recogniser()
    m.eval()
    biases = [b for _, w, b in layers(model) if w is not None]
    with torch.no_grad():
        for i, seq in enumerate(list(m.convs) + [m.t1, m.t2, m.t3]):
            seq[0].weight.copy_(torch.from_numpy(deq[i]))
            bn = seq[1]
            bn.weight.fill_(1); bn.running_var.fill_(1 - bn.eps); bn.running_mean.zero_()
            bn.bias.copy_(torch.from_numpy(biases[i]))
        m.out.weight.copy_(torch.from_numpy(deq[-1])); m.out.bias.copy_(torch.from_numpy(biases[-1]))
    return m


def fixtures(qmodel, fixture_dir):
    from synth import Synth
    from fonts import TEST, available
    from text import Texts
    rng = np.random.default_rng(3)
    gray = np.round(rng.random((23, 61)) * 255, 2).astype(np.float32)
    norm = normalize_line(gray)
    s = Synth(available(TEST), Texts(os.path.join(os.environ["OCR_TEXT"], "test.txt"), 5), 5)
    lines = []
    for _ in range(4):
        img, label = s.sample()
        img = np.round(img[:, :160], 3).astype(np.float32)
        with torch.no_grad():
            sc = qmodel(torch.from_numpy(img.copy())[None, None])
        lines.append({"label": label, "width": img.shape[1], "image": [round(float(v), 3) for v in img.ravel()], "text": greedy(sc)[0],
                      "scores0": [round(float(v), 4) for v in sc[0, :, 0].numpy()]})
    os.makedirs(fixture_dir, exist_ok=True)
    json.dump({"gray": {"w": 61, "h": 23, "data": [round(float(v), 2) for v in gray.ravel()]}, "normalized": {"width": norm.shape[1], "data": [round(float(v), 6) for v in norm.ravel()]}, "lines": lines},
              open(os.path.join(fixture_dir, "ocr-parity.json"), "w"))


def main(ck, out, fixture_dir):
    model = Recogniser()
    st = torch.load(ck, map_location="cpu")
    model.load_state_dict(st.get("model", st))
    model.eval()
    deq = write(model, out)
    fixtures(load_dequantised(model, deq), fixture_dir)
    print(f"{out}: {os.path.getsize(out)} bytes")


if __name__ == "__main__":
    main(*sys.argv[1:4])
