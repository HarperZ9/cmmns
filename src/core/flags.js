// Authenticity flags for one account, each with its evidence and what it does not prove.
// A flag is a reason to look closer, never a verdict. The thresholds are starting points to be
// calibrated against the hand-labelled threads (project-docs/EVALUATION.md).

export const NEW_ACCOUNT_DAYS = 30;
export const MANY_NAME_CHANGES = 3;
// X suggests handles like "Name12345678" at sign-up; many throwaway accounts keep them.
export const DEFAULT_HANDLE = /^[A-Za-z]+_?[0-9]{6,}$/;

const DAY = 86400000;
// Self-chosen names that carry documented hate symbols (ADL Hate Symbols database).
const HATE_NAME = /(?:^|[^\d])(?:1488|14\/88)(?:$|[^\d])|\b(?:aryan|foid|foids|sieg ?heil|groyper|groypers)\b/i;

export const DOES_NOT_PROVE = {
  "new-account": "New accounts include real people who just joined, often during a news event.",
  "name-changes": "People rename accounts for many reasons; repeated renames are only common among resold or repurposed accounts.",
  "default-handle": "Many real people never change the handle X suggested.",
  "based-elsewhere": "The label can be wrong (VPNs, travel, X's own errors), and people abroad still speak as locals of where they come from.",
  "hate-symbol-name": "The account chose this name; it can be ironic or quoted, and it says nothing about who runs the account.",
  "same-text": "People copy and share text they agree with; identical replies show coordination or copying, not who wrote them.",
};

export function ageDays(joinDate, now = Date.now()) {
  const t = joinDate instanceof Date ? joinDate.getTime() : Date.parse(joinDate);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / DAY)) : null;
}

// account: { handle, joinDate, nameChanges, basedIn }
// context: { mismatch: result of compare(), cluster: { size } | null, now }
export function flagsFor(account, context = {}) {
  const out = [];
  const age = ageDays(account.joinDate, context.now);
  if (age != null && age < NEW_ACCOUNT_DAYS) out.push({ id: "new-account", evidence: `account is ${age} day${age === 1 ? "" : "s"} old` });
  if (Number.isFinite(account.nameChanges) && account.nameChanges >= MANY_NAME_CHANGES) out.push({ id: "name-changes", evidence: `username changed ${account.nameChanges} times` });
  const name = `${account.display || ""} ${account.handle || ""}`;
  const sym = HATE_NAME.exec(name);
  if (sym) out.push({ id: "hate-symbol-name", evidence: `name contains "${sym[0].trim()}", a documented hate symbol or slur` });
  if (account.handle && DEFAULT_HANDLE.test(account.handle)) out.push({ id: "default-handle", evidence: `handle @${account.handle} has the sign-up pattern` });
  if (context.mismatch && context.mismatch.status === "mismatch") out.push({ id: "based-elsewhere", evidence: context.mismatch.reason });
  if (context.cluster && context.cluster.size >= 2) {
    const others = (context.cluster.authors || []).filter((a) => a !== account.handle).map((a) => "@" + a);
    const list = others.length ? `: ${others.slice(0, 8).join(", ")}${others.length > 8 ? ` and ${others.length - 8} more` : ""}` : "";
    out.push({ id: "same-text", evidence: `same text as ${context.cluster.size - 1} other repl${context.cluster.size === 2 ? "y" : "ies"} in this thread${list}` });
  }
  return out.map((f) => ({ ...f, doesNotProve: DOES_NOT_PROVE[f.id] }));
}

// An account counts as "flagged" for the thread report when it has at least one authenticity
// flag. The weak default-handle signal does not count, and neither does a hate symbol in the name:
// that is about what the account says, and counting it would make the report circular.
const NOT_AUTHENTICITY = new Set(["default-handle", "hate-symbol-name"]);
export function isFlagged(flags) {
  return flags.some((f) => !NOT_AUTHENTICITY.has(f.id));
}
