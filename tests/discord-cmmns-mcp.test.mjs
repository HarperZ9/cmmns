// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Offline tests for official Discord Bot + JSON-RPC 2.0 MCP Server (mcp/discord-cmmns-mcp.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DISCORD_RECEIPT_SCHEMA,
  createDiscordBotClient,
  createDiscordCmmnsMcpServer,
  validateBotAuthorizationHeader,
  validateBotToken,
  verifyDiscordReceipt,
} from "../mcp/discord-cmmns-mcp.mjs";
import { verifyBundleSeals } from "../pipeline/auto-study-hook.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(ROOT, "..", "mcp", "discord-cmmns-mcp.mjs"), "utf8");

function makeMockFetch() {
  const calls = [];
  let rateLimitOnce = true;
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method, auth: init.headers?.Authorization, body: init.body });
    if (rateLimitOnce && url.includes("/channels/ch-1/messages") && init.method === "GET") {
      rateLimitOnce = false;
      return { ok: false, status: 429, json: async () => ({ retry_after: 0.001 }) };
    }
    if (url.includes("/guilds/guild-ok/channels")) {
      return { ok: true, status: 200, json: async () => [{ id: "ch-1", name: "research-intake" }] };
    }
    if (url.includes("/guilds/guild-ok/threads/active")) {
      return { ok: true, status: 200, json: async () => ({ threads: [{ id: "th-1", name: "gpu-kernels" }] }) };
    }
    if (url.includes("/channels/ch-1/messages") && init.method === "GET") {
      if (url.includes("before=m-2")) {
        return { ok: true, status: 200, json: async () => [{ id: "m-0", content: "Finding: BuildLang WGSL shader passed 560/560 certs." }] };
      }
      return {
        ok: true,
        status: 200,
        json: async () => [
          { id: "m-1", content: "Claim: LoomFormer arXiv:2611.30634 boosts active heads from 22.9% to 74.4%.", attachments: [{ filename: "diagram.png", url: "https://cdn.example/diagram.png", size: 1024, content_type: "image/png" }] },
          { id: "m-2", content: "Unrelated chat message" },
        ],
      };
    }
    if (url.includes("/channels/th-1/messages") && init.method === "GET") {
      return { ok: true, status: 200, json: async () => [{ id: "t-1", content: "Result: Superframe 3DGS ran in 10s (arXiv:2611.27962)." }] };
    }
    if (url.includes("/channels/ch-1/messages") && init.method === "POST") {
      return { ok: true, status: 200, json: async () => ({ id: "m-posted-1", ok: true }) };
    }
    return { ok: false, status: 404, json: async () => ({ message: "not found" }) };
  };
  return { fetchImpl, calls };
}

test("discord-cmmns-mcp enforces official Bot token prefix and rejects self-bot/user tokens", () => {
  assert.match(SRC, /SPDX-License-Identifier:\s*AGPL-3\.0-only/);
  assert.doesNotMatch(SRC, /[\u2013\u2014]/);
  assert.equal(validateBotToken("").ok, false);
  assert.equal(validateBotToken("mfa.user-selfbot-token-1234567890").reason, "self_bot_token_refused");
  assert.equal(validateBotToken("Bearer oauth-user-token-1234567890").reason, "self_bot_token_refused");
  assert.equal(validateBotAuthorizationHeader("raw-user-token").reason, "self_bot_token_refused");
  assert.equal(validateBotToken("official_bot_token_1234567890").ok, true);
  assert.equal(validateBotToken("official_bot_token_1234567890").header, "Bot official_bot_token_1234567890");
  assert.throws(() => createDiscordBotClient({ token: "mfa.evil-selfbot-token" }), /self_bot_token_refused/);
});

