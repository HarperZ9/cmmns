// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Live integration tests for CMMNS loopback Chrome relay (relay/cmmns-relay.mjs)
// and extension client (src/ext/workstation-relay-client.js).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createCmmnsRelay, verifyReceiptChain } from "../relay/cmmns-relay.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const RELAY_SRC = readFileSync(join(ROOT, "..", "relay", "cmmns-relay.mjs"), "utf8");
const EXT_CLIENT_SRC = readFileSync(join(ROOT, "..", "src", "ext", "workstation-relay-client.js"), "utf8");

test("relay refuses non-loopback bind host fail-closed and satisfies hygiene invariants", () => {
  assert.throws(() => createCmmnsRelay({ host: "0.0.0.0", port: 0 }), /Strict loopback-only bind/);
  assert.throws(() => createCmmnsRelay({ host: "localhost", port: 0 }), /Strict loopback-only bind/);
  assert.doesNotMatch(RELAY_SRC, /[\u2013\u2014]/);
  assert.doesNotMatch(EXT_CLIENT_SRC, /[\u2013\u2014]/);
});

test("live loopback relay enforces opt-in gate, CAPTCHA/auth handoff, WS round-trip, kill, and SHA-256 chain", async () => {
  let clock = 1764290000000;
  const relay = createCmmnsRelay({ host: "127.0.0.1", port: 0, now: () => (clock += 10) });
  const addr = await relay.start();
  assert.equal(addr.host, "127.0.0.1");
  assert.ok(addr.port > 0);

  const post = async (path, body) => {
    const r = await fetch(`${addr.url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: r.status, json: await r.json() };
  };

  try {
    // 1. /health and /status report disabled by default
    const h = await fetch(`${addr.url}/health`).then((r) => r.json());
    assert.equal(h.ok, true);
    assert.equal(h.host, "127.0.0.1");
    assert.equal(h.enabled, false);
    assert.equal(h.killed, false);

    const st0 = await fetch(`${addr.url}/status`).then((r) => r.json());
    assert.equal(st0.ok, true);
    assert.equal(st0.enabled, false);

    // 2. Command before opt-in is refused fail-closed with chained receipt
    const beforeOptIn = await post("/command", {
      action: "verify_provenance",
      targetUrl: "https://example.org/post/1",
      approved: true,
    });
    assert.equal(beforeOptIn.status, 403);
    assert.equal(beforeOptIn.json.reason, "bridge_disabled");

    // 3. Opt-in requires explicit userApproved: true
    const badEnable = await post("/enable", {});
    assert.equal(badEnable.status, 403);
    assert.equal(badEnable.json.reason, "approval_required");

    const okEnable = await post("/enable", { userApproved: true });
    assert.equal(okEnable.status, 200);
    assert.equal(okEnable.json.enabled, true);

    // 4. Live RFC 6455 WebSocket extension client connects, registers tabs, and answers commands
    const ws = new WebSocket(`ws://127.0.0.1:${addr.port}/ws`);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    ws.send(JSON.stringify({
      type: "cmmns-relay-tabs",
      tabs: [{ id: 1, url: "https://example.org/post/1", title: "Example Post" }],
    }));
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.type === "cmmns-relay-command") {
        ws.send(JSON.stringify({ type: "cmmns-relay-result", id: msg.id, ok: true, verdict: "ALLOW", echoed: msg.action }));
      }
    });
    await new Promise((r) => setTimeout(r, 40));

    const tabs = await fetch(`${addr.url}/tabs`).then((r) => r.json());
    assert.equal(tabs.ok, true);
    assert.equal(tabs.connected_clients, 1);
    assert.equal(tabs.tabs.length, 1);

    // 5. Fail-closed user-observed handoff on Google Sign-In, Google Pay, CAPTCHA, login, and password pages
    for (const [targetUrl, context, expectedReason, expectedGate] of [
      ["https://challenges.cloudflare.com/turnstile", {}, "sensitive_origin_refused", "captcha"],
      ["https://accounts.google.com/o/oauth2/v2/auth", {}, "sensitive_origin_refused", "auth"],
      ["https://pay.google.com/gp/w/u/0/home/paymentmethods", {}, "sensitive_origin_refused", "payment"],
      ["https://checkout.stripe.com/pay/123", {}, "sensitive_origin_refused", "payment"],
      ["https://example.org/page", { hasCaptcha: true }, "captcha_refused", "captcha"],
      ["https://example.org/page", { hasPasswordField: true }, "password_field_refused", "auth"],
    ]) {
      const refused = await post("/command", {
        action: "inspect_dom",
        targetUrl,
        context,
        approved: true,
      });
      assert.equal(refused.status, 403);
      assert.equal(refused.json.state, "handoff_required");
      assert.equal(refused.json.verdict, "HANDOFF");
      assert.equal(refused.json.handoff_required, true);
      assert.equal(refused.json.user_observed, true);
      assert.equal(refused.json.gate_kind, expectedGate);
      assert.equal(refused.json.reason, expectedReason);
      assert.ok(refused.json.pre_receipt && refused.json.pre_receipt.receipt.receipt_sha256);
    }

    // 5b. Automated commands stay paused while handoff_required; resume requires explicit operator confirmation
    const pausedCmd = await post("/command", {
      action: "verify_provenance",
      targetUrl: "https://example.org/post/1",
      approved: true,
    });
    assert.equal(pausedCmd.status, 403);
    assert.equal(pausedCmd.json.reason, "handoff_pending");

    const badResume = await post("/handoff/resume", { operatorConfirmed: true });
    assert.equal(badResume.status, 403);
    assert.equal(badResume.json.reason, "operator_confirmation_required");

    const okResume = await post("/handoff/resume", { operatorConfirmed: true, userObserved: true });
    assert.equal(okResume.status, 200);
    assert.equal(okResume.json.state, "ready");
    assert.equal(okResume.json.user_observed, true);
    assert.ok(okResume.json.post_receipt && okResume.json.post_receipt.receipt.receipt_sha256);

    // 6. Approved safe command succeeds over live WS and appends verifiable receipt
    const okCmd = await post("/command", {
      action: "verify_provenance",
      targetUrl: "https://example.org/post/1",
      params: { check: "c2pa" },
      approved: true,
    });
    assert.equal(okCmd.status, 200);
    assert.equal(okCmd.json.verdict, "ALLOW");
    assert.equal(okCmd.json.result.echoed, "verify_provenance");

    // 7. Instant kill switch stops relay and refuses subsequent commands
    const killRes = await post("/kill", { reason: "operator_stop" });
    assert.equal(killRes.status, 200);
    assert.equal(killRes.json.verdict, "KILLED");

    const afterKill = await post("/command", {
      action: "read_metadata",
      targetUrl: "https://example.org/post/1",
      approved: true,
    });
    assert.equal(afterKill.status, 403);
    assert.equal(afterKill.json.reason, "relay_killed");

    // 8. Verify full SHA-256 receipt chain intact AND tamper-evident
    const receiptsResp = await fetch(`${addr.url}/receipts`).then((r) => r.json());
    assert.equal(receiptsResp.ok, true);
    assert.equal(receiptsResp.chain_valid, true);
    assert.ok(receiptsResp.count >= 8);

    const tampered = structuredClone(receiptsResp.receipts);
    tampered[0].receipt.verdict = "ALLOW";
    const badChain = await verifyReceiptChain(tampered);
    assert.equal(badChain.ok, false);
  } finally {
    await relay.stop();
  }
});

test("extension workstation-relay-client defaults disabled, enforces 127.0.0.1, and hands off CAPTCHA/auth", () => {
  const sandbox = { globalThis: {}, URL, console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(EXT_CLIENT_SRC, sandbox);
  const client = sandbox.PBWorkstationRelay;
  assert.ok(client);
  assert.equal(client.status().enabled, false);
  assert.equal(client.enable({}).ok, false);
  assert.equal(client.enable({ userApproved: true, wsUrl: "ws://evil.example:19989/ws" }).ok, false);
  assert.equal(client.enable({ userApproved: true }).ok, true);

  const captchaHandoff = client.handleIncomingCommand({ action: "inspect_dom", targetUrl: "https://example.org/p", context: { hasCaptcha: true } });
  assert.equal(captchaHandoff.verdict, "HANDOFF");
  assert.equal(captchaHandoff.reason, "captcha_refused");

  const ok = client.handleIncomingCommand({ action: "verify_provenance", targetUrl: "https://example.org/article" });
  assert.equal(ok.ok, true);
  assert.equal(ok.verdict, "ALLOW");

  client.kill();
  assert.equal(client.handleIncomingCommand({ action: "verify_provenance", targetUrl: "https://example.org/article" }).reason, "relay_killed");
});
