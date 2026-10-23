// The thread card page: shows the card a thread panel built (src/core/evidence.js), so the user
// reads it before saving or sharing, then writes it as a PNG and a JSON. The JSON carries a SHA-256
// hash of the card; the page shows it only under "Check a copy", and the image never prints it.
// The image is always drawn light, ink on a calm ground, so a shared copy reads the same anywhere.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const id = location.hash.slice(1);
  const built = id ? await chrome.runtime.sendMessage({ type: "pb-card-get", id }) : null;
  if (!built) { $("say").textContent = "This card is no longer here. Open the thread again and choose Save card in Daylight Commons' panel."; return; }
  if (!built.ok) { $("say").textContent = built.reason; $("png").hidden = true; return; }
  const card = await PB.sealCard(built.card);
  const lines = PB.cardLines(card);
  $("hash").textContent = `${card.hash.alg} ${card.hash.value}`;
  $("say").textContent = `A card about one ${card.thread.site} thread with ${card.thread.replyAccounts} reply accounts. It names no account. Read it, then save or share it.`;

  for (const l of lines) $("lines").append(Object.assign(document.createElement(l.kind === "title" ? "h3" : "p"), { className: l.kind, textContent: l.text }));
  await Promise.all(["400 24px", "700 24px"].map((f) => document.fonts.load(`${f} "Hanken Grotesk"`))).catch(() => {});
  const png = await draw($("png"), lines);

  const base = `radar-card-${card.thread.site.toLowerCase()}-${card.hash.value.slice(0, 12)}`;
  const json = new Blob([JSON.stringify(card, null, 2)], { type: "application/json" });
  const files = [new File([png], base + ".png", { type: "image/png" }), new File([json], base + ".json", { type: "application/json" })];
  $("save").disabled = false;
  $("save").addEventListener("click", () => { for (const f of files) download(f); $("status").textContent = `Saved ${base}.png and ${base}.json.`; });
  if (navigator.canShare && navigator.canShare({ files })) {
    $("share").hidden = false;
    $("share").addEventListener("click", () => navigator.share({ files, title: "Daylight Commons thread card" }).catch((e) => { if (e.name !== "AbortError") { console.error("[daylight-commons] share failed", e); $("status").textContent = "Could not share: " + e.message; } }));
  }

  function download(file) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
})().catch((e) => { console.error("[daylight-commons] card page failed", e); document.getElementById("say").textContent = "Could not build the card: " + e.message; });

// Paints the lines onto the canvas and resolves to a PNG blob.
function draw(canvas, lines) {
  const W = 1200, PAD = 64, inner = W - 2 * PAD;
  const SANS = '"Hanken Grotesk", system-ui, sans-serif', MONO = '"JetBrains Mono", ui-monospace, Consolas, monospace';
  const STYLE = {
    title: { font: `780 44px ${SANS}`, color: "#16130f", lh: 54, before: 0 },
    meta: { font: `400 19px ${MONO}`, color: "#4a443b", lh: 28, before: 8 },
    head: { font: `720 26px ${SANS}`, color: "#16130f", lh: 34, before: 30 },
    body: { font: `400 23px ${SANS}`, color: "#16130f", lh: 33, before: 6 },
    small: { font: `400 18px ${SANS}`, color: "#4a443b", lh: 26, before: 4 },
    limit: { font: `400 19px ${SANS}`, color: "#16130f", lh: 27, before: 6 },
  };
  const ctx = canvas.getContext("2d");
  const laid = [];
  let y = PAD;
  for (const l of lines) {
    const st = STYLE[l.kind] || STYLE.body;
    ctx.font = st.font;
    y += st.before;
    for (const row of wrap(ctx, l.text, l.kind === "limit" ? inner - 18 : inner)) { laid.push({ st, row, y, limit: l.kind === "limit" }); y += st.lh; }
  }
  canvas.width = W; canvas.height = y + PAD;
  ctx.fillStyle = "#f1ece1"; ctx.fillRect(0, 0, W, canvas.height);
  ctx.textBaseline = "top";
  for (const { st, row, y: at, limit } of laid) {
    ctx.font = st.font; ctx.fillStyle = st.color;
    if (limit) ctx.fillRect(PAD, at + 2, 3, st.lh - 4);
    ctx.fillText(row, limit ? PAD + 18 : PAD, at + (st === STYLE.title ? 0 : 4));
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("the image could not be made"))), "image/png"));
}

// Word wrap; a word wider than the line (a long link or the hash) is broken by characters.
function wrap(ctx, text, width) {
  const out = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width <= width) { line = next; continue; }
    if (line) out.push(line);
    line = "";
    let w = word;
    while (ctx.measureText(w).width > width) {
      let i = w.length;
      while (i > 1 && ctx.measureText(w.slice(0, i)).width > width) i--;
      out.push(w.slice(0, i)); w = w.slice(i);
    }
    line = w;
  }
  if (line) out.push(line);
  return out;
}
