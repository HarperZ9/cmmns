// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Tests for CMMNS native opt-in, localhost-only (127.0.0.1) workstation bridge.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RECEIPT_SCHEMA,
  checkTargetOriginPolicy,
  createWorkstationBridge,
  validateLoopbackEndpoint,
  verifyActionReceipt,
} from "../extension/workstation-bridge.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const BRIDGE_SRC = readFileSync(join(ROOT, "..", "extension", "workstation-bridge.js"), "utf8");

test("workstation bridge is pure ESM, zero Node-only imports, zero em dashes, zero local paths", () => {
  assert.match(BRIDGE_SRC, /SPDX-License-Identifier:\s*AGPL-3\.0-only/);
  assert.doesNotMatch(BRIDGE_SRC, /from\s+["']node:/);
  assert.doesNotMatch(BRIDGE_SRC, /[\u2013\u2014]/);
  assert.doesNotMatch(BRIDGE_SRC, /[A-Za-z]:\\|\/Users\/|\/home\//);
});

test("bridge is disabled by default and requires explicit user opt-in", async () => {
  const bridge = createWorkstationBridge({ now: () => 1764288000000 });
  assert.equal(bridge.isEnabled(), false);

  const deniedOptIn = bridge.enable({});
  assert.equal(deniedOptIn.ok, false);
  assert.equal(deniedOptIn.reason, "approval_required");
  assert.equal(bridge.isEnabled(), false);

  const res = await bridge.requestAction({
    endpoint: "http://127.0.0.1:43111/bridge",
    targetUrl: "https://example.org/article",
    action: "verify_provenance",
    approved: true,
  });
  assert.equal(res.ok, false);
  assert.equal(res.verdict, "REFUSE");
  assert.equal(res.reason, "bridge_disabled");
  assert.equal((await verifyActionReceipt(res.receipt)).ok, true);

  const okOptIn = bridge.enable({ userApproved: true });
  assert.equal(okOptIn.ok, true);
  assert.equal(bridge.isEnabled(), true);

  bridge.disable();
  assert.equal(bridge.isEnabled(), false);
});

test("strict loopback-only (127.0.0.1) endpoint enforcement rejects non-loopback and ambiguous hosts", async () => {
  assert.equal(validateLoopbackEndpoint("http://127.0.0.1:43111/bridge").ok, true);
  assert.equal(validateLoopbackEndpoint("ws://127.0.0.1:43112/ws").ok, true);

  const badEndpoints = [
    ["http://localhost:43111/bridge", "non_loopback_host"],
    ["http://0.0.0.0:43111/bridge", "non_loopback_host"],
    ["http://192.168.1.25:43111/bridge", "non_loopback_host"],
    ["http://10.0.0.5:43111/bridge", "non_loopback_host"],
    ["https://127.0.0.1:43111/bridge", "disallowed_protocol"],
    ["http://127.0.0.1.evil.example:43111/bridge", "non_loopback_host"],
    ["http://user:pass@127.0.0.1:43111/bridge", "credentials_in_endpoint"],
    ["http://127.0.0.1/bridge", "invalid_port"],
    ["file:///etc/passwd", "disallowed_protocol"],
  ];

  const bridge = createWorkstationBridge({ now: () => 1764288000000 });
  bridge.enable({ userApproved: true });

  for (const [endpoint, expectedReason] of badEndpoints) {
    const check = validateLoopbackEndpoint(endpoint);
    assert.equal(check.ok, false, `Expected refusal for ${endpoint}`);
    assert.equal(check.reason, expectedReason, `Wrong reason for ${endpoint}`);

    const res = await bridge.requestAction({
      endpoint,
      targetUrl: "https://example.org/article",
      action: "read_metadata",
      approved: true,
    });
    assert.equal(res.ok, false);
    assert.equal(res.verdict, "REFUSE");
    assert.equal(res.reason, expectedReason);
    assert.equal((await verifyActionReceipt(res.receipt)).ok, true);
  }
});

test("fail-closed refusal on login, auth, CAPTCHA, payment, password origins and DOM flags", async () => {
  const bridge = createWorkstationBridge({ now: () => 1764288000000 });
  bridge.enable({ userApproved: true });

  const sensitiveCases = [
    ["https://login.example.org/session", {}, "sensitive_origin_refused"],
    ["https://accounts.example.org/oauth2/authorize", {}, "sensitive_origin_refused"],
    ["https://example.org/signin", {}, "sensitive_path_refused"],
    ["https://challenges.cloudflare.com/turnstile", {}, "sensitive_origin_refused"],
    ["https://example.org/captcha/verify", {}, "sensitive_path_refused"],
    ["https://checkout.stripe.com/pay/cs_123", {}, "sensitive_origin_refused"],
    ["https://example.org/billing/card", {}, "sensitive_path_refused"],
    ["https://vault.bitwarden.com/items", {}, "sensitive_origin_refused"],
    ["https://example.org/reset-password", {}, "sensitive_path_refused"],
    ["chrome://settings/passwords", {}, "sensitive_scheme_refused"],
    ["file:///tmp/secret.txt", {}, "sensitive_scheme_refused"],
    ["https://example.org/portal", { hasPasswordField: true }, "password_field_refused"],
    ["https://example.org/portal", { hasCaptcha: true }, "captcha_refused"],
    ["https://example.org/portal", { hasPaymentForm: true }, "payment_form_refused"],
  ];

  for (const [targetUrl, context, expectedReason] of sensitiveCases) {
    const p = checkTargetOriginPolicy(targetUrl, context);
    assert.equal(p.ok, false, `Expected refusal for ${targetUrl}`);
    assert.equal(p.reason, expectedReason);

    const res = await bridge.requestAction({
      endpoint: "http://127.0.0.1:43111/bridge",
      targetUrl,
      action: "inspect_dom",
      approved: true,
      context,
    });
    assert.equal(res.ok, false);
    assert.equal(res.verdict, "REFUSE");
    assert.equal(res.reason, expectedReason);
    assert.equal((await verifyActionReceipt(res.receipt)).ok, true);
  }
});

test("approved loopback action executes and emits deterministic, tamper-evident SHA-256 receipts", async () => {
  const calls = [];
  const bridge = createWorkstationBridge({
    now: () => 1764288000123,
    executor: async (payload) => {
      calls.push(payload);
      return { status: "ok" };
    },
  });
  bridge.enable({ userApproved: true });

  // Unapproved action refused
  const unapproved = await bridge.requestAction({
    endpoint: "http://127.0.0.1:43111/bridge",
    targetUrl: "https://example.org/news/1",
    action: "verify_provenance",
    approved: false,
  });
  assert.equal(unapproved.ok, false);
  assert.equal(unapproved.reason, "action_not_approved");

  // Disallowed action refused
  const disallowed = await bridge.requestAction({
    endpoint: "http://127.0.0.1:43111/bridge",
    targetUrl: "https://example.org/news/1",
    action: "eval_arbitrary_js",
    approved: true,
  });
  assert.equal(disallowed.ok, false);
  assert.equal(disallowed.reason, "action_not_allowed");
  assert.equal(calls.length, 0);

  // Approved action succeeds with deterministic SHA-256 receipt (key-order invariant)
  const r1 = await bridge.requestAction({
    endpoint: "http://127.0.0.1:43111/bridge",
    targetUrl: "https://example.org/news/1",
    action: "verify_provenance",
    params: { b: 2, a: 1 },
    approved: true,
  });
  const r2 = await bridge.requestAction({
    endpoint: "http://127.0.0.1:43111/bridge",
    targetUrl: "https://example.org/news/1",
    action: "verify_provenance",
    params: { a: 1, b: 2 },
    approved: true,
  });

  assert.equal(r1.ok, true);
  assert.equal(r1.verdict, "ALLOW");
  assert.equal(r1.receipt.schema, RECEIPT_SCHEMA);
  assert.match(r1.receipt.receipt_sha256, /^[0-9a-f]{64}$/);
  assert.equal(r1.receipt.receipt_sha256, r2.receipt.receipt_sha256, "Receipts must be deterministic and key-order invariant");
  assert.equal(calls.length, 2);

  // Verify receipt passes intact and fails closed on 1-field tamper
  assert.equal((await verifyActionReceipt(r1.receipt)).ok, true);
  const tampered = { ...r1.receipt, verdict: "REFUSE" };
  const badVerify = await verifyActionReceipt(tampered);
  assert.equal(badVerify.ok, false);
  assert.equal(badVerify.reason, "receipt_digest_mismatch");
});
