#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Official Discord Bot + JSON-RPC 2.0 MCP Server inside HarperZ9/cmmns.
// Pure Node stdlib ESM (zero external dependencies). Uses strictly the official Discord Bot
// OAuth2 REST API (Authorization: Bot <DISCORD_BOT_TOKEN> via env var; NEVER self-bot user tokens),
// explicit guild allowlist, rate-limit backoff, public-research-only policy gate, read-only Layer-0
// artifact dissection via pipeline/auto-study-hook.mjs, and deterministic SHA-256 receipts.

import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import {
  buildMcpDispatchPlan,
  buildRoutingManifest,
  canonicalJson,
  checkPublicResearchPolicy,
  dissectArtifactReadOnly,
  sha256Hex,
  verifyStudyReceipt,
} from "../pipeline/auto-study-hook.mjs";

export const DISCORD_API_BASE = "https://discord.com/api/v10";
export const DISCORD_RECEIPT_SCHEMA = "cmmns-discord-mcp-receipt/1";

export const SLASH_COMMANDS = Object.freeze([
  { name: "cmmns-study", description: "Decompose public research content into a receipted Study and MCP dispatch plan" },
  { name: "cmmns-distill", description: "Extract claims, citations, and equations with verified vs unverified bounds" },
  { name: "cmmns-verify", description: "Verify a CMMNS Study or Discord MCP SHA-256 receipt fail-closed" },
  { name: "cmmns-search", description: "Search messages in an allowlisted Discord channel for terms or citations" },
]);

export const MCP_TOOLS = Object.freeze([
  { name: "discord_list_authorized_channels", description: "List text channels in an allowlisted Discord guild" },
  { name: "discord_read_channel_messages", description: "Read recent messages from an allowlisted Discord guild channel" },
  { name: "discord_run_cmmns_study", description: "Run public-research CMMNS Study decomposition + Layer-0 read-only dissection on channel content" },
  { name: "discord_post_study_summary", description: "Post a verified Study summary with SHA-256 receipt to an allowlisted Discord channel" },
]);

export function validateBotToken(token) {
  if (typeof token !== "string" || !token.trim()) {
    return { ok: false, reason: "missing_bot_token", detail: "Official DISCORD_BOT_TOKEN is required" };
  }
  const t = token.trim();
  if (/^(Bearer|User|mfa\.)/i.test(t)) {
    return { ok: false, reason: "self_bot_token_refused", detail: "Self-bot or user tokens are strictly forbidden; use an official Discord Bot token" };
  }
  const stripped = t.startsWith("Bot ") ? t.slice(4).trim() : t;
  if (stripped.length < 16 || /\s/.test(stripped) || /^mfa\./i.test(stripped)) {
    return { ok: false, reason: "invalid_bot_token", detail: "Malformed Discord Bot token" };
  }
  return { ok: true, header: `Bot ${stripped}` };
}

export function validateBotAuthorizationHeader(authHeader) {
  if (typeof authHeader !== "string" || !authHeader.startsWith("Bot ")) {
    return { ok: false, reason: "self_bot_token_refused", detail: "Authorization header must strictly use official 'Bot <token>' prefix" };
  }
  return validateBotToken(authHeader);
}

export function buildDiscordReceipt(fields) {
  const payload = {
    schema: DISCORD_RECEIPT_SCHEMA,
    verdict: fields.verdict,
    reason: fields.reason,
    surface: String(fields.surface || "mcp"),
    operation: String(fields.operation || ""),
    guild_id: String(fields.guild_id || ""),
    channel_id: String(fields.channel_id || ""),
    input_sha256: sha256Hex(canonicalJson(fields.input ?? {})),
    output_sha256: sha256Hex(canonicalJson(fields.output ?? {})),
    timestamp_ms: Number.isFinite(fields.timestamp_ms) ? Math.trunc(fields.timestamp_ms) : 0,
  };
  return { ...payload, receipt_sha256: sha256Hex(canonicalJson(payload)) };
}

export function verifyDiscordReceipt(receipt) {
  if (!receipt || typeof receipt !== "object" || typeof receipt.receipt_sha256 !== "string") {
    return { ok: false, reason: "malformed_receipt" };
  }
  const { receipt_sha256, ...payload } = receipt;
  if (payload.schema !== DISCORD_RECEIPT_SCHEMA) {
    return { ok: false, reason: "invalid_schema" };
  }
  const expected = sha256Hex(canonicalJson(payload));
  if (expected !== receipt_sha256) {
    return { ok: false, reason: "receipt_digest_mismatch", expected, actual: receipt_sha256 };
  }
  return { ok: true, receipt_sha256: expected };
}

