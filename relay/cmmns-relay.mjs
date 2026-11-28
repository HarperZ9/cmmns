#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// CMMNS Live Loopback Chrome Relay + Accountable-Surface Harness Bridge.
// Pure Node stdlib (node:http, node:crypto, node:fs) + RFC 6455 WebSocket on 127.0.0.1:19989.
// Zero npm dependencies, disabled by default until explicitly opted-in, strict loopback-only bind,
// fail-closed human handoff on login/auth/CAPTCHA/payment/password pages, and append-only
// chained SHA-256 receipts (cmmns-workstation-bridge-receipt/1).

import http from "node:http";
import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ALLOWED_ACTIONS,
  RECEIPT_SCHEMA,
  buildActionReceipt,
  canonicalJson,
  checkTargetOriginPolicy,
  sha256Hex,
  verifyActionReceipt,
} from "../extension/workstation-bridge.js";

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 19989;
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const ALLOWED_ACTION_SET = new Set(ALLOWED_ACTIONS);

function encodeWsFrame(opcode, payloadBuf) {
  const len = payloadBuf.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payloadBuf]);
}

function decodeWsFrames(buf) {
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buf.length) {
    const b0 = buf[offset];
    const b1 = buf[offset + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let payloadLen = b1 & 0x7f;
    let pos = offset + 2;
    if (payloadLen === 126) {
      if (pos + 2 > buf.length) break;
      payloadLen = buf.readUInt16BE(pos);
      pos += 2;
    } else if (payloadLen === 127) {
      if (pos + 8 > buf.length) break;
      payloadLen = Number(buf.readBigUInt64BE(pos));
      pos += 8;
    }
    const maskLen = masked ? 4 : 0;
    if (pos + maskLen + payloadLen > buf.length) break;
    const mask = masked ? buf.subarray(pos, pos + 4) : null;
    pos += maskLen;
    const payload = Buffer.from(buf.subarray(pos, pos + payloadLen));
    if (mask) {
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    }
    frames.push({ opcode, payload });
    offset = pos + payloadLen;
  }
  return { frames, remaining: buf.subarray(offset) };
}

export async function verifyReceiptChain(entries) {
  if (!Array.isArray(entries)) return { ok: false, reason: "entries_not_array" };
  let prev = "0".repeat(64);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry || typeof entry !== "object") return { ok: false, reason: "malformed_entry", index: i };
    const rCheck = await verifyActionReceipt(entry.receipt);
    if (!rCheck.ok) return { ok: false, reason: rCheck.reason, index: i };
    if (entry.prev_chain_sha256 !== prev) {
      return { ok: false, reason: "chain_prev_mismatch", index: i };
    }
    const expectedChain = await sha256Hex(canonicalJson({
      index: i,
      prev_chain_sha256: prev,
      receipt_sha256: entry.receipt.receipt_sha256,
    }));
    if (entry.chain_sha256 !== expectedChain) {
      return { ok: false, reason: "chain_digest_mismatch", index: i };
    }
    prev = expectedChain;
  }
  return { ok: true, count: entries.length, chain_head: prev };
}

