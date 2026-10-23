// Pluggable model steps for `case run`: claim extraction, search queries for primary records, and
// the dossier summary. Three providers, set in case.json "models":
//   { "provider": "none" }                         rules only; the rest goes to the review queue
//   { "provider": "command", "command": "relay", "args": ["run", "--json"] }
//       a local model through any command that reads a prompt on stdin and writes text on stdout
//       (Flywheel's relay, an Ollama or llama.cpp wrapper, anything)
//   { "provider": "http", "url": "https://.../v1/chat/completions", "model": "name", "keyEnv": "VAR" }
//       an OpenAI-compatible chat endpoint the user configures; the key is read from the named
//       environment variable and never written to the case
// Nothing here is needed for hashing, capture, diffs, origin counts, timelines or exports. Every
// model output lands as "proposed", with the source span it came from, until a person accepts it.
import { spawnSync } from "node:child_process";

export const PROVIDERS = ["none", "command", "http"];

export function makeModel(config = {}, { spawnFn = spawnSync, fetchFn = globalThis.fetch, env = process.env } = {}) {
  const p = config.provider || "none";
  if (!PROVIDERS.includes(p)) throw new Error(`models.provider must be one of ${PROVIDERS.join(", ")}`);
  if (p === "none") return null;
  if (p === "command") {
    if (!config.command) throw new Error("models.command is required for the command provider");
    return {
      name: `command:${config.command}`,
      async complete(prompt) {
        const r = spawnFn(config.command, config.args || [], { input: prompt, encoding: "utf8", timeout: config.timeoutMs || 300000, maxBuffer: 16 * 1024 * 1024, shell: false });
        if (r.error) throw new Error(`model command failed: ${r.error.message}`);
        if (r.status !== 0) throw new Error(`model command exited ${r.status}: ${String(r.stderr || "").slice(0, 300)}`);
        return String(r.stdout || "");
      },
    };
  }
  if (!config.url || !config.model) throw new Error("models.url and models.model are required for the http provider");
  const key = config.keyEnv ? env[config.keyEnv] : null;
  if (config.keyEnv && !key) throw new Error(`the environment variable ${config.keyEnv} named in models.keyEnv is not set`);
  return {
    name: `http:${config.model}`,
    async complete(prompt) {
      const res = await fetchFn(config.url, { method: "POST", headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify({ model: config.model, temperature: 0, messages: [{ role: "user", content: prompt }] }) });
      if (!res.ok) throw new Error(`model endpoint answered HTTP ${res.status}`);
      const j = await res.json();
      return String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "");
    },
  };
}

// The first JSON array or object in a model's reply, or null.
export function jsonFrom(text) {
  const s = String(text || "");
  for (const [open, close] of [["[", "]"], ["{", "}"]]) {
    const a = s.indexOf(open), b = s.lastIndexOf(close);
    if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* try the other shape */ } }
  }
  return null;
}

export const PROMPTS = {
  claims: (text) => `List the checkable factual claims in the text below. Return only a JSON array of objects {"claim": "...", "quote": "..."}, where "quote" is copied exactly from the text and supports the claim. Do not judge whether a claim is true. Text:\n\n${text}`,
  queries: (claim) => `Name the primary records that would settle this claim (court dockets, filings, contracts, official statements, original posts). Return only a JSON array of objects {"record": "...", "holder": "...", "query": "..."}. Claim: ${claim}`,
  summary: (md) => `Summarise this case dossier in under 200 words for an editor. Keep each claim at the rung given. Name no private individual. Dossier:\n\n${md}`,
};
