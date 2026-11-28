// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Opt-in, localhost-only (127.0.0.1), explicit-approval workstation bridge for CMMNS.
// Disabled by default, zero Node-only imports, fail-closed on sensitive origins
// (login, auth, OAuth, CAPTCHA, payment, password/vault), and deterministic SHA-256 action receipts.

export const RECEIPT_SCHEMA = "cmmns-workstation-bridge-receipt/1";

export const ALLOWED_ACTIONS = Object.freeze([
  "inspect_dom",
  "capture_screenshot",
  "read_metadata",
  "verify_provenance",
  "scroll",
  "click",
  "navigate",
]);

const ALLOWED_ACTION_SET = new Set(ALLOWED_ACTIONS);

const SENSITIVE_HOST_PATTERNS = [
  /(^|[.-])(login|signin|sign-in|log-in|auth|oauth|sso|id|idp|identity|accounts?|okta|auth0)([.-]|$)/i,
  /(^|[.-])(captcha|recaptcha|hcaptcha|turnstile|arkoselabs|funcaptcha|challenges?)([.-]|$)/i,
  /(^|[.-])(pay|payments?|checkout|billing|stripe|paypal|adyen|braintree|square|bank|banking|wallet)([.-]|$)/i,
  /(^|[.-])(password|passwords|passwd|vault|1password|bitwarden|lastpass|dashlane|keepass|keychain)([.-]|$)/i,
];

const SENSITIVE_PATH_PATTERNS = [
  /\/(login|log-in|signin|sign-in|signup|sign-up|register|auth|oauth|oauth2|oidc|sso|saml|mfa|2fa|totp|webauthn|passkey|session|logout)\b/i,
  /\/(captcha|recaptcha|hcaptcha|turnstile|challenge|verify-human|bot-check)\b/i,
  /\/(checkout|payment|payments|pay|billing|card|credit-card|subscribe|purchase|transfer|wire|wallet)\b/i,
  /\/(password|passwords|passwd|reset-password|forgot-password|credentials?|vault|secrets?|tokens?|api-keys?)\b/i,
];

function canonicalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== undefined) out[key] = canonicalize(value[key]);
  }
  return out;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export async function sha256Hex(input) {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : (input instanceof Uint8Array ? input : new Uint8Array(input));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function validateLoopbackEndpoint(endpoint) {
  if (typeof endpoint !== "string" || !endpoint.trim()) {
    return { ok: false, reason: "invalid_endpoint", detail: "Endpoint URL is required" };
  }
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    return { ok: false, reason: "invalid_endpoint", detail: "Malformed endpoint URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "ws:") {
    return { ok: false, reason: "disallowed_protocol", detail: `Protocol ${parsed.protocol} is not allowed for loopback bridge` };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "credentials_in_endpoint", detail: "Embedded credentials in endpoint URL are forbidden" };
  }
  if (parsed.hostname !== "127.0.0.1") {
    return { ok: false, reason: "non_loopback_host", detail: `Host ${parsed.hostname} rejected; strictly 127.0.0.1 required` };
  }
  const port = Number(parsed.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, reason: "invalid_port", detail: "Explicit loopback port 1..65535 is required" };
  }
  return { ok: true, origin: parsed.origin, port, url: parsed.href };
}

export function checkTargetOriginPolicy(targetUrl, context = {}) {
  if (typeof targetUrl !== "string" || !targetUrl.trim()) {
    return { ok: false, reason: "invalid_target_url", detail: "Target URL is required" };
  }
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { ok: false, reason: "invalid_target_url", detail: "Malformed target URL" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: "sensitive_scheme_refused", detail: `Scheme ${parsed.protocol} is refused fail-closed` };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "sensitive_credentials_refused", detail: "Target URLs containing credentials are refused" };
  }
  const host = parsed.hostname.toLowerCase();
  for (const re of SENSITIVE_HOST_PATTERNS) {
    if (re.test(host)) {
      return { ok: false, reason: "sensitive_origin_refused", detail: `Refused sensitive host ${host}` };
    }
  }
  const pathAndQuery = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  for (const re of SENSITIVE_PATH_PATTERNS) {
    if (re.test(pathAndQuery)) {
      return { ok: false, reason: "sensitive_path_refused", detail: `Refused sensitive route on ${host}` };
    }
  }
  if (context && context.hasPasswordField === true) {
    return { ok: false, reason: "password_field_refused", detail: "Page contains password input field" };
  }
  if (context && context.hasCaptcha === true) {
    return { ok: false, reason: "captcha_refused", detail: "Page contains CAPTCHA or anti-bot challenge" };
  }
  if (context && context.hasPaymentForm === true) {
    return { ok: false, reason: "payment_form_refused", detail: "Page contains payment or billing form" };
  }
  return { ok: true, origin: parsed.origin, hostname: host };
}

