// A video's transcript in two forms: timestamped lines ("[00:01:23] words") and plain paragraphs.
// The segments come from a WebVTT caption file (yt-dlp on the command line), from the transcript
// panel the watch page drew, or from the panel's own data the page received (get_transcript).
// Pure: no DOM and no request.

const pad = (n) => String(n).padStart(2, "0");
// Seconds as "HH:MM:SS".
export function clockOf(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
// "1:02:03", "02:03" or "2:03.500" as seconds; null when it is not a time.
export function secondsOf(t) {
  const m = /^\s*(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?\s*$/.exec(String(t || ""));
  if (!m) return null;
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + (m[4] ? Number(m[4].padEnd(3, "0")) / 1000 : 0);
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
const unescape = (s) => s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+|#39);/gi, (all, e) => {
  if (ENTITIES[e.toLowerCase()] != null) return ENTITIES[e.toLowerCase()];
  if (/^#x/i.test(e)) return String.fromCodePoint(parseInt(e.slice(2), 16));
  if (/^#\d+$/.test(e)) return String.fromCodePoint(Number(e.slice(1)));
  return all;
});
const words = (s) => unescape(String(s || "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

// WebVTT cues as segments { start, end, text }, in seconds. Machine captions repeat the line before
// on every cue and grow a line across cues; a line already said is dropped, and a line that only
// extends the one before replaces it, so each spoken line is kept once.
export function vttSegments(vtt) {
  const out = [], said = [];
  const blocks = String(vtt || "").replace(/\r\n?/g, "\n").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n");
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at < 0) continue;
    const [a, b] = lines[at].split("-->").map((x) => secondsOf(x.trim().split(/\s+/)[0]));
    if (a == null) continue;
    for (const raw of lines.slice(at + 1)) {
      const text = words(raw);
      if (!text || said.includes(text)) continue;
      const last = out[out.length - 1];
      if (last && text.startsWith(last.text)) { last.text = text; last.end = b ?? last.end; said[said.length - 1] = text; continue; }
      out.push({ start: a, end: b ?? a, text });
      said.push(text);
      if (said.length > 4) said.shift();
    }
  }
  return out;
}

// The transcript panel as the page drew it: lines of "1:23 words" (yt-reference.js transcript()).
export function panelSegments(lines) {
  return (lines || []).map((l) => {
    const m = /^\s*((?:\d+:)?\d{1,2}:\d{2})\s+([\s\S]+)$/.exec(String(l || ""));
    return m ? { start: secondsOf(m[1]), end: null, text: words(m[2]) } : null;
  }).filter((s) => s && s.text);
}

// The panel's own data (YouTube's get_transcript answer): transcriptSegmentRenderer { startMs, endMs, snippet }.
export function dataSegments(json) {
  const out = [], stack = [json];
  for (let n = 0; stack.length && n < 400000; n++) {
    const v = stack.pop();
    if (!v || typeof v !== "object") continue;
    const s = v.transcriptSegmentRenderer;
    if (s && s.startMs != null) {
      const snip = s.snippet || {}, text = words(snip.simpleText || (snip.runs || []).map((r) => r.text).join(""));
      if (text) out.push({ start: Number(s.startMs) / 1000, end: s.endMs != null ? Number(s.endMs) / 1000 : null, text });
      continue;
    }
    for (const k in v) if (v[k] && typeof v[k] === "object") stack.push(v[k]);
  }
  return out.sort((a, b) => a.start - b.start);
}

// "[00:01:23] words", one segment a line.
export const timedTranscript = (segs) => (segs || []).map((s) => `[${clockOf(s.start)}] ${s.text}`).join("\n") + ((segs || []).length ? "\n" : "");

// The words alone, as paragraphs: a new one after a pause of 3 s or more, or after about 120 words.
export function plainTranscript(segs) {
  const paras = [];
  let cur = [], count = 0, prevEnd = null;
  for (const s of segs || []) {
    const gap = prevEnd != null && s.start != null ? s.start - prevEnd : 0;
    if (cur.length && (gap >= 3 || count >= 120)) { paras.push(cur.join(" ")); cur = []; count = 0; }
    cur.push(s.text); count += s.text.split(" ").length; prevEnd = s.end ?? s.start;
  }
  if (cur.length) paras.push(cur.join(" "));
  return paras.length ? paras.join("\n\n") + "\n" : "";
}
