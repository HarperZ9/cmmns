// Where to take frames from a video the page already loaded, for a reverse search of its frames.
// Frames come from the part the browser has buffered, so taking them fetches nothing new where
// the player allows; the window restores the playing position afterwards.

// duration in seconds; buffered as [[start, end], ...]; n frames. Times rounded to 0.1 s.
export function keyframeTimes(duration, buffered, n = 4) {
  const ranges = (buffered || []).map(([s, e]) => [Math.max(0, s), Number.isFinite(duration) ? Math.min(e, duration) : e]).filter(([s, e]) => e > s);
  let lo, hi;
  if (ranges.length) { lo = Math.min(...ranges.map((r) => r[0])); hi = Math.max(...ranges.map((r) => r[1])); }
  else if (Number.isFinite(duration) && duration > 0) { lo = 0; hi = duration; }
  else return [];
  const span = hi - lo, k = Math.max(1, n);
  const out = [];
  for (let i = 0; i < k; i++) out.push(Math.round((lo + span * (k === 1 ? 0.5 : 0.1 + (0.8 * i) / (k - 1))) * 10) / 10);
  return [...new Set(out)];
}