export async function buildActionReceipt(fields) {
  const payload = {
    schema: RECEIPT_SCHEMA,
    verdict: fields.verdict,
    reason: fields.reason,
    action: String(fields.action || ""),
    endpoint: String(fields.endpoint || ""),
    target_origin: String(fields.target_origin || ""),
    target_url_sha256: await sha256Hex(String(fields.target_url || "")),
    params_sha256: await sha256Hex(canonicalJson(fields.params ?? {})),
    bridge_enabled: Boolean(fields.bridge_enabled),
    user_approved: Boolean(fields.user_approved),
    timestamp_ms: Number.isFinite(fields.timestamp_ms) ? Math.trunc(fields.timestamp_ms) : 0,
  };
  const receipt_sha256 = await sha256Hex(canonicalJson(payload));
  return { ...payload, receipt_sha256 };
}

export async function verifyActionReceipt(receipt) {
  if (!receipt || typeof receipt !== "object" || typeof receipt.receipt_sha256 !== "string") {
    return { ok: false, reason: "malformed_receipt" };
  }
  const { receipt_sha256, ...payload } = receipt;
  if (payload.schema !== RECEIPT_SCHEMA) {
    return { ok: false, reason: "invalid_schema" };
  }
  const expected = await sha256Hex(canonicalJson(payload));
  if (expected !== receipt_sha256) {
    return { ok: false, reason: "receipt_digest_mismatch", expected, got: receipt_sha256 };
  }
  return { ok: true, receipt_sha256: expected };
}

export function createWorkstationBridge(options = {}) {
  const nowFn = typeof options.now === "function" ? options.now : () => Date.now();
  const executor = typeof options.executor === "function" ? options.executor : null;
  let enabled = false;
  const receipts = [];

  function isEnabled() {
    return enabled;
  }

  function enable(opts = {}) {
    if (!opts || opts.userApproved !== true) {
      return { ok: false, reason: "approval_required", enabled };
    }
    enabled = true;
    return { ok: true, reason: "enabled_by_user", enabled };
  }

  function disable() {
    enabled = false;
    return { ok: true, reason: "disabled_by_user", enabled };
  }

  async function requestAction(req = {}) {
    const timestamp_ms = Number.isFinite(req.timestamp_ms) ? req.timestamp_ms : nowFn();
    const action = String(req.action || "");
    const endpoint = String(req.endpoint || "");
    const targetUrl = String(req.targetUrl || "");
    const params = req.params ?? {};
    const approved = req.approved === true;

    let targetOrigin = "";
    try {
      targetOrigin = new URL(targetUrl).origin;
    } catch {
      targetOrigin = "";
    }

    const refuse = async (reason, detail) => {
      const receipt = await buildActionReceipt({
        verdict: "REFUSE",
        reason,
        action,
        endpoint,
        target_origin: targetOrigin,
        target_url: targetUrl,
        params,
        bridge_enabled: enabled,
        user_approved: approved,
        timestamp_ms,
      });
      receipts.push(receipt);
      return { ok: false, verdict: "REFUSE", reason, detail, receipt };
    };

    if (!enabled) {
      return refuse("bridge_disabled", "Workstation bridge is disabled by default until explicitly enabled by the user");
    }
    const epCheck = validateLoopbackEndpoint(endpoint);
    if (!epCheck.ok) {
      return refuse(epCheck.reason, epCheck.detail);
    }
    const targetCheck = checkTargetOriginPolicy(targetUrl, req.context);
    if (!targetCheck.ok) {
      return refuse(targetCheck.reason, targetCheck.detail);
    }
    if (!ALLOWED_ACTION_SET.has(action)) {
      return refuse("action_not_allowed", `Action ${action || "(empty)"} is not in the explicit allowlist`);
    }
    if (!approved) {
      return refuse("action_not_approved", "Explicit per-action user approval is required");
    }

    const result = executor ? await executor({ endpoint: epCheck.url, targetUrl, action, params }) : { executed: false };
    const receipt = await buildActionReceipt({
      verdict: "ALLOW",
      reason: "approved_loopback_action",
      action,
      endpoint: epCheck.url,
      target_origin: targetCheck.origin,
      target_url: targetUrl,
      params,
      bridge_enabled: enabled,
      user_approved: true,
      timestamp_ms,
    });
    receipts.push(receipt);
    return { ok: true, verdict: "ALLOW", reason: "approved_loopback_action", result, receipt };
  }

  return {
    isEnabled,
    enable,
    disable,
    requestAction,
    getReceipts: () => [...receipts],
  };
}
