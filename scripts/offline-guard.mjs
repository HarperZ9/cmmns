// Loaded with `node --import ./scripts/offline-guard.mjs` by scripts/build-offline.mjs: every way
// a build script could reach the network throws instead, so an offline build that passes cannot
// have fetched anything. Covers fetch, WebSocket, http, https, http2, net, tls, dns and dgram.
import { syncBuiltinESMExports } from "node:module";
import http from "node:http";
import https from "node:https";
import http2 from "node:http2";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
import dgram from "node:dgram";

export const OFFLINE_MESSAGE = "network access is blocked in the offline build";
const block = (what) => function blocked() { throw new Error(`${OFFLINE_MESSAGE} (${what})`); };

globalThis.fetch = async () => { throw new Error(`${OFFLINE_MESSAGE} (fetch)`); };
globalThis.WebSocket = class { constructor() { throw new Error(`${OFFLINE_MESSAGE} (WebSocket)`); } };
for (const [name, mod, fns] of [
  ["http", http, ["request", "get"]], ["https", https, ["request", "get"]], ["http2", http2, ["connect"]],
  ["net", net, ["connect", "createConnection"]], ["tls", tls, ["connect"]],
  ["dns", dns, ["lookup", "resolve", "resolve4", "resolve6"]], ["dgram", dgram, ["createSocket"]],
]) for (const f of fns) mod[f] = block(`${name}.${f}`);
dns.promises.lookup = block("dns.promises.lookup");
dns.promises.resolve = block("dns.promises.resolve");
syncBuiltinESMExports();