export function createDiscordBotClient(options = {}) {
  const tokenCheck = validateBotToken(options.token ?? process.env.DISCORD_BOT_TOKEN ?? "");
  if (!tokenCheck.ok) {
    throw new Error(`${tokenCheck.reason}: ${tokenCheck.detail}`);
  }
  const authHeader = tokenCheck.header;
  const apiBase = options.apiBase || DISCORD_API_BASE;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : 2;
  const sleepFn = options.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));

  async function request(method, apiPath, body = null) {
    const authCheck = validateBotAuthorizationHeader(authHeader);
    if (!authCheck.ok) throw new Error(authCheck.reason);

    let attempt = 0;
    while (true) {
      const headers = {
        Authorization: authHeader,
        "User-Agent": "CMMNS-Discord-MCP/1.0 (https://github.com/HarperZ9/cmmns)",
      };
      const init = { method, headers };
      if (body !== null) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
      }
      const res = await fetchImpl(`${apiBase}${apiPath}`, init);
      if (res.status === 429 && attempt < maxRetries) {
        let retryMs = 500;
        try {
          const j = await res.json();
          if (typeof j.retry_after === "number" && j.retry_after >= 0) retryMs = Math.min(5000, Math.ceil(j.retry_after * 1000));
        } catch { /* fallback */ }
        attempt += 1;
        await sleepFn(retryMs);
        continue;
      }
      if (!res.ok) {
        throw new Error(`discord_api_http_${res.status}`);
      }
      return res.json();
    }
  }

  return {
    getAuthorizationHeader: () => authHeader,
    listGuildChannels: (guildId) => request("GET", `/guilds/${encodeURIComponent(guildId)}/channels`),
    readChannelMessages: (channelId, limit = 25) => {
      const lim = Math.max(1, Math.min(100, Number(limit) || 25));
      return request("GET", `/channels/${encodeURIComponent(channelId)}/messages?limit=${lim}`);
    },
    postChannelMessage: (channelId, content) => request("POST", `/channels/${encodeURIComponent(channelId)}/messages`, { content: String(content || "").slice(0, 1900) }),
  };
}

function decomposeTextPayload(title, text, attachments = []) {
  const lines = String(text || "").split(/\r?\n/);
  const claims = [];
  const citations = new Set();
  const equations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    for (const m of line.matchAll(/arXiv:\d{4}\.\d{4,5}(?:v\d+)?/gi)) citations.add(m[0]);
    for (const m of line.matchAll(/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/g)) citations.add(`doi:${m[0]}`);
    for (const m of line.matchAll(/https?:\/\/[^\s)>\]"']+/g)) citations.add(m[0]);
    for (const m of line.matchAll(/\$\$([^$]+)\$\$|\$([^$\n]{3,120})\$/g)) {
      equations.push({ line: i + 1, expr: (m[1] || m[2]).trim() });
    }
    if (/^[-*]?\s*(claim|finding|result|benchmark):/i.test(line) || (/\b(\d+(?:\.\d+)?x|\d+(?:\.\d+)?%|\d+\/\d+)\b/.test(line) && line.length >= 20)) {
      claims.push({ line: i + 1, text: line.replace(/^[-*]\s*/, "") });
    }
  }

  const media_inventory = attachments.map((att) => {
    const raw = Buffer.isBuffer(att.bytes) ? att.bytes : Buffer.from(att.bytes || "", "utf8");
    const ext = att.name && att.name.includes(".") ? att.name.slice(att.name.lastIndexOf(".")).toLowerCase() : "";
    return {
      rel: String(att.name || "attachment.bin"),
      kind: ext === ".png" || ext === ".jpg" ? "image" : ext === ".wav" ? "audio" : "binary",
      ext,
      bytes: raw.length,
      sha256: sha256Hex(raw),
      layer0: dissectArtifactReadOnly(raw, ext),
    };
  });

  const decomposition = {
    claims,
    citations: Array.from(citations).sort(),
    equations,
    media_inventory,
    corpusText: String(text || ""),
  };
  const studySha = sha256Hex(canonicalJson({ title, ...decomposition }));
  const routing = buildRoutingManifest(title, decomposition, studySha);
  const seal = { files: media_inventory, sha256sums_digest: studySha };
  const mcpDispatch = buildMcpDispatchPlan(title, decomposition, routing, studySha, seal);
  return {
    title,
    study_sha256: studySha,
    bounds: {
      verified: { claims_extracted: claims.length, attachments_dissected: media_inventory.length },
      unverified: { external_citations: decomposition.citations },
    },
    claims,
    citations: decomposition.citations,
    equations,
    media_inventory,
    routing,
    mcp_dispatch: mcpDispatch,
  };
}