test("JSON-RPC MCP tools, rate-limit backoff, guild allowlist, slash commands, and SHA-256 receipts pass", async () => {
  const { fetchImpl, calls } = makeMockFetch();
  const botClient = createDiscordBotClient({
    token: "official_bot_token_1234567890",
    fetchImpl,
    sleep: async () => {},
  });
  const server = createDiscordCmmnsMcpServer({
    guildAllowlist: ["guild-ok"],
    botClient,
    now: () => 1764295000000,
  });

  // 1. JSON-RPC initialize and tools/list
  const initRes = await server.handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "initialize" });
  assert.equal(initRes.result.serverInfo.name, "cmmns-discord-mcp");
  const listRes = await server.handleJsonRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.deepEqual(
    listRes.result.tools.map((t) => t.name),
    [
      "discord_list_authorized_channels",
      "discord_read_channel_messages",
      "discord_run_cmmns_study",
      "discord_post_study_summary",
      "discord_archive_authorized_guild",
    ],
  );

  // 2. Fail-closed guild allowlist rejection
  const deniedGuild = await server.callTool("discord_list_authorized_channels", { guild_id: "guild-evil" });
  assert.equal(deniedGuild.ok, false);
  assert.equal(deniedGuild.reason, "guild_not_allowlisted");
  assert.equal(verifyDiscordReceipt(deniedGuild.receipt).ok, true);

  // 3. Authorized channel list + read with 429 retry backoff
  const chRes = await server.callTool("discord_list_authorized_channels", { guild_id: "guild-ok" });
  assert.equal(chRes.ok, true);
  assert.equal(chRes.result.channels.length, 1);

  const msgRes = await server.callTool("discord_read_channel_messages", { guild_id: "guild-ok", channel_id: "ch-1" });
  assert.equal(msgRes.ok, true);
  assert.equal(msgRes.result.count, 2);
  assert.ok(calls.every((c) => c.auth === "Bot official_bot_token_1234567890"), "Every request must use official Bot prefix");

  // 4. All 4 slash commands (/cmmns-study, /cmmns-distill, /cmmns-verify, /cmmns-search)
  const studyCmd = await server.handleSlashCommand({
    command: "/cmmns-study",
    guild_id: "guild-ok",
    channel_id: "ch-1",
    title: "Discord Research Drop",
    text: "Claim: BuildLang GPU WGSL kernel hit 457x speedup (arXiv:2611.30634).\n$E = mc^2$",
    attachments: [{ name: "kernel.wasm", bytes: Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]) }],
  });
  assert.equal(studyCmd.ok, true);
  assert.equal(studyCmd.result.media_inventory[0].layer0.format, "wasm");
  assert.equal(studyCmd.result.media_inventory[0].layer0.executed, false);
  assert.equal(studyCmd.receipt.schema, DISCORD_RECEIPT_SCHEMA);

  const distillCmd = await server.handleSlashCommand({
    command: "/cmmns-distill",
    guild_id: "guild-ok",
    channel_id: "ch-1",
    text: "Finding: 98.8% agreement on arXiv:2611.30634.",
  });
  assert.equal(distillCmd.ok, true);
  assert.equal(distillCmd.result.citations[0], "arXiv:2611.30634");

  const verifyCmd = await server.handleSlashCommand({
    command: "/cmmns-verify",
    guild_id: "guild-ok",
    channel_id: "ch-1",
    receipt: studyCmd.receipt,
  });
  assert.equal(verifyCmd.ok, true);
  assert.equal(verifyCmd.result.ok, true);

  const searchCmd = await server.handleSlashCommand({
    command: "/cmmns-search",
    guild_id: "guild-ok",
    channel_id: "ch-1",
    query: "loomformer",
  });
  assert.equal(searchCmd.ok, true);
  assert.equal(searchCmd.result.hits.length, 1);

  // 5. Post study summary via JSON-RPC tools/call + receipt tamper control
  const postRpc = await server.handleJsonRpc({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "discord_post_study_summary",
      arguments: { guild_id: "guild-ok", channel_id: "ch-1", summary: `Study sealed: ${studyCmd.receipt.receipt_sha256}` },
    },
  });
  assert.equal(postRpc.result.isError, false);
  assert.equal(postRpc.result.data.result.id, "m-posted-1");

  const tampered = { ...studyCmd.receipt, guild_id: "guild-forged" };
  assert.equal(verifyDiscordReceipt(tampered).ok, false);

  // 6. discord_archive_authorized_guild with bounded pagination, threads, attachments, and Study sealing
  const outDir = mkdtempSync(path.join(os.tmpdir(), "cmmns-discord-archive-"));
  try {
    const deniedArchive = await server.callTool("discord_archive_authorized_guild", { guild_id: "guild-evil", out_dir: outDir });
    assert.equal(deniedArchive.ok, false);
    assert.equal(deniedArchive.reason, "guild_not_allowlisted");

    const arch = await server.callTool("discord_archive_authorized_guild", {
      guild_id: "guild-ok",
      out_dir: outDir,
      page_size: 2,
      max_pages_per_channel: 3,
      intakeIso: "2026-11-27T17:40:00Z",
    });
    assert.equal(arch.ok, true);
    assert.equal(arch.verdict, "ALLOW");
    assert.equal(arch.result.channels_count, 1);
    assert.equal(arch.result.threads_count, 1);
    assert.equal(arch.result.total_messages, 4);
    assert.equal(arch.result.attachments_count, 1);
    assert.ok(calls.some((c) => c.url.includes("before=m-2")), "Pagination must use before=<message_id>");
    assert.equal(existsSync(path.join(outDir, "SOURCE.txt")), true);
    assert.equal(existsSync(path.join(outDir, "SHA256SUMS")), true);
    assert.equal(existsSync(path.join(outDir, "study.md")), true);
    assert.equal(existsSync(path.join(outDir, "study.json")), true);
    assert.equal(existsSync(path.join(outDir, "mcp_dispatch_plan.json")), true);
    assert.equal(verifyBundleSeals(outDir).ok, true);
    assert.equal(verifyDiscordReceipt(arch.receipt).ok, true);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
