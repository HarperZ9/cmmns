import test from "node:test";
import assert from "node:assert/strict";
import { nextStep, RESERVE, BASE_GAP_MS, MAX_RETRIES } from "../src/core/pace.js";

const NOW = 1_800_000_000_000;
const reset = (s) => Math.floor(NOW / 1000) + s;

test("with no rate headers CMMNS keeps its base gap", () => {
  assert.deepEqual(nextStep({ status: 200, now: NOW }), { delay: BASE_GAP_MS, retry: false });
});

test("remaining requests are spread over the window", () => {
  // 30 left, window resets in 300 s: one request every 10 s
  const s = nextStep({ status: 200, remaining: 30 + RESERVE, reset: reset(300), now: NOW });
  assert.equal(s.delay, 10_000);
});

test("a spread never goes faster than the base gap", () => {
  const s = nextStep({ status: 200, remaining: 500, reset: reset(60), now: NOW });
  assert.equal(s.delay, BASE_GAP_MS);
});

test("at the reserve CMMNS waits for the window to reset, leaving X's own requests room", () => {
  const s = nextStep({ status: 200, remaining: RESERVE, reset: reset(120), now: NOW });
  assert.equal(s.delay, 122_000);
});

test("a 429 waits for the reset when X gives one, and retries the handle", () => {
  assert.deepEqual(nextStep({ status: 429, reset: reset(200), now: NOW, tries: 0 }), { delay: 202_000, retry: true });
});

test("a 429 with no reset header waits five minutes", () => {
  assert.equal(nextStep({ status: 429, now: NOW, tries: 0 }).delay, 5 * 60_000);
});

test("timeouts retry, but only up to MAX_RETRIES", () => {
  assert.equal(nextStep({ status: "timeout", now: NOW, tries: 0 }).retry, true);
  assert.equal(nextStep({ status: "timeout", now: NOW, tries: MAX_RETRIES }).retry, false);
});

test("a reset time in the past is ignored", () => {
  assert.equal(nextStep({ status: 200, remaining: 1, reset: reset(-30), now: NOW }).delay, BASE_GAP_MS);
});
