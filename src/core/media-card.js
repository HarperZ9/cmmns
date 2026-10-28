// A text card: a post's or a selection's words set as a picture, for sharing where only pictures
// travel. It is a CMMNS rendering in the house type (Hanken Grotesk, JetBrains Mono for the
// address) on the house paper, with no avatar, icon, button or layout of any platform, and it says
// at its foot that it is a rendering and not a screenshot. Pure: the caller passes measure(text,
// font) and draws the returned list.

export const CARD = Object.freeze({ width: 1200, pad: 80, paper: "#ebe5d8", ink: "#16130f", soft: "#4a443b", rule: "#c9bfab", maxBodyLines: 36 });
const SANS = '"Hanken Grotesk", "Segoe UI", sans-serif', MONO = '"JetBrains Mono", Consolas, monospace';
export const CARD_FOOT = "CMMNS rendering of text the page showed. Not a screenshot of the post.";

// Words wrapped to maxWidth; a word wider than a line is broken by characters. Blank lines stay.
export function wrapLines(text, measure, font, maxWidth) {
  const out = [];
  for (const para of String(text || "").replace(/\r\n?/g, "\n").split("\n")) {
    if (!para.trim()) { out.push(""); continue; }
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next, font) <= maxWidth) { line = next; continue; }
      if (line) out.push(line);
      line = word;
      while (measure(line, font) > maxWidth && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut), font) > maxWidth) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    if (line) out.push(line);
  }
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}

// The drawing for one card: { width, height, background, items: [{ kind: "text" | "rule", ... }] }.
export function cardPlan(meta, measure) {
  const { width, pad, maxBodyLines } = CARD, inner = width - pad * 2, items = [];
  let y = pad;
  const text = (s, font, size, color, x = pad, lead = 1.4) => { items.push({ kind: "text", text: s, font, size, color, x, y: y + size }); y += Math.round(size * lead); };
  const who = [meta.author && meta.author.name, meta.author && meta.author.handle ? (/^u\//.test(meta.author.handle) ? meta.author.handle : "@" + meta.author.handle) : null].filter(Boolean).join("  ") || meta.site || "";
  const f = (w, size, fam) => `${w} ${size}px ${fam}`;
  if (who) text(who, f(700, 30, SANS), 30, CARD.ink);
  const when = [meta.site, meta.postedAt ? meta.postedAt.slice(0, 10) : null].filter(Boolean).join(", ");
  if (when) text(when, f(400, 22, SANS), 22, CARD.soft, pad, 2);
  if (meta.title && (meta.site === "reddit" || meta.site === "youtube" || meta.selection)) for (const l of wrapLines(meta.title, measure, f(700, 34, SANS), inner)) text(l, f(700, 34, SANS), 34, CARD.ink);
  const body = wrapLines([meta.text, ...(meta.thread || [])].filter(Boolean).join("\n\n"), measure, f(400, 34, SANS), inner);
  const shown = body.slice(0, maxBodyLines);
  if (body.length > maxBodyLines) shown[shown.length - 1] = `${shown[shown.length - 1]} …`;
  for (const l of shown) text(l, f(400, 34, SANS), 34, CARD.ink, pad, 1.45);
  if (body.length > maxBodyLines || meta.textComplete === false) text(meta.textComplete === false ? "The page showed only the start of this text." : "The rest is in the saved note.", f(400, 22, SANS), 22, CARD.soft);
  if (meta.quoted && meta.quoted.text) {
    y += 12;
    const top = y;
    for (const l of wrapLines(meta.quoted.text, measure, f(400, 26, SANS), inner - 32).slice(0, 10)) text(l, f(400, 26, SANS), 26, CARD.soft, pad + 32);
    items.push({ kind: "rule", x: pad + 8, y: top, w: 3, h: y - top });
  }
  y += 24;
  items.push({ kind: "rule", x: pad, y, w: inner, h: 1 });
  y += 20;
  const link = meta.postUrl || meta.pageUrl;
  if (link) for (const l of wrapLines(link, measure, f(400, 20, MONO), inner)) text(l, f(400, 20, MONO), 20, CARD.ink);
  text(CARD_FOOT, f(400, 18, SANS), 18, CARD.soft, pad, 1.6);
  return { width, height: y + pad - 20, background: CARD.paper, items };
}
