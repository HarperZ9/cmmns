// Local server for the fixture harness: serves the repo root on 127.0.0.1 so
// tests/fixtures/thread.html can load the extension scripts in an ordinary page.
//   node scripts/serve.mjs [port]
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const port = +(process.argv[2] || 8742);

http.createServer(async (req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!path.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try {
    const body = await readFile(path);
    res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch (e) {
    res.writeHead(404); res.end(String(e.code || e));
  }
}).listen(port, "127.0.0.1", () => console.log(`fixture server on http://127.0.0.1:${port}/tests/fixtures/thread.html`));
