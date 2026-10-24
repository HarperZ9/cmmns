// Merges "||host^" filters that share every other field into rules that list the hosts in requestDomains.
const HOST_ONLY_RE = /^\|\|([a-z0-9.-]+)\^$/;

// Hosts per merged rule. Keeps each rule a reasonable size while costing only a few rule slots.
export const HOSTS_PER_RULE = 1000;

// Returns the host of a "||host^" urlFilter, or null.
export function hostOf(urlFilter) {
  const m = HOST_ONLY_RE.exec(urlFilter || "");
  return m ? m[1] : null;
}

// Drops hosts already covered by a listed parent domain, since requestDomains matches subdomains too.
export function pruneSubdomains(hosts) {
  const set = new Set(hosts);
  const covered = (h) => {
    for (let i = h.indexOf("."); i >= 0; i = h.indexOf(".", i + 1)) {
      if (set.has(h.slice(i + 1))) return true;
    }
    return false;
  };
  return [...set].filter((h) => !covered(h)).sort();
}

// Groups host-only candidates by everything except the host, keeping the first member's position.
function groupHosts(candidates) {
  const groups = new Map();
  const order = [];
  for (const c of candidates) {
    const host = hostOf(c.rule.condition.urlFilter);
    if (!host) {
      order.push(c);
      continue;
    }
    const { urlFilter, isUrlFilterCaseSensitive, ...rest } = c.rule.condition;
    const key = JSON.stringify([c.rule.priority, c.rule.action, rest]);
    if (!groups.has(key)) {
      const group = { key, tier: c.tier, rule: c.rule, rest, hosts: [] };
      groups.set(key, group);
      order.push(group);
    }
    groups.get(key).hosts.push(host);
  }
  return order;
}

// Builds the merged rules for one group, split into chunks of HOSTS_PER_RULE hosts.
function groupRules(group, perRule) {
  const hosts = pruneSubdomains(group.hosts);
  const out = [];
  for (let i = 0; i < hosts.length; i += perRule) {
    const condition = { requestDomains: hosts.slice(i, i + perRule), ...group.rest };
    out.push({ tier: group.tier, rule: { priority: group.rule.priority, action: group.rule.action, condition } });
  }
  return out;
}

// Replaces host-only candidates with merged ones. Returns the new list and how many filters it absorbed.
export function mergeHostRules(candidates, perRule = HOSTS_PER_RULE) {
  const merged = [];
  let absorbed = 0;
  let pruned = 0;
  for (const item of groupHosts(candidates)) {
    if (!item.hosts) {
      merged.push(item);
      continue;
    }
    const rules = groupRules(item, perRule);
    absorbed += item.hosts.length;
    pruned += item.hosts.length - rules.reduce((n, r) => n + r.rule.condition.requestDomains.length, 0);
    merged.push(...rules);
  }
  return { candidates: merged, absorbed, pruned };
}
