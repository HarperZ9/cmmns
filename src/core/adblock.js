// The per-site part of ad blocking (src/ext/adblock-bg.js): which site a page belongs to, whether
// the user allowed ads there, and the allow list after a toggle. A site is its host name without
// "www."; allowing a site also allows its subdomains, as the browser's requestDomains matching does.

export function adblockSite(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol) || !u.hostname) return null;
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch { return null; }
}

export const adblockAllowed = (list, site) => !!site && (list || []).some((h) => site === h || site.endsWith("." + h));

// The allow list with `site` added (allow true) or removed with any parent entry that covers it.
export function adblockToggle(list, site, allow) {
  const cur = [...new Set(list || [])];
  if (!site) return cur;
  if (allow) return adblockAllowed(cur, site) ? cur : [...cur, site].sort();
  return cur.filter((h) => !(site === h || site.endsWith("." + h)));
}
