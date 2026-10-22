// Pacing for automatic About lookups, from X's own rate-limit headers.
// x-rate-limit-remaining and x-rate-limit-reset (epoch seconds) come back on every GraphQL
// response. Daylight Commons spreads what is left over the window and stops RESERVE requests short, so the
// viewer's own use of X is never the thing that gets limited. Without headers it keeps its base gap.

export const BASE_GAP_MS = 1500;
export const RESERVE = 5;
export const MAX_RETRIES = 2;
const NO_RESET_PAUSE_MS = 5 * 60000;
const SLACK_MS = 2000;

// { status, remaining?, reset?, now, tries? } -> { delay, retry }
export function nextStep({ status, remaining, reset, now, tries = 0 }) {
  const resetMs = Number.isFinite(reset) ? reset * 1000 : NaN;
  const window = resetMs - now;
  const hasWindow = Number.isFinite(window) && window > 0;
  const canRetry = tries < MAX_RETRIES;
  if (status === 429) return { delay: hasWindow ? window + SLACK_MS : NO_RESET_PAUSE_MS, retry: canRetry };
  if (status === "timeout" || status === "error") return { delay: BASE_GAP_MS * 4, retry: canRetry };
  if (!hasWindow || !Number.isFinite(remaining)) return { delay: BASE_GAP_MS, retry: false };
  const usable = remaining - RESERVE;
  if (usable <= 0) return { delay: window + SLACK_MS, retry: false };
  return { delay: Math.max(BASE_GAP_MS, Math.ceil(window / usable)), retry: false };
}
