// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Opt-in localhost-only (127.0.0.1) Chrome relay client for the CMMNS extension service worker.
// Disabled by default until the user explicitly flips ON; enforces strict 127.0.0.1 WS endpoint
// and fail-closed human handoff on login, auth, CAPTCHA, payment, or password pages.
(() => {
  const STORAGE_KEY = "cmmns_workstation_relay_enabled";
  const DEFAULT_WS_URL = "ws://127.0.0.1:19989/ws";
  const SENSITIVE_HOST_RE = [
    /(^|[.-])(login|signin|sign-in|log-in|auth|oauth|sso|id|idp|identity|accounts?|okta|auth0)([.-]|$)/i,
    /(^|[.-])(captcha|recaptcha|hcaptcha|turnstile|arkoselabs|funcaptcha|challenges?)([.-]|$)/i,
    /(^|[.-])(pay|payments?|checkout|billing|stripe|paypal|adyen|braintree|square|bank|banking|wallet)([.-]|$)/i,
    /(^|[.-])(password|passwords|passwd|vault|1password|bitwarden|lastpass|dashlane|keepass|keychain)([.-]|$)/i,
  ];
  const SENSITIVE_PATH_RE = [
    /\/(login|log-in|signin|sign-in|signup|sign-up|register|auth|oauth|oauth2|oidc|sso|saml|mfa|2fa|totp|webauthn|passkey|session|logout)\b/i,
    /\/(captcha|recaptcha|hcaptcha|turnstile|challenge|verify-human|bot-check)\b/i,
    /\/(checkout|payment|payments|pay|billing|card|credit-card|subscribe|purchase|transfer|wire|wallet)\b/i,
    /\/(password|passwords|passwd|reset-password|forgot-password|credentials?|vault|secrets?|tokens?|api-keys?)\b/i,
  ];

  let enabled = false;
  let killed = false;
  let socket = null;
  let wsUrl = DEFAULT_WS_URL;

  function isLoopbackWsUrl(raw) {
    try {
      const u = new URL(String(raw || ""));
      const port = Number(u.port);
      return u.protocol === "ws:" && u.hostname === "127.0.0.1" && !u.username && !u.password && Number.isInteger(port) && port >= 1 && port <= 65535;
    } catch {
      return false;
    }
  }

  function checkSensitiveTarget(targetUrl, context) {
    try {
      const u = new URL(String(targetUrl || ""));
      if (u.protocol !== "https:" && u.protocol !== "http:") return { sensitive: true, reason: "sensitive_scheme_refused" };
      const host = u.hostname.toLowerCase();
      if (SENSITIVE_HOST_RE.some((re) => re.test(host))) return { sensitive: true, reason: "sensitive_origin_refused" };
      const pq = `${u.pathname}${u.search}${u.hash}`;
      if (SENSITIVE_PATH_RE.some((re) => re.test(pq))) return { sensitive: true, reason: "sensitive_path_refused" };
      if (context && context.hasPasswordField) return { sensitive: true, reason: "password_field_refused" };
      if (context && context.hasCaptcha) return { sensitive: true, reason: "captcha_refused" };
      if (context && context.hasPaymentForm) return { sensitive: true, reason: "payment_form_refused" };
      return { sensitive: false, reason: null };
    } catch {
      return { sensitive: true, reason: "invalid_target_url" };
    }
  }

  function disconnect() {
    if (socket) {
      try { socket.close(); } catch { /* ignore */ }
      socket = null;
    }
  }

  function handleIncomingCommand(cmd) {
    if (killed) return { ok: false, verdict: "REFUSE", reason: "relay_killed" };
    if (!enabled) return { ok: false, verdict: "REFUSE", reason: "bridge_disabled" };
    const check = checkSensitiveTarget(cmd && cmd.targetUrl, cmd && cmd.context);
    if (check.sensitive) {
      return { ok: false, verdict: "HANDOFF", handoff_required: true, reason: check.reason };
    }
    return { ok: true, verdict: "ALLOW", action: String(cmd && cmd.action || ""), targetUrl: String(cmd && cmd.targetUrl || "") };
  }

  function connect() {
    if (!enabled || killed || !isLoopbackWsUrl(wsUrl) || typeof WebSocket !== "function") return false;
    disconnect();
    const ws = new WebSocket(wsUrl);
    socket = ws;
    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(String(ev.data || "{}"));
        if (msg.type === "cmmns-relay-command") {
          const reply = handleIncomingCommand(msg);
          ws.send(JSON.stringify({ type: "cmmns-relay-result", id: msg.id, ...reply }));
        }
      } catch { /* ignore */ }
    });
    ws.addEventListener("close", () => { if (socket === ws) socket = null; });
    return true;
  }

  function persistState(val) {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: Boolean(val) });
    }
  }

  const api = {
    STORAGE_KEY,
    DEFAULT_WS_URL,
    isLoopbackWsUrl,
    checkSensitiveTarget,
    handleIncomingCommand,
    status() {
      return { enabled, killed, connected: Boolean(socket), wsUrl };
    },
    enable(opts = {}) {
      if (killed) return { ok: false, reason: "relay_killed", enabled: false };
      if (!opts || opts.userApproved !== true) return { ok: false, reason: "approval_required", enabled };
      if (opts.wsUrl && !isLoopbackWsUrl(opts.wsUrl)) return { ok: false, reason: "non_loopback_host", enabled };
      if (opts.wsUrl) wsUrl = opts.wsUrl;
      enabled = true;
      persistState(true);
      if (opts.autoConnect) connect();
      return { ok: true, reason: "enabled_by_user", enabled };
    },
    disable() {
      enabled = false;
      persistState(false);
      disconnect();
      return { ok: true, reason: "disabled_by_user", enabled };
    },
    kill() {
      killed = true;
      enabled = false;
      persistState(false);
      disconnect();
      return { ok: true, verdict: "KILLED", killed: true, enabled: false };
    },
  };

  globalThis.PBWorkstationRelay = api;
})();
