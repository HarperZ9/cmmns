// The readable report the CLI prints: each evidence item with what it shows, its source and what
// it does not prove, grouped by level. Plain text, no colour codes, so it pipes and reads aloud.

const LEVEL = { warn: "Worth a look", flag: "Signs that mean more together", info: "Context" };
const wrap = (text, indent, width = 96) => {
  const out = [];
  let line = "";
  for (const w of String(text).split(/\s+/)) {
    if (line && (indent + line + " " + w).length > width) { out.push(indent + line); line = w; } else line = line ? line + " " + w : w;
  }
  if (line) out.push(indent + line);
  return out.join("\n");
};

export function itemLines(e) {
  const where = e.posts.length ? ` (post${e.posts.length === 1 ? "" : "s"} ${e.posts.slice(0, 6).join(", ")}${e.posts.length > 6 ? `, and ${e.posts.length - 6} more` : ""})` : "";
  const spans = e.spans.filter((s) => s.text).slice(0, 3).map((s) => `"${s.text}"`).join(", ");
  return [
    `  ${e.id}  ${e.label}${where}`,
    wrap(e.shows, "      "),
    spans ? wrap(`Matched: ${spans}`, "      ") : null,
    wrap(`Source: ${e.source}`, "      "),
    wrap(`Does not prove: ${e.doesNotProve}`, "      "),
  ].filter(Boolean);
}

export function readable(result, notes = []) {
  const L = [];
  const head = result.kind === "thread" ? `Thread${result.site ? ` on ${result.site}` : ""}: ${result.posts.n} posts from ${result.posts.accounts} accounts.`
    : result.kind === "media" ? `File: Content Credentials ${result.media.state}${result.media.ai ? ", marked as made with AI" : ""}.`
    : result.kind === "site" ? `Site: ${result.site.domain}.` : "Text: one post.";
  L.push(head, ...notes.map((n) => "Note: " + n), "");
  for (const level of ["warn", "flag", "info"]) {
    const items = result.evidence.filter((e) => e.level === level);
    if (!items.length) continue;
    L.push(`${LEVEL[level]} (${items.length})`);
    for (const e of items) L.push(...itemLines(e), "");
  }
  if (!result.evidence.length) L.push("Nothing stands out in this input.", "");
  L.push("What this does not prove:", ...result.limits.map((t) => wrap(t, "  ")));
  return L.join("\n") + "\n";
}

export function verdictLines(file, v) {
  const L = [`${v.ok ? "Checks pass" : "Checks fail"}: ${file}`, `Key id: ${v.keyId || "none"}`];
  for (const c of v.checks) L.push(`  ${c.ok ? "pass" : "FAIL"}  ${c.name}: ${c.text}`);
  return L.join("\n") + "\n";
}
