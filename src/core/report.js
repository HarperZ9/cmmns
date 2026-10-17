// The thread norm report: are the most extreme replies coming disproportionately from accounts
// with authenticity flags? It compares the flagged share among extreme replies with the flagged
// share among the other replies, each with a 95% Wilson interval. Replies whose account has not
// been looked up are left out of both groups and counted as coverage.
//
// What it does not prove: a skew can come from how the platform ranks replies, from which
// accounts the viewer happened to look up, or from real people who joined during the event.

import { score } from "./rhetoric.js";
import { isFlagged } from "./flags.js";

export const MIN_EXTREME = 10;   // below this, the report says "too few to compare"

export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - r) / d), Math.min(1, (c + r) / d)];
}

const pct = (x) => Math.round(x * 100);

// replies: [{ id, author, text, flags: [...] | null }]  (null = account not looked up)
export function threadReport(replies) {
  const known = [], unknown = [];
  for (const r of replies) (Array.isArray(r.flags) ? known : unknown).push(r);
  const rows = known.map((r) => ({ ...r, extreme: score(r.text).extreme, flagged: isFlagged(r.flags) }));
  const ext = rows.filter((r) => r.extreme), rest = rows.filter((r) => !r.extreme);
  const kE = ext.filter((r) => r.flagged).length, kR = rest.filter((r) => r.flagged).length;
  const out = {
    replies: replies.length,
    lookedUp: known.length,
    notLookedUp: unknown.length,
    extreme: { n: ext.length, flagged: kE, share: ext.length ? kE / ext.length : 0, ci: wilson(kE, ext.length) },
    others: { n: rest.length, flagged: kR, share: rest.length ? kR / rest.length : 0, ci: wilson(kR, rest.length) },
  };
  out.verdict = verdict(out);
  out.sentence = sentence(out);
  return out;
}

// "skewed" only when the two intervals do not overlap; the report never goes further than that.
function verdict(r) {
  if (r.extreme.n < MIN_EXTREME) return "too-few";
  if (r.extreme.ci[0] > r.others.ci[1]) return "skewed-to-flagged";
  if (r.extreme.ci[1] < r.others.ci[0]) return "skewed-away";
  return "no-clear-difference";
}

function sentence(r) {
  const e = r.extreme, o = r.others;
  const base = `${e.flagged} of ${e.n} extreme replies (${pct(e.share)}%) come from flagged accounts, against ${o.flagged} of ${o.n} other replies (${pct(o.share)}%).`;
  const cover = r.notLookedUp ? ` ${r.notLookedUp} replies are left out because their accounts were not looked up.` : "";
  switch (r.verdict) {
    case "too-few": return `Too few extreme replies to compare (${e.n}; the report needs ${MIN_EXTREME}).${cover}`;
    case "skewed-to-flagged": return `${base} The difference is larger than the uncertainty.${cover}`;
    case "skewed-away": return `${base} Extreme replies come less often from flagged accounts here.${cover}`;
    default: return `${base} The difference is within the uncertainty.${cover}`;
  }
}

export const DOES_NOT_PROVE = "A skew can come from how the platform ranks replies, from which accounts were looked up, or from real people who joined during the event. It says nothing about any one reply or account.";