export function createDiscordCmmnsMcpServer(options = {}) {
  const guildAllowlist = new Set((options.guildAllowlist || []).map(String));
  const botClient = options.botClient || createDiscordBotClient(options);
  const nowFn = typeof options.now === "function" ? options.now : () => Date.now();

  function checkGuild(guildId) {
    const gid = String(guildId || "");
    if (!gid || !guildAllowlist.has(gid)) {
      return { ok: false, reason: "guild_not_allowlisted", detail: `Guild "${gid}" is not in the explicit guild_allowlist` };
    }
    return { ok: true, guildId: gid };
  }

  async function callTool(name, args = {}) {
    const ts = Number.isFinite(args.timestamp_ms) ? args.timestamp_ms : nowFn();
    const guildId = String(args.guild_id || "");
    const channelId = String(args.channel_id || "");

    const refuse = (reason, detail) => {
      const receipt = buildDiscordReceipt({
        verdict: "REFUSE", reason, surface: "mcp", operation: name,
        guild_id: guildId, channel_id: channelId, input: args, output: { detail }, timestamp_ms: ts,
      });
      return { ok: false, verdict: "REFUSE", reason, detail, receipt };
    };

    const gCheck = checkGuild(guildId);
    if (!gCheck.ok) return refuse(gCheck.reason, gCheck.detail);

    if (name === "discord_list_authorized_channels") {
      const channels = await botClient.listGuildChannels(guildId);
      const out = { guild_id: guildId, channels };
      const receipt = buildDiscordReceipt({
        verdict: "ALLOW", reason: "channels_listed", surface: "mcp", operation: name,
        guild_id: guildId, channel_id: "", input: { guild_id: guildId }, output: out, timestamp_ms: ts,
      });
      return { ok: true, verdict: "ALLOW", result: out, receipt };
    }

    if (name === "discord_read_channel_messages") {
      if (!channelId) return refuse("missing_channel_id", "channel_id is required");
      const messages = await botClient.readChannelMessages(channelId, args.limit);
      const out = { guild_id: guildId, channel_id: channelId, count: messages.length, messages };
      const receipt = buildDiscordReceipt({
        verdict: "ALLOW", reason: "messages_read", surface: "mcp", operation: name,
        guild_id: guildId, channel_id: channelId, input: { guild_id: guildId, channel_id: channelId }, output: { count: messages.length }, timestamp_ms: ts,
      });
      return { ok: true, verdict: "ALLOW", result: out, receipt };
    }

    if (name === "discord_run_cmmns_study") {
      const text = String(args.text || "");
      const title = String(args.title || `Discord Study ${channelId || guildId}`);
      const policy = checkPublicResearchPolicy({ title }, text);
      if (!policy.ok) return refuse(policy.reason, policy.detail);
      const study = decomposeTextPayload(title, text, args.attachments || []);
      const receipt = buildDiscordReceipt({
        verdict: "ALLOW", reason: "study_completed", surface: "mcp", operation: name,
        guild_id: guildId, channel_id: channelId, input: { title, text_sha256: sha256Hex(text) }, output: { study_sha256: study.study_sha256 }, timestamp_ms: ts,
      });
      return { ok: true, verdict: "ALLOW", result: study, receipt };
    }

    if (name === "discord_post_study_summary") {
      if (!channelId) return refuse("missing_channel_id", "channel_id is required");
      const summary = String(args.summary || "");
      const policy = checkPublicResearchPolicy({}, summary);
      if (!policy.ok) return refuse(policy.reason, policy.detail);
      const posted = await botClient.postChannelMessage(channelId, summary);
      const receipt = buildDiscordReceipt({
        verdict: "ALLOW", reason: "summary_posted", surface: "mcp", operation: name,
        guild_id: guildId, channel_id: channelId, input: { channel_id: channelId, summary_sha256: sha256Hex(summary) }, output: { message_id: posted.id || "" }, timestamp_ms: ts,
      });
      return { ok: true, verdict: "ALLOW", result: posted, receipt };
    }

    return refuse("unknown_tool", `Unknown MCP tool: ${name}`);
  }

  async function handleSlashCommand(interaction = {}) {
    const cmd = String(interaction.command || "").replace(/^\//, "");
    const guildId = String(interaction.guild_id || "");
    const channelId = String(interaction.channel_id || "");
    const ts = Number.isFinite(interaction.timestamp_ms) ? interaction.timestamp_ms : nowFn();

    const gCheck = checkGuild(guildId);
    if (!gCheck.ok) {
      const receipt = buildDiscordReceipt({
        verdict: "REFUSE", reason: gCheck.reason, surface: "slash_command", operation: cmd,
        guild_id: guildId, channel_id: channelId, input: interaction, output: { detail: gCheck.detail }, timestamp_ms: ts,
      });
      return { ok: false, verdict: "REFUSE", reason: gCheck.reason, receipt };
    }

    if (cmd === "cmmns-study") {
      return callTool("discord_run_cmmns_study", {
        guild_id: guildId,
        channel_id: channelId,
        title: interaction.title || "Slash Study",
        text: interaction.text || "",
        attachments: interaction.attachments || [],
        timestamp_ms: ts,
      });
    }

    if (cmd === "cmmns-distill") {
      const policy = checkPublicResearchPolicy({}, String(interaction.text || ""));
      if (!policy.ok) {
        const receipt = buildDiscordReceipt({
          verdict: "REFUSE", reason: policy.reason, surface: "slash_command", operation: cmd,
          guild_id: guildId, channel_id: channelId, input: { cmd }, output: { detail: policy.detail }, timestamp_ms: ts,
        });
        return { ok: false, verdict: "REFUSE", reason: policy.reason, receipt };
      }
      const res = decomposeTextPayload(interaction.title || "Distill", interaction.text || "", []);
      const out = { claims: res.claims, citations: res.citations, equations: res.equations, bounds: res.bounds };
      const receipt = buildDiscordReceipt({
        verdict: "ALLOW", reason: "distilled", surface: "slash_command", operation: cmd,
        guild_id: guildId, channel_id: channelId, input: { cmd }, output: { claims: out.claims.length, citations: out.citations.length }, timestamp_ms: ts,
      });
      return { ok: true, verdict: "ALLOW", result: out, receipt };
    }

    if (cmd === "cmmns-verify") {
      const target = interaction.receipt;
      const verified = target && target.schema === DISCORD_RECEIPT_SCHEMA
        ? verifyDiscordReceipt(target)
        : verifyStudyReceipt(target);
      const receipt = buildDiscordReceipt({
        verdict: verified.ok ? "ALLOW" : "REFUSE",
        reason: verified.ok ? "receipt_verified" : verified.reason,
        surface: "slash_command",
        operation: cmd,
        guild_id: guildId,
        channel_id: channelId,
        input: { schema: target && target.schema },
        output: verified,
        timestamp_ms: ts,
      });
      return { ok: verified.ok, verdict: verified.ok ? "ALLOW" : "REFUSE", result: verified, receipt };
    }

    if (cmd === "cmmns-search") {
      const query = String(interaction.query || "").toLowerCase();
      const msgs = await botClient.readChannelMessages(channelId, interaction.limit || 25);
      const hits = msgs.filter((m) => String(m.content || "").toLowerCase().includes(query));
      const receipt = buildDiscordReceipt({
        verdict: "ALLOW", reason: "search_completed", surface: "slash_command", operation: cmd,
        guild_id: guildId, channel_id: channelId, input: { query }, output: { hits: hits.length }, timestamp_ms: ts,
      });
      return { ok: true, verdict: "ALLOW", result: { query, hits }, receipt };
    }

    const receipt = buildDiscordReceipt({
      verdict: "REFUSE", reason: "unknown_command", surface: "slash_command", operation: cmd,
      guild_id: guildId, channel_id: channelId, input: { cmd }, output: {}, timestamp_ms: ts,
    });
    return { ok: false, verdict: "REFUSE", reason: "unknown_command", receipt };
  }

  async function handleJsonRpc(req = {}) {
    const id = req.id ?? null;
    if (req.jsonrpc !== "2.0" || typeof req.method !== "string") {
      return { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid JSON-RPC 2.0 request" } };
    }
    if (req.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-11-25",
          serverInfo: { name: "cmmns-discord-mcp", version: "1.0.0" },
          capabilities: { tools: {} },
        },
      };
    }
    if (req.method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } };
    }
    if (req.method === "tools/call") {
      const name = req.params && req.params.name;
      const args = (req.params && req.params.arguments) || {};
      const out = await callTool(name, args);
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out) }], isError: !out.ok, data: out } };
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${req.method}` } };
  }

  return { callTool, handleSlashCommand, handleJsonRpc };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const allowlist = String(process.env.CMMNS_DISCORD_GUILD_ALLOWLIST || "").split(",").map((s) => s.trim()).filter(Boolean);
  const server = createDiscordCmmnsMcpServer({ guildAllowlist: allowlist });
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line);
      const reply = await server.handleJsonRpc(msg);
      process.stdout.write(`${JSON.stringify(reply)}\n`);
    } catch {
      process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`);
    }
  });
}
