// The window's "This was right" and "This was wrong" controls, and the user's own calibration line.
// Marks live in chrome.storage.local under PB.FEEDBACK_KEY, in this browser only. Nothing is sent:
// the options page can save them to a file, and the user decides what to do with that file.
(() => {
  "use strict";
  const api = (globalThis.chrome && chrome.storage && chrome.storage.local) || null;
  const KEY = PB.FEEDBACK_KEY;
  let mirror = {};
  const ready = api ? api.get(KEY).then((r) => { mirror = r[KEY] || {}; }).catch((e) => PBGuard.report("could not read feedback", e)) : Promise.resolve();
  if (api && chrome.storage.onChanged) chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[KEY]) mirror = ch[KEY].newValue || {}; });

  // Writes are read-modify-write on one key, so they run one after another.
  let chain = Promise.resolve();
  function write(next) {
    mirror = next;
    chain = chain.then(() => (api ? api.set({ [KEY]: next }) : null)).catch((e) => PBGuard.report("could not save feedback", e));
    return chain;
  }
  const record = (entry) => write(PB.addFeedback(mirror, entry));
  const undo = (id) => write(PB.removeFeedback(mirror, id));

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };

  // f: { sign: { fam, label }, postId, threadKey, text }
  function control(f) {
    const id = PB.signId(f.sign, f.postId);
    const box = el("div", "pb-fb");
    const status = el("span", "pb-fb-status");
    status.setAttribute("role", "status");
    let include = null;
    const buttons = [["right", "This was right"], ["wrong", "This was wrong"]].map(([verdict, label]) => {
      const b = el("button", "pb-btn", label); b.type = "button"; b.dataset.verdict = verdict;
      b.addEventListener("click", (e) => {
        stop(e);
        record(PB.makeEntry({ ...f, verdict, includeText: !!(include && include.checked) }));
        paint();
      });
      return b;
    });
    const undoBtn = el("button", "pb-btn pb-fb-undo", "Undo"); undoBtn.type = "button";
    undoBtn.addEventListener("click", (e) => { stop(e); undo(id); paint(); });
    box.append(...buttons);
    if (f.text) {
      const lab = el("label", "pb-fb-text");
      include = el("input"); include.type = "checkbox";
      include.addEventListener("click", (e) => e.stopPropagation());
      lab.append(include, document.createTextNode(" include the text"));
      box.append(lab);
    }
    box.append(status, undoBtn);
    function paint() {
      const v = PB.verdictOf(mirror, id);
      for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.verdict === v));
      status.textContent = v ? `Marked ${v}. Kept in this browser only.` : "";
      undoBtn.hidden = !v;
    }
    paint();
    return box;
  }

  // Rows the window adds under a sign's "Measured" line: the user's own count once there are
  // enough marks on the family, then the controls.
  function rows(sign, m) {
    if (!sign || !sign.fam) return [];
    const c = PB.calibration(mirror, sign.fam);
    const out = [];
    if (c) out.push(["Your feedback", `${c.right} of ${c.total} right (your own marks in this browser)`]);
    out.push(["Was this right?", { feedback: { sign: { fam: sign.fam, label: sign.label }, postId: m.postId || null, threadKey: m.threadKey || null, text: m.text || null } }]);
    return out;
  }

  const all = () => mirror;
  async function clear() { await chain; mirror = {}; if (api) await api.remove(KEY); }

  globalThis.PBFeedback = Object.freeze({ ready, rows, control, all, clear });
})();