function readJsonBody(req, maxBytes = 1024 * 256) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (c) => {
      total += c.length;
      if (total > maxBytes) {
        reject(new Error("body_too_large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (chunks.length === 0) { resolve({}); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new Error("invalid_json")); }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  const body = `${JSON.stringify(obj)}\n`;
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

export function classifyGateKind(targetUrl, context = {}, reason = "") {
  const s = `${String(targetUrl || "")} ${String(reason || "")}`.toLowerCase();
  if ((context && context.hasCaptcha === true) || /captcha|recaptcha|hcaptcha|turnstile|arkose|challenge|bot-check/.test(s)) {
    return "captcha";
  }
  if ((context && context.hasPaymentForm === true) || /pay\.google\.com|payment|checkout|billing|stripe|paypal|adyen|braintree|square|bank|wallet|card/.test(s)) {
    return "payment";
  }
  return "auth";
}

export function createCmmnsRelay(options = {}) {
  const host = options.host ?? DEFAULT_HOST;
  if (host !== "127.0.0.1") {
    throw new Error(`Strict loopback-only bind enforced: refused host "${host}" (only 127.0.0.1 allowed)`);
  }
  const requestedPort = options.port ?? DEFAULT_PORT;
  const logPath = options.logPath || null;
  const nowFn = typeof options.now === "function" ? options.now : () => Date.now();

  let enabled = false;
  let killed = false;
  let handoffRequired = false;
  let handoffReason = null;
  let handoffGateKind = null;
  let boundPort = requestedPort;
  let chainHead = "0".repeat(64);
  let nextCmdId = 1;

  function currentState() {
    if (killed) return "killed";
    if (handoffRequired) return "handoff_required";
    return enabled ? "ready" : "disabled";
  }

  const chain = [];
  const wsClients = new Set();
  const pendingCommands = new Map();
  let knownTabs = [];

  async function appendReceipt(fields) {
    const receipt = await buildActionReceipt({
      ...fields,
      endpoint: `http://127.0.0.1:${boundPort}/command`,
      bridge_enabled: enabled,
      timestamp_ms: Number.isFinite(fields.timestamp_ms) ? fields.timestamp_ms : nowFn(),
    });
    const index = chain.length;
    const prev_chain_sha256 = chainHead;
    const chain_sha256 = await sha256Hex(canonicalJson({
      index,
      prev_chain_sha256,
      receipt_sha256: receipt.receipt_sha256,
    }));
    const entry = { index, prev_chain_sha256, chain_sha256, receipt };
    chain.push(entry);
    chainHead = chain_sha256;
    if (logPath) {
      appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
    }
    return entry;
  }

  function closeAllClients(reason = "relay_closed") {
    for (const sock of wsClients) {
      try {
        sock.write(encodeWsFrame(0x8, Buffer.from(reason, "utf8")));
        sock.end();
      } catch { /* ignore */ }
    }
    wsClients.clear();
    for (const [id, p] of pendingCommands.entries()) {
      clearTimeout(p.timer);
      p.reject(new Error(reason));
      pendingCommands.delete(id);
    }
  }

  function dispatchWsCommand(payload, timeoutMs = 4000) {
    const sock = wsClients.values().next().value;
    if (!sock) return Promise.resolve({ dispatched: false, clients: 0 });
    const id = `cmd_${nextCmdId++}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingCommands.delete(id);
        reject(new Error("extension_command_timeout"));
      }, timeoutMs);
      pendingCommands.set(id, { resolve, reject, timer });
      const msg = JSON.stringify({ type: "cmmns-relay-command", id, ...payload });
      sock.write(encodeWsFrame(0x1, Buffer.from(msg, "utf8")));
    });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${boundPort}`);
    const pathname = url.pathname;

    if (req.method === "GET" && pathname === "/health") {
      return sendJson(res, 200, {
        ok: !killed,
        service: "cmmns-live-relay",
        schema: RECEIPT_SCHEMA,
        host: "127.0.0.1",
        port: boundPort,
        state: currentState(),
        enabled,
        killed,
        handoff_required: handoffRequired,
        user_observed: handoffRequired,
        gate_kind: handoffGateKind,
        connected_clients: wsClients.size,
        receipt_count: chain.length,
        chain_head: chainHead,
      });
    }

    if (req.method === "GET" && pathname === "/status") {
      return sendJson(res, 200, {
        ok: true,
        host: "127.0.0.1",
        port: boundPort,
        state: currentState(),
        enabled,
        killed,
        handoff_required: handoffRequired,
        user_observed: handoffRequired,
        gate_kind: handoffGateKind,
        handoff_reason: handoffReason,
        connected_clients: wsClients.size,
        tabs_count: knownTabs.length,
        receipt_count: chain.length,
        chain_head: chainHead,
        allowed_actions: [...ALLOWED_ACTIONS, "kill", "handoff"],
      });
    }

    if (req.method === "GET" && pathname === "/tabs") {
      return sendJson(res, 200, { ok: true, connected_clients: wsClients.size, tabs: knownTabs });
    }

    if (req.method === "GET" && pathname === "/receipts") {
      const check = await verifyReceiptChain(chain);
      return sendJson(res, 200, {
        ok: check.ok,
        count: chain.length,
        chain_head: chainHead,
        chain_valid: check.ok,
        receipts: chain,
      });
    }

    if (req.method === "POST") {
      let body;
      try { body = await readJsonBody(req); }
      catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }

      if (pathname === "/enable") {
        if (killed) return sendJson(res, 403, { ok: false, reason: "relay_killed", enabled: false });
        if (body.userApproved !== true) {
          return sendJson(res, 403, { ok: false, reason: "approval_required", enabled });
        }
        enabled = true;
        handoffRequired = false;
        handoffReason = null;
        return sendJson(res, 200, { ok: true, reason: "enabled_by_user", enabled });
      }

      if (pathname === "/disable") {
        enabled = false;
        return sendJson(res, 200, { ok: true, reason: "disabled_by_user", enabled });
      }

      if (pathname === "/kill") {
        killed = true;
        enabled = false;
        closeAllClients("relay_killed");
        const entry = await appendReceipt({
          verdict: "REFUSE",
          reason: "kill_switch_activated",
          action: "kill",
          target_origin: "",
          target_url: "",
          params: body,
          user_approved: true,
        });
        return sendJson(res, 200, { ok: true, verdict: "KILLED", killed: true, enabled: false, entry });
      }

      if (pathname === "/handoff") {
        handoffRequired = true;
        handoffReason = String(body.reason || "operator_requested_handoff");
        handoffGateKind = classifyGateKind(body.targetUrl, body.context, body.gate_kind || handoffReason);
        const entry = await appendReceipt({
          verdict: "REFUSE",
          reason: "human_handoff_requested",
          action: "handoff",
          target_origin: "",
          target_url: String(body.targetUrl || ""),
          params: { ...body, gate_kind: handoffGateKind, user_observed: true },
          user_approved: true,
        });
        return sendJson(res, 200, {
          ok: true,
          state: "handoff_required",
          verdict: "HANDOFF",
          handoff_required: true,
          user_observed: true,
          gate_kind: handoffGateKind,
          reason: handoffReason,
          entry,
        });
      }

      if (pathname === "/handoff/resume") {
        if (killed) return sendJson(res, 403, { ok: false, state: "killed", reason: "relay_killed" });
        if (body.operatorConfirmed !== true || body.userObserved !== true) {
          return sendJson(res, 403, {
            ok: false,
            state: currentState(),
            reason: "operator_confirmation_required",
            handoff_required: handoffRequired,
          });
        }
        const resumedGate = handoffGateKind || "auth";
        handoffRequired = false;
        handoffReason = null;
        handoffGateKind = null;
        const entry = await appendReceipt({
          verdict: "ALLOW",
          reason: "operator_confirmed_handoff",
          action: "handoff_resume",
          target_origin: "",
          target_url: String(body.targetUrl || ""),
          params: { gate_kind: resumedGate, user_observed: true, operator_confirmed: true },
          user_approved: true,
        });
        return sendJson(res, 200, {
          ok: true,
          state: currentState(),
          verdict: "RESUMED",
          handoff_required: false,
          user_observed: true,
          gate_kind: resumedGate,
          post_receipt: entry,
        });
      }

      if (pathname === "/command") {
        const action = String(body.action || "");
        const targetUrl = String(body.targetUrl || "");
        const params = body.params ?? {};
        const approved = body.approved === true;
        const context = body.context || {};

        if (action === "kill") {
          killed = true;
          enabled = false;
          closeAllClients("relay_killed");
          const entry = await appendReceipt({
            verdict: "REFUSE",
            reason: "kill_switch_activated",
            action: "kill",
            target_origin: "",
            target_url: targetUrl,
            params,
            user_approved: approved,
          });
          return sendJson(res, 200, { ok: true, verdict: "KILLED", killed: true, entry });
        }

        if (action === "handoff") {
          handoffRequired = true;
          handoffReason = String(params.reason || "operator_handoff");
          const entry = await appendReceipt({
            verdict: "REFUSE",
            reason: "human_handoff_requested",
            action: "handoff",
            target_origin: "",
            target_url: targetUrl,
            params,
            user_approved: approved,
          });
          return sendJson(res, 200, { ok: true, verdict: "HANDOFF", handoff_required: true, entry });
        }

        let targetOrigin = "";
        try { targetOrigin = new URL(targetUrl).origin; } catch { targetOrigin = ""; }

        if (killed) {
          const entry = await appendReceipt({
            verdict: "REFUSE", reason: "relay_killed", action, target_origin: targetOrigin,
            target_url: targetUrl, params, user_approved: approved,
          });
          return sendJson(res, 403, { ok: false, verdict: "REFUSE", reason: "relay_killed", entry });
        }

        if (!enabled) {
          const entry = await appendReceipt({
            verdict: "REFUSE", reason: "bridge_disabled", action, target_origin: targetOrigin,
            target_url: targetUrl, params, user_approved: approved,
          });
          return sendJson(res, 403, { ok: false, verdict: "REFUSE", reason: "bridge_disabled", entry });
        }

        const policy = checkTargetOriginPolicy(targetUrl, context);
        if (!policy.ok) {
          const gateKind = classifyGateKind(targetUrl, context, policy.reason);
          handoffRequired = true;
          handoffReason = policy.reason;
          handoffGateKind = gateKind;
          const entry = await appendReceipt({
            verdict: "REFUSE", reason: policy.reason, action, target_origin: targetOrigin,
            target_url: targetUrl, params: { ...params, gate_kind: gateKind, user_observed: true }, user_approved: approved,
          });
          return sendJson(res, 403, {
            ok: false,
            state: "handoff_required",
            verdict: "HANDOFF",
            handoff_required: true,
            user_observed: true,
            gate_kind: gateKind,
            reason: policy.reason,
            detail: policy.detail,
            pre_receipt: entry,
            entry,
          });
        }

        if (handoffRequired) {
          const entry = await appendReceipt({
            verdict: "REFUSE", reason: "handoff_pending", action, target_origin: policy.origin,
            target_url: targetUrl, params, user_approved: approved,
          });
          return sendJson(res, 403, {
            ok: false,
            state: "handoff_required",
            verdict: "HANDOFF",
            handoff_required: true,
            user_observed: true,
            gate_kind: handoffGateKind,
            reason: "handoff_pending",
            entry,
          });
        }

        if (!ALLOWED_ACTION_SET.has(action)) {
          const entry = await appendReceipt({
            verdict: "REFUSE", reason: "action_not_allowed", action, target_origin: policy.origin,
            target_url: targetUrl, params, user_approved: approved,
          });
          return sendJson(res, 403, { ok: false, verdict: "REFUSE", reason: "action_not_allowed", entry });
        }

        if (!approved) {
          const entry = await appendReceipt({
            verdict: "REFUSE", reason: "action_not_approved", action, target_origin: policy.origin,
            target_url: targetUrl, params, user_approved: false,
          });
          return sendJson(res, 403, { ok: false, verdict: "REFUSE", reason: "action_not_approved", entry });
        }

        let dispatchResult;
        try {
          dispatchResult = await dispatchWsCommand({ action, targetUrl, params, context });
        } catch (err) {
          const entry = await appendReceipt({
            verdict: "REFUSE", reason: err.message, action, target_origin: policy.origin,
            target_url: targetUrl, params, user_approved: true,
          });
          return sendJson(res, 502, { ok: false, verdict: "REFUSE", reason: err.message, entry });
        }

        if (dispatchResult && dispatchResult.verdict === "HANDOFF") {
          handoffRequired = true;
          handoffReason = dispatchResult.reason || "extension_handoff";
          const entry = await appendReceipt({
            verdict: "REFUSE", reason: handoffReason, action, target_origin: policy.origin,
            target_url: targetUrl, params, user_approved: true,
          });
          return sendJson(res, 403, { ok: false, verdict: "HANDOFF", handoff_required: true, reason: handoffReason, entry });
        }

        const entry = await appendReceipt({
          verdict: "ALLOW",
          reason: "approved_loopback_action",
          action,
          target_origin: policy.origin,
          target_url: targetUrl,
          params,
          user_approved: true,
        });
        return sendJson(res, 200, { ok: true, verdict: "ALLOW", result: dispatchResult, entry });
      }
    }

    return sendJson(res, 404, { ok: false, error: "not_found" });
  });

  server.on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    const remote = socket.remoteAddress || "";
    const isLoopback = remote === "127.0.0.1" || remote === "::ffff:127.0.0.1" || remote === "::1";
    if (!key || !isLoopback || killed) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    const accept = createHash("sha1").update(key + WS_GUID).digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    wsClients.add(socket);
    let rxBuf = Buffer.alloc(0);

    socket.on("data", (chunk) => {
      rxBuf = Buffer.concat([rxBuf, chunk]);
      const { frames, remaining } = decodeWsFrames(rxBuf);
      rxBuf = remaining;
      for (const f of frames) {
        if (f.opcode === 0x8) {
          wsClients.delete(socket);
          socket.end();
          return;
        }
        if (f.opcode === 0x9) {
          socket.write(encodeWsFrame(0xA, f.payload));
          continue;
        }
        if (f.opcode === 0x1) {
          try {
            const msg = JSON.parse(f.payload.toString("utf8"));
            if (msg.type === "cmmns-relay-tabs" && Array.isArray(msg.tabs)) {
              knownTabs = msg.tabs;
            } else if (msg.type === "cmmns-relay-result" && msg.id && pendingCommands.has(msg.id)) {
              const p = pendingCommands.get(msg.id);
              clearTimeout(p.timer);
              pendingCommands.delete(msg.id);
              p.resolve(msg);
            }
          } catch { /* ignore malformed ws json */ }
        }
      }
    });

    socket.on("close", () => wsClients.delete(socket));
    socket.on("error", () => wsClients.delete(socket));
  });

  function start() {
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(requestedPort, "127.0.0.1", () => {
        const addr = server.address();
        boundPort = typeof addr === "object" && addr ? addr.port : requestedPort;
        resolve({ host: "127.0.0.1", port: boundPort, url: `http://127.0.0.1:${boundPort}` });
      });
    });
  }

  function stop() {
    closeAllClients("relay_stopped");
    return new Promise((resolve) => server.close(() => resolve()));
  }

  return {
    start,
    stop,
    getChain: () => [...chain],
    getAddress: () => ({ host: "127.0.0.1", port: boundPort }),
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const port = Number(process.env.CMMNS_RELAY_PORT || DEFAULT_PORT);
  const relay = createCmmnsRelay({ host: DEFAULT_HOST, port });
  relay.start().then(({ host, port: p }) => {
    console.log(`[cmmns-relay] listening on http://${host}:${p} (disabled by default; opt-in required)`);
  }).catch((err) => {
    console.error(`[cmmns-relay] failed to start: ${err.message}`);
    process.exit(1);
  });
}
